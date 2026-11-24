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
      transformed.z += cos(uTime * 1.1 + wph * 1.3) * wk * 0.7;`); };
  mat.customProgramCacheKey = () => 'wind' + amp + '_' + base;
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
export function rockGeo(seed){ const r = mulberry(seed); const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position;
  const offs = []; for (let i = 0; i < 6; i++) offs.push([r() * TAU, r() * TAU, 0.15 + r() * 0.2]);
  for (let i = 0; i < p.count; i++){ _v.fromBufferAttribute(p, i); let k = 1; for (const [a, b, s] of offs) k += Math.sin(_v.x * 2.3 + a) * Math.cos(_v.z * 2.1 + b) * s * 0.5; _v.multiplyScalar(k); _v.y *= 0.62; p.setXYZ(i, _v.x, _v.y, _v.z); }
  g.computeVertexNormals(); return mergeColored([[g, (v, c) => c.setHex(0x8a8476).offsetHSL(0, 0, v.y * 0.08 - 0.03)]]); }

/* ---------------- buildings (front faces +Z, footprint centred) ---------------- */
const COL = { wood: 0x6b4c2e, woodD: 0x4a3420, thatch: 0x9c7b45, thatchD: 0x7a5c30, stone: 0x8d8576, stoneD: 0x6c6558, cream: 0xe6dcc4, concrete: 0xb9b4a8, metal: 0x6e7270, glass: 0x2e4a52, amber: 0xe0a43a, yellow: 0xf2c230, black: 0x1c1c18, red: 0xa8321f, green: 0x3c5a34, roof: 0x4b5a3c };
function hip(w, d, h){ const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(w, h, d); g.translate(0, h / 2, 0); return g; }
function hazard(w, h, d){ return [box(w, h, d), (v, c) => c.setHex(((Math.floor((v.x + v.y) * 2.5) % 2) + 2) % 2 ? COL.yellow : COL.black)]; }
export function buildingGeo(type){
  const P = [];
  const add = (g, col, m) => P.push([g, col, m]);
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
  return mergeColored(P);
}
export const FOOT = { gate: [2, 1], visitor: [3, 3], hatchery: [2, 2], meat: [1, 1], plant: [1, 1], viewing: [1, 1], food: [1, 1], gift: [1, 1], restroom: [1, 1], ranger: [2, 2] };

/* ---------------- fences: panel spans x in [-2,2] at local origin, posts separate ---------------- */
export function fenceGeos(tier){
  const P = [], Q = []; const add = (arr, g, c, m) => arr.push([g, c, m]);
  if (tier === 0){ add(P, cyl(0.12, 0.14, 2.0, 7), 0x5b4128, M(0, 1.0, 0)); add(P, new THREE.ConeGeometry(0.13, 0.25, 7), 0x5b4128, M(0, 2.1, 0));
    for (const y of [0.7, 1.5]) add(Q, box(4.0, 0.16, 0.1), 0x76563a, M(0, y, 0)); add(Q, box(0.1, 1.2, 0.08), 0x6a4c30, M(0, 1.1, 0, 0, 0, 0.6)); }
  if (tier === 1){ add(P, cyl(0.06, 0.06, 2.8, 8), 0x9a9e9c, M(0, 1.4, 0)); add(P, new THREE.SphereGeometry(0.08, 6, 4), 0x9a9e9c, M(0, 2.82, 0));
    add(Q, cyl(0.04, 0.04, 4.0, 6), 0x9a9e9c, M(0, 2.7, 0, 0, 0, Math.PI / 2)); add(Q, cyl(0.03, 0.03, 4.0, 5), 0x9a9e9c, M(0, 0.08, 0, 0, 0, Math.PI / 2)); }
  if (tier === 2){ add(P, box(0.28, 4.8, 0.28), 0x3c3f3c, M(0, 2.4, 0)); add(P, box(0.5, 0.2, 0.5), 0x2a2c2a, M(0, 4.85, 0));
    for (let i = 0; i < 7; i++) add(Q, box(4.0, 0.035, 0.035), 0x2b2b28, M(0, 0.6 + i * 0.62, 0)); for (let i = 0; i < 7; i++) add(P, cyl(0.06, 0.06, 0.12, 6), 0xd8d0b8, M(0, 0.6 + i * 0.62, 0.12, Math.PI / 2, 0, 0));
    add(Q, ...hazard(0.9, 0.6, 0.04), M(0.8, 1.4, 0.05)); add(Q, box(0.5, 0.25, 0.05), 0xe8e0c8, M(0.8, 1.4, 0.08)); }
  if (tier === 3){ add(P, box(0.9, 6.6, 1.3), 0x8f8a80, M(0, 3.3, 0.3)); add(P, box(1.1, 0.3, 1.5), 0x7a766e, M(0, 6.6, 0.3)); add(P, box(0.2, 0.2, 0.6), 0x2a2a28, M(0, 6.9, 0.6)); add(P, new THREE.SphereGeometry(0.18, 8, 6), 0xfff2c0, M(0, 6.9, 0.95));
    add(Q, box(4.0, 6.2, 0.55), (v, c) => { c.setHex(0xa49f94).offsetHSL(0, 0, (Math.sin(v.x * 9.1) * Math.sin(v.y * 7.3)) * 0.02 - (v.y < 0.6 ? 0.08 : 0) - Math.max(0, v.y - 5.9) * 0.1); }, M(0, 3.1, 0));
    add(Q, ...hazard(4.0, 0.4, 0.58), M(0, 0.6, 0)); }
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

/* ---------------- guests ---------------- */
export function guestGeos(){
  // torso+arms (tinted by shirt instance colour)
  const shirt = mergeColored([[cyl(0.2, 0.17, 0.62, 8), 0xffffff, M(0, 1.22, 0)], [cyl(0.06, 0.05, 0.6, 6), 0xffffff, M(0.24, 1.2, 0, 0, 0, 0.08)], [cyl(0.06, 0.05, 0.6, 6), 0xffffff, M(-0.24, 1.2, 0, 0, 0, -0.08)]]);
  // legs + head (+ leg id attribute for walk swing)
  const legs = []; const parts = [[cyl(0.085, 0.07, 0.9, 6), 0x3a3a34, M(0.1, 0.46, 0)], [cyl(0.085, 0.07, 0.9, 6), 0x3a3a34, M(-0.1, 0.46, 0)], [box(0.12, 0.08, 0.24), 0x2a2620, M(0.1, 0.04, 0.04)], [box(0.12, 0.08, 0.24), 0x2a2620, M(-0.1, 0.04, 0.04)],
    [new THREE.SphereGeometry(0.13, 10, 8), 0xc89a78, M(0, 1.7, 0)], [cyl(0.05, 0.06, 0.1, 6), 0xc89a78, M(0, 1.56, 0)], [cyl(0.16, 0.17, 0.08, 10), 0xe0d4b0, M(0, 1.8, 0)], [cyl(0.24, 0.24, 0.02, 12), 0xe0d4b0, M(0, 1.77, 0)],
    [new THREE.SphereGeometry(0.05, 6, 4), 0xc89a78, M(0.27, 0.9, 0)], [new THREE.SphereGeometry(0.05, 6, 4), 0xc89a78, M(-0.27, 0.9, 0)]];
  const body = mergeColored(parts);
  const n = body.attributes.position.count, legA = new Float32Array(n); const p = body.attributes.position;
  for (let i = 0; i < n; i++){ const y = p.getY(i); legA[i] = y < 0.93 && Math.abs(p.getX(i)) < 0.2 ? Math.sign(p.getX(i)) : 0; }
  body.setAttribute('aLeg', new THREE.BufferAttribute(legA, 1));
  return { shirt, body };
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
