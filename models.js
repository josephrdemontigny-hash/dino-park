/* Primeval Park - procedural props: vegetation, buildings, fences, guests, jeep. */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function mk(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const _c = new THREE.Color(), _v = new THREE.Vector3();
/* parts: [geometry, color(hex|fn), Matrix4?] -> one non-indexed vertex-coloured geometry */
export function mergeColored(parts, keepUv = false){
  const geos = [];
  for (const [g0, col, m] of parts){
    let g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){ if (typeof col === 'function'){ _v.fromBufferAttribute(g.attributes.position, i); col(_v, _c, i); } else _c.set(col); a[i*3] = _c.r; a[i*3+1] = _c.g; a[i*3+2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (keepUv){ if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].concat(keepUv ? ['uv'] : []).includes(k)) g.deleteAttribute(k);
    geos.push(g);
  }
  return mergeGeometries(geos, false);
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

/* ---------------- textures ---------------- */
export function leafClusterCanvas(){
  const c = mk(256, 256), g = c.getContext('2d'), r = mulberry(11);
  for (let i = 0; i < 110; i++){
    const a = r() * TAU, d = Math.sqrt(r()) * 104, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
    const L = 22 + r() * 26, W = L * (0.36 + r() * 0.12), rot = a + (r() - 0.5) * 1.2 + Math.PI / 2;
    const l = 0.22 + r() * 0.3, h = 95 + r() * 30;
    g.save(); g.translate(x, y); g.rotate(rot);
    const gr = g.createLinearGradient(0, -L / 2, 0, L / 2); gr.addColorStop(0, `hsl(${h},${38 + r() * 20}%,${l * 100 + 8}%)`); gr.addColorStop(1, `hsl(${h + 8},45%,${l * 100 - 6}%)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -L / 2); g.quadraticCurveTo(W, 0, 0, L / 2); g.quadraticCurveTo(-W, 0, 0, -L / 2); g.fill();
    g.strokeStyle = 'rgba(20,30,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -L / 2); g.lineTo(0, L / 2); g.stroke(); g.restore();
  }
  return c;
}
export function frondCanvas(fine){
  const c = mk(128, 512), g = c.getContext('2d'), r = mulberry(fine ? 5 : 23);
  g.strokeStyle = '#4a5a24'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 4); g.stroke();
  const n = fine ? 40 : 34;
  for (let i = 0; i < n; i++){
    const t = i / n, y = 500 - t * 490, len = (fine ? 52 : 60) * Math.sin(Math.min(1, (1 - t) * 1.15) * Math.PI * 0.95 + 0.1) + 6;
    for (const sd of [-1, 1]){
      const hue = 80 + r() * 25, lig = 22 + r() * 14;
      g.fillStyle = `hsl(${hue},${40 + r() * 15}%,${lig}%)`;
      g.save(); g.translate(64, y); g.rotate(sd * (fine ? 1.15 : 1.0) + (r() - 0.5) * 0.12);
      const wv = fine ? 11 : 15; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(wv, -len * 0.25, wv * 0.7, -len * 0.8, 0, -len); g.bezierCurveTo(-wv * 0.7, -len * 0.8, -wv, -len * 0.25, 0, 0); g.fill();
      g.strokeStyle = 'rgba(30,40,12,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.stroke(); g.restore();
    }
  }
  return c;
}
export function signCanvas(text, sub){
  const c = mk(1024, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3a2a18'); gr.addColorStop(1, '#22180c'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 40; i++){ g.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.1})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 256; g.moveTo(0, y); g.bezierCurveTo(300, y + 6, 700, y - 6, 1024, y); g.stroke(); }
  g.strokeStyle = '#d99a2b'; g.lineWidth = 10; g.strokeRect(18, 18, 988, 220);
  g.fillStyle = '#e8a93a'; g.font = '900 112px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8; g.shadowOffsetY = 4; g.fillText(text, 512, sub ? 112 : 128);
  if (sub){ g.font = '700 34px Georgia, serif'; g.fillStyle = '#efe6d2'; g.fillText(sub, 512, 196); }
  return c;
}
export function chainCanvas(){ const c = mk(64, 64), g = c.getContext('2d'); g.strokeStyle = '#c9ccc8'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-32, 32); g.lineTo(0, 0); g.moveTo(64, 0); g.lineTo(96, 32); g.stroke(); return c; }

/* ---------------- near fade (v7): foliage and bark dissolve within a few metres of the camera instead of clipping through it ---------------- */
export function nearFadePatch(sh){
  sh.vertexShader = 'varying vec3 vNfMv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vNfMv = mvPosition.xyz;');
  sh.fragmentShader = 'varying vec3 vNfMv;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
    { float nfd = length(vNfMv); if (nfd < 7.0){ float nfn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if ((nfd - 2.0) / 5.0 < nfn) discard; } }`); }
/* ---------------- wind ---------------- */
export const WIND = { value: 0 };
export function windify(mat, amp, base = 1){
  mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = WIND;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float wph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
      #else
      float wph = 0.0;
      #endif
      float wk = max(0.0, position.y - ${base.toFixed(2)}) * ${amp.toFixed(4)};
      transformed.x += sin(uTime * 1.4 + wph) * wk + sin(uTime * 3.1 + wph * 2.0 + position.z) * wk * 0.3;
      transformed.z += cos(uTime * 1.1 + wph * 1.3) * wk * 0.7;`);
    // v7: foliage cards carry hand-set (outward/up) normals; three flips them on back faces of DoubleSide cards, which lit those faces black (the old "black blobs"). Undo the flip.
    nearFadePatch(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      #ifdef DOUBLE_SIDED
      normal *= faceDirection;
      #endif`); };
  mat.customProgramCacheKey = () => 'wind7f_' + amp + '_' + base;
  return mat;
}

/* ---------------- vegetation geometry ---------------- */
function bendTrunk(g, h, bend, dir){ const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const t = clamp(p.getY(i) / h, 0, 1); p.setX(i, p.getX(i) + Math.sin(dir) * bend * t * t); p.setZ(i, p.getZ(i) + Math.cos(dir) * bend * t * t); } g.computeVertexNormals(); return g; }
export function palmGeos(){
  const h = 11; let t = cyl(0.17, 0.3, h, 9); t.translate(0, h / 2, 0); t = bendTrunk(t, h, 1.6, 0.4);
  const trunk = mergeColored([[t, (v, c) => { const band = (Math.sin(v.y * 9) * 0.5 + 0.5); c.setHex(0x6b5a44).lerp(_c.setHex(0x3e3326), band * 0.45).offsetHSL(0, 0, -0.05 + v.y * 0.006); }]]);
  // crown
  const parts = []; const top = new THREE.Vector3(Math.sin(0.4) * 1.6, h, Math.cos(0.4) * 1.6); const r = mulberry(3);
  for (let i = 0; i < 11; i++){
    const a = i / 11 * TAU + r() * 0.3, L = 4.2 + r() * 1.2, W = 1.5, seg = 7; const pg = new THREE.PlaneGeometry(W, L, 1, seg); pg.rotateX(-Math.PI / 2); pg.translate(0, 0, L / 2);
    const p = pg.attributes.position; const droop = 0.12 + r() * 0.15 + (i % 3 === 0 ? -0.1 : 0);
    for (let k = 0; k < p.count; k++){ const z = p.getZ(k), x = p.getX(k); const tt = z / L; p.setY(k, 0.8 * tt * L * 0.35 - droop * z * z * 0.9 - Math.abs(x) * 0.25); }
    pg.rotateY(a); pg.translate(top.x, top.y, top.z); pg.computeVertexNormals();
    // normals: mostly up for soft lighting
    const nn = pg.attributes.normal; for (let k = 0; k < nn.count; k++){ nn.setXYZ(k, nn.getX(k) * 0.4, Math.abs(nn.getY(k)) * 0.8 + 0.5, nn.getZ(k) * 0.4); }
    parts.push(pg);
  }
  const crown = mergeGeometries(parts.map(g => { g = g.toNonIndexed(); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++){ const y = g.attributes.position.getY(i); const k = clamp((y - h + 1.5) / 2.5, 0.55, 1.05); a[i*3] = k; a[i*3+1] = k; a[i*3+2] = k; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }));
  return { trunk, crown, h };
}
export function cycadGeos(){ // tree fern / cycad
  const h = 2.4; let t = cyl(0.22, 0.32, h, 8); t.translate(0, h / 2, 0); const trunk = mergeColored([[t, (v, c) => c.setHex(0x4a3c2a).offsetHSL(0, 0, Math.sin(v.y * 14) * 0.03)]]);
  const parts = []; const r = mulberry(9);
  for (let i = 0; i < 16; i++){ const a = i / 16 * TAU + r() * 0.2, L = 2.6 + r() * 0.8, W = 0.9; const pg = new THREE.PlaneGeometry(W, L, 1, 6); pg.rotateX(-Math.PI / 2); pg.translate(0, 0, L / 2);
    const p = pg.attributes.position, up = 0.9 + r() * 0.5; for (let k = 0; k < p.count; k++){ const z = p.getZ(k); p.setY(k, up * z - 0.32 * z * z); }
    pg.rotateY(a); pg.translate(0, h, 0); const g = pg.toNonIndexed(); g.computeVertexNormals(); const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, nn.getX(k) * 0.4, Math.abs(nn.getY(k)) * 0.8 + 0.5, nn.getZ(k) * 0.4); parts.push(g); }
  const crown = mergeGeometries(parts.map(g => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(0.95); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }));
  return { trunk, crown, h };
}
export function broadleafGeos(seed = 1){
  const r = mulberry(seed * 31 + 7); const h = 13 + r() * 4;
  let t = cyl(0.26, 0.48, h, 11); t.translate(0, h / 2, 0);
  { const p = t.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i), x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const fl = Math.max(0, 1 - y / 2.2); const k = 1 + fl * fl * (0.6 + Math.max(0, Math.cos(a * 5)) * 1.3); p.setX(i, x * k); p.setZ(i, z * k); } t.computeVertexNormals(); }
  const limbs = []; const blobs = [[0, h + 1.5, 0, 4.2]];
  for (let i = 0; i < 4; i++){ const a = i / 4 * TAU + r(), y = h * (0.62 + r() * 0.25), L = 3 + r() * 2.5; const g = cyl(0.12, 0.26, L, 6); g.translate(0, L / 2, 0); g.applyMatrix4(M(0, y, 0, 0, a, 0.9 + r() * 0.3));
    limbs.push(g); const ex = Math.cos(-a) * 0, d = L * 0.8; blobs.push([Math.sin(0.9) * d * Math.cos(a + Math.PI / 2) * -1, y + Math.cos(0.95) * L + 0.8, Math.sin(0.9) * d * Math.sin(a + Math.PI / 2), 2.8 + r() * 1.0]); }
  const trunk = mergeColored([[t, (v, c) => { c.setHex(0x5d5444).offsetHSL(0, 0, -0.04 + Math.sin(v.y * 3 + v.x * 4) * 0.02); if (v.y < 3) c.lerp(_c.setHex(0x3b4a2a), (3 - v.y) / 3 * 0.45); }], ...limbs.map(g => [g, 0x544a3a])]);
  const cards = [];
  for (const [bx, by, bz, R] of blobs){ const n = Math.round(R * 7);
    for (let i = 0; i < n; i++){ const u = r() * 2 - 1, a = r() * TAU; const s = Math.sqrt(1 - u * u); const dir = new THREE.Vector3(s * Math.cos(a), u * 0.75, s * Math.sin(a)); const rr = R * (0.55 + r() * 0.45);
      const size = 2.6 + r() * 1.6; const pg = new THREE.PlaneGeometry(size, size); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, r() * TAU));
      pg.applyQuaternion(q); pg.translate(bx + dir.x * rr, by + dir.y * rr, bz + dir.z * rr);
      const g = pg.toNonIndexed(); const nn = g.attributes.normal; const sh = clamp(0.62 + dir.y * 0.38 + (rr / R) * 0.12, 0.35, 1.08);
      for (let k = 0; k < nn.count; k++) nn.setXYZ(k, dir.x * 0.8, dir.y * 0.8 + 0.35, dir.z * 0.8);
      const col = new Float32Array(g.attributes.position.count * 3).fill(sh); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); cards.push(g); } }
  const canopy = mergeGeometries(cards);
  return { trunk, canopy, h };
}
export function bushGeo(){ const r = mulberry(77), cards = [];
  for (let i = 0; i < 9; i++){ const a = r() * TAU, d = r() * 0.6; const size = 1.4 + r() * 0.8; const pg = new THREE.PlaneGeometry(size, size);
    pg.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, r() * TAU))); pg.translate(Math.cos(a) * d, 0.6 + r() * 0.5, Math.sin(a) * d);
    const g = pg.toNonIndexed(); const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, 0, 1, 0); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.8 + r() * 0.15), 3)); cards.push(g); }
  return mergeGeometries(cards); }
export function fernGeo(){ const parts = [], r = mulberry(21);
  for (let i = 0; i < 9; i++){ const a = i / 9 * TAU + r() * 0.3, L = 1.3 + r() * 0.5; const pg = new THREE.PlaneGeometry(0.55, L, 1, 4); pg.rotateX(-Math.PI / 2); pg.translate(0, 0, L / 2);
    const p = pg.attributes.position; for (let k = 0; k < p.count; k++){ const z = p.getZ(k); p.setY(k, 0.1 + z * 0.9 - z * z * 0.42); } pg.rotateY(a);
    const g = pg.toNonIndexed(); const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, 0, 1, 0); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.9), 3)); parts.push(g); }
  return mergeGeometries(parts); }
/* ---------- v7 ground cover: grass tufts, flowers, leafy shrubs, fallen logs and stumps ---------- */
function blades(r, n, hMin, hMax, spread, colFn){ const geos = [];
  for (let i = 0; i < n; i++){ const a = r() * TAU, d = Math.sqrt(r()) * spread, h = hMin + r() * (hMax - hMin), w = 0.05 + r() * 0.04, lean = 0.15 + r() * 0.35, la = r() * TAU;
    const pos = [], col = [], nor = []; const segs = 3; const x0 = Math.cos(a) * d, z0 = Math.sin(a) * d; const dx = Math.cos(la + Math.PI / 2) * w, dz = Math.sin(la + Math.PI / 2) * w;
    const P = (t, side) => { const ww = (1 - t) * side; const bend = lean * t * t * h; return [x0 + dx * ww + Math.cos(la) * bend, t * h, z0 + dz * ww + Math.sin(la) * bend]; };
    const tri = (A, B, C, ta, tb, tc) => { for (const [v, t] of [[A, ta], [B, tb], [C, tc]]){ pos.push(...v); nor.push(Math.cos(la) * 0.3, 0.9, Math.sin(la) * 0.3); const c = colFn(t, i); col.push(c.r, c.g, c.b); } };
    for (let k = 0; k < segs; k++){ const t0 = k / segs, t1 = (k + 1) / segs; const a0 = P(t0, -1), b0 = P(t0, 1), a1 = P(t1, -1), b1 = P(t1, 1);
      if (k === segs - 1){ tri(a0, b0, P(1, 0), t0, t0, 1); } else { tri(a0, b0, b1, t0, t0, t1); tri(a0, b1, a1, t0, t1, t1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geos.push(g); }
  return geos; }
export function grassGeo(){ const r = mulberry(501); const c = new THREE.Color();
  return mergeGeometries(blades(r, 10, 0.35, 0.8, 0.28, (t, i) => c.setHex(i % 4 === 0 ? 0x8a9a4a : 0x5a7a2e).lerp(_c.setHex(0x2e4218), (1 - t) * 0.55).offsetHSL(0, 0, (i % 3) * 0.02).clone())); }
export function flowerGeo(){ const r = mulberry(733); const c = new THREE.Color(); const geos = blades(r, 7, 0.3, 0.55, 0.22, (t) => c.setHex(0x4e6e2a).lerp(_c.setHex(0x2a3a16), (1 - t) * 0.5).clone());
  const cols = [0xf2e6a0, 0xe8e4f0, 0xe08aa8, 0xf0b040, 0xb070c8];
  for (let i = 0; i < 6; i++){ const a = r() * TAU, d = r() * 0.25, h = 0.42 + r() * 0.25; const g = new THREE.OctahedronGeometry(0.06 + r() * 0.03, 0).toNonIndexed(); g.translate(Math.cos(a) * d, h, Math.sin(a) * d);
    const n = g.attributes.position.count, cc = new Float32Array(n * 3); _c.setHex(cols[(i + (r() * 5 | 0)) % cols.length]); for (let k = 0; k < n; k++){ cc[k*3] = _c.r; cc[k*3+1] = _c.g; cc[k*3+2] = _c.b; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geos.push(g);
    const st = blades(mulberry(i + 9), 1, h, h, 0, () => c.setHex(0x4e6e2a).clone())[0]; const sp = st.attributes.position; for (let k = 0; k < sp.count; k++){ sp.setX(k, sp.getX(k) * 0.3 + Math.cos(a) * d); sp.setZ(k, sp.getZ(k) * 0.3 + Math.sin(a) * d); } geos.push(st); }
  return mergeGeometries(geos.map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; })); }
export function shrubGeo(seed = 3){ // leafy round shrub with outward normals (lit like the tree canopies, not flat)
  const r = mulberry(seed * 97 + 5), cards = []; const blobs = [[0, 0.75, 0, 0.75], [0.45, 0.55, 0.2, 0.5], [-0.4, 0.55, -0.15, 0.55]];
  for (const [bx, by, bz, R] of blobs){ const n = Math.round(R * 16);
    for (let i = 0; i < n; i++){ const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); const dir = new THREE.Vector3(s * Math.cos(a), u * 0.8 + 0.1, s * Math.sin(a)).normalize(); const rr = R * (0.5 + r() * 0.5);
      const size = 0.7 + r() * 0.5; const pg = new THREE.PlaneGeometry(size, size); pg.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, r() * TAU))); pg.translate(bx + dir.x * rr, by + dir.y * rr * 0.8, bz + dir.z * rr);
      const g = pg.toNonIndexed(); const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, dir.x * 0.75, dir.y * 0.75 + 0.35, dir.z * 0.75); const sh = clamp(0.6 + dir.y * 0.3 + rr / R * 0.15, 0.4, 1.05);
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(sh), 3)); cards.push(g); } }
  return mergeGeometries(cards); }
export function logGeo(){ const P = []; const bark = (v, c) => c.setHex(0x5a4a36).offsetHSL(0, 0, Math.sin(v.x * 5 + v.z * 9) * 0.03 + Math.sin(v.y * 31) * 0.015);
  P.push([cyl(0.3, 0.36, 4.2, 9), bark, M(0, 0.28, 0, 0, 0, Math.PI / 2)]); P.push([cyl(0.31, 0.31, 0.02, 9), 0xa08a62, M(2.1, 0.28, 0, 0, 0, Math.PI / 2)]); P.push([cyl(0.37, 0.37, 0.02, 9), 0x9a845c, M(-2.1, 0.28, 0, 0, 0, Math.PI / 2)]);
  P.push([cyl(0.06, 0.1, 0.9, 6), bark, M(0.6, 0.6, 0.15, 0.5, 0, -0.7)]); P.push([cyl(0.05, 0.08, 0.7, 6), bark, M(-1.1, 0.55, -0.2, -0.6, 0, 0.5)]);
  for (let i = 0; i < 2; i++) P.push([new THREE.IcosahedronGeometry(0.13 + i * 0.02, 0), 0x4e6a30, M(-1.2 + i * 1.9, 0.55 + (i % 2) * 0.05, (i % 2 ? 0.2 : -0.18), 0, 0, 0, 1.3, 0.5, 1.2)]);
  return mergeColored(P); }
export function stumpGeo(){ const P = []; const r = mulberry(61); const bark = (v, c) => c.setHex(0x5d5444).offsetHSL(0, 0, Math.sin(v.y * 9 + v.x * 4) * 0.03);
  const t = cyl(0.42, 0.55, 0.7, 10); const p = t.attributes.position; for (let i = 0; i < p.count; i++){ if (p.getY(i) > 0.3) p.setY(i, 0.35 + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 3) * 0.06); } t.computeVertexNormals();
  P.push([t, bark, M(0, 0.32, 0)]); P.push([cyl(0.36, 0.36, 0.02, 10), 0xa89068, M(0, 0.69, 0)]); for (let k = 0; k < 4; k++){ const a = k / 4 * TAU + r(); P.push([cyl(0.05, 0.14, 0.8, 5), bark, M(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55, 0, -a, Math.PI / 2 - 0.25)]); }
  P.push([new THREE.CylinderGeometry(0.12, 0.08, 0.04, 8), 0xd8b070, M(0.38, 0.45, 0.22, 0, 0, 1.2)]); return mergeColored(P); }
/* path curb: four stone blocks along x in [-0.5,0.5] (scaled to the run length in the game) */
export function curbGeo(){ const P = []; const r = mulberry(17); for (let i = 0; i < 4; i++) P.push([box(0.235, 0.16, 0.2), _c.setHex(0x9a9282).offsetHSL(0, 0, (r() - 0.5) * 0.08).getHex(), M(-0.375 + i * 0.25, 0.06, 0)]); return mergeColored(P); }
export function rockGeo(seed){ const r = mulberry(seed); const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position;
  const offs = []; for (let i = 0; i < 6; i++) offs.push([r() * TAU, r() * TAU, 0.15 + r() * 0.2]);
  for (let i = 0; i < p.count; i++){ _v.fromBufferAttribute(p, i); let k = 1; for (const [a, b, s] of offs) k += Math.sin(_v.x * 2.3 + a) * Math.cos(_v.z * 2.1 + b) * s * 0.5; _v.multiplyScalar(k); _v.y *= 0.62; p.setXYZ(i, _v.x, _v.y, _v.z); }
  g.computeVertexNormals(); return mergeColored([[g, (v, c) => c.setHex(0x8a8476).offsetHSL(0, 0, v.y * 0.08 - 0.03)]]); }

/* ---------------- buildings (front faces +Z, footprint centred) ---------------- */
const COL = { wood: 0x6b4c2e, woodD: 0x4a3420, thatch: 0x9c7b45, thatchD: 0x7a5c30, stone: 0x8d8576, stoneD: 0x6c6558, cream: 0xe6dcc4, concrete: 0xb9b4a8, metal: 0x6e7270, glass: 0x2e4a52, amber: 0xe0a43a, yellow: 0xf2c230, black: 0x1c1c18, red: 0xa8321f, green: 0x3c5a34, roof: 0x4b5a3c };
function hip(w, d, h){ const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(w, h, d); g.translate(0, h / 2, 0); return g; }
function hazard(w, h, d){ return [box(w, h, d), (v, c) => c.setHex(((Math.floor((v.x + v.y) * 2.5) % 2) + 2) % 2 ? COL.yellow : COL.black)]; }
/* ---------- v7 building detail (hi quality); the plain v6 shapes above stay as the low-quality version ---------- */
function winFrame(add, w, h, x, y, z, ry = 0, col = COL.woodD, glass = COL.glass){ // glazed window with frame, mullion and sill, facing +Z then turned by ry
  const R = (dx, dy, dz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + dx * c + dz * s, y + dy, z - dx * s + dz * c]; };
  const P = (g, cl, dx, dy, dz) => add(g, cl, M(...R(dx, dy, dz), 0, ry, 0));
  P(box(w, h, 0.08), glass, 0, 0, 0); P(box(w + 0.2, 0.12, 0.16), col, 0, h / 2 + 0.04, 0.04); P(box(w + 0.3, 0.1, 0.3), col, 0, -h / 2 - 0.05, 0.1);
  for (const sd of [-1, 1]) P(box(0.1, h, 0.16), col, sd * (w / 2 + 0.03), 0, 0.04); P(box(0.06, h, 0.1), col, 0, 0, 0.06); P(box(w, 0.05, 0.1), col, 0, 0, 0.06);
}
function rail(add, x0, z0, x1, z1, y, col, posts = 3){ const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
  add(box(0.08, 0.08, L), col, M((x0 + x1) / 2, y, (z0 + z1) / 2, 0, a, 0)); add(box(0.06, 0.06, L), col, M((x0 + x1) / 2, y - 0.45, (z0 + z1) / 2, 0, a, 0));
  for (let k = 0; k <= posts; k++){ const t = k / posts; add(box(0.08, 0.9, 0.08), col, M(lerp(x0, x1, t), y - 0.45, lerp(z0, z1, t))); } }
function shrubs(add, x, y, z, n, seed){ const r = mulberry(seed); for (let i = 0; i < n; i++) add(new THREE.IcosahedronGeometry(0.28 + r() * 0.18, 0), _c.setHex(0x4a6a2c).offsetHSL((r() - .5) * .04, 0, (r() - .5) * .08).getHex(), M(x + (r() - .5) * 0.8, y + 0.2 + r() * 0.2, z + (r() - .5) * 0.5)); }
function buildingDetail(type, add){
  switch (type){
    case 'gate': {
      for (const sd of [-1, 1]){ add(box(0.9, 3.2, 0.06), COL.red, M(sd * 5.2, 7.6, 0.82)); add(box(0.9, 0.5, 0.07), COL.amber, M(sd * 5.2, 6.1, 0.82)); add(box(1.0, 0.12, 0.12), COL.woodD, M(sd * 5.2, 9.25, 0.82));
        add(cyl(0.45, 0.25, 0.5, 8), 0x2a2018, M(sd * 5.2, 12.75, 0)); for (let k = 0; k < 4; k++) add(box(0.06, 0.6, 0.06), 0x2a2018, M(sd * 5.2 + Math.cos(k * 1.57) * 0.42, 12.8, Math.sin(k * 1.57) * 0.42));
      }
      for (let k = -2; k <= 2; k++) add(box(0.3, 0.5, 1.3), COL.wood, M(k * 2.4, 11.85, 0)); break; }
    case 'visitor': {
      add(box(10.6, 0.55, 10.6), COL.stoneD, M(0, 1.05, 0)); add(box(10.7, 0.3, 10.7), COL.woodD, M(0, 4.85, 0));
      for (const [x, z] of [[-5.2, 5.2], [5.2, 5.2], [-5.2, -5.2], [5.2, -5.2]]) add(box(0.55, 4.2, 0.55), COL.woodD, M(x, 2.9, z));
      add(box(6.5, 0.2, 0.3), COL.woodD, M(0, 4.15, 5.32)); add(box(6.5, 0.2, 0.3), COL.woodD, M(0, 1.05, 5.32)); add(box(1.9, 2.7, 0.12), 0x2e3a30, M(0, 2.25, 5.4)); add(box(0.08, 2.6, 0.14), 0x8a7a5a, M(0, 2.25, 5.47));
      for (const sd of [-1, 1]) add(box(0.06, 0.4, 0.06), 0xd8c070, M(sd * 0.25, 2.2, 5.5));
      add(box(6.4, 0.4, 1.5), COL.stone, M(0, 0.2, 6.45)); add(box(6.4, 0.2, 0.8), COL.stone, M(0, 0.5, 6.1));
      for (const sd of [-1, 1]){ winFrame(add, 1.7, 1.5, sd * 5.26, 2.8, 2.2, sd * Math.PI / 2); winFrame(add, 1.7, 1.5, sd * 5.26, 2.8, -2.2, sd * Math.PI / 2); winFrame(add, 1.7, 1.5, sd * 2.4, 2.8, -5.26, Math.PI); }
      add(box(13.9, 0.32, 0.16), COL.woodD, M(0, 5.12, 6.9)); add(box(13.9, 0.32, 0.16), COL.woodD, M(0, 5.12, -6.9)); add(box(0.16, 0.32, 13.9), COL.woodD, M(6.9, 5.12, 0)); add(box(0.16, 0.32, 13.9), COL.woodD, M(-6.9, 5.12, 0));
      add(hip(12.4, 12.4, 2.3), COL.thatch, M(0, 5.35, 0)); add(cyl(4.5, 4.6, 0.25, 16), COL.woodD, M(0, 8.25, 0)); add(new THREE.ConeGeometry(0.9, 0.9, 10), COL.woodD, M(0, 11.75, 0));
      add(cyl(0.05, 0.05, 3.2, 5), COL.metal, M(0, 13.6, 0)); add(box(1.3, 0.75, 0.04), COL.red, M(0.7, 14.75, 0)); add(box(1.3, 0.16, 0.05), COL.amber, M(0.7, 14.75, 0));
      for (let k = 0; k < 8; k++){ const a = k / 8 * TAU; add(box(0.18, 0.22, 1.1), COL.woodD, M(Math.sin(a) * 6.75, 4.7, Math.cos(a) * 6.75, 0, a, 0)); }
      for (const sd of [-1, 1]){ add(box(1.2, 0.6, 1.2), COL.stone, M(sd * 3.9, 0.3 + 0.0, 6.6)); shrubs(add, sd * 3.9, 0.55, 6.6, 4, 7 + sd); add(box(1.8, 0.1, 0.5), COL.wood, M(sd * 5.4, 0.48, 6.4)); for (const e of [-0.75, 0.75]) add(box(0.1, 0.45, 0.45), COL.woodD, M(sd * 5.4 + e, 0.22, 6.4)); }
      break; }
    case 'hatchery': {
      for (let k = -3; k <= 3; k++) add(box(0.09, 1.3, 0.16), 0x5a605c, M(k * 1.0, 3.1, 2.66)); add(box(6.4, 0.12, 0.2), 0x5a605c, M(0, 3.75, 2.66)); add(box(6.4, 0.16, 0.3), 0x5a605c, M(0, 2.45, 2.7));
      add(box(2.3, 0.16, 0.22), 0x5a605c, M(0, 3.15, 2.68)); for (const sd of [-1, 1]) add(box(0.14, 2.7, 0.22), 0x5a605c, M(sd * 1.08, 1.8, 2.68));
      add(box(7.25, 0.32, 0.16), 0xd8d6ce, M(0, 5.05, 2.62)); add(box(7.25, 0.32, 0.16), 0xd8d6ce, M(0, 5.05, -3.42)); for (const sd of [-1, 1]) add(box(0.16, 0.32, 6.2), 0xd8d6ce, M(sd * 3.55, 5.05, -0.4));
      for (const a of [0, 1.05, 2.1]){ const g = new THREE.TorusGeometry(2.02, 0.045, 4, 18, Math.PI); g.rotateY(a); add(g, 0x9aa2a2, M(1.2, 4.9, -0.8)); }
      add(cyl(0.38, 0.38, 0.1, 12), 0x3a3e3c, M(-2.4, 6.05, -1.8)); for (let k = -2; k <= 2; k++) add(box(0.04, 0.9, 0.04), 0x3a3e3c, M(-2.4 + k * 0.2, 5.4, -1.28));
      for (const [x, z] of [[-1.2, -2.6], [2.9, 1.6]]){ add(cyl(0.12, 0.12, 0.9, 8), COL.metal, M(x, 5.4, z)); add(cyl(0.2, 0.2, 0.08, 8), COL.metal, M(x, 5.88, z)); }
      add(cyl(0.09, 0.09, 4.2, 6), 0x7a7e7c, M(3.6, 2.6, 1.9)); add(cyl(0.09, 0.09, 4.2, 6), 0x7a7e7c, M(3.6, 2.6, 1.6)); add(box(0.4, 0.5, 0.3), 0x7a7e7c, M(3.65, 1.2, 1.75));
      add(box(3.2, 0.12, 1.5), COL.metal, M(0, 3.45, 3.35)); for (const sd of [-1, 1]) add(cyl(0.06, 0.06, 3.0, 6), COL.metal, M(sd * 1.45, 1.95, 3.95));
      for (const x of [-2.6, -1.9, 1.9, 2.6]){ add(cyl(0.11, 0.11, 0.9, 8), COL.yellow, M(x, 0.95, 3.4)); add(cyl(0.115, 0.115, 0.16, 8), COL.black, M(x, 1.15, 3.4)); }
      break; }
    case 'food': {
      for (const sd of [-1, 1]) add(cyl(0.05, 0.05, 2.0, 6), COL.metal, M(sd * 1.6, 1.85, 1.95)); add(box(3.0, 0.08, 0.62), 0xb89a6a, M(0, 1.18, 1.25));
      for (let k = 0; k < 4; k++) add(cyl(0.07, 0.06, 0.2, 7), k % 2 ? 0xd83a2a : 0xf0ece0, M(-0.9 + k * 0.5, 1.32, 1.3));
      add(box(2.6, 0.12, 0.14), COL.woodD, M(0, 2.22, 1.06)); add(box(2.6, 0.12, 0.14), COL.woodD, M(0, 1.18, 1.06)); for (const sd of [-1, 1]) add(box(0.12, 1.1, 0.14), COL.woodD, M(sd * 1.25, 1.7, 1.06));
      for (const sd of [-1, 1]) add(cyl(0.05, 0.05, 1.2, 6), COL.woodD, M(sd * 0.9, 3.55, 0.75)); add(box(2.3, 0.75, 0.12), COL.woodD, M(0, 4.15, 0.75));
      add(cyl(0.14, 0.14, 1.0, 8), COL.metal, M(0.9, 3.3, -1.0)); add(new THREE.ConeGeometry(0.24, 0.2, 8), COL.metal, M(0.9, 3.9, -1.0));
      add(box(0.7, 1.0, 0.6), 0xd8d8d0, M(-1.75, 0.75, -0.6)); add(box(0.5, 0.06, 0.04), COL.metal, M(-1.75, 0.95, -0.28));
      break; }
    case 'gift': {
      for (const sd of [-1, 1]){ winFrame(add, 0.9, 0.8, sd * 0.95, 1.6, 1.53, 0, COL.woodD, COL.glass); for (let k = 0; k < 3; k++) add(box(0.18, 0.22, 0.14), [0x4a7a3a, 0xc96a2c, 0x8a5aa0][k], M(sd * 0.95 - 0.28 + k * 0.28, 1.31, 1.72)); }
      add(box(1.15, 0.12, 0.16), COL.woodD, M(0, 2.24, 1.55)); for (const sd of [-1, 1]) add(box(0.12, 2.0, 0.16), COL.woodD, M(sd * 0.55, 1.25, 1.55)); add(new THREE.SphereGeometry(0.05, 6, 4), 0xd8c070, M(0.3, 1.2, 1.62));
      for (let k = 0; k < 6; k++){ const y = 0.55 + k * 0.42; add(box(3.04, 0.04, 3.04), COL.woodD, M(0, y, 0)); }
      for (const sd of [-1, 1]) add(cyl(0.09, 0.1, 2.6, 7), COL.woodD, M(sd * 1.85, 1.6, 1.85));
      add(box(0.5, 0.3, 0.9), 0x4a7a3a, M(-1.95, 0.55, -0.6)); add(box(0.25, 0.3, 0.35), 0x4a7a3a, M(-1.95, 0.85, -0.1)); add(box(0.08, 0.3, 0.45), 0x4a7a3a, M(-1.95, 0.45, -1.2, 0.5, 0, 0));
      break; }
    case 'restroom': {
      for (const sd of [-1, 1]){ add(box(1.0, 0.12, 0.16), 0x2a3a44, M(sd * 0.8, 2.1, 1.34)); for (const e of [-1, 1]) add(box(0.12, 1.9, 0.16), 0x2a3a44, M(sd * 0.8 + e * 0.45, 1.15, 1.34)); add(new THREE.SphereGeometry(0.04, 6, 4), 0xc0c0b8, M(sd * 0.8 + sd * 0.3, 1.15, 1.4)); }
      add(box(3.25, 0.4, 2.65), COL.stoneD, M(0, 0.45, 0)); add(box(3.25, 0.14, 2.65), 0x3c5a6a, M(0, 2.45, 0));
      for (const x of [-0.9, 0.9]){ add(cyl(0.08, 0.08, 0.6, 8), COL.metal, M(x, 3.2, -0.6)); add(cyl(0.13, 0.13, 0.06, 8), COL.metal, M(x, 3.52, -0.6)); }
      add(box(3.6, 0.1, 0.18), 0x5a605c, M(0, 2.98, 1.48)); shrubs(add, 1.95, 0.0, 0.8, 3, 41); shrubs(add, -1.95, 0.0, 0.8, 3, 43);
      break; }
    case 'ranger': {
      winFrame(add, 1.6, 0.8, -2.7, 2.2, 0.64, 0, 0x2e3426); winFrame(add, 1.6, 0.8, 0.7, 2.2, 0.64, 0, 0x2e3426); for (const sd of [-1, 1]) winFrame(add, 1.2, 0.8, -1 + sd * 2.53, 2.2, -1.4, sd * Math.PI / 2, 0x2e3426);
      add(box(1.4, 0.14, 0.18), 0x2e3426, M(-1, 2.45, 0.66)); for (const sd of [-1, 1]) add(box(0.14, 2.1, 0.18), 0x2e3426, M(-1 + sd * 0.66, 1.4, 0.66));
      add(box(2.4, 0.1, 1.3), COL.metal, M(-1, 2.95, 1.25, 0.12, 0, 0)); for (const sd of [-1, 1]) add(cyl(0.05, 0.05, 2.6, 6), 0x2e3426, M(-1 + sd * 1.1, 1.65, 1.8)); add(box(1.8, 0.2, 0.7), COL.concrete, M(-1, 0.5, 1.1));
      for (let k = 0; k < 12; k++) add(box(1.2, 0.06, 0.06), COL.woodD, M(2.8, 0.7 + k * 0.48, -1.55));
      for (const sd of [-1, 1]){ add(box(0.06, 5.4, 0.06), COL.woodD, M(sd > 0 ? 3.4 : 2.2, 3.3, -2.2, 0.38 * sd, 0, 0)); add(box(1.2, 0.06, 0.06), COL.woodD, M(2.8, 6.95, -2.2 + sd * 0.9)); add(box(0.06, 0.06, 1.8), COL.woodD, M(2.8 + sd * 0.9, 6.95, -2.2)); }
      add(new THREE.SphereGeometry(0.16, 8, 6), 0xd8321f, M(2.8, 8.4, -2.2)); add(cyl(0.04, 0.04, 2.2, 5), COL.metal, M(-2.6, 4.6, -2.6)); add(new THREE.SphereGeometry(0.45, 10, 6, 0, TAU, 0, Math.PI / 2), 0xd8d8d0, M(-0.4, 3.7, -2.4, -1.1, 0, 0));
      add(box(1.6, 0.8, 0.08), 0x3c5a34, M(-1, 4.2, -3.38)); break; }
    case 'viewing': {
      for (let k = 0; k < 8; k++) add(box(1.0, 0.08, 0.32), COL.woodD, M(2.2, 0.25 + k * 0.5, 2.9 - k * 0.42));
      for (const sd of [-1, 1]){ add(cyl(0.05, 0.05, 1.0, 6), COL.metal, M(sd * 0.9, 4.6, 1.5)); add(box(0.32, 0.16, 0.2), 0x2a2a26, M(sd * 0.9, 5.15, 1.5)); for (const e of [-1, 1]) add(cyl(0.05, 0.05, 0.2, 6), 0x2a2a26, M(sd * 0.9 + e * 0.07, 5.15, 1.62, Math.PI / 2, 0, 0)); }
      for (const s of [-1, 1]){ add(box(3.8, 0.06, 0.06), COL.woodD, M(0, 4.55, s * 1.85)); add(box(0.06, 0.06, 3.8), COL.woodD, M(s * 1.85, 4.55, 0)); }
      add(box(4.5, 0.1, 4.5), COL.thatchD, M(0, 6.65, 0)); break; }
    case 'meat': { add(cyl(0.3, 0.3, 0.15, 8), COL.metal, M(0, 7.05, 1.4)); add(box(0.6, 0.06, 0.6), COL.metal, M(0, 6.85, 0.2)); break; }
    case 'plant': { for (let i = 0; i < 6; i++) add(new THREE.ConeGeometry(0.12, 0.5, 5), 0x6a9a3a, M(-1.2 + i * 0.48, 1.45, 0.35 - (i % 2) * 0.6, 0.2, 0, 0.1)); break; }
  }
}
/* ---------- signs: one canvas atlas (2 x 4 slots of 512 x 128) shared by every building ---------- */
export const SIGN = { visitor: [0, 'VISITOR CENTRE', '#2a1c10', '#e8a93a'], hatchery: [1, 'HATCHERY', '#e8e6de', '#1e2a2e'], food: [2, 'SNACKS', '#a8321f', '#f4ead0'], gift: [3, 'GIFT SHOP', '#3a2a18', '#e8c060'],
  restroom: [4, 'RESTROOMS', '#2c4a5c', '#f0f0e8'], ranger: [5, 'RANGERS', '#33402a', '#f2c230'] };
const SIGN_POS = { visitor: [[0, 4.55, 5.39, 3.9, 0.66, 0]], hatchery: [[0, 4.2, 2.69, 3.0, 0.6, 0]], food: [[0, 4.15, 0.82, 2.2, 0.55, 0], [0, 4.15, 0.68, 2.2, 0.55, Math.PI]], gift: [[0, 2.6, 1.61, 1.75, 0.44, 0]],
  restroom: [[0, 2.38, 1.36, 2.0, 0.4, 0]], ranger: [[-1, 3.15, 0.66, 2.2, 0.48, 0]] };
export function signAtlasCanvas(){
  const c = mk(1024, 512), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1024, 512); // bottom row stays white: building bodies sample it
  for (const k in SIGN){ const [slot, text, bg, fg] = SIGN[k]; const x = (slot % 2) * 512, y = (slot >> 1) * 128;
    g.fillStyle = bg; g.fillRect(x, y, 512, 128); g.strokeStyle = fg; g.globalAlpha = 0.85; g.lineWidth = 6; g.strokeRect(x + 10, y + 10, 492, 108); g.globalAlpha = 1;
    let fs = 78; g.font = `900 ${fs}px Georgia, "Times New Roman", serif`; while (g.measureText(text).width > 440 && fs > 30){ fs -= 2; g.font = `900 ${fs}px Georgia, "Times New Roman", serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 4; g.shadowOffsetY = 2; g.fillText(text, x + 256, y + 68); g.shadowColor = 'transparent'; }
  return c;
}
export function signGeo(type){
  const S = SIGN[type], P = SIGN_POS[type]; if (!S || !P) return null; const slot = S[0], u0 = (slot % 2) * 0.5, v1 = 1 - (slot >> 1) * 0.25, v0 = v1 - 0.25;
  const geos = P.map(([x, y, z, w, h, ry]) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.25); g.rotateY(ry); g.translate(x, y, z); return g; });
  return mergeGeometries(geos, false);
}
export function buildingGeo(type, hi = true){
  const P = [];
  const add = (g, col, m) => P.push([g, col, m]);
  if (hi) buildingDetail(type, add);
  switch (type){
    case 'gate': { // 2 tiles wide (8m) x 1 deep; opening along Z
      for (const sd of [-1, 1]){ add(cyl(0.75, 0.9, 12, 10), COL.woodD, M(sd * 5.2, 6, 0)); add(cyl(0.95, 1.05, 1.2, 10), COL.stone, M(sd * 5.2, 0.6, 0));
        add(cyl(0.18, 0.12, 1.2, 6), COL.black, M(sd * 5.2, 12.5, 0)); add(box(0.5, 0.5, 0.5), 0x2a2018, M(sd * 5.2, 12.0, 0));
        for (const y of [3, 7, 10]) add(cyl(0.8, 0.8, 0.25, 10), COL.wood, M(sd * 5.2, y, 0)); }
      add(box(12.4, 1.1, 1.1), COL.woodD, M(0, 10.6, 0)); add(box(13.2, 0.4, 1.4), COL.wood, M(0, 11.3, 0));
      for (const sd of [-1, 1]) add(box(4.2, 7.5, 0.25), COL.wood, M(sd * 3.6, 3.75, 2.2, 0, sd * 1.1, 0));
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) add(box(0.12, 7.2, 0.3), COL.woodD, M(sd * (2.2 + k * 1.3) , 3.75, 2.2 + k * 0.55, 0, sd * 1.1, 0));
      break; }
    case 'visitor': { // 3x3 = 12m
      add(box(11.4, 0.8, 11.4), COL.stone, M(0, 0.4, 0)); add(box(10.4, 4.2, 10.4), COL.cream, M(0, 2.9, 0));
      add(box(6.2, 3.0, 0.2), COL.glass, M(0, 2.6, 5.25)); for (let i = -3; i <= 3; i++) add(box(0.14, 3.2, 0.3), COL.woodD, M(i * 1.0, 2.6, 5.3));
      add(cyl(3.4, 3.6, 3.2, 16), COL.cream, M(0, 6.6, 0)); add(new THREE.ConeGeometry(4.4, 3.4, 16), COL.thatch, M(0, 9.9, 0));
      add(hip(13.6, 13.6, 3.0), COL.thatchD, M(0, 5.0, 0)); add(box(13.8, 0.3, 13.8), COL.woodD, M(0, 5.05, 0));
      for (const [x, z] of [[-5, 5], [5, 5], [-5, -5], [5, -5]]) add(cyl(0.35, 0.4, 5, 8), COL.woodD, M(x * 1.25, 2.5, z * 1.25));
      add(box(4, 0.7, 0.15), COL.amber, M(0, 4.55, 5.3));
      break; }
    case 'hatchery': { // 2x2 = 8m
      add(box(7.4, 0.5, 7.4), COL.concrete, M(0, 0.25, 0)); add(box(7, 4.4, 6), 0xe9e7df, M(0, 2.6, -0.4));
      add(box(6.2, 1.2, 0.12), COL.glass, M(0, 3.1, 2.62)); add(box(2, 2.6, 0.12), 0x3a4c50, M(0, 1.8, 2.63));
      add(new THREE.SphereGeometry(2.0, 18, 10, 0, TAU, 0, Math.PI / 2), 0xbfd3d6, M(1.2, 4.8, -0.8)); add(cyl(2.05, 2.05, 0.3, 18), COL.metal, M(1.2, 4.9, -0.8));
      add(box(1, 1.2, 1), COL.metal, M(-2.4, 5.4, -1.8)); add(cyl(0.25, 0.25, 2.2, 8), COL.metal, M(-2.4, 6.2, 0.6));
      add(...hazard(7.0, 0.35, 0.1), M(0, 4.6, 2.62)); add(box(7.2, 0.25, 6.2), 0x8f938f, M(0, 4.9, -0.4));
      break; }
    case 'meat': {
      add(box(2.4, 0.3, 2.4), COL.concrete, M(0, 0.15, 0)); add(cyl(0.18, 0.22, 7, 8), COL.metal, M(0, 3.5, 0)); add(box(0.25, 0.25, 3.2), COL.metal, M(0, 6.9, 1.4));
      add(cyl(0.02, 0.02, 2.4, 4), COL.black, M(0, 5.6, 2.9)); add(box(1.1, 1.4, 1.1), 0x7a2c22, M(0, 3.9, 2.9)); add(box(1.15, 0.2, 1.15), COL.metal, M(0, 4.65, 2.9));
      add(...hazard(0.5, 1.2, 0.5), M(0, 0.9, 0)); break; }
    case 'plant': {
      add(box(3.2, 0.9, 1.6), COL.wood, M(0, 0.45, 0)); add(box(3.0, 0.35, 1.4), 0x4f7a2e, M(0, 1.0, 0));
      for (let i = 0; i < 9; i++) add(new THREE.IcosahedronGeometry(0.35, 0), 0x5e8a36, M(-1.2 + i * 0.3, 1.25 + (i % 2) * 0.12, (i % 3 - 1) * 0.3));
      for (const sd of [-1, 1]) add(cyl(0.1, 0.1, 2.6, 6), COL.woodD, M(sd * 1.5, 1.3, 0)); add(hip(3.8, 2.2, 0.8), COL.thatch, M(0, 2.5, 0)); break; }
    case 'viewing': {
      for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) add(cyl(0.16, 0.2, 4, 8), COL.woodD, M(x, 2, z));
      add(box(3.8, 0.25, 3.8), COL.wood, M(0, 4.0, 0)); for (const s of [-1, 1]){ add(box(3.8, 0.1, 0.1), COL.woodD, M(0, 5.0, s * 1.85)); add(box(0.1, 0.1, 3.8), COL.woodD, M(s * 1.85, 5.0, 0)); }
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]){ add(box(0.08, 1, 0.08), COL.woodD, M(-1.8 + i * 0.9, 4.5, s * 1.85)); }
      add(box(1.0, 0.15, 4.6), COL.wood, M(2.2, 2.0, 1.0, -0.72, 0, 0)); add(hip(4.4, 4.4, 1.4), COL.thatch, M(0, 6.6, 0)); for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) add(cyl(0.08, 0.08, 2.4, 6), COL.woodD, M(x, 5.4, z));
      break; }
    case 'food': {
      add(box(3.2, 0.25, 3.2), COL.stone, M(0, 0.12, 0)); add(box(2.8, 2.4, 2.4), COL.cream, M(0, 1.45, -0.2)); add(box(2.4, 1.0, 0.1), 0x2a2620, M(0, 1.7, 1.02));
      add(box(2.9, 0.9, 0.5), COL.wood, M(0, 0.7, 1.25));
      add(box(3.4, 0.08, 1.6), (v, c) => c.setHex(Math.floor((v.x + 2) * 2.2) % 2 ? COL.amber : COL.cream), M(0, 2.85, 1.3, 0.35, 0, 0)); add(hip(3.2, 2.8, 0.9), COL.roof, M(0, 2.65, -0.2));
      add(new THREE.SphereGeometry(0.35, 10, 8), 0xc96a2c, M(0, 3.9, -0.2)); break; }
    case 'gift': {
      add(box(3.4, 0.3, 3.4), COL.stone, M(0, 0.15, 0)); add(box(3.0, 2.6, 3.0), COL.wood, M(0, 1.6, 0)); add(box(1.0, 1.9, 0.1), 0x2a2620, M(0, 1.25, 1.52));
      add(box(0.9, 0.8, 0.1), COL.glass, M(-0.95, 1.6, 1.52)); add(box(0.9, 0.8, 0.1), COL.glass, M(0.95, 1.6, 1.52)); add(hip(4.4, 4.4, 1.8), COL.thatch, M(0, 2.9, 0));
      add(box(1.8, 0.45, 0.1), COL.amber, M(0, 2.6, 1.55)); break; }
    case 'restroom': {
      add(box(3.4, 0.25, 3.0), COL.concrete, M(0, 0.12, 0)); add(box(3.2, 2.5, 2.6), 0xd8d2c2, M(0, 1.5, 0)); for (const sd of [-1, 1]) add(box(0.8, 1.8, 0.1), 0x3c5a6a, M(sd * 0.8, 1.15, 1.32));
      add(box(3.5, 0.25, 2.9), COL.metal, M(0, 2.85, 0, 0.06, 0, 0)); add(box(0.5, 0.5, 0.06), COL.cream, M(0, 2.1, 1.33)); break; }
    case 'ranger': { // 2x2
      add(box(7.4, 0.4, 7.4), COL.concrete, M(0, 0.2, 0)); add(box(5, 3, 4), 0x56603e, M(-1, 1.9, -1.4)); add(box(5.4, 0.2, 4.6), COL.metal, M(-1, 3.5, -1.4, 0.1, 0, 0));
      add(box(1.2, 2, 0.1), 0x3a3426, M(-1, 1.4, 0.62)); add(box(1.6, 0.8, 0.1), COL.glass, M(-2.7, 2.2, 0.62)); add(box(1.6, 0.8, 0.1), COL.glass, M(0.7, 2.2, 0.62));
      for (const [x, z] of [[2.2, -2.8], [3.4, -2.8], [2.2, -1.6], [3.4, -1.6]]) add(cyl(0.1, 0.12, 7, 6), COL.woodD, M(x, 3.5, z));
      add(box(1.8, 0.2, 1.8), COL.wood, M(2.8, 6.4, -2.2)); add(box(1.9, 1.0, 0.08), COL.wood, M(2.8, 7.0, -1.3)); add(hip(2.4, 2.4, 1.0), COL.metal, M(2.8, 7.8, -2.2));
      add(...hazard(5.0, 0.3, 0.08), M(-1, 3.15, 0.64)); add(cyl(0.05, 0.05, 3, 4), COL.metal, M(-3.2, 5.0, -3.0));
      break; }
  }
  // body uvs sit in the sign atlas' white row; they vary slightly with position because constant uvs (zero derivatives) sparkled black in WebKit
  const body = mergeColored(P); const n = body.attributes.position.count; const uv = new Float32Array(n * 2); const bp = body.attributes.position; for (let k = 0; k < n; k++){ uv[k*2] = 0.5 + bp.getX(k) * 0.004 + bp.getZ(k) * 0.002; uv[k*2+1] = 0.1 + bp.getY(k) * 0.002; } body.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); // white row of the sign atlas
  const sg = hi ? signGeo(type) : null; if (!sg) return body;
  sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sg.attributes.position.count * 3).fill(1), 3)); if (sg.index) return mergeGeometries([body, sg.toNonIndexed()], false); return mergeGeometries([body, sg], false);
}
export const FOOT = { gate: [2, 1], visitor: [3, 3], hatchery: [2, 2], meat: [1, 1], plant: [1, 1], viewing: [1, 1], food: [1, 1], gift: [1, 1], restroom: [1, 1], ranger: [2, 2] };

/* ---------------- fences: panel spans x in [-2,2] at local origin, posts separate. hi adds per-tier detail (v7); lo is the v6 shape ---------------- */
function sagWire(y, z, sag, r = 0.02){ const pts = []; for (let k = 0; k <= 8; k++){ const t = k / 8; pts.push(new THREE.Vector3(-2 + 4 * t, y - sag * 4 * t * (1 - t), z)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, r, 3, false); }
export function fenceGeos(tier, hi = true){
  const P = [], Q = []; const add = (arr, g, c, m) => arr.push([g, c, m]);
  if (tier === 0){ add(P, cyl(0.12, 0.14, 2.0, 7), 0x5b4128, M(0, 1.0, 0)); add(P, new THREE.ConeGeometry(0.13, 0.25, 7), 0x5b4128, M(0, 2.1, 0));
    if (!hi){ for (const y of [0.7, 1.5]) add(Q, box(4.0, 0.16, 0.1), 0x76563a, M(0, y, 0)); add(Q, box(0.1, 1.2, 0.08), 0x6a4c30, M(0, 1.1, 0, 0, 0, 0.6)); }
    else { const bark = (base) => (v, c) => c.setHex(base).offsetHSL(0, 0, Math.sin(v.x * 7.3 + v.y * 3) * 0.035 + Math.sin(v.x * 23.1) * 0.02);
      for (const y of [0.55, 1.15, 1.72]) add(Q, cyl(0.075, 0.085, 4.0, 7), bark(0x76563a), M(0, y, 0, 0, 0, Math.PI / 2));
      add(Q, box(0.09, 1.45, 0.08), 0x6a4c30, M(0, 1.13, 0.04, 0, 0, 0.62)); add(Q, box(0.09, 1.45, 0.08), 0x6a4c30, M(0, 1.13, -0.04, 0, 0, -0.62));
      for (const y of [0.55, 1.15, 1.72]) add(P, cyl(0.145, 0.145, 0.05, 7), 0x3e2c1a, M(0, y, 0)); add(P, cyl(0.2, 0.24, 0.18, 7), 0x6c6558, M(0, 0.07, 0)); } }
  if (tier === 1){ add(P, cyl(0.06, 0.06, 2.8, 8), 0x9a9e9c, M(0, 1.4, 0)); add(P, new THREE.SphereGeometry(0.08, 6, 4), 0x9a9e9c, M(0, 2.82, 0));
    add(Q, cyl(0.04, 0.04, 4.0, 6), 0x9a9e9c, M(0, 2.7, 0, 0, 0, Math.PI / 2)); add(Q, cyl(0.03, 0.03, 4.0, 5), 0x9a9e9c, M(0, 0.08, 0, 0, 0, Math.PI / 2));
    if (hi){ add(Q, cyl(0.032, 0.032, 4.0, 5), 0x8e9290, M(0, 1.4, 0, 0, 0, Math.PI / 2)); for (let k = 0; k < 3; k++) add(Q, cyl(0.012, 0.012, 4.0, 3), 0x5a5e5c, M(0, 2.92 + k * 0.14, -0.12 - k * 0.12, 0, 0, Math.PI / 2));
      for (let k = 0; k < 10; k++) add(Q, box(0.02, 0.07, 0.07), 0x5a5e5c, M(-1.8 + k * 0.4, 3.06, -0.24, 0.8, 0, 0));
      add(P, box(0.05, 0.6, 0.05), 0x9a9e9c, M(0, 3.0, -0.2, -0.7, 0, 0)); for (const y of [0.35, 1.4, 2.5]) add(P, cyl(0.075, 0.075, 0.06, 8), 0x7e8280, M(0, y, 0)); add(P, cyl(0.13, 0.15, 0.14, 8), 0xb9b4a8, M(0, 0.05, 0)); } }
  if (tier === 2){ add(P, box(0.28, 4.8, 0.28), 0x3c3f3c, M(0, 2.4, 0)); add(P, box(0.5, 0.2, 0.5), 0x2a2c2a, M(0, 4.85, 0));
    if (!hi) for (let i = 0; i < 7; i++) add(Q, box(4.0, 0.035, 0.035), 0x2b2b28, M(0, 0.6 + i * 0.62, 0));
    else { for (let i = 0; i < 7; i++) add(Q, sagWire(0.6 + i * 0.62, 0, 0.07 + i * 0.006), 0x2b2b28);
      add(P, box(0.6, 0.35, 0.6), 0xb9b4a8, M(0, 0.17, 0)); add(P, box(0.9, 0.1, 0.1), 0x2a2c2a, M(0, 4.6, 0)); add(P, new THREE.SphereGeometry(0.09, 8, 6), 0xffb030, M(0, 5.05, 0));
      for (let i = 0; i < 7; i++) add(P, new THREE.ConeGeometry(0.07, 0.1, 6), 0x7a5a3a, M(0, 0.6 + i * 0.62, 0.2, Math.PI / 2, 0, 0)); add(P, box(0.2, 0.5, 0.12), 0x5a5e58, M(0, 1.3, -0.2)); }
    for (let i = 0; i < 7; i++) add(P, cyl(0.06, 0.06, 0.12, 6), 0xd8d0b8, M(0, 0.6 + i * 0.62, 0.12, Math.PI / 2, 0, 0));
    add(Q, ...hazard(0.9, 0.6, 0.04), M(0.8, 1.4, 0.05)); add(Q, box(0.5, 0.25, 0.05), 0xe8e0c8, M(0.8, 1.4, 0.08)); if (hi){ add(Q, ...hazard(0.9, 0.6, 0.04), M(-0.8, 1.4, -0.05)); add(Q, box(0.5, 0.25, 0.05), 0xe8e0c8, M(-0.8, 1.4, -0.08)); } }
  if (tier === 3){ add(P, box(0.9, 6.6, 1.3), 0x8f8a80, M(0, 3.3, 0.3)); add(P, box(1.1, 0.3, 1.5), 0x7a766e, M(0, 6.6, 0.3)); add(P, box(0.2, 0.2, 0.6), 0x2a2a28, M(0, 6.9, 0.6)); add(P, new THREE.SphereGeometry(0.18, 8, 6), 0xfff2c0, M(0, 6.9, 0.95));
    add(Q, box(4.0, 6.2, 0.55), (v, c) => { c.setHex(0xa49f94).offsetHSL(0, 0, (Math.sin(v.x * 9.1) * Math.sin(v.y * 7.3)) * 0.02 - (v.y < 0.6 ? 0.08 : 0) - Math.max(0, v.y - 5.9) * 0.1 - (hi ? Math.max(0, 1.4 - v.y) * 0.04 + Math.max(0, Math.sin(v.x * 3.1 + v.y * 0.4)) * Math.max(0, 3 - v.y) * 0.015 : 0)); }, M(0, 3.1, 0));
    add(Q, ...hazard(4.0, 0.4, 0.58), M(0, 0.6, 0));
    if (hi){ for (const x of [-0.67, 0.67]) for (const z of [-0.29, 0.29]) add(Q, box(0.05, 5.6, 0.03), 0x7c776c, M(x, 3.4, z)); for (const z of [-0.29, 0.29]) add(Q, box(4.0, 0.05, 0.03), 0x7c776c, M(0, 3.4, z));
      add(Q, box(4.0, 0.22, 0.8), 0x8a857a, M(0, 6.3, 0)); add(Q, box(4.0, 0.3, 0.75), 0x77736a, M(0, 0.15, 0));
      const pts = []; for (let k = 0; k <= 96; k++){ const t = k / 96, a = t * TAU * 7; pts.push(new THREE.Vector3(-2 + 4 * t, 6.72 + Math.sin(a) * 0.3, Math.cos(a) * 0.3)); }
      add(Q, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.018, 3, false), 0x6a6e6c); for (const z of [-0.22, 0.22]) add(Q, box(4.0, 0.04, 0.04), 0x4a4e4c, M(0, 6.45, z));
      add(P, box(1.0, 0.45, 1.4), 0x77736a, M(0, 0.22, 0.3)); add(P, box(0.1, 0.5, 0.1), 0x2a2a28, M(0, 6.55, 0.95)); } }
  const post = mergeColored(P); const panel = mergeColored(Q); let mesh = null;
  if (tier === 1){ mesh = new THREE.PlaneGeometry(4.0, 2.6); mesh.translate(0, 1.35, 0); const p = mesh.attributes.position, uv = mesh.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 2.5, p.getY(i) * 2.5); }
  return { post, panel, mesh };
}
export const FENCE_TIERS = [
  { name: 'Wooden', str: 2.0, cost: 60, upkeep: 2, decay: 0.005, color: '#8a6a44', desc: 'Cheap timber rails. Small herbivores only.' },
  { name: 'Chain-link', str: 3.5, cost: 140, upkeep: 3, decay: 0.0032, color: '#9aa09c', desc: 'Steel mesh. Triceratops and other mid-size herbivores, Dilophosaurus.' },
  { name: 'Electric', str: 5.5, cost: 320, upkeep: 14, decay: 0.0026, color: '#f2c230', desc: '10,000 volts. Raptors and sauropods.' },
  { name: 'Reinforced Concrete', str: 8.5, cost: 700, upkeep: 6, decay: 0.0013, color: '#b9b4a8', desc: 'Six-metre walls. Built for a T. rex.' },
];

/* ---------------- guests: one geometry, one draw call. aPart picks the colour in the shader (0 fixed, 1 shirt, 2 pants, 3 skin, 4 hair, 5 cap, 6 safari hat, 7 backpack, 8 lower leg = pants or skin for shorts); aLeg +-1 legs, +-2 arms ---------------- */
export const GUEST_PAL = { pants: [0x8a7a58, 0x34465e, 0x2a2a28, 0x4f5636, 0x6a6a66, 0xb09a74, 0x1e2a40, 0x5a4030], skin: [0xf0c8a8, 0xd8a882, 0xc08a64, 0x9a6a48, 0x6e4a32, 0x4a3022],
  hair: [0x1a1410, 0x3a2618, 0x6a4424, 0xb08a50, 0x8a8a86, 0x9a3a1a], hat: [0xb8321f, 0x26344c, 0xc8b88a, 0xe8e4da, 0x3c5a34, 0xd8a030, 0x2a6a6a, 0x6a4a7a], pack: [0x3a5a34, 0xb8321f, 0x26344c, 0xd88a2a, 0x4a4a48, 0x2a6a6a] };
export function guestGeos(hi = true){
  const P = []; const add = (g, part, leg, m, col = 0xffffff) => P.push([g, part, leg, m, col]);
  if (!hi){ // v6 shape, merged
    add(cyl(0.2, 0.17, 0.62, 8), 1, 0, M(0, 1.22, 0)); for (const sd of [-1, 1]) add(cyl(0.06, 0.05, 0.6, 6), 1, 0, M(sd * 0.24, 1.2, 0, 0, 0, sd * 0.08));
    for (const sd of [-1, 1]){ add(cyl(0.085, 0.07, 0.9, 6), 2, sd, M(sd * 0.1, 0.46, 0)); add(box(0.12, 0.08, 0.24), 0, sd, M(sd * 0.1, 0.04, 0.04), 0x2a2620); add(new THREE.SphereGeometry(0.05, 6, 4), 3, 0, M(sd * 0.27, 0.9, 0)); }
    add(new THREE.SphereGeometry(0.13, 10, 8), 3, 0, M(0, 1.7, 0)); add(cyl(0.05, 0.06, 0.1, 6), 3, 0, M(0, 1.56, 0)); add(cyl(0.16, 0.17, 0.08, 10), 6, 0, M(0, 1.8, 0)); add(cyl(0.24, 0.24, 0.02, 12), 6, 0, M(0, 1.77, 0));
  } else {
    for (const sd of [-1, 1]){ const x = sd * 0.1;
      add(box(0.12, 0.08, 0.26), 0, sd, M(x, 0.04, 0.04), 0x2a2620); add(box(0.125, 0.03, 0.27), 0, sd, M(x, 0.015, 0.04), 0xd8d4c8);
      add(cyl(0.068, 0.058, 0.46, 5, true), 8, sd, M(x, 0.31, 0)); add(cyl(0.09, 0.072, 0.44, 6, true), 2, sd, M(x, 0.72, 0));
      add(cyl(0.064, 0.058, 0.3, 5, true), 1, sd * 2, M(sd * 0.255, 1.37, 0, 0, 0, sd * 0.06)); add(cyl(0.052, 0.046, 0.28, 5, true), 3, sd * 2, M(sd * 0.27, 1.09, 0.01, 0, 0, sd * 0.03)); add(new THREE.SphereGeometry(0.052, 5, 3), 3, sd * 2, M(sd * 0.275, 0.92, 0.01)); }
    add(cyl(0.19, 0.18, 0.2, 8), 2, 0, M(0, 0.96, 0)); add(box(0.36, 0.04, 0.3), 0, 0, M(0, 1.05, 0), 0x2a2620);
    add(cyl(0.205, 0.185, 0.5, 8, true), 1, 0, M(0, 1.3, 0)); add(new THREE.SphereGeometry(0.205, 8, 3, 0, TAU, 0, Math.PI / 2), 1, 0, M(0, 1.54, 0, 0, 0, 0, 1, 0.35, 0.9));
    add(cyl(0.052, 0.06, 0.12, 5, true), 3, 0, M(0, 1.6, 0)); add(new THREE.SphereGeometry(0.128, 9, 7), 3, 0, M(0, 1.73, 0.005, 0, 0, 0, 1, 1.08, 1)); add(box(0.04, 0.05, 0.05), 3, 0, M(0, 1.72, 0.13));
    for (const sd of [-1, 1]) add(box(0.03, 0.022, 0.01), 0, 0, M(sd * 0.045, 1.755, 0.122), 0x1a1410);
    add(new THREE.SphereGeometry(0.136, 9, 4, 0, TAU, 0, Math.PI * 0.56), 4, 0, M(0, 1.738, -0.012));
    add(cyl(0.138, 0.142, 0.08, 8, true), 5, 0, M(0, 1.82, 0)); add(new THREE.SphereGeometry(0.138, 8, 2, 0, TAU, 0, Math.PI / 2), 5, 0, M(0, 1.855, 0, 0, 0, 0, 1, 0.45, 1)); add(box(0.17, 0.02, 0.15), 5, 0, M(0, 1.795, 0.16));
    add(cyl(0.148, 0.158, 0.11, 8), 6, 0, M(0, 1.84, 0)); add(cyl(0.25, 0.25, 0.02, 10), 6, 0, M(0, 1.79, 0)); add(cyl(0.152, 0.152, 0.03, 8, true), 0, 0, M(0, 1.81, 0), 0x3a2a1a);
    add(box(0.28, 0.34, 0.13), 7, 0, M(0, 1.3, -0.25)); add(box(0.24, 0.12, 0.06), 7, 0, M(0, 1.2, -0.33)); for (const sd of [-1, 1]) add(box(0.04, 0.42, 0.02), 7, 0, M(sd * 0.11, 1.34, 0.19, 0.12, 0, 0));
  }
  const geos = P.map(([g0, part, leg, m, col]) => { let g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); const n = g.attributes.position.count;
    const c = new Float32Array(n * 3), pa = new Float32Array(n).fill(part), la = new Float32Array(n).fill(leg); _c.set(col); for (let i = 0; i < n; i++){ c[i*3] = _c.r; c[i*3+1] = _c.g; c[i*3+2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1)); g.setAttribute('aLeg', new THREE.BufferAttribute(la, 1)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aPart', 'aLeg'].includes(k)) g.deleteAttribute(k); return g; });
  return mergeGeometries(geos, false);
}
export function jeepGeo(){
  const P = []; const add = (g, c, m) => P.push([g, c, m]);
  add(box(2.0, 0.9, 4.2), 0x4c5a34, M(0, 1.05, 0)); add(box(1.9, 0.7, 1.6), 0x4c5a34, M(0, 1.8, -0.6)); add(box(1.8, 0.55, 0.06), 0x2e3c40, M(0, 1.85, 0.25, -0.35, 0, 0));
  add(box(2.1, 0.12, 4.3), 0x2a2a26, M(0, 0.62, 0)); add(box(2.0, 0.3, 0.2), 0x2a2a26, M(0, 0.85, 2.15)); for (const sd of [-1, 1]) add(new THREE.SphereGeometry(0.15, 8, 6), 0xfff4d0, M(sd * 0.7, 1.15, 2.1));
  add(...[box(2.04, 0.18, 4.24), (v, c) => c.setHex(Math.floor((v.z + 3) * 1.5) % 2 ? COL.yellow : COL.black)], M(0, 1.3, 0));
  for (const [x, z] of [[-1, 1.35], [1, 1.35], [-1, -1.35], [1, -1.35]]) add(cyl(0.42, 0.42, 0.32, 12), 0x1a1a18, M(x, 0.42, z, 0, 0, Math.PI / 2));
  add(cyl(0.42, 0.42, 0.3, 12), 0x1a1a18, M(0, 1.3, -2.25, Math.PI / 2, 0, 0)); add(box(1.8, 0.1, 0.1), 0xb8321f, M(0, 2.2, -0.6)); add(box(0.3, 0.12, 0.3), 0x3a6ad0, M(0.5, 2.22, -0.6)); add(box(0.3, 0.12, 0.3), 0xb8321f, M(-0.5, 2.22, -0.6));
  return mergeColored(P);
}
export function eggGeo(){ const g = new THREE.SphereGeometry(0.5, 16, 12); const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i); p.setY(i, y * 1.3); const k = 1 - Math.max(0, y) * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; }
