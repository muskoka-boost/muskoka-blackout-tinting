/* Muskoka Blackout Tinting: instant tint estimator
 * Prices are rough CAD ranges for standard film (before HST), set slightly
 * under typical Simcoe/Muskoka shop pricing. Edit PRICING to adjust.
 */
(() => {
  const SHADES = [70, 50, 35, 20, 5];
  const BUNDLE_MIN = 3;        // this many side/back windows (or more) get the package discount
  const BUNDLE_OFF = 0.15;     // 15% off for packages

  // body = counts toward package discount
  const PRICING = {
    car: {
      label: 'Car',
      windows: [
        { id: 'front', name: 'Front doors (pair)', note: 'Driver & passenger', lo: 130, hi: 160, body: true, def: 35 },
        { id: 'rear',  name: 'Rear doors (pair)',  note: 'Back seat windows',  lo: 100, hi: 120, body: true, def: 20 },
        { id: 'back',  name: 'Rear windshield',    note: 'Back glass',          lo: 80,  hi: 100, body: true, def: 20 },
        { id: 'wind',  name: 'Front windshield',   note: 'Clear/light film',    lo: 150, hi: 200, def: 70 },
        { id: 'strip', name: 'Windshield brow strip', note: 'Top sun strip',    lo: 40,  hi: 50,  def: 5 }
      ]
    },
    truck: {
      label: 'Truck',
      windows: [
        { id: 'front', name: 'Front doors (pair)', note: 'Driver & passenger', lo: 130, hi: 160, body: true, def: 35 },
        { id: 'rear',  name: 'Rear doors (pair)',  note: 'Extended / crew cab', lo: 90,  hi: 120, body: true, def: 20 },
        { id: 'back',  name: 'Back glass / slider', note: 'Rear cab window',    lo: 70,  hi: 90,  body: true, def: 20 },
        { id: 'wind',  name: 'Front windshield',   note: 'Clear/light film',    lo: 160, hi: 210, def: 70 },
        { id: 'strip', name: 'Windshield brow strip', note: 'Top sun strip',    lo: 40,  hi: 50,  def: 5 }
      ]
    },
    suv: {
      label: 'SUV / Van',
      windows: [
        { id: 'front',   name: 'Front doors (pair)',   note: 'Driver & passenger', lo: 130, hi: 160, body: true, def: 35 },
        { id: 'rear',    name: 'Rear doors (pair)',    note: 'Second row',         lo: 100, hi: 130, body: true, def: 20 },
        { id: 'quarter', name: 'Rear quarter windows', note: 'Cargo area sides',   lo: 60,  hi: 80,  body: true, def: 20 },
        { id: 'back',    name: 'Rear hatch glass',     note: 'Liftgate / back doors', lo: 90, hi: 110, body: true, def: 20 },
        { id: 'wind',    name: 'Front windshield',     note: 'Clear/light film',   lo: 170, hi: 220, def: 70 },
        { id: 'strip',   name: 'Windshield brow strip', note: 'Top sun strip',     lo: 45,  hi: 55,  def: 5 }
      ]
    }
  };

  // Side-view diagrams (viewBox 0 0 600 210). Panes are keyed by window id.
  const DIAGRAMS = {
    car: {
      body: 'M30,158 C30,140 38,128 70,124 L176,116 C200,94 224,74 252,66 C278,60 360,60 386,66 C412,74 440,98 464,114 L540,122 C564,126 572,138 572,152 L572,162 C572,167 567,170 561,170 L41,170 C34,170 30,166 30,158 Z',
      trim: 'M70,132 L560,132 M322,116 L322,166 M412,116 L404,160 M214,116 L210,162',
      lights: [['M548,128 L570,132 L570,140 L546,136 Z', '#cfe9ff'], ['M32,132 L46,130 L46,140 L32,142 Z', '#ff4d5e']],
      wheels: [140, 470], wy: 168, wr: 31,
      panes: {
        wind:  'M186,113 L246,72 L260,70 L210,113 Z',
        strip: 'M236,79 L246,72 L260,70 L250,79 Z',
        front: 'M216,113 L264,70 L318,67 L318,113 Z',
        rear:  'M328,113 L328,67 L378,67 L398,80 L410,113 Z',
        back:  'M420,113 L398,74 L408,71 L454,113 Z'
      }
    },
    truck: {
      body: 'M28,164 L28,104 L262,100 L268,54 C270,47 276,44 285,44 L410,44 C420,44 428,48 434,56 L468,100 L548,106 C566,108 574,118 574,134 L574,160 C574,166 570,170 562,170 L36,170 C30,170 28,168 28,164 Z',
      trim: 'M36,112 L262,110 M262,100 L262,166 M270,112 L566,116 M356,100 L356,166 M448,100 L444,160',
      lights: [['M552,114 L572,118 L572,128 L550,126 Z', '#cfe9ff'], ['M29,110 L40,110 L40,126 L29,126 Z', '#ff4d5e']],
      wheels: [130, 470], wy: 168, wr: 33,
      panes: {
        back:  'M272,97 L276,54 L288,51 L286,97 Z',
        rear:  'M296,97 L296,52 L350,52 L350,97 Z',
        front: 'M362,97 L362,52 L406,52 L418,59 L444,97 Z',
        wind:  'M452,97 L424,58 L434,53 L466,97 Z',
        strip: 'M428,64 L424,58 L434,53 L438,59 Z'
      }
    },
    suv: {
      body: 'M30,160 C30,118 32,66 44,56 C48,52 56,50 66,50 L392,48 C408,48 418,52 428,62 L470,104 L546,112 C566,116 574,128 574,144 L574,160 C574,166 570,170 562,170 L40,170 C34,170 30,166 30,160 Z',
      trim: 'M38,116 L566,120 M156,106 L156,166 M266,106 L266,166 M440,106 L436,160',
      lights: [['M550,120 L572,124 L572,134 L548,130 Z', '#cfe9ff'], ['M31,112 L44,112 L44,128 L31,128 Z', '#ff4d5e']],
      wheels: [135, 470], wy: 168, wr: 32,
      panes: {
        back:    'M41,104 L43,66 L52,58 L55,104 Z',
        quarter: 'M64,104 L64,58 L146,57 L146,104 Z',
        rear:    'M156,104 L156,57 L256,56 L256,104 Z',
        front:   'M266,104 L266,56 L380,55 L398,62 L434,104 Z',
        wind:    'M442,104 L404,60 L414,56 L456,104 Z',
        strip:   'M408,66 L404,60 L414,56 L418,63 Z'
      }
    }
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const section = $('#estimate');
  if (!section) return;
  const panel = $('#estPanel');
  const svg = $('#estSvg');
  const list = $('#estList');
  const priceEl = $('#estPrice');
  const noteEl = $('#estNote');
  const NS = 'http://www.w3.org/2000/svg';
  const shadeName = (v) => v <= 10 ? 'Limo' : v <= 25 ? 'Dark' : v <= 40 ? 'Medium' : v <= 55 ? 'Light' : 'Very light';
  const round5 = (n) => Math.round(n / 5) * 5;
  const money = (n) => '$' + n.toLocaleString('en-CA');

  let type = null;
  let state = {}; // id -> { on, vlt }

  // ---- optional 3D viewer (falls back to the SVG diagram) ----
  const host3d = $('#est3d');
  const stage = $('.est__stage', section);
  const hint = $('#estHint');
  let viewer = null, viewerPromise = null, paint = '#e9edf2';
  const webgl = (() => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } })();
  function ensureViewer() {
    if (!webgl || !host3d || !HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) return Promise.reject(new Error('no 3d'));
    if (!viewerPromise) {
      viewerPromise = import('./vehicle3d.js?v=2').then((mod) => {
        viewer = mod.createViewer(host3d, { onToggle: (id) => { if (state[id]) toggle(id); } });
        window.__mbtViewer = viewer;
        viewer.setPaint(paint);
        return viewer;
      });
    }
    return viewerPromise;
  }
  function show3d(t) {
    stage.classList.add('is-loading');
    ensureViewer().then((v) => v.load(t)).then(() => {
      if (t !== type) return;
      stage.classList.remove('is-loading');
      stage.classList.add('is-3d');
      hint.textContent = 'Drag to spin the vehicle. Tap a window to tint it.';
      viewer.setState(state);
    }).catch((err) => {
      console.warn('3D viewer unavailable, using diagram', err);
      stage.classList.remove('is-loading', 'is-3d');
      hint.textContent = 'Tap a window on the diagram or use the list.';
    });
  }
  $$('[data-paint]', section).forEach((b) => b.addEventListener('click', () => {
    paint = b.dataset.paint;
    $$('[data-paint]', section).forEach((x) => x.classList.toggle('is-active', x === b));
    if (viewer) viewer.setPaint(paint);
  }));

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  function drawDiagram() {
    const d = DIAGRAMS[type];
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const bg = el('linearGradient', { id: 'bodyGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#eef2f6' }, bg);
    el('stop', { offset: '.5', 'stop-color': '#b9c2ce' }, bg);
    el('stop', { offset: '1', 'stop-color': '#6d7787' }, bg);
    const gl = el('linearGradient', { id: 'glassGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#e9f5ff' }, gl);
    el('stop', { offset: '.5', 'stop-color': '#a8cdea' }, gl);
    el('stop', { offset: '1', 'stop-color': '#6f97b8' }, gl);
    const gg = el('radialGradient', { id: 'groundGrad', cx: '.5', cy: '.5', r: '.5' }, defs);
    el('stop', { offset: '0', 'stop-color': 'rgba(47,164,255,.35)' }, gg);
    el('stop', { offset: '1', 'stop-color': 'rgba(47,164,255,0)' }, gg);
    el('ellipse', { class: 'ground', cx: 300, cy: 196, rx: 290, ry: 12 }, svg);
    el('path', { class: 'body', d: d.body }, svg);
    el('path', { class: 'trim', d: d.trim }, svg);
    d.lights.forEach(([p, c]) => el('path', { d: p, fill: c, opacity: .85 }, svg));
    const cfg = PRICING[type].windows;
    cfg.forEach((w) => {
      const p = d.panes[w.id];
      if (!p) return;
      el('path', { d: p, class: 'glass' }, svg);
      const pane = el('path', { d: p, class: 'pane' + (w.id === 'strip' ? ' strip' : ''), 'data-id': w.id, tabindex: 0, role: 'button', 'aria-label': w.name }, svg);
      const t = el('title', {}, pane); t.textContent = w.name;
      pane.addEventListener('click', () => toggle(w.id));
      pane.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(w.id); } });
    });
    d.wheels.forEach((cx) => {
      el('circle', { cx, cy: d.wy, r: d.wr + 7, fill: '#070a11' }, svg);
      el('circle', { class: 'wheel', cx, cy: d.wy, r: d.wr }, svg);
      el('circle', { class: 'rim', cx, cy: d.wy, r: d.wr * 0.55 }, svg);
      el('circle', { cx, cy: d.wy, r: 4, fill: '#6cc6ff' }, svg);
    });
  }

  function drawList() {
    list.innerHTML = '';
    PRICING[type].windows.forEach((w) => {
      const li = document.createElement('li');
      li.className = 'est__row';
      li.dataset.id = w.id;
      const cid = 'est-' + w.id;
      li.innerHTML =
        `<input type="checkbox" class="est__check" id="${cid}">` +
        `<label class="est__name" for="${cid}"><b>${w.name}</b><small>${w.note} · ${money(w.lo)}–${money(w.hi)}</small></label>` +
        `<select class="est__shade" aria-label="Shade for ${w.name}">${SHADES.map(s => `<option value="${s}">${s}% ${shadeName(s)}</option>`).join('')}</select>`;
      $('input', li).addEventListener('change', (e) => { state[w.id].on = e.target.checked; render(); });
      $('select', li).addEventListener('change', (e) => { state[w.id].vlt = Number(e.target.value); state[w.id].on = true; render(); });
      list.appendChild(li);
    });
  }

  function toggle(id) { state[id].on = !state[id].on; render(); }

  function render() {
    const cfg = PRICING[type].windows;
    let lo = 0, hi = 0, bodyCount = 0, bodyLo = 0, bodyHi = 0, count = 0;
    cfg.forEach((w) => {
      const s = state[w.id];
      const row = $(`.est__row[data-id="${w.id}"]`, list);
      row.classList.toggle('on', s.on);
      $('input', row).checked = s.on;
      const sel = $('select', row);
      sel.value = String(s.vlt);
      sel.disabled = !s.on;
      const pane = $(`.pane[data-id="${w.id}"]`, svg);
      if (pane) {
        pane.classList.toggle('on', s.on);
        pane.setAttribute('aria-pressed', String(s.on));
        pane.style.fillOpacity = s.on ? (0.18 + (100 - s.vlt) / 100 * 0.8).toFixed(2) : '0';
      }
      if (s.on) {
        count++;
        lo += w.lo; hi += w.hi;
        if (w.body) { bodyCount++; bodyLo += w.lo; bodyHi += w.hi; }
      }
    });
    if (viewer) viewer.setState(state);
    let discount = false;
    if (bodyCount >= BUNDLE_MIN) {
      lo -= bodyLo * BUNDLE_OFF; hi -= bodyHi * BUNDLE_OFF; discount = true;
    }
    if (!count) {
      priceEl.textContent = '$0';
      noteEl.textContent = 'Pick at least one window to see a price.';
    } else {
      priceEl.textContent = `${money(round5(lo))} – ${money(round5(hi))}`;
      noteEl.textContent = discount
        ? `${count} item${count > 1 ? 's' : ''} selected. Package savings applied.`
        : `${count} item${count > 1 ? 's' : ''} selected. Add ${BUNDLE_MIN - bodyCount} more side or back window${BUNDLE_MIN - bodyCount > 1 ? 's' : ''} for package savings.`;
    }
  }

  function setType(t, scroll) {
    type = t;
    state = {};
    PRICING[t].windows.forEach((w) => { state[w.id] = { on: !!w.body, vlt: w.def }; });
    $$('.est__type', section).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === t)));
    panel.hidden = false;
    drawDiagram();
    drawList();
    render();
    show3d(t);
    if (scroll) section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  $$('.est__type', section).forEach((b) => b.addEventListener('click', () => {
    setType(b.dataset.type, false);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));

  // service cards -> estimator
  $$('.card[data-vehicle]').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    setType(card.dataset.vehicle, true);
  }));

  $$('[data-all]', section).forEach((b) => b.addEventListener('click', () => {
    const v = Number(b.dataset.all);
    Object.entries(state).forEach(([id, s]) => { if (s.on && id !== 'strip') s.vlt = v; });
    render();
  }));
  $$('[data-preset]', section).forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.preset;
    PRICING[type].windows.forEach((w) => {
      state[w.id].on = p === 'full' ? !!w.body : p === 'front' ? w.id === 'front' : false;
    });
    render();
  }));

  // send selection to the quote form
  $('#estSend').addEventListener('click', () => {
    const cfg = PRICING[type].windows.filter((w) => state[w.id].on);
    const form = $('#quoteForm');
    if (!form) return;
    const lines = cfg.map((w) => `- ${w.name}: ${state[w.id].vlt}% (${shadeName(state[w.id].vlt)})`);
    const summary = `Estimate builder (${PRICING[type].label}):\n${lines.length ? lines.join('\n') : '- No windows picked yet'}\nRough estimate shown: ${priceEl.textContent} + HST`;
    const msg = form.elements.message;
    msg.value = summary + (msg.value && !msg.value.startsWith('Estimate builder') ? '\n\n' + msg.value : '');
    const service = form.elements.service;
    const ids = cfg.map((w) => w.id);
    const bodyAll = PRICING[type].windows.filter((w) => w.body).every((w) => state[w.id].on);
    const onlyRearSet = ids.length && ids.every((i) => ['rear', 'back', 'quarter'].includes(i));
    service.value = bodyAll ? 'Full vehicle tint'
      : (ids.length === 1 && ids[0] === 'front') ? 'Front windows (match rear)'
      : onlyRearSet ? 'Rear & back glass'
      : 'Not sure yet, need advice';
    if (!form.elements.vehicle.value) form.elements.vehicle.placeholder = `Your ${PRICING[type].label.toLowerCase()}'s year, make & model`;
    $('#quote').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => form.elements.name.value ? form.elements.vehicle.focus({ preventScroll: true }) : form.elements.name.focus({ preventScroll: true }), 700);
  });
})();
