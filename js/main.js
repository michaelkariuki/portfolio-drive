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
const persist = () => { try { localStorage.setItem('drive-save', JSON.stringify({ coins: [...state.coins], quests: [...state.quests], seen: true })); } catch(e){} };
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

/* ---------- sound (opt-in engine + blips) ---------- */
let audio = null, soundOn = false, engine = null; try { soundOn = localStorage.getItem('drive-sound') === 'on'; } catch(e){}
const soundBtn = $('#soundBtn'); const syncSound = () => { soundBtn.textContent = 'Sound: ' + (soundOn ? 'on' : 'off'); if (soundOn) startEngine(); else if (engine) { engine.gain.gain.value = 0; } };
soundBtn.addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('drive-sound', soundOn ? 'on' : 'off'); } catch(e){} syncSound(); blip(660, .06); });
function ctx(){ audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); return audio; }
function startEngine(){ try { const a = ctx(); if (!engine){ const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
  o.connect(f).connect(g).connect(a.destination); o.start(); engine = { o, g: g, gain: g }; } } catch(e){} }
function blip(freq, dur){ if (!soundOn) return; try { const a = ctx(), o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(.06, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur); } catch(e){} }
syncSound();

/* ---------- renderer ---------- */
const canvas = $('#gl'); canvas.tabIndex = 0;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch(e) { $('#nogl').classList.add('show'); $('#intro').classList.add('hide'); throw e; }
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
let tier = coarse ? 1 : 0; const tiers = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 1024 }, { dpr: 1, shadow: 0 }];
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 320);
function applyTier(){ const t = tiers[tier]; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, t.dpr)); renderer.shadowMap.enabled = t.shadow > 0;
  if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
function resize(){ const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x6f9a4c, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.7); sun.position.set(40, 60, 20); sun.castShadow = true;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.near = 10; sun.shadow.camera.far = 170; sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);
const ambient = new THREE.AmbientLight(0xffffff, 0.12); scene.add(ambient);
const SUN_DIR = new THREE.Vector3(0.5, 0.62, 0.3).normalize();

/* ---------- geometry helpers ---------- */
let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
const M4 = () => new THREE.Matrix4();
const mtx = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => M4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
// merge [geometry, colour, matrix] parts into one non-indexed, vertex-coloured geometry (one draw call per object)
function merge(parts){ const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, color, m] of parts){ const g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m); const p = g.attributes.position, n = g.attributes.normal; c.set(color);
    for (let i = 0; i < p.count; i++){ pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo; }
const vcMat = (o) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...o });
const mat = (c, o) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s), cone = (r, h, s) => new THREE.ConeGeometry(r, h, s);

/* ---------- world layout ---------- */
const R = 58;
const ZONES = [
  { id: 'work',    name: 'STUDIO',      x: -30, z: -16, h: 1.4, color: 0xf3e2c2, roof: 0xd9503c, w: 8, d: 7, hh: 4.2, chimney: true },
  { id: 'about',   name: 'LIBRARY',     x: 2,   z: -36, h: 1.8, color: 0xe8d6b0, roof: 0x4f78b8, w: 10, d: 7, hh: 4.6 },
  { id: 'skills',  name: 'WORKSHOP',    x: 32,  z: -14, h: 1.4, color: 0xd6dde2, roof: 0x5f7080, w: 8, d: 7, hh: 4.0, chimney: true },
  { id: 'fun',     name: 'GARAGE',      x: -34, z: 18,  h: 1.0, color: 0x2e2e48, roof: 0xd04fd0, w: 8, d: 6, hh: 3.6 },
  { id: 'contact', name: 'POST OFFICE', x: 34,  z: 20,  h: 1.0, color: 0xf5e7c8, roof: 0xd9902f, w: 9, d: 7, hh: 4.2 },
  { id: 'board',   name: 'NOTICE BOARD', x: 4,  z: 4,   h: 1.2, board: true, w: 3, d: 0.6, hh: 2.4 },
];
const HUB = { x: 0, z: 8, h: 1.2 }, SPAWN = { x: 0, z: 40, h: 0.7 }, PEAK = { x: -13, z: -6, h: 9 };
const RAMP = { x0: -1.9, x1: 1.9, z0: 22.5, z1: 28.5, rise: 2.3 };
const FLATS = [...ZONES.map(z => ({ x: z.x, z: z.z, r: 12, h: z.h })), { x: SPAWN.x, z: SPAWN.z, r: 12, h: SPAWN.h }, { ...HUB, r: 10 }];
const ROADS = []; ZONES.forEach(z => ROADS.push([HUB, { x: z.x, z: z.z + (z.board ? 0 : z.d / 2 + 4), h: z.h }])); ROADS.push([HUB, SPAWN]);
function roadInfo(x, z){ let m = 1e9, rh = 0; for (const [a, b] of ROADS){ const abx = b.x - a.x, abz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  const d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t); if (d < m) { m = d; rh = a.h + (b.h - a.h) * t; } } return { d: m, h: rh }; }
const roadDist = (x, z) => roadInfo(x, z).d;
function vnoise(x, z){ const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v); }
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 7.3, z * 2.1 + 3.1) * 0.3 + vnoise(x * 4.3 + 11.7, z * 4.3 + 5.9) * 0.15;
const fall = (d, inner, outer) => d <= inner ? 1 : d >= outer ? 0 : (t => 1 - t * t * (3 - 2 * t))((d - inner) / (outer - inner));
const onRamp = (x, z) => x > RAMP.x0 && x < RAMP.x1 && z > RAMP.z0 && z < RAMP.z1;
function height(x, z){
  const d = Math.hypot(x, z), mask = fall(d, R - 18, R + 8);
  let h = (fbm(x / 30 + 3, z / 30 + 5) - 0.30) * 9.5; h = h * mask - (1 - mask) * 5;
  h += PEAK.h * fall(Math.hypot(x - PEAK.x, z - PEAK.z), 0, 15) * (0.8 + 0.2 * fbm(x / 6, z / 6));
  for (const f of FLATS){ const dd = Math.hypot(x - f.x, z - f.z); if (dd < f.r) h += (f.h - h) * fall(dd, f.r - 6, f.r); }
  const r = roadInfo(x, z); if (r.d < 7) h += (r.h - h) * fall(r.d, 2.5, 7);
  if (onRamp(x, z)) h = Math.max(h, r.h + RAMP.rise * (RAMP.z1 - z) / (RAMP.z1 - RAMP.z0));
  return h;
}
const isSand = (x, z) => height(x, z) < 0.45 && !onRamp(x, z);

/* ---------- terrain (jittered, flat-shaded, vertex-coloured) ---------- */
const SIZE = 172, SEG = 150;
const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).toNonIndexed(); tg.rotateX(-Math.PI / 2);
{ const p = tg.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++){ const x0 = p.getX(i), z0 = p.getZ(i); const x = x0 + (hash(x0, z0) - 0.5) * 0.55, z = z0 + (hash(z0 + 9, x0) - 0.5) * 0.55; p.setXYZ(i, x, height(x, z), z); }
  tg.computeVertexNormals();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3){
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2); const ny = b.sub(a).cross(d.sub(a)).normalize().y;
    if (onRamp(cx, cz)) c.set(0xb98a55);
    else if (cy < -0.25) c.set(0xd2bc85); else if (cy < 0.45) c.set(0xf1dc9c); else if (roadDist(cx, cz) < 1.8) c.set(0xcdb894);
    else if (cy > 7.6) c.set(0xf4f6f8); else if (cy > 5.4 || ny < 0.6) c.set(0x9aa3a8); else if (ny < 0.85) c.set(0x5faa47); else c.set(cy > 3.2 ? 0x6fbe52 : 0x7ccd5a);
    const j = (hash(cx, cz) - 0.5) * 0.07; c.r += j; c.g += j; c.b += j;
    for (let k = 0; k < 3; k++){ col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; } }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
const terrain = new THREE.Mesh(tg, vcMat()); terrain.receiveShadow = true; scene.add(terrain);

/* ---------- water ---------- */
const waterU = { uTime: { value: 0 }, uNight: { value: 0 }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) };
const water = new THREE.Mesh(new THREE.PlaneGeometry(460, 460, 80, 80), new THREE.ShaderMaterial({ uniforms: waterU, transparent: true, fog: true,
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
  vec3 deep = mix(vec3(0.14,0.50,0.86), vec3(0.03,0.10,0.24), uNight), shallow = mix(vec3(0.45,0.80,0.98), vec3(0.10,0.22,0.42), uNight);
  float f = smoothstep(-0.3, 0.35, vW); vec3 c = mix(deep, shallow, f);
  float foam = smoothstep(0.30, 0.40, vW); c = mix(c, vec3(1.0), foam * 0.35);
  gl_FragColor = vec4(c, 0.92);
#include <fog_fragment>
}` }));
water.rotation.x = -Math.PI / 2; water.position.y = -0.05; scene.add(water);

/* ---------- nature ---------- */
const obstacles = [];
const tooClose = (x, z, m) => FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r - 2 + m) || roadDist(x, z) < 3.2 + m || (x > RAMP.x0 - 3 && x < RAMP.x1 + 3 && z > RAMP.z0 - 4 && z < RAMP.z1 + 4);
const pineGeo = merge([[cyl(0.16, 0.28, 1.6, 6), 0x7a4b25, mtx(0, 0.8, 0)], [cone(1.7, 2.0, 7), 0x3f8a3a, mtx(0, 2.2, 0)], [cone(1.35, 1.9, 7), 0x4a9a40, mtx(0, 3.4, 0)], [cone(0.95, 1.7, 7), 0x57a848, mtx(0, 4.55, 0)]]);
const roundGeo = merge([[cyl(0.2, 0.32, 1.9, 6), 0x7a4b25, mtx(0, 0.95, 0)], [new THREE.IcosahedronGeometry(1.5, 0), 0x4f9a3c, mtx(0, 2.9, 0)], [new THREE.IcosahedronGeometry(1.0, 0), 0x63b04a, mtx(0.7, 3.6, 0.4)], [new THREE.IcosahedronGeometry(0.9, 0), 0x5aa844, mtx(-0.7, 3.4, -0.5)]]);
const palmParts = []; for (let i = 0; i < 6; i++) palmParts.push([cyl(0.13, 0.18, 0.95, 5), 0x9a6b3a, mtx(i * i * 0.05, 0.45 + i * 0.85, 0, 0, 0, -i * 0.05)]);
for (let i = 0; i < 7; i++){ const a = i / 7 * Math.PI * 2; palmParts.push([box(2.4, 0.06, 0.55), i % 2 ? 0x4fa34a : 0x62b95a, mtx(1.5 + Math.cos(a) * 0.9, 5.45 - 0.35 * Math.abs(Math.sin(a * 1.3)), Math.sin(a) * 0.9, 0, -a, -0.45)]); }
palmParts.push([new THREE.IcosahedronGeometry(0.22, 0), 0xc98f57, mtx(1.5, 5.3, 0)]);
const palmGeo = merge(palmParts);
const SPECIES = [{ geo: pineGeo, n: 150, r: 0.5 }, { geo: roundGeo, n: 120, r: 0.5 }, { geo: palmGeo, n: 50, r: 0.35 }];
const q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), mm = M4(), tint = new THREE.Color();
SPECIES.forEach((sp, si) => { const im = new THREE.InstancedMesh(sp.geo, vcMat(), sp.n); im.castShadow = im.receiveShadow = true; let n = 0, tries = 0;
  while (n < sp.n && tries++ < 8000){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - 3), x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z);
    if (tooClose(x, z, 0)) continue;
    if (si === 2) { if (h < 0.2 || h > 1.3 || Math.hypot(x, z) < R - 22) continue; } else if (h < 0.7 || h > 6.2) continue; else if (si === 0 && h < 2.2 && rnd() < 0.5) continue;
    const s = 0.75 + rnd() * 0.7; q.setFromAxisAngle(v3.set(0, 1, 0), rnd() * 6.283); mm.compose(v3.set(x, h - 0.1, z), q, sc3.set(s, s * (0.9 + rnd() * 0.3), s)); im.setMatrixAt(n, mm);
    im.setColorAt(n, tint.setHSL(0, 0, 0.82 + rnd() * 0.3)); obstacles.push({ x, z, r: sp.r * s }); n++; }
  im.count = n; scene.add(im); });
/* bushes, grass tufts, flowers, rocks */
const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), mat(0xffffff), 140); bushes.castShadow = bushes.receiveShadow = true;
{ let n = 0, tries = 0; while (n < 140 && tries++ < 4000){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - 3), x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z); if (h < 0.5 || h > 5 || tooClose(x, z, -1.5)) continue;
    const s = 0.6 + rnd() * 0.8; mm.compose(v3.set(x, h + 0.2 * s, z), q.setFromAxisAngle(v3.set(0, 1, 0), rnd() * 6), sc3.set(s, s * 0.75, s)); bushes.setMatrixAt(n, mm); bushes.setColorAt(n, tint.setHSL(0.28 + rnd() * 0.08, 0.5, 0.35 + rnd() * 0.12)); n++; } bushes.count = n; scene.add(bushes); }
const tufts = new THREE.InstancedMesh(cone(0.22, 0.75, 3), mat(0xffffff), 1400);
{ let n = 0, tries = 0; while (n < 1400 && tries++ < 12000){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - 2), x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z); if (h < 0.5 || h > 5.2 || roadDist(x, z) < 2.2 || onRamp(x, z)) continue;
    const fl = rnd() < 0.14, s = fl ? 0.5 + rnd() * 0.3 : 0.7 + rnd() * 0.8; mm.compose(v3.set(x, h + 0.3 * s, z), q.setFromAxisAngle(v3.set(0, 1, 0), rnd() * 6), sc3.set(s, s, s)); tufts.setMatrixAt(n, mm);
    tufts.setColorAt(n, fl ? tint.setHSL(rnd() < 0.5 ? 0.13 : 0.92, 0.9, 0.62) : tint.setHSL(0.27, 0.55, 0.5 + rnd() * 0.15)); n++; } tufts.count = n; scene.add(tufts); }
const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9, 0), mat(0xffffff), 90); rocks.castShadow = rocks.receiveShadow = true;
{ let n = 0, tries = 0; while (n < 90 && tries++ < 5000){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - 2), x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z); if (h < -0.3 || tooClose(x, z, -1)) continue;
    const near = Math.hypot(x - PEAK.x, z - PEAK.z) < 16; if (!near && rnd() < 0.5) continue; const s = 0.5 + rnd() * (near ? 1.8 : 1.0);
    mm.compose(v3.set(x, h + 0.25 * s, z), q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), sc3.set(s, s * 0.7, s)); rocks.setMatrixAt(n, mm); rocks.setColorAt(n, tint.setHSL(0.58, 0.05, 0.5 + rnd() * 0.2)); obstacles.push({ x, z, r: 0.8 * s }); n++; } rocks.count = n; scene.add(rocks); }
/* clouds, birds, sun */
const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 }), 48);
const cloudData = []; for (let i = 0; i < 16; i++){ const cx = (rnd() - 0.5) * 240, cz = (rnd() - 0.5) * 240, cy = 26 + rnd() * 12, sp = 0.6 + rnd() * 0.8;
  for (let k = 0; k < 3; k++) cloudData.push({ x: cx + (k - 1) * 3.4 * (0.7 + rnd() * 0.5), y: cy + (k === 1 ? 0.9 : 0), z: cz + (rnd() - 0.5) * 2, s: (k === 1 ? 4.4 : 3.1) * (0.8 + rnd() * 0.5), sp }); }
scene.add(clouds);
const birds = new THREE.InstancedMesh(box(0.7, 0.04, 0.22), mat(0x2a3138), 16); scene.add(birds);
const birdData = []; for (let i = 0; i < 8; i++) birdData.push({ r: 22 + rnd() * 26, a: rnd() * 6.283, y: 16 + rnd() * 10, sp: (0.25 + rnd() * 0.2) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6 });
const sunTex = (inner, outer) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.35, inner); g.addColorStop(0.5, outer); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex('rgba(255,250,225,1)', 'rgba(255,215,120,.55)'), transparent: true, fog: false, depthWrite: false })); sunSprite.scale.set(60, 60, 1); scene.add(sunSprite);
const moonTexture = sunTex('rgba(235,240,255,1)', 'rgba(160,190,255,.35)'), sunTexture = sunSprite.material.map;

/* ---------- buildings, pads, lamps, dock ---------- */
const labelTex = (text) => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.font = '700 62px "Fredoka", "Nunito", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = 'rgba(29,43,51,.9)'; x.strokeText(text, 256, 66); x.fillStyle = '#fff'; x.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const labels = []; const makeLabel = (text) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text), transparent: true, depthWrite: false })); s.scale.set(9, 2.25, 1); labels.push({ s, text }); return s; };
const windowMat = new THREE.MeshLambertMaterial({ color: 0x9ed3f2, emissive: 0xffd27a, emissiveIntensity: 0 });
const pads = [], lampPos = [];
ZONES.forEach(z => {
  const parts = [];
  if (z.board){ parts.push([box(3, 1.6, 0.18), 0xc98f57, mtx(0, 1.9, 0)], [box(0.16, 2.2, 0.16), 0x7a4b25, mtx(-1.2, 1.1, 0)], [box(0.16, 2.2, 0.16), 0x7a4b25, mtx(1.2, 1.1, 0)]);
    [[-0.9, 0.2, 0xffffff], [0.2, 0.35, 0xffe7a0], [1.0, -0.1, 0xffffff]].forEach(([x, y, c]) => parts.push([box(0.7, 0.9, 0.04), c, mtx(x, 1.9 + y, 0.11)])); obstacles.push({ x: z.x, z: z.z, hw: 1.6, hd: 0.5 }); }
  else { const mx = Math.max(z.w, z.d);
    parts.push([box(z.w, z.hh, z.d), z.color, mtx(0, z.hh / 2, 0)], [box(z.w + 0.6, 0.3, z.d + 0.6), 0x8a7a66, mtx(0, 0.15, 0)]);
    const roof = cone(mx * 0.78, 2.8, 4); roof.scale(z.w / mx, 1, z.d / mx); parts.push([roof, z.roof, mtx(0, z.hh + 1.4, 0, 0, Math.PI / 4, 0)]);
    parts.push([box(1.4, 2.2, 0.2), 0x6b3f1f, mtx(0, 1.1, z.d / 2 + 0.05)], [box(2.2, 0.25, 1.2), 0x6b3f1f, mtx(0, 2.35, z.d / 2 + 0.5)]);
    if (z.chimney) parts.push([box(0.7, 1.6, 0.7), 0x8a6a5a, mtx(z.w / 3, z.hh + 1.6, -z.d / 5)]);
    obstacles.push({ x: z.x, z: z.z, hw: z.w / 2 + 0.4, hd: z.d / 2 + 0.4 }); }
  const g = new THREE.Group(); g.position.set(z.x, z.h, z.z); scene.add(g);
  const m = new THREE.Mesh(merge(parts), vcMat()); m.castShadow = m.receiveShadow = true; g.add(m);
  if (!z.board){ const wins = merge([[box(1.2, 1.2, 0.2), 0xffffff, mtx(-z.w / 3.2, 2.3, z.d / 2 + 0.05)], [box(1.2, 1.2, 0.2), 0xffffff, mtx(z.w / 3.2, 2.3, z.d / 2 + 0.05)], [box(1.0, 1.0, 0.2), 0xffffff, mtx(z.w / 2 + 0.05, 2.4, 0, 0, Math.PI / 2, 0)]]);
    wins.deleteAttribute('color'); g.add(new THREE.Mesh(wins, windowMat)); }
  const sp = makeLabel(z.name); sp.position.y = z.hh + (z.board ? 1.6 : 3.8); g.add(sp);
  const px = z.x, pz = z.z + (z.board ? 3.2 : z.d / 2 + 4);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 40), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(px, height(px, pz) + 0.06, pz); scene.add(ring); pads.push({ id: z.id, x: px, z: pz, ring, inside: false });
  lampPos.push({ x: px + 4, z: pz, h: height(px + 4, pz) }); obstacles.push({ x: px + 4, z: pz, r: 0.3 });
});
lampPos.push({ x: 4, z: 30, h: height(4, 30) }, { x: -4, z: 18, h: height(-4, 18) });
const posts = new THREE.InstancedMesh(merge([[cyl(0.08, 0.11, 3.2, 6), 0x3a3f44, mtx(0, 1.6, 0)], [box(0.5, 0.12, 0.5), 0x3a3f44, mtx(0, 3.25, 0)]]), vcMat(), lampPos.length); posts.castShadow = true;
const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 0 });
const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 6), bulbMat, lampPos.length);
const lamps = lampPos.map((l, i) => { posts.setMatrixAt(i, mtx(l.x, l.h, l.z)); if (i >= ZONES.length) obstacles.push({ x: l.x, z: l.z, r: 0.3 }); bulbs.setMatrixAt(i, mtx(l.x, l.h + 3.3, l.z)); const light = new THREE.PointLight(0xffcf7a, 0, 26, 1.6); light.position.set(l.x, l.h + 3.2, l.z); scene.add(light); return light; });
scene.add(posts, bulbs);
{ const dock = new THREE.Mesh(merge([[box(3, 0.3, 14), 0x8b5a2b, mtx(SPAWN.x, 0.35, SPAWN.z + 12)], [box(2.2, 0.9, 5), 0x8b5a2b, mtx(SPAWN.x + 3.2, 0.25, SPAWN.z + 14)], [cyl(0.06, 0.08, 4, 5), 0x5a3a1a, mtx(SPAWN.x + 3.2, 2.5, SPAWN.z + 14)], [box(0.05, 2.6, 2.2), 0xffffff, mtx(SPAWN.x + 3.2 + 0.05, 3, SPAWN.z + 14 - 1.1)],
    ...[0, 1, 2, 3].map(i => [cyl(0.12, 0.12, 1.2, 5), 0x5a3a1a, mtx(SPAWN.x + (i % 2 ? 1.4 : -1.4), 0.6, SPAWN.z + 8 + Math.floor(i / 2) * 7)])]), vcMat()); dock.castShadow = dock.receiveShadow = true; scene.add(dock);
  obstacles.push({ x: SPAWN.x + 3.2, z: SPAWN.z + 14, hw: 1.2, hd: 2.6 });
  const sign = makeLabel('DRIVE NORTH ↑'); sign.position.set(SPAWN.x - 5, SPAWN.h + 3.5, SPAWN.z - 4); scene.add(sign);
  const rampSign = makeLabel('RAMP AHEAD'); rampSign.scale.set(6, 1.5, 1); rampSign.position.set(RAMP.x1 + 3.5, 3.2, RAMP.z1 + 2); scene.add(rampSign); }

/* coins + crates */
const COINS = [[-14, 30], [-20, -2], [16, -28], [40, 2], [-40, 0], [14, 34], [22, 14], [-8, -20], [-22, 26], [PEAK.x, PEAK.z]];
const coins = new THREE.InstancedMesh(merge([[cyl(0.62, 0.62, 0.14, 18), 0xffc94d], [cyl(0.42, 0.42, 0.18, 12), 0xffe08a]]), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffb300, emissiveIntensity: 0.35, flatShading: true }), COINS.length); coins.castShadow = true; scene.add(coins);
const crateGeo = merge([[box(1.1, 1.1, 1.1), 0xd9a15a], [box(1.14, 0.12, 1.14), 0x9a6b3a, mtx(0, 0.4, 0)], [box(1.14, 0.12, 1.14), 0x9a6b3a, mtx(0, -0.4, 0)], [box(0.12, 1.14, 1.14), 0x9a6b3a, mtx(0.45, 0, 0)], [box(0.12, 1.14, 1.14), 0x9a6b3a, mtx(-0.45, 0, 0)]]);
const crates = [[-1.2, 17.5], [0, 17.5], [1.2, 17.5], [-0.6, 16.3], [0.6, 16.3], [0, 15.1], [7, 11], [-7, 10]].map(([x, z]) => { const m = new THREE.Mesh(crateGeo, vcMat()); m.castShadow = m.receiveShadow = true; scene.add(m); return { m, x, z, vx: 0, vz: 0, rot: rnd() * 3, sunk: false }; });

/* ---------- the car ---------- */
const car = new THREE.Group(); scene.add(car);
const chassis = new THREE.Group(); car.add(chassis);
{ const side = new THREE.Shape(); [[-1.45, 0.22], [-1.45, 0.72], [-1.22, 0.88], [-0.78, 1.26], [0.12, 1.3], [0.62, 0.96], [1.36, 0.86], [1.48, 0.7], [1.48, 0.22]].forEach(([x, y], i) => i ? side.lineTo(x, y) : side.moveTo(x, y)); side.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(side, { depth: 1.46, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }); bodyGeo.translate(0, 0, -0.73); bodyGeo.rotateY(-Math.PI / 2);
  const glass = new THREE.Shape(); [[-0.82, 0.9], [-0.7, 1.2], [0.1, 1.23], [0.56, 0.92]].forEach(([x, y], i) => i ? glass.lineTo(x, y) : glass.moveTo(x, y)); glass.closePath();
  const glassGeo = new THREE.ExtrudeGeometry(glass, { depth: 1.5, bevelEnabled: false }); glassGeo.translate(0, 0.02, -0.75); glassGeo.rotateY(-Math.PI / 2);
  const bodyMesh = new THREE.Mesh(merge([[bodyGeo, 0xff6b57], [box(1.62, 0.18, 0.28), 0x2a2f34, mtx(0, 0.36, 1.46)], [box(1.62, 0.18, 0.28), 0x2a2f34, mtx(0, 0.36, -1.46)], [box(0.9, 0.22, 0.08), 0x1f2428, mtx(0, 0.62, 1.53)],
    [box(0.16, 0.12, 0.22), 0xff6b57, mtx(-0.82, 0.98, 0.45)], [box(0.16, 0.12, 0.22), 0xff6b57, mtx(0.82, 0.98, 0.45)], [box(1.3, 0.06, 0.34), 0x2a2f34, mtx(0, 1.0, -1.42)], [box(0.08, 0.18, 0.1), 0x2a2f34, mtx(-0.5, 0.9, -1.4)], [box(0.08, 0.18, 0.1), 0x2a2f34, mtx(0.5, 0.9, -1.4)]]),
    new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 60, specular: 0x666666 })); bodyMesh.castShadow = true; chassis.add(bodyMesh);
  chassis.add(new THREE.Mesh(glassGeo, new THREE.MeshPhongMaterial({ color: 0x1c2a36, shininess: 120, specular: 0x99bbdd, flatShading: true })));
  const hl = new THREE.Mesh(merge([[box(0.3, 0.16, 0.08), 0xffffff, mtx(-0.5, 0.64, 1.52)], [box(0.3, 0.16, 0.08), 0xffffff, mtx(0.5, 0.64, 1.52)]]), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xfff0b0, emissiveIntensity: 0.6 })); chassis.add(hl);
  const tl = new THREE.Mesh(merge([[box(0.34, 0.14, 0.08), 0xff3030, mtx(-0.5, 0.64, -1.52)], [box(0.34, 0.14, 0.08), 0xff3030, mtx(0.5, 0.64, -1.52)]]), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xff2020, emissiveIntensity: 0.5 })); chassis.add(tl); car.tail = tl;
  const tireGeo = cyl(0.37, 0.37, 0.32, 12); tireGeo.rotateZ(Math.PI / 2); const rimGeo = cyl(0.22, 0.22, 0.34, 8); rimGeo.rotateZ(Math.PI / 2);
  car.tires = new THREE.InstancedMesh(tireGeo, mat(0x1f2428), 4); car.rims = new THREE.InstancedMesh(rimGeo, new THREE.MeshPhongMaterial({ color: 0xd8dde2, flatShading: true, shininess: 80 }), 4); car.tires.castShadow = true; car.add(car.tires, car.rims);
  car.wheelPos = [[-0.8, 0.37, 0.95], [0.8, 0.37, 0.95], [-0.8, 0.37, -0.95], [0.8, 0.37, -0.95]];
  car.head = new THREE.SpotLight(0xfff0c0, 0, 34, 0.6, 0.5, 1.2); car.head.position.set(0, 0.8, 1.2); car.head.target.position.set(0, 0, 14); car.add(car.head); car.add(car.head.target); }
const P = { x: SPAWN.x, z: SPAWN.z, y: SPAWN.h, heading: Math.PI, vx: 0, vz: 0, vy: 0, vf: 0, vl: 0, air: false, sinkT: 0, pitch: 0, roll: 0, spin: 0, steer: 0, surfVy: 0, prevG: SPAWN.h };
const keys = {}, joy = { x: 0, y: 0, id: null };
function resetCar(){ Object.assign(P, { x: SPAWN.x, z: SPAWN.z, y: SPAWN.h, heading: Math.PI, vx: 0, vz: 0, vy: 0, vf: 0, vl: 0, air: false, sinkT: 0, prevG: SPAWN.h, surfVy: 0 }); car.position.set(P.x, P.y, P.z); }
resetCar();

/* ---------- particles: dust + sparkles ---------- */
const PN = 160, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pLife = new Float32Array(PN), pSize = new Float32Array(PN), pVel = new Float32Array(PN * 3); let pHead = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('aLife', new THREE.BufferAttribute(pLife, 1)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const particles = new THREE.Points(pGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true,
  vertexShader: `attribute float aLife; attribute float aSize; varying float vA; varying vec3 vC;
void main(){ vC = color; vA = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (260.0 / max(1.0, -mv.z)) * (0.5 + 0.5 * (1.0 - aLife)); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 p = gl_PointCoord - 0.5; if (dot(p, p) > 0.25) discard; gl_FragColor = vec4(vC, vA * 0.7); }` })); particles.frustumCulled = false; scene.add(particles);
function emit(x, y, z, vx, vy, vz, r, g, b, size){ const i = pHead = (pHead + 1) % PN; pPos.set([x, y, z], i * 3); pVel.set([vx, vy, vz], i * 3); pCol.set([r, g, b], i * 3); pLife[i] = 1; pSize[i] = size; }
const fireflies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(240), 3)), new THREE.PointsMaterial({ color: 0xeaffa0, size: 0.22, transparent: true, opacity: 0.9 }));
const ffBase = []; for (let i = 0; i < 80; i++){ const a = rnd() * 6.283, r = 6 + rnd() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r; ffBase.push({ x, z, y: height(x, z) + 0.8 + rnd() * 2, ph: rnd() * 6 }); } fireflies.visible = false; scene.add(fireflies);

/* ---------- minimap ---------- */
const mapC = $('#map'), mapX = mapC.getContext('2d'), mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 256;
{ const x = mapBase.getContext('2d'), img = x.createImageData(256, 256), W = R + 12; for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++){ const wx = (i / 256 - 0.5) * 2 * W, wz = (j / 256 - 0.5) * 2 * W, h = height(wx, wz); let c;
    if (Math.hypot(i - 128, j - 128) > 128) c = [0, 0, 0, 0]; else if (h < -0.1) c = [58, 164, 234, 255]; else if (h < 0.45) c = [241, 220, 156, 255]; else if (roadDist(wx, wz) < 1.8) c = [205, 184, 148, 255]; else if (h > 5.4) c = [154, 163, 168, 255]; else c = [110, 190, 82, 255];
    img.data.set(c, (j * 256 + i) * 4); } x.putImageData(img, 0, 0);
  ZONES.forEach(z => { const px = 128 + z.x / W * 128, pz = 128 + z.z / W * 128; x.fillStyle = '#' + (z.roof || 0xc98f57).toString(16).padStart(6, '0'); x.fillRect(px - 5, pz - 5, 10, 10); x.strokeStyle = '#1d2b33'; x.lineWidth = 2; x.strokeRect(px - 5, pz - 5, 10, 10); }); }
function drawMap(){ const W = R + 12; mapX.clearRect(0, 0, 256, 256); mapX.drawImage(mapBase, 0, 0);
  COINS.forEach((c, i) => { if (state.coins.has(i)) return; mapX.fillStyle = '#ffc94d'; mapX.beginPath(); mapX.arc(128 + c[0] / W * 128, 128 + c[1] / W * 128, 3.5, 0, 7); mapX.fill(); mapX.strokeStyle = '#8a5a00'; mapX.lineWidth = 1; mapX.stroke(); });
  const px = 128 + P.x / W * 128, pz = 128 + P.z / W * 128; mapX.save(); mapX.translate(px, pz); mapX.rotate(Math.PI - P.heading); mapX.fillStyle = '#ff6b57'; mapX.strokeStyle = '#fff'; mapX.lineWidth = 2; mapX.beginPath(); mapX.moveTo(0, -8); mapX.lineTo(6, 6); mapX.lineTo(0, 3); mapX.lineTo(-6, 6); mapX.closePath(); mapX.fill(); mapX.stroke(); mapX.restore(); }

/* ---------- input ---------- */
addEventListener('keydown', e => { const k = e.key.toLowerCase();
  if (k === 'escape') { closePanel(); return; } if (!state.started || panelOpen) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault();
  if (k === 'r') { resetCar(); toast('Back at the dock.'); } keys[k] = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const stick = $('#stick'), knob = $('#knob');
stick.addEventListener('pointerdown', e => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveJoy(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);
function moveJoy(e){ const r = stick.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = Math.abs(dx) > .15 ? dx : 0; joy.y = Math.abs(dy) > .15 ? -dy : 0; knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`; }
$('#resetBtn').addEventListener('click', () => { resetCar(); toast('Back at the dock.'); });
$('#startBtn').addEventListener('click', () => { $('#intro').classList.add('hide'); state.started = true; canvas.focus(); if (soundOn) startEngine();
  if (!save.seen) toast('Drive north. Park on a glowing pad to open a building. Space is the handbrake.', 4600); persist(); });

/* ---------- theme ---------- */
function applyTheme(){ const n = isNight(); themeBtn.textContent = n ? 'Day' : 'Night';
  scene.background = new THREE.Color(n ? 0x0c1a33 : 0x8fd3ff); scene.fog = new THREE.Fog(n ? 0x0c1a33 : 0x9fdcff, n ? 30 : 80, n ? 130 : 230);
  hemi.color.set(n ? 0x2a3f6b : 0xbfe6ff); hemi.groundColor.set(n ? 0x0b1a12 : 0x6f9a4c); hemi.intensity = n ? 0.4 : 0.9;
  sun.color.set(n ? 0x8fb0ff : 0xfff2d0); sun.intensity = n ? 0.35 : 1.7; ambient.intensity = n ? 0.05 : 0.12;
  lamps.forEach(l => { l.intensity = n ? 16 : 0; }); bulbMat.emissiveIntensity = n ? 1.2 : 0; windowMat.emissiveIntensity = n ? 1 : 0; car.head.intensity = n ? 60 : 0; waterU.uNight.value = n ? 1 : 0;
  clouds.material.opacity = n ? 0.3 : 0.92; fireflies.visible = n; sunSprite.material.map = n ? moonTexture : sunTexture; sunSprite.material.needsUpdate = true; sunSprite.scale.set(n ? 26 : 60, n ? 26 : 60, 1); }
applyTheme();

/* ---------- physics + camera ---------- */
const camPos = new THREE.Vector3(SPAWN.x, 5, SPAWN.z + 9), camLook = new THREE.Vector3(), M = M4(), UP = new THREE.Vector3(), FWD = new THREE.Vector3(), RGT = new THREE.Vector3(), nTmp = new THREE.Vector3();
function normalAt(x, z, out){ const e = 0.6; return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize(); }
function collide(x, z, r){ let px = x, pz = z, hit = false, nx = 0, nz = 0;
  for (const o of obstacles){ if (o.r !== undefined){ const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz), m = o.r + r; if (d < m && d > 1e-4) { px = o.x + dx / d * m; pz = o.z + dz / d * m; nx = dx / d; nz = dz / d; hit = true; } }
    else { const cx = Math.max(o.x - o.hw, Math.min(px, o.x + o.hw)), cz = Math.max(o.z - o.hd, Math.min(pz, o.z + o.hd)); const dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
      if (d < r) { if (d > 1e-4) { px = cx + dx / d * r; pz = cz + dz / d * r; nx = dx / d; nz = dz / d; } else { px += r; nx = 1; } hit = true; } } }
  return { x: px, z: pz, hit, nx, nz }; }
let time = 0;
function update(dt){
  const drive = state.started && !panelOpen && P.sinkT === 0;
  let steer = drive ? ((keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0) + joy.x) : 0;
  let throttle = drive ? ((keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0) + joy.y) : 0;
  const hand = drive && !!keys[' '];
  steer = Math.max(-1, Math.min(1, steer)); throttle = Math.max(-1, Math.min(1, throttle));
  P.steer += (steer - P.steer) * Math.min(1, dt * 10);
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading), rx = fz, rz = -fx;
  // decompose velocity into forward / lateral
  let vf = P.vx * fx + P.vz * fz, vl = P.vx * rx + P.vz * rz;
  const maxF = 19, maxR = 7;
  if (!P.air){
    if (throttle > 0) vf += (vf < 0 ? 30 : 15 * Math.max(0.25, 1 - vf / maxF)) * throttle * dt;
    else if (throttle < 0) vf += (vf > 0.4 ? 26 : 10) * throttle * dt;
    vf -= vf * (throttle === 0 ? 1.1 : 0.25) * dt; vf -= vf * Math.abs(vf) * 0.006 * dt;
    if (hand) vf -= vf * 2.2 * dt;
    vf = Math.max(-maxR, Math.min(maxF, vf)); if (Math.abs(vf) < 0.04 && throttle === 0) vf = 0;
    const grip = hand ? 1.6 : (isSand(P.x, P.z) ? 5 : 10); vl *= Math.exp(-grip * dt);
    // steering: needs speed to bite, softens at high speed, sharper with the handbrake
    const turn = P.steer * 2.5 * Math.min(1, Math.abs(vf) / 5) * (1 - Math.abs(vf) / (maxF * 2.4)) * (hand ? 1.35 : 1);
    P.heading -= turn * dt * (vf < 0 ? -1 : 1);
  } else { vl *= Math.exp(-0.4 * dt); P.heading -= P.steer * 0.6 * dt; }
  P.vx = vf * fx + vl * rx; P.vz = vf * fz + vl * rz;
  if (!P.air){ normalAt(P.x, P.z, nTmp); P.vx += nTmp.x * 8 * dt; P.vz += nTmp.z * 8 * dt; }   // gravity along the slope: hills pull, descents push
  let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
  const c = collide(nx, nz, 1.1); if (c.hit) { const vn = P.vx * c.nx + P.vz * c.nz; if (vn < 0) { P.vx -= vn * c.nx * 1.4; P.vz -= vn * c.nz * 1.4; } P.vx *= 0.6; P.vz *= 0.6; if (Math.abs(vn) > 5) { P.pitch += 0.1; blip(120, .12); } }
  nx = c.x; nz = c.z;
  crates.forEach(cr => { if (cr.sunk) return; const dx = cr.x - nx, dz = cr.z - nz, d = Math.hypot(dx, dz); if (d < 1.8 && d > 1e-3 && !P.air) { const sp = Math.hypot(P.vx, P.vz); cr.vx += dx / d * Math.max(3, sp * 1.2) + P.vx * 0.3; cr.vz += dz / d * Math.max(3, sp * 1.2) + P.vz * 0.3; cr.vy = Math.min(6, sp * 0.4); P.vx *= 0.9; P.vz *= 0.9; nx -= dx / d * (1.8 - d) * 0.5; nz -= dz / d * (1.8 - d) * 0.5; blip(200, .08); } });
  P.x = nx; P.z = nz;
  const dd = Math.hypot(P.x, P.z); if (dd > R + 16) { P.x *= (R + 16) / dd; P.z *= (R + 16) / dd; P.vx *= 0.5; P.vz *= 0.5; }
  // vertical: follow the ground, launch off edges, fall with gravity
  const g = height(P.x, P.z);
  if (g < -0.35 && P.sinkT === 0 && !P.air) { P.sinkT = 0.001; toast('Splash. Back to the dock in a moment.', 2200); }
  if (P.sinkT > 0) { P.sinkT += dt; P.vx *= 0.9; P.vz *= 0.9; if (P.sinkT > 1.6) { resetCar(); return; } P.y += ((g - P.sinkT * 1.5) - P.y) * Math.min(1, dt * 10); }
  else if (P.air) { P.vy -= 30 * dt; P.y += P.vy * dt; if (P.y <= g) { const impact = -P.vy; P.y = g; P.air = false; P.vy = 0; P.pitch += Math.min(0.25, impact * 0.02); if (impact > 4) blip(90, .15); for (let i = 0; i < 8; i++) emit(P.x + (rnd() - .5) * 2, P.y + 0.2, P.z + (rnd() - .5) * 2, (rnd() - .5) * 3, 1 + rnd() * 2, (rnd() - .5) * 3, .85, .75, .55, 6); } }
  else { const surf = (g - P.prevG) / Math.max(dt, 1e-3); if (g < P.y - 0.32 && Math.hypot(P.vx, P.vz) > 4) { P.air = true; P.vy = Math.max(0, Math.min(14, P.surfVy)); } else { P.y = g; if (Math.abs(surf) < 12) P.surfVy = P.surfVy * 0.6 + surf * 0.4; } }
  P.prevG = g;
  car.position.set(P.x, P.y, P.z);
  if (!P.air) { normalAt(P.x, P.z, UP); } else { UP.lerp(nTmp.set(0, 1, 0), Math.min(1, dt * 2)).normalize(); }
  FWD.set(fx, 0, fz); FWD.addScaledVector(UP, -FWD.dot(UP)).normalize(); RGT.crossVectors(UP, FWD).normalize(); M.makeBasis(RGT, UP, FWD); car.quaternion.setFromRotationMatrix(M);
  // body dynamics
  const accF = (vf - P.vf) / Math.max(dt, 1e-3); P.vf = vf; P.vl = vl;
  P.pitch += ((P.air ? -P.vy * 0.03 : -accF * 0.012) - P.pitch) * Math.min(1, dt * 6); P.roll += ((-P.steer * Math.abs(vf) * 0.012) - P.roll) * Math.min(1, dt * 6);
  chassis.rotation.set(Math.max(-0.3, Math.min(0.3, P.pitch)), 0, Math.max(-0.3, Math.min(0.3, P.roll))); chassis.position.y = 0.02 * Math.sin(time * 40) * Math.min(1, Math.abs(vf) / 8) * 0.3;
  P.spin += vf * dt / 0.37;
  car.wheelPos.forEach(([x, y, z], i) => { mm.compose(v3.set(x, y, z), q.setFromEuler(new THREE.Euler(P.spin, i < 2 ? -P.steer * 0.5 : 0, 0, 'YXZ')), sc3.set(1, 1, 1)); car.tires.setMatrixAt(i, mm); car.rims.setMatrixAt(i, mm); });
  car.tires.instanceMatrix.needsUpdate = car.rims.instanceMatrix.needsUpdate = true;
  car.tail.material.emissiveIntensity = throttle < 0 ? 1.4 : 0.5;
  // dust from the rear wheels when sliding, braking hard or on sand
  if (!P.air && (Math.abs(vl) > 2.2 || (hand && Math.abs(vf) > 3) || (isSand(P.x, P.z) && Math.abs(vf) > 4))) for (const s of [-0.8, 0.8]){ const wx = P.x + rx * s - fx * 0.95, wz = P.z + rz * s - fz * 0.95; emit(wx, P.y + 0.15, wz, (rnd() - .5) * 2 - P.vx * 0.15, 0.8 + rnd() * 1.5, (rnd() - .5) * 2 - P.vz * 0.15, .82, .74, .58, 5 + rnd() * 3); }
  // crates
  crates.forEach(cr => { if (cr.sunk) return; cr.vy = (cr.vy || 0) - 20 * dt; cr.h = (cr.h || 0) + cr.vy * dt; if (cr.h < 0) { cr.h = 0; cr.vy = 0; }
    cr.x += cr.vx * dt; cr.z += cr.vz * dt; const f = cr.h > 0 ? 0.6 : 0.06; cr.vx *= Math.pow(f, dt); cr.vz *= Math.pow(f, dt);
    const cc = collide(cr.x, cr.z, 0.8); if (cc.hit) { cr.vx *= -0.3; cr.vz *= -0.3; } cr.x = cc.x; cr.z = cc.z; const ch = height(cr.x, cr.z);
    if (ch < -0.4) { cr.sunk = true; cr.m.visible = false; toast('A crate went for a swim.', 1800); return; }
    const sp = Math.hypot(cr.vx, cr.vz); cr.rot += sp * dt * 0.8; cr.m.position.set(cr.x, ch + 0.55 + cr.h, cr.z); cr.m.rotation.set(cr.h > 0 ? cr.rot * 0.7 : 0, cr.rot, sp > 2 ? Math.sin(cr.rot * 3) * 0.2 : 0); });
  // pads
  pads.forEach(p => { const d = Math.hypot(P.x - p.x, P.z - p.z); p.ring.material.opacity = 0.55 + 0.35 * Math.sin(time * 4 + p.x);
    if (d < 3 && !p.inside && drive && !P.air) { p.inside = true; P.vx *= 0.2; P.vz *= 0.2; quest(p.id); openPanel(p.id); blip(520, .1); } else if (d > 4.5) p.inside = false; });
  // coins
  COINS.forEach((cp, i) => { const got = state.coins.has(i), s = got ? 0 : 1; mm.compose(v3.set(cp[0], height(cp[0], cp[1]) + 1.15 + Math.sin(time * 3 + i) * 0.15, cp[1]), q.setFromAxisAngle(nTmp.set(0, 1, 0), time * 2 + i), sc3.set(s, s, s)); coins.setMatrixAt(i, mm);
    if (!got && Math.hypot(P.x - cp[0], P.z - cp[1]) < 2.0 && Math.abs(P.y - height(cp[0], cp[1])) < 2.5) { state.coins.add(i); persist(); syncHud(); blip(880, .08); setTimeout(() => blip(1320, .12), 70);
      for (let k = 0; k < 16; k++) emit(cp[0], height(cp[0], cp[1]) + 1.2, cp[1], (rnd() - .5) * 6, 2 + rnd() * 4, (rnd() - .5) * 6, 1, .8, .3, 7);
      toast(`Coin ${state.coins.size}/10 · ${FACTS[i]}`, 4200); if (state.coins.size === 10) setTimeout(() => toast('All ten. The secret: the fastest way to a reply is telling Michael the deadline. Post Office is east.', 6000), 4300); } });
  coins.instanceMatrix.needsUpdate = true;
  // particles
  for (let i = 0; i < PN; i++){ if (pLife[i] <= 0) continue; pLife[i] -= dt * 1.4; pVel[i * 3 + 1] -= 4 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; if (pLife[i] < 0) pLife[i] = 0; }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aLife.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
  if (fireflies.visible){ const a = fireflies.geometry.attributes.position; ffBase.forEach((f, i) => a.setXYZ(i, f.x + Math.sin(time * 0.7 + f.ph) * 1.5, f.y + Math.sin(time * 1.3 + f.ph * 2) * 0.6, f.z + Math.cos(time * 0.5 + f.ph) * 1.5)); a.needsUpdate = true; }
  // clouds + birds
  cloudData.forEach((c, i) => { c.x += c.sp * dt; if (c.x > 140) c.x -= 280; mm.compose(v3.set(c.x, c.y, c.z), q.identity(), sc3.set(c.s, c.s * 0.45, c.s * 0.7)); clouds.setMatrixAt(i, mm); }); clouds.instanceMatrix.needsUpdate = true;
  birdData.forEach((b, i) => { b.a += b.sp * dt; const bx = Math.cos(b.a) * b.r, bz = Math.sin(b.a) * b.r, yaw = -b.a + (b.sp > 0 ? 0 : Math.PI), flap = Math.sin(time * 9 + b.ph) * 0.7;
    for (const s of [-1, 1]){ M.compose(v3.set(bx, b.y + Math.sin(time + b.ph) * 0.5, bz), q.setFromEuler(new THREE.Euler(0, yaw, 0)), sc3.set(1, 1, 1)); mm.compose(v3.set(s * 0.36, 0, 0), q.setFromEuler(new THREE.Euler(0, 0, s * flap)), sc3.set(1, 1, 1)); M.multiply(mm); birds.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), M); } });
  birds.instanceMatrix.needsUpdate = true;
  // camera: behind, lower and wider as speed rises, looks a little into the turn
  const spd = Math.abs(vf), back = 7.2 + spd * 0.14, up = 2.9 + spd * 0.03;
  const tx = P.x - fx * back, tz = P.z - fz * back, ty = Math.max(P.y + up, height(tx, tz) + 1.4);
  const k = 1 - Math.exp(-dt * 5.5); camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
  camera.position.copy(camPos); camLook.set(P.x + fx * 4 - rx * P.steer * 2.2, P.y + 1.0, P.z + fz * 4 - rz * P.steer * 2.2); camera.lookAt(camLook);
  const fov = 58 + spd * 0.55; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  sun.position.set(P.x + SUN_DIR.x * 70, SUN_DIR.y * 70 + 10, P.z + SUN_DIR.z * 70); sun.target.position.set(P.x, 0, P.z);
  sunSprite.position.copy(camera.position).addScaledVector(SUN_DIR, 240);
  if (engine && soundOn) { engine.o.frequency.value = 52 + spd * 9 + (throttle > 0 ? 12 : 0); engine.g.gain.value = state.started ? 0.018 + Math.abs(throttle) * 0.02 + spd * 0.0012 : 0; }
  $('#speed').textContent = Math.round(spd * 6);
  drawMap();
}

/* ---------- loop with frame-time governor ---------- */
let last = performance.now(), ema = 16, hot = 0, cooldown = 0;
function frame(now){ requestAnimationFrame(frame); if (document.hidden) { last = now; return; }
  let dt = (now - last) / 1000; const ft = now - last; last = now; if (dt > 0.05) dt = 0.05; time += dt;
  ema = ema * 0.94 + Math.min(ft, 100) * 0.06; cooldown -= dt;
  if (cooldown <= 0 && ema > 26 && tier < tiers.length - 1) { if (++hot > 45) { tier++; hot = 0; cooldown = 3; applyTier(); } } else hot = 0;
  waterU.uTime.value = reduced ? 0 : time;
  update(dt); renderer.render(scene, camera); }
resize(); applyTier();
document.fonts.ready.then(() => { labels.forEach(l => { l.s.material.map.dispose(); l.s.material.map = labelTex(l.text); l.s.material.needsUpdate = true; }); requestAnimationFrame(frame); });
