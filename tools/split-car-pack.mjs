import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, weld, flatten, join } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const PICK = { sedan: 'Sedan Body', pickup: 'Pickup Body', suv: 'SUV Body' };
const TEX = Number(process.env.TEX || 1024);
fs.mkdirSync('../out', { recursive: true });

for (const [slug, bodyName] of Object.entries(PICK)) {
  const doc = await io.read('../scene.gltf');
  const root = doc.getRoot();
  const rn = root.listNodes().find(n => n.getName() === 'RootNode');
  const body = rn.listChildren().find(n => n.getName() === bodyName);
  const bb = getBounds(body);
  const inside = (n) => { const b = getBounds(n); const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    return cx > bb.min[0] && cx < bb.max[0] && cz > bb.min[2] && cz < bb.max[2]; };
  const keep = rn.listChildren().filter(n => n === body || (/^Wheel/.test(n.getName()) && inside(n)));
  const wheels = keep.filter(n => n !== body);
  for (const c of rn.listChildren()) if (!keep.includes(c)) c.dispose();
  // orientation from wheel centres (PCA on XZ)
  const pts = wheels.map(w => { const b = getBounds(w); return [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2]; });
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, mz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0, szz = 0, sxz = 0; pts.forEach(([x, z]) => { sxx += (x - mx) ** 2; szz += (z - mz) ** 2; sxz += (x - mx) * (z - mz); });
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz); // long axis angle from +X
  console.log(slug, 'wheels', wheels.length, 'centre', mx.toFixed(2), mz.toFixed(2), 'axisDeg', (ang * 180 / Math.PI).toFixed(1));
  await doc.transform(flatten());
  // bake: translate to origin, rotate so long axis -> +Z
  const scene = root.listScenes()[0];
  const wrap = doc.createNode('vehicle');
  for (const n of scene.listChildren()) { scene.removeChild(n); }
  const all = root.listNodes().filter(n => n.getMesh());
  for (const n of all) { const p = n.getParent && n.getParent(); wrap.addChild(n); }
  scene.addChild(wrap);
  const rot = ang - Math.PI / 2; // rotate about Y
  const s = Math.sin(rot / 2), c = Math.cos(rot / 2);
  const pivot = doc.createNode('pivot').setRotation([0, s, 0, c]);
  const off = doc.createNode('offset').setTranslation([-mx, 0, -mz]);
  scene.removeChild(wrap); off.addChild(wrap); pivot.addChild(off); scene.addChild(pivot);
  // name meshes for the web app
  for (const n of root.listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const mat = m.listPrimitives()[0].getMaterial();
    const mn = mat ? mat.getName() : '';
    n.setName(/^Glass/.test(mn) ? 'glass' : /^Optics/.test(mn) ? 'optics' : /^Body/.test(mn) && n.getName().startsWith('Wheel') ? 'wheel' : /^Body/.test(mn) ? 'body' : 'wheel');
  }
  await doc.transform(prune());
  // make paint recolourable: paint pixels -> neutral light grey, paint mask stored in alpha
  for (const mat of root.listMaterials()) {
    if (!/^Body/.test(mat.getName())) continue;
    const tex = mat.getBaseColorTexture(); if (!tex) continue;
    const img = Buffer.from(tex.getImage());
    const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    let satCount = 0;
    const L = new Float32Array(n), Sat = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; Sat[i] = mx ? (mx - mn) / mx : 0;
      if (Sat[i] > 0.3 && mx > 40) satCount++;
    }
    const colourful = satCount / n > 0.08;
    const mask = new Uint8Array(n);
    let lo = 0, hi = 0;
    if (!colourful) {
      const hist = new Array(256).fill(0);
      for (let i = 0; i < n; i++) if (L[i] > 4) hist[Math.round(L[i])]++;
            const sm = (v) => { let s = 0; for (let k = -3; k <= 3; k++) s += hist[v + k] || 0; return s; };
      let mode = 5; for (let v = 6; v < 250; v++) if (sm(v) > sm(mode)) mode = v;
            lo = Math.max(4.5, mode * 0.6); hi = mode * 4.2;
    }
    const vals = [];
    for (let i = 0; i < n; i++) {
      const isPaint = colourful ? (Sat[i] > 0.28 && Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) > 30) : (L[i] >= lo && L[i] <= hi && Sat[i] < 0.3);
      if (isPaint) { mask[i] = 255; if (i % 7 === 0) vals.push(L[i]); }
    }
    vals.sort((a, b) => a - b);
    const med = vals[vals.length >> 1] || 1;
    const out = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      if (mask[i]) {
        const v = colourful ? Math.max(0, Math.min(255, Math.round((L[i] / med) * 205))) : 212;
        out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
      } else { out[i * 4] = data[i * 3]; out[i * 4 + 1] = data[i * 3 + 1]; out[i * 4 + 2] = data[i * 3 + 2]; }
      out[i * 4 + 3] = mask[i];
    }
    const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    tex.setImage(new Uint8Array(png)).setMimeType('image/png');
    mat.setName('paint');
    console.log('  paint', colourful ? 'by saturation' : `by luminance ${lo.toFixed(0)}-${hi.toFixed(0)}`, 'coverage', (vals.length * 7 / n * 100).toFixed(0) + '%', 'median', med.toFixed(0));
  }
  await doc.transform(
    prune(), dedup(), weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80, pattern: /Optics/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = `../out/${slug}.glb`;
  await io.write(out, doc);
  console.log('  ->', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB',
    'materials', root.listMaterials().map(m => m.getName()).join(','),
    'textures', root.listTextures().map(t => (t.getName()||t.getURI()) + ':' + (t.getImage().byteLength / 1024 | 0)).join(' / '));
}
