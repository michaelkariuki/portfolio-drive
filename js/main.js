import * as THREE from './vendor/three.module.min.js';
const $ = s => document.querySelector(s);
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

/* ---------- theme ---------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
const isNight = () => { const t = root.getAttribute('data-theme'); return t ? t === 'dark' : mq.matches; };
try { const s = localStorage.getItem('drive-theme'); if (s === 'light' || s === 'dark') root.setAttribute('data-theme', s); } catch(e){}
const themeBtn = $('#themeBtn');
themeBtn.addEventListener('click', () => { const n = isNight() ? 'light' : 'dark'; root.setAttribute('data-theme', n); try { localStorage.setItem('drive-theme', n); } catch(e){} applyTheme(); });
mq.addEventListener('change', applyTheme);

/* ---------- state, HUD, panel ---------- */
const save = (() => { try { return JSON.parse(localStorage.getItem('drive-save') || '{}'); } catch(e){ return {}; } })();
const state = { coins: new Set(save.coins || []), quests: new Set(save.quests || []), started: false };
const persist = () => { try { localStorage.setItem('drive-save', JSON.stringify({ coins: [...state.coins], quests: [...state.quests] })); } catch(e){} };
const toastEl = $('#toast'); let toastT;
const toast = (m, ms) => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 2800); };
function syncHud(){ $('#tokenCount').textContent = `${state.coins.size}/10`; if (state.coins.size >= 10) state.quests.add('tokens');
  const lis = [...document.querySelectorAll('#qlist li')]; lis.forEach(li => li.classList.toggle('done', state.quests.has(li.dataset.q)));
  $('#qcount').textContent = `${lis.filter(l => l.classList.contains('done')).length}/${lis.length}`; }
function quest(id){ if (state.quests.has(id)) return; state.quests.add(id); persist(); syncHud();
  if ([...document.querySelectorAll('#qlist li')].every(l => l.classList.contains('done'))) setTimeout(() => toast('Road trip complete. You are thorough. Michael likes thorough.', 5000), 500); }
syncHud(); if (coarse) $('#quest').removeAttribute('open');
const FACTS = [...document.querySelectorAll('#factList li')].map(li => li.textContent);

const panel = $('#panel'), panelBody = $('#panelBody'), panelTitle = $('#panelTitle'); let panelOpen = false;
function drawCover(c){ const x = c.getContext('2d'), id = c.dataset.cover, W = c.width, H = c.height; let s = id.length * 31; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const P = { sanduku: ['#173a2a', '#2fa36b', '#ffc94d'], baraza: ['#1b2a44', '#5aa7e6', '#ffffff'], kilele: ['#2b1d12', '#e07a2f', '#9fd3f2'] }[id];
  x.fillStyle = P[0]; x.fillRect(0, 0, W, H); for (let i = 0; i < 22; i++){ x.fillStyle = r() < .7 ? P[1] : P[2]; x.globalAlpha = .5 + r() * .5; x.beginPath(); x.arc(r() * W, r() * H, 8 + r() * 40, 0, 7); x.fill(); }
  x.globalAlpha = 1; x.fillStyle = P[2]; x.fillRect(20, H - 46, 90, 12); x.fillStyle = P[1]; x.fillRect(20, H - 28, 140, 6); x.fillRect(20, H - 18, 100, 6); }
document.querySelectorAll('#site canvas.cover').forEach(drawCover);
function openPanel(id){ const sec = document.getElementById(id); if (!sec || panelOpen) return; panelTitle.textContent = sec.dataset.title || id; panelBody.innerHTML = sec.querySelector('.pb').innerHTML;
  panelBody.querySelectorAll('canvas.cover').forEach(drawCover); panel.classList.add('show'); panelOpen = true; $('#panelClose').focus(); panelBody.scrollTop = 0; }
function closePanel(){ if (!panelOpen) return; panel.classList.remove('show'); panelOpen = false; $('#gl').focus(); }
$('#panelClose').addEventListener('click', closePanel); panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });

/* ---------- renderer ---------- */
const canvas = $('#gl'); canvas.tabIndex = 0;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch(e) { $('#nogl').classList.add('show'); $('#intro').classList.add('hide'); throw e; }
let tier = coarse ? 1 : 0; const tiers = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 1024 }, { dpr: 1, shadow: 0 }];
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 260);
function applyTier(){ const t = tiers[tier]; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, t.dpr)); renderer.shadowMap.enabled = t.shadow > 0;
  if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
function resize(){ const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x6f9a4c, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.7); sun.position.set(40, 60, 20); sun.castShadow = true;
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; sun.shadow.camera.near = 10; sun.shadow.camera.far = 160; sun.shadow.bias = -0.0015;
scene.add(sun); scene.add(sun.target);
const ambient = new THREE.AmbientLight(0xffffff, 0.15); scene.add(ambient);

/* ---------- terrain ---------- */
let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
const lerp = (a, b, t) => a + (b - a) * t;
function vnoise(x, z){ const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v); }
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 7.3, z * 2.1 + 3.1) * 0.3 + vnoise(x * 4.3 + 11.7, z * 4.3 + 5.9) * 0.15;
const fall = (d, inner, outer) => d <= inner ? 1 : d >= outer ? 0 : (t => 1 - t * t * (3 - 2 * t))((d - inner) / (outer - inner));
const R = 58;
const ZONES = [
  { id: 'work',    name: 'STUDIO',      x: -30, z: -16, h: 1.4, color: 0xf3e2c2, roof: 0xd9503c, w: 8, d: 7, hh: 4.2 },
  { id: 'about',   name: 'LIBRARY',     x: 2,   z: -36, h: 1.8, color: 0xe8d6b0, roof: 0x4f78b8, w: 10, d: 7, hh: 4.6 },
  { id: 'skills',  name: 'WORKSHOP',    x: 32,  z: -14, h: 1.4, color: 0xd6dde2, roof: 0x5f7080, w: 8, d: 7, hh: 4.0 },
  { id: 'fun',     name: 'GARAGE',      x: -34, z: 18,  h: 1.0, color: 0x2e2e48, roof: 0xd04fd0, w: 8, d: 6, hh: 3.6 },
  { id: 'contact', name: 'POST OFFICE', x: 34,  z: 20,  h: 1.0, color: 0xf5e7c8, roof: 0xd9902f, w: 9, d: 7, hh: 4.2 },
  { id: 'board',   name: 'NOTICE BOARD', x: 4,  z: 4,   h: 1.2, board: true, w: 3, d: 0.6, hh: 2.4 },
];
const HUB = { x: 0, z: 8 }, SPAWN = { x: 0, z: 40, h: 0.7 };
const FLATS = [...ZONES.map(z => ({ x: z.x, z: z.z, r: 12, h: z.h })), { x: SPAWN.x, z: SPAWN.z, r: 12, h: SPAWN.h }, { x: HUB.x, z: HUB.z, r: 10, h: 1.2 }];
const ROADS = []; ZONES.forEach(z => ROADS.push([{ ...HUB, h: 1.2 }, { x: z.x, z: z.z + (z.board ? 0 : z.d / 2 + 4), h: z.h }])); ROADS.push([{ ...HUB, h: 1.2 }, { ...SPAWN }]);
function roadInfo(x, z){ let m = 1e9, rh = 0; for (const [a, b] of ROADS){ const abx = b.x - a.x, abz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  const d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t); if (d < m) { m = d; rh = a.h + (b.h - a.h) * t; } } return { d: m, h: rh }; }
const roadDist = (x, z) => roadInfo(x, z).d;
function height(x, z){
  const d = Math.hypot(x, z), mask = fall(d, R - 18, R + 8);
  let h = (fbm(x / 30 + 3, z / 30 + 5) - 0.30) * 9.5; h = h * mask - (1 - mask) * 5;
  for (const f of FLATS){ const dd = Math.hypot(x - f.x, z - f.z); if (dd < f.r) h += (f.h - h) * fall(dd, f.r - 6, f.r); }
  const r = roadInfo(x, z); if (r.d < 7) h += (r.h - h) * fall(r.d, 2.5, 7);   // roads are graded flat between the places they join
  return h;
}
const SIZE = 170, SEG = 136;
const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).toNonIndexed(); tg.rotateX(-Math.PI / 2);
{ const p = tg.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  tg.computeVertexNormals();
  for (let i = 0; i < p.count; i += 3){
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), d = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const ny = b.sub(a).cross(d.sub(a)).normalize().y;
    if (cy < -0.2) c.set(0xd9c48e); else if (cy < 0.45) c.set(0xf1dc9c); else if (roadDist(cx, cz) < 1.7) c.set(0xcdb894); else if (cy > 5.2) c.set(0x9aa3a8); else if (ny < 0.82) c.set(0x5faa47); else c.set(0x7ccd5a);
    const j = (hash(cx, cz) - 0.5) * 0.06; c.r += j; c.g += j; c.b += j;
    for (let k = 0; k < 3; k++){ col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true })); terrain.receiveShadow = true; terrain.castShadow = false; scene.add(terrain);

/* ---------- water ---------- */
const waterU = { uTime: { value: 0 }, uNight: { value: 0 }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) };
const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 420, 70, 70), new THREE.ShaderMaterial({ uniforms: waterU, transparent: true, fog: true,
  vertexShader: `uniform float uTime; varying float vW;
#include <fog_pars_vertex>
void main(){
  vec3 p = position;
  float w = sin(p.x*0.32 + uTime*1.2)*0.16 + sin(p.y*0.47 - uTime*0.9)*0.13 + sin((p.x+p.y)*0.18 + uTime*0.6)*0.12;
  p.z += w; vW = w;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `uniform float uNight; varying float vW;
#include <fog_pars_fragment>
void main(){
  vec3 deep = mix(vec3(0.16,0.52,0.86), vec3(0.03,0.10,0.24), uNight), shallow = mix(vec3(0.45,0.78,0.98), vec3(0.10,0.22,0.42), uNight);
  float f = smoothstep(-0.3, 0.35, vW); vec3 c = mix(deep, shallow, f);
  float foam = smoothstep(0.30, 0.40, vW); c = mix(c, vec3(1.0), foam * 0.35);
  gl_FragColor = vec4(c, 0.92);
#include <fog_fragment>
}` }));
water.rotation.x = -Math.PI / 2; water.position.y = -0.05; scene.add(water);

/* ---------- placement helpers ---------- */
const obstacles = []; // {x,z,r} circles and {x,z,hw,hd} boxes for car collisions
const flat = new THREE.MeshLambertMaterial({ flatShading: true });
const mat = (c, o) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const tooClose = (x, z, m) => FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r - 2 + m) || roadDist(x, z) < 3 + m;

/* trees */
const TREES = 260, treeMat = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
const canopy = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 3.8, 6), mat(0x4f9a3c), TREES), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 1.5, 5), mat(0x7a4b25), TREES);
canopy.castShadow = trunk.castShadow = true; canopy.receiveShadow = true;
{ let n = 0, tries = 0; const c = new THREE.Color(); while (n < TREES && tries++ < 6000){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - 4), x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z);
    if (h < 0.7 || tooClose(x, z, 0)) continue; const s = 0.7 + rnd() * 0.8;
    q.setFromAxisAngle(v3.set(0, 1, 0), rnd() * 6.283);
    treeMat.compose(v3.set(x, h + 0.6 * s, z), q, sc3.set(s, s, s)); trunk.setMatrixAt(n, treeMat);
    treeMat.compose(v3.set(x, h + 1.2 * s + 1.9 * s, z), q, sc3.set(s, s, s)); canopy.setMatrixAt(n, treeMat);
    canopy.setColorAt(n, c.setHSL(0.29 + rnd() * 0.06, 0.55, 0.36 + rnd() * 0.1)); obstacles.push({ x, z, r: 0.55 * s }); n++; }
  canopy.count = trunk.count = n; }
scene.add(canopy, trunk);
/* rocks */
const ROCKS = 60, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9, 0), mat(0x98a2a8), ROCKS); rocks.castShadow = rocks.receiveShadow = true;
{ let n = 0, tries = 0; while (n < ROCKS && tries++ < 3000){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - 2), x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z);
    if (h < -0.3 || tooClose(x, z, -1)) continue; const s = 0.5 + rnd() * 1.1; q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
    treeMat.compose(v3.set(x, h + 0.3 * s, z), q, sc3.set(s, s * 0.7, s)); rocks.setMatrixAt(n, treeMat); obstacles.push({ x, z, r: 0.8 * s }); n++; } rocks.count = n; }
scene.add(rocks);
/* clouds */
const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 }), 42);
const cloudData = [];
for (let i = 0; i < 14; i++){ const cx = (rnd() - 0.5) * 220, cz = (rnd() - 0.5) * 220, cy = 24 + rnd() * 10, sp = 0.6 + rnd() * 0.8;
  for (let k = 0; k < 3; k++){ cloudData.push({ x: cx + (k - 1) * 3.2 * (0.7 + rnd() * 0.5), y: cy + (k === 1 ? 0.8 : 0), z: cz + (rnd() - 0.5) * 2, s: (k === 1 ? 4.2 : 3) * (0.8 + rnd() * 0.5), sp }); } }
scene.add(clouds);

/* buildings, pads, lamps */
const labelTex = (text) => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.font = '700 62px "Fredoka", "Nunito", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = 'rgba(29,43,51,.9)'; x.strokeText(text, 256, 66); x.fillStyle = '#fff'; x.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const windowMat = new THREE.MeshLambertMaterial({ color: 0x9ed3f2, emissive: 0xffd27a, emissiveIntensity: 0 });
const lamps = [], pads = [], labels = [];
const makeLabel = (text) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text), transparent: true, depthWrite: false })); s.scale.set(9, 2.25, 1); labels.push({ s, text }); return s; };
ZONES.forEach(z => {
  const g = new THREE.Group(); g.position.set(z.x, z.h, z.z); scene.add(g);
  if (z.board){
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 0.18), mat(0xc98f57)); b.position.y = 1.9; b.castShadow = true; g.add(b);
    for (const px of [-1.2, 1.2]){ const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), mat(0x7a4b25)); p.position.set(px, 1.1, 0); g.add(p); }
    [[-0.9, 0.2, 0xffffff], [0.2, 0.35, 0xffe7a0], [1.0, -0.1, 0xffffff]].forEach(([x, y, c]) => { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ color: c })); n.position.set(x, 1.9 + y, 0.1); g.add(n); });
    obstacles.push({ x: z.x, z: z.z, hw: 1.6, hd: 0.5 });
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(z.w, z.hh, z.d), mat(z.color)); body.position.y = z.hh / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(z.w, z.d) * 0.78, 2.6, 4), mat(z.roof)); roof.position.y = z.hh + 1.3; roof.rotation.y = Math.PI / 4; roof.scale.set(z.w / Math.max(z.w, z.d), 1, z.d / Math.max(z.w, z.d)); roof.castShadow = true; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.2), mat(0x6b3f1f)); door.position.set(0, 1.1, z.d / 2 + 0.05); g.add(door);
    for (const wx of [-z.w / 3.2, z.w / 3.2]){ const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.2), windowMat); w.position.set(wx, 2.3, z.d / 2 + 0.05); g.add(w); }
    obstacles.push({ x: z.x, z: z.z, hw: z.w / 2 + 0.3, hd: z.d / 2 + 0.3 });
  }
  const sp = makeLabel(z.name); sp.position.y = z.hh + (z.board ? 1.6 : 3.6); g.add(sp);
  // pad in front (toward the hub side)
  const px = z.x, pz = z.z + (z.board ? 3.2 : z.d / 2 + 4);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 40), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(px, height(px, pz) + 0.06, pz); scene.add(ring); pads.push({ id: z.id, x: px, z: pz, ring, inside: false });
  // lamp post beside the pad
  const lx = px + 4, lz = pz, lh = height(lx, lz);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), mat(0x3a3f44)); post.position.set(lx, lh + 1.6, lz); scene.add(post);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0 })); bulb.position.set(lx, lh + 3.3, lz); scene.add(bulb);
  const light = new THREE.PointLight(0xffcf7a, 0, 24, 1.6); light.position.set(lx, lh + 3.2, lz); scene.add(light); lamps.push({ light, bulb }); obstacles.push({ x: lx, z: lz, r: 0.3 });
});
/* dock + boat at spawn */
{ const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 14), mat(0x8b5a2b)); dock.position.set(SPAWN.x, 0.35, SPAWN.z + 12); dock.receiveShadow = true; scene.add(dock);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 5), mat(0x8b5a2b)); hull.position.set(SPAWN.x + 3.2, 0.25, SPAWN.z + 14); scene.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 5), mat(0x5a3a1a)); mast.position.set(SPAWN.x + 3.2, 2.5, SPAWN.z + 14); scene.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })); sail.position.set(SPAWN.x + 3.2 + 1.1, 3, SPAWN.z + 14); scene.add(sail);
  obstacles.push({ x: SPAWN.x + 3.2, z: SPAWN.z + 14, hw: 1.2, hd: 2.6 });
  const sign = makeLabel('DRIVE NORTH ↑'); sign.position.set(SPAWN.x - 5, SPAWN.h + 3.5, SPAWN.z - 4); scene.add(sign); }

/* coins */
const COINS = [[-14, 30], [-20, -2], [16, -28], [40, 2], [-40, 0], [14, 34], [22, 14], [-8, -20], [-22, 26], [8, -8]];
const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 18), new THREE.MeshLambertMaterial({ color: 0xffc94d, emissive: 0xffb300, emissiveIntensity: 0.35, flatShading: true }), COINS.length); coins.castShadow = true; scene.add(coins);
/* crates (pushable) */
const crateGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1), crateMat = mat(0xd9a15a);
const crates = [[-3, 14], [3, 16], [0, 18], [-2, 22], [2, 24], [6, 12], [-6, 10]].map(([x, z]) => { const m = new THREE.Mesh(crateGeo, crateMat); m.castShadow = m.receiveShadow = true; scene.add(m); return { m, x, z, vx: 0, vz: 0, rot: rnd() * 3, sunk: false }; });

/* ---------- car ---------- */
const car = new THREE.Group(); scene.add(car);
{ const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.7), mat(0xff6b57)); body.position.y = 0.55; body.castShadow = true; car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.3), mat(0x2a3a4a)); cabin.position.set(0, 1.02, -0.2); cabin.castShadow = true; car.add(cabin);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.3), mat(0x2a2a2a)); bumper.position.set(0, 0.4, 1.4); car.add(bumper);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 10); wheelGeo.rotateZ(Math.PI / 2);
  car.wheels = [[-0.8, 0.95], [0.8, 0.95], [-0.8, -0.95], [0.8, -0.95]].map(([x, z]) => { const w = new THREE.Mesh(wheelGeo, mat(0x1f2428)); w.position.set(x, 0.34, z); w.castShadow = true; car.add(w); return w; });
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 0.4 });
  for (const x of [-0.5, 0.5]){ const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.1), hl); l.position.set(x, 0.62, 1.37); car.add(l); const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.1), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 0.6 })); t.position.set(x, 0.62, -1.37); car.add(t); }
  car.head = new THREE.SpotLight(0xfff0c0, 0, 30, 0.6, 0.5, 1.2); car.head.position.set(0, 0.8, 1.2); car.head.target.position.set(0, 0, 12); car.add(car.head); car.add(car.head.target); }
const P = { x: SPAWN.x, z: SPAWN.z, y: SPAWN.h, heading: Math.PI, speed: 0, sinkT: 0 };
const input = { x: 0, y: 0 }, keys = {};
function resetCar(){ P.x = SPAWN.x; P.z = SPAWN.z; P.heading = Math.PI; P.speed = 0; P.sinkT = 0; car.position.set(P.x, SPAWN.h, P.z); }
resetCar();

/* ---------- input ---------- */
addEventListener('keydown', e => { const k = e.key.toLowerCase();
  if (k === 'escape') { closePanel(); return; }
  if (!state.started || panelOpen) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault();
  if (k === 'r') { resetCar(); toast('Back at the dock.'); } keys[k] = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const stick = $('#stick'), knob = $('#knob'), joy = { x: 0, y: 0, id: null };
stick.addEventListener('pointerdown', e => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveJoy(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);
function moveJoy(e){ const r = stick.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = Math.abs(dx) > .18 ? dx : 0; joy.y = Math.abs(dy) > .18 ? -dy : 0; knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`; }
$('#resetBtn').addEventListener('click', () => { resetCar(); toast('Back at the dock.'); });
$('#startBtn').addEventListener('click', () => { $('#intro').classList.add('hide'); state.started = true; canvas.focus(); if (!save.seen) toast('Drive north. Park on a glowing pad to open a building.', 4200);
  save.seen = true; try { localStorage.setItem('drive-save', JSON.stringify({ coins: [...state.coins], quests: [...state.quests], seen: true })); } catch(e){} });

/* ---------- theme application ---------- */
function applyTheme(){ const n = isNight(); themeBtn.textContent = n ? 'Day' : 'Night';
  scene.background = new THREE.Color(n ? 0x0c1a33 : 0x8fd3ff); scene.fog = new THREE.Fog(n ? 0x0c1a33 : 0x8fd3ff, n ? 28 : 70, n ? 120 : 190);
  hemi.color.set(n ? 0x2a3f6b : 0xbfe6ff); hemi.groundColor.set(n ? 0x0b1a12 : 0x6f9a4c); hemi.intensity = n ? 0.4 : 0.9;
  sun.color.set(n ? 0x8fb0ff : 0xfff2d0); sun.intensity = n ? 0.35 : 1.7; ambient.intensity = n ? 0.05 : 0.15;
  lamps.forEach(l => { l.light.intensity = n ? 14 : 0; l.bulb.material.emissiveIntensity = n ? 1.2 : 0; }); windowMat.emissiveIntensity = n ? 1 : 0; car.head.intensity = n ? 40 : 0; waterU.uNight.value = n ? 1 : 0;
  clouds.material.opacity = n ? 0.35 : 0.92; }
applyTheme();

/* ---------- physics + camera ---------- */
const camPos = new THREE.Vector3(SPAWN.x, 6, SPAWN.z + 10), camLook = new THREE.Vector3(), M = new THREE.Matrix4(), UP = new THREE.Vector3(), FWD = new THREE.Vector3(), RGT = new THREE.Vector3();
function normalAt(x, z){ const e = 0.7; return v3.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize().clone(); }
function collide(x, z, r){ let px = x, pz = z, hit = false;
  for (const o of obstacles){ if (o.r !== undefined){ const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz), m = o.r + r; if (d < m && d > 1e-4) { px = o.x + dx / d * m; pz = o.z + dz / d * m; hit = true; } }
    else { const cx = Math.max(o.x - o.hw, Math.min(px, o.x + o.hw)), cz = Math.max(o.z - o.hd, Math.min(pz, o.z + o.hd)); const dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
      if (d < r) { if (d > 1e-4) { px = cx + dx / d * r; pz = cz + dz / d * r; } else { px += r; } hit = true; } } }
  return { x: px, z: pz, hit }; }
function update(dt){
  const drive = state.started && !panelOpen && P.sinkT === 0;
  input.x = drive ? ((keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0) + joy.x) : 0;
  input.y = drive ? ((keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0) + joy.y) : 0;
  input.x = Math.max(-1, Math.min(1, input.x)); input.y = Math.max(-1, Math.min(1, input.y));
  // longitudinal
  const maxF = 17, maxR = 6;
  if (input.y > 0) P.speed += (P.speed < 0 ? 26 : 13) * input.y * dt; else if (input.y < 0) P.speed += (P.speed > 0 ? 24 : 9) * input.y * dt;
  P.speed -= P.speed * (input.y === 0 ? 1.6 : 0.35) * dt; P.speed = Math.max(-maxR, Math.min(maxF, P.speed));
  if (Math.abs(P.speed) < 0.05 && input.y === 0) P.speed = 0;
  // steering (tighter at low speed, looser at high speed)
  const sf = Math.min(1, Math.abs(P.speed) / 4) * (1 - Math.abs(P.speed) / (maxF * 2.2));
  P.heading -= input.x * 2.6 * sf * dt * Math.sign(P.speed || 1);
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
  let nx = P.x + fx * P.speed * dt, nz = P.z + fz * P.speed * dt;
  const c = collide(nx, nz, 1.05); if (c.hit) { P.speed *= 0.45; } nx = c.x; nz = c.z;
  // crates: push
  crates.forEach(cr => { if (cr.sunk) return; const dx = cr.x - nx, dz = cr.z - nz, d = Math.hypot(dx, dz); if (d < 1.75 && d > 1e-3) { const push = Math.max(2.5, Math.abs(P.speed) * 1.1); cr.vx += dx / d * push; cr.vz += dz / d * push; P.speed *= 0.9; nx -= dx / d * (1.75 - d) * 0.5; nz -= dz / d * (1.75 - d) * 0.5; } });
  P.x = nx; P.z = nz;
  // island boundary
  const dd = Math.hypot(P.x, P.z); if (dd > R + 14) { P.x *= (R + 14) / dd; P.z *= (R + 14) / dd; P.speed *= 0.5; }
  const h = height(P.x, P.z);
  if (h < -0.35 && P.sinkT === 0) { P.sinkT = 0.001; toast('Splash. Back to the dock in a moment.', 2200); }
  if (P.sinkT > 0) { P.sinkT += dt; P.speed *= 0.9; if (P.sinkT > 1.6) { resetCar(); return; } }
  P.y += ((P.sinkT > 0 ? h - P.sinkT * 1.5 : h) - P.y) * Math.min(1, dt * 12);
  car.position.set(P.x, P.y, P.z);
  UP.copy(normalAt(P.x, P.z)); FWD.set(fx, 0, fz); FWD.addScaledVector(UP, -FWD.dot(UP)).normalize(); RGT.crossVectors(UP, FWD).normalize();
  M.makeBasis(RGT, UP, FWD); car.quaternion.setFromRotationMatrix(M);
  car.wheels.forEach((w, i) => { w.rotation.x += P.speed * dt * 3; if (i < 2) w.rotation.y = -input.x * 0.45; });
  // crates integrate
  crates.forEach(cr => { if (cr.sunk) return; cr.x += cr.vx * dt; cr.z += cr.vz * dt; cr.vx *= Math.pow(0.08, dt); cr.vz *= Math.pow(0.08, dt);
    const cc = collide(cr.x, cr.z, 0.8); if (cc.hit) { cr.vx *= -0.3; cr.vz *= -0.3; } cr.x = cc.x; cr.z = cc.z; const ch = height(cr.x, cr.z);
    if (ch < -0.4) { cr.sunk = true; cr.m.visible = false; toast('A crate went for a swim.', 1800); return; }
    const sp = Math.hypot(cr.vx, cr.vz); cr.rot += sp * dt * 0.8; cr.m.position.set(cr.x, ch + 0.55 + Math.min(0.6, sp * 0.05), cr.z); cr.m.rotation.set(0, cr.rot, sp > 2 ? Math.sin(cr.rot * 3) * 0.2 : 0); });
  // pads
  pads.forEach(p => { const d = Math.hypot(P.x - p.x, P.z - p.z); p.ring.material.opacity = 0.55 + 0.35 * Math.sin(time * 4 + p.x);
    if (d < 3 && !p.inside && drive) { p.inside = true; P.speed *= 0.2; quest(p.id); openPanel(p.id); } else if (d > 4.5) p.inside = false; });
  // coins
  COINS.forEach((cp, i) => { const got = state.coins.has(i); const s = got ? 0 : 1; q.setFromAxisAngle(v3.set(0, 1, 0), time * 2 + i); treeMat.compose(new THREE.Vector3(cp[0], height(cp[0], cp[1]) + 1.1 + Math.sin(time * 3 + i) * 0.15, cp[1]), q, sc3.set(s, s, s)); coins.setMatrixAt(i, treeMat);
    if (!got && Math.hypot(P.x - cp[0], P.z - cp[1]) < 1.9) { state.coins.add(i); persist(); syncHud(); toast(`Coin ${state.coins.size}/10 · ${FACTS[i]}`, 4200); if (state.coins.size === 10) setTimeout(() => toast('All ten. The secret: the fastest way to a reply is telling Michael the deadline. Post Office is east.', 6000), 4300); } });
  coins.instanceMatrix.needsUpdate = true;
  // clouds drift
  cloudData.forEach((c, i) => { c.x += c.sp * dt; if (c.x > 130) c.x -= 260; treeMat.compose(v3.set(c.x, c.y, c.z), q.identity(), sc3.set(c.s, c.s * 0.45, c.s * 0.7)); clouds.setMatrixAt(i, treeMat); }); clouds.instanceMatrix.needsUpdate = true;
  // camera
  const back = 8.5 + Math.abs(P.speed) * 0.12; const tx = P.x - fx * back, tz = P.z - fz * back, ty = Math.max(P.y + 3.6, height(tx, tz) + 1.6);
  const k = 1 - Math.exp(-dt * 5); camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
  camera.position.copy(camPos); camLook.set(P.x + fx * 3, P.y + 1, P.z + fz * 3); camera.lookAt(camLook);
  sun.position.set(P.x + 40, 60, P.z + 20); sun.target.position.set(P.x, 0, P.z);
  $('#speed').textContent = Math.round(Math.abs(P.speed) * 6.5);
}

/* ---------- loop with frame-time governor ---------- */
let time = 0, last = performance.now(), ema = 16, hot = 0, cooldown = 0, gpuOk = true;
function frame(now){ requestAnimationFrame(frame); if (document.hidden) { last = now; return; }
  let dt = (now - last) / 1000; const ft = now - last; last = now; if (dt > 0.05) dt = 0.05; time += dt;
  ema = ema * 0.94 + Math.min(ft, 100) * 0.06; cooldown -= dt;
  if (cooldown <= 0 && ema > 26 && tier < tiers.length - 1) { if (++hot > 45) { tier++; hot = 0; cooldown = 3; applyTier(); } } else hot = 0;
  waterU.uTime.value = reduced ? 0 : time;
  update(dt); renderer.render(scene, camera); }
resize(); applyTier();
document.fonts.ready.then(() => { labels.forEach(l => { l.s.material.map.dispose(); l.s.material.map = labelTex(l.text); l.s.material.needsUpdate = true; }); requestAnimationFrame(frame); });
