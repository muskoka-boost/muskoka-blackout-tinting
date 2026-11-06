// Muskoka Blackout Tinting: 3D vehicle viewer for the estimator.
// Models: "Generic passenger car pack" by Comrade1280 (CC BY 4.0), split and compressed per vehicle.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = (type) => new URL(`../models/${type}.glb?v=1`, import.meta.url).href;
const FILE = { car: 'sedan', truck: 'pickup', suv: 'suv' };
// which side-window index (front→back) maps to which estimator id
const SIDE_MAP = {
  car: ['front', 'rear', 'rear'],
  truck: ['front', 'rear', 'rear'],
  suv: ['front', 'rear', 'quarter', 'quarter']
};

// which end of the long axis is the front (+1 = +axis), checked visually per model
const FRONT = { car: 1, truck: 1, suv: 1 };

const CLEAR = { color: new THREE.Color('#cfe4f5'), opacity: 0.2 };
const FILM = new THREE.Color('#04060b');
const HOVER = new THREE.Color('#2fa4ff');

export function createViewer(host, { onToggle, onReady } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'est__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#cfe9ff', '#0a0e17', 0.6));
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6cc6ff', 1.2);
  rim.position.set(-6, 3, -6);
  scene.add(rim);

  // soft blue floor glow
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const g2 = gc.getContext('2d');
  const grd = g2.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.55, 'rgba(10,40,80,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = grd; g2.fillRect(0, 0, 256, 256);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  let current = null;   // { root, panes: Map(id -> Mesh[]), paint: Material[] }
  let state = {};
  let hovered = null;
  let paintHex = '#d9dee6';

  function resize() {
    const w = host.clientWidth || 600;
    const h = Math.round(w * (w < 560 ? 0.72 : 0.56));
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  function islands(geom) {
    const idx = geom.index ? geom.index.array : [...Array(geom.attributes.position.count).keys()];
    const pos = geom.attributes.position, n = pos.count;
    const parent = new Int32Array(n).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const seen = new Map();
    for (let i = 0; i < n; i++) {
      const k = pos.getX(i).toFixed(4) + ',' + pos.getY(i).toFixed(4) + ',' + pos.getZ(i).toFixed(4);
      if (seen.has(k)) parent[find(i)] = find(seen.get(k)); else seen.set(k, i);
    }
    for (let t = 0; t < idx.length; t += 3) {
      const a = find(idx[t]); parent[find(idx[t + 1])] = a; parent[find(idx[t + 2])] = a;
    }
    const groups = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const r = find(idx[t]);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    return [...groups.values()];
  }

  function prepare(type, gltf) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    root.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
    root.updateMatrixWorld(true);

    const paint = [];
    let glassMesh = null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const name = (o.material && o.material.name) || '';
      if (/^Glass/i.test(name)) glassMesh = o;
      else if (name === 'paint') {
        const mat = o.material.clone();
        mat.color.set('#ffffff');
        mat.userData.uPaint = { value: new THREE.Color(paintHex) };
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uPaint = mat.userData.uPaint;
          sh.fragmentShader = 'uniform vec3 uPaint;\n' + sh.fragmentShader.replace('#include <map_fragment>',
            '#ifdef USE_MAP\n vec4 sdc = texture2D( map, vMapUv );\n diffuseColor.rgb *= mix( vec3(1.0), uPaint, sdc.a ) * sdc.rgb;\n#endif');
        };
        mat.customProgramCacheKey = () => 'mbt-paint';
        mat.metalness = Math.min(mat.metalness, 0.35);
        mat.roughness = Math.min(mat.roughness, 0.4);
        mat.envMapIntensity = 1.2;
        o.material = mat; paint.push(mat);
      }
    });

    // split glass into one mesh per pane
    const pieces = [];
    if (glassMesh) {
      const geom = glassMesh.geometry;
      for (const tri of islands(geom)) {
        const g = geom.clone();
        g.setIndex(tri);
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
          color: CLEAR.color.clone(), transparent: true, opacity: CLEAR.opacity, metalness: 0.2, roughness: 0.05,
          envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide
        }));
        m.renderOrder = 2;
        glassMesh.parent.add(m);
        m.position.copy(glassMesh.position); m.quaternion.copy(glassMesh.quaternion); m.scale.copy(glassMesh.scale);
        m.updateMatrixWorld(true);
        const c = new THREE.Vector3(), v = new THREE.Vector3(), pos = g.attributes.position;
        for (const i of tri) c.add(v.fromBufferAttribute(pos, i));
        c.divideScalar(tri.length).applyMatrix4(m.matrixWorld);
        pieces.push({ mesh: m, c, tris: tri.length / 3 });
      }
      glassMesh.visible = false;
    }

    // vehicle axes: long axis = larger of x/z extents
    const longX = size.x > size.z;
    const L = (v) => longX ? v.x : v.z;          // along length
    const S = (v) => longX ? v.z : v.x;          // across width
    const halfW = (longX ? size.z : size.x) / 2;
    const centreLine = pieces.filter(p => Math.abs(S(p.c)) < halfW * 0.35);
    const sides = pieces.filter(p => Math.abs(S(p.c)) >= halfW * 0.35);
    // windshield is the centre pane that is biggest (most triangles / most sloped) — pick by the end the side "front" panes sit nearest
    centreLine.sort((a, b) => L(b.c) - L(a.c));
    // decide which end is the front: front side windows are the ones closest to one centre pane with more triangles
    const ends = centreLine.length >= 2 ? [centreLine[0], centreLine[centreLine.length - 1]] : centreLine;
    let frontSign = FRONT[type] || 1;
    const panes = new Map();
    const add = (id, mesh) => { if (!panes.has(id)) panes.set(id, []); panes.get(id).push(mesh); mesh.userData.id = id; };
    if (ends.length === 2) {
      const front = frontSign > 0 ? ends[0] : ends[1];
      const back = frontSign > 0 ? ends[1] : ends[0];
      add('wind', front.mesh); add('back', back.mesh);
      centreLine.filter(p => p !== front && p !== back).forEach(p => add(L(p.c) * frontSign > 0 ? 'wind' : 'back', p.mesh));
    } else if (ends.length === 1) add('wind', ends[0].mesh);
    for (const sideSign of [1, -1]) {
      const row = sides.filter(p => Math.sign(S(p.c)) === sideSign).sort((a, b) => (L(b.c) - L(a.c)) * frontSign);
      row.forEach((p, i) => add((SIDE_MAP[type] || [])[i] || 'rear', p.mesh));
    }

    // camera framing: front 3/4 from the driver's side
    const len = Math.max(size.x, size.z);
    floor.scale.set(len * 1.6, len * 1.6, 1);
    const fwd = longX ? new THREE.Vector3(frontSign, 0, 0) : new THREE.Vector3(0, 0, frontSign);
    const side = longX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const target = new THREE.Vector3(0, size.y * 0.45, 0);
    const dist = len * 1.55;
    const camPos = target.clone().add(fwd.clone().multiplyScalar(dist * 0.55)).add(side.multiplyScalar(dist * 0.83)).add(new THREE.Vector3(0, size.y * 0.9, 0));
    window.__veh3d = window.__veh3d || {};
    window.__veh3d[type] = { longX, frontSign, halfW: +halfW.toFixed(2), panes: [...panes.entries()].map(([k, v]) => [k, v.length]), all: pieces.map(p => [+L(p.c).toFixed(2), +S(p.c).toFixed(2), +p.c.y.toFixed(2), p.tris, p.mesh.userData.id]) };
    return { root, panes, paint, target, camPos, len, frontSign };
  }

  async function load(type) {
    const file = FILE[type];
    let entry = cache.get(file);
    if (!entry) {
      const gltf = await loader.loadAsync(MODEL_URL(file));
      entry = prepare(type, gltf);
      cache.set(file, entry);
    }
    if (current && current.root.parent) scene.remove(current.root);
    current = entry;
    scene.add(entry.root);
    controls.target.copy(entry.target);
    camera.position.copy(entry.camPos);
    controls.minDistance = entry.len * 1.1;
    controls.maxDistance = entry.len * 3.2;
    controls.autoRotate = true;
    controls.update();
    setPaint(paintHex);
    apply();
    if (onReady) onReady(entry);
    return entry;
  }

  function apply() {
    if (!current) return;
    current.panes.forEach((meshes, id) => {
      const s = state[id];
      meshes.forEach((m) => {
        const on = s && s.on;
        const mat = m.material;
        if (on) {
          mat.color.copy(FILM);
          mat.opacity = 0.4 + (100 - s.vlt) / 100 * 0.58;
          mat.metalness = 0; mat.roughness = 0.2;
          mat.envMapIntensity = 0.35 + s.vlt / 100 * 0.6;
        } else {
          mat.color.copy(CLEAR.color);
          mat.opacity = CLEAR.opacity;
          mat.metalness = 0.1; mat.roughness = 0.05;
          mat.envMapIntensity = 1.2;
        }
        mat.emissive = mat.emissive || new THREE.Color(0);
        mat.emissive.copy(m === hovered ? HOVER : new THREE.Color(0));
        mat.emissiveIntensity = m === hovered ? 0.35 : 0;
      });
    });
  }

  function setState(next) { state = next; apply(); }
  function setPaint(hex) { paintHex = hex; if (current) current.paint.forEach((m) => m.userData.uPaint.value.set(hex)); }

  // picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  function pick(ev) {
    if (!current) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const meshes = [];
    current.panes.forEach((ms) => meshes.push(...ms));
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hit.object : null;
  }
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const m = pick(e);
    if (m && onToggle) onToggle(m.userData.id);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const m = pick(e);
    if (m !== hovered) { hovered = m; canvas.style.cursor = m ? 'pointer' : 'grab'; apply(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hovered) { hovered = null; apply(); } });

  // render loop only while visible
  let visible = true, raf = 0;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) loop(); }, { threshold: 0.05 });
  io.observe(canvas);
  function loop() {
    raf = 0;
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  function screenPoint(id) {
    if (!current || !current.panes.get(id)) return null;
    const m = current.panes.get(id)[0];
    const v = new THREE.Vector3(), c = new THREE.Vector3(), pos = m.geometry.attributes.position, idx = m.geometry.index.array;
    for (let i = 0; i < idx.length; i++) c.add(v.fromBufferAttribute(pos, idx[i]));
    c.divideScalar(idx.length).applyMatrix4(m.matrixWorld).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height };
  }
  return { load, setState, setPaint, canvas, screenPoint, stopSpin() { controls.autoRotate = false; }, resetView() { if (current) { camera.position.copy(current.camPos); controls.target.copy(current.target); controls.autoRotate = true; } } };
}
