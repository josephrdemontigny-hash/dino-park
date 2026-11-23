/* Primeval Park - procedural skinned dinosaurs (Three.js r160). Each species is a lofted, skinned body + legs + extras in one geometry. */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function cr(p0, p1, p2, p3, t){ const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
function vn(x, y){ const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
function noise2(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(vn(xi, yi), vn(xi + 1, yi), u), lerp(vn(xi, yi + 1), vn(xi + 1, yi + 1), u), v); }
function fbm(x, y){ return noise2(x, y) * 0.55 + noise2(x * 2.1, y * 2.1) * 0.3 + noise2(x * 4.3, y * 4.3) * 0.15; }

/* ---------- skin texture (pebbly scales) ---------- */
let SKIN_TEX = null;
function skinNormalMap(){
  if (SKIN_TEX) return SKIN_TEX;
  const N = 256, h = new Float32Array(N * N), r = mulberry(7);
  // Worley-style scales: distance to nearest jittered cell point
  const C = 22, pts = [];
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + 0.15 + r() * 0.7) / C, (j + 0.15 + r() * 0.7) / C, 0.6 + r() * 0.4]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const u = x / N, v = y / N, ci = Math.floor(u * C), cj = Math.floor(v * C); let d1 = 9, d2 = 9, hv = 1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){
      let ii = ci + di, jj = cj + dj, ou = 0, ov = 0; if (ii < 0){ ii += C; ou = -1; } if (ii >= C){ ii -= C; ou = 1; } if (jj < 0){ jj += C; ov = -1; } if (jj >= C){ jj -= C; ov = 1; }
      const p = pts[jj * C + ii]; const dx = (p[0] + ou) - u, dy = (p[1] + ov) - v; const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1){ d2 = d1; d1 = d; hv = p[2]; } else if (d < d2) d2 = d;
    }
    const edge = clamp((d2 - d1) * C * 2.2, 0, 1);
    h[y * N + x] = Math.sqrt(edge) * hv + fbm(u * 9, v * 9) * 0.25;
  }
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N);
  const S = 2.4;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const l = h[y * N + ((x - 1 + N) % N)], rr = h[y * N + ((x + 1) % N)], u = h[((y - 1 + N) % N) * N + x], d = h[((y + 1) % N) * N + x];
    let nx = (l - rr) * S, ny = (d - u) * S, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    const k = (y * N + x) * 4; img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  SKIN_TEX = t; return t;
}

/* ---------- species rigs ----------
   nodes: [z, y, rw, rUp, rDown] tail tip -> snout tip.  pel = pelvis node, head = first head node (rigid after).
   legs: { side, at:[x,y,z], pts:[[dx,dy,dz,rw,rd]...] relative to 'at', parent:'pelvis'|'chest' } */
const SPECIES = {
  trex: {
    nodes: [[-6.7,2.15,.04,.04,.04],[-5.9,2.35,.15,.17,.17],[-4.9,2.6,.26,.32,.3],[-3.8,2.85,.4,.48,.46],[-2.7,3.05,.55,.66,.66],[-1.5,3.22,.7,.86,.88],
      [-.3,3.3,.84,.98,1.12],[.9,3.22,.92,1.02,1.32],[1.95,3.25,.84,.9,1.22],[2.85,3.45,.62,.66,.86],[3.55,3.78,.48,.52,.6],[4.1,4.0,.46,.5,.48],
      [4.55,4.18,.58,.6,.3],[5.05,4.12,.5,.52,.26],[5.55,4.02,.4,.42,.22],[5.98,3.92,.28,.31,.16],[6.25,3.86,.1,.13,.07]],
    pel: 6, head: 11, chest: 8,
    jaw: { hinge: [0, -.08, .2], pts: [[0,0,.48,.18,.3],[.5,-.06,.42,.15,.26],[1.0,-.1,.33,.12,.2],[1.4,-.1,.23,.09,.13],[1.68,-.08,.09,.06,.06]] },
    eye: [.36, .2, .52, .075], teeth: 11,
    legs: [
      { at: [.62, 3.05, .15], parent: 'pel', pts: [[0,0,0,.62,.8],[0,-1.4,.5,.36,.44],[0,-2.3,-.32,.17,.2],[0,-2.92,.1,.15,.17],[0,-3.0,.8,.18,.06]], hind: true },
      { at: [.48, 2.85, 2.6], parent: 'chest', pts: [[0,0,0,.14,.14],[0,-.38,.12,.1,.1],[0,-.52,.42,.07,.06],[0,-.5,.56,.03,.03]], arm: true }],
    gait: 'biped', stride: 3.6, size: 12, col: { top: 0x463d2e, belly: 0xa08e6c, mark: 0x2a241a, pattern: 'mottled', mouth: 0x5a1e1c }, carn: true },
  raptor: {
    nodes: [[-2.25,.92,.02,.02,.02],[-1.85,.98,.05,.05,.05],[-1.4,1.02,.075,.08,.08],[-.95,1.05,.11,.12,.12],[-.48,1.07,.15,.17,.17],
      [0,1.08,.19,.2,.24],[.36,1.07,.2,.2,.27],[.7,1.1,.17,.16,.21],[.95,1.22,.11,.11,.12],[1.1,1.4,.085,.085,.085],[1.2,1.56,.09,.09,.06],
      [1.32,1.61,.1,.09,.04],[1.48,1.6,.085,.075,.035],[1.63,1.56,.06,.055,.03],[1.75,1.53,.025,.03,.02]],
    pel: 5, head: 10, chest: 7,
    jaw: { hinge: [0,-.04,.06], pts: [[0,0,.08,.03,.04],[.16,-.01,.07,.025,.035],[.32,-.02,.05,.02,.025],[.44,-.02,.02,.012,.012]] },
    eye: [.075, .045, .13, .02], teeth: 9,
    legs: [
      { at: [.15, .98, .02], parent: 'pel', pts: [[0,0,0,.13,.17],[0,-.38,.15,.075,.09],[0,-.74,-.13,.04,.045],[0,-.95,.02,.035,.04],[0,-.98,.2,.04,.014]], hind: true, sickle: true },
      { at: [.12, .99, .74], parent: 'chest', pts: [[0,0,0,.05,.05],[0,-.16,-.06,.035,.035],[0,-.27,.14,.025,.025],[0,-.3,.24,.012,.012]], arm: true }],
    gait: 'biped', stride: 1.5, size: 3.8, col: { top: 0x7c6a48, belly: 0xcbb994, mark: 0x3a2c1c, pattern: 'stripes', mouth: 0x5a1e1c }, carn: true },
  dilo: {
    nodes: [[-3.3,1.45,.03,.03,.03],[-2.7,1.55,.08,.08,.08],[-2.05,1.62,.12,.13,.13],[-1.4,1.68,.18,.2,.2],[-.7,1.71,.25,.28,.28],
      [0,1.72,.32,.32,.38],[.55,1.7,.33,.32,.42],[1.05,1.74,.27,.26,.33],[1.45,1.95,.16,.16,.17],[1.7,2.25,.12,.12,.12],[1.86,2.5,.12,.12,.09],
      [2.04,2.58,.13,.12,.06],[2.28,2.56,.11,.1,.05],[2.5,2.5,.075,.07,.04],[2.66,2.46,.03,.035,.02]],
    pel: 5, head: 10, chest: 7,
    jaw: { hinge: [0,-.05,.08], pts: [[0,0,.1,.04,.05],[.22,-.02,.09,.035,.045],[.45,-.03,.065,.025,.03],[.6,-.03,.025,.015,.015]] },
    eye: [.095, .06, .18, .026], teeth: 9, crest: 'dilo',
    legs: [
      { at: [.24, 1.58, .03], parent: 'pel', pts: [[0,0,0,.2,.27],[0,-.62,.24,.12,.14],[0,-1.2,-.2,.06,.07],[0,-1.53,.04,.055,.06],[0,-1.58,.34,.06,.02]], hind: true },
      { at: [.18, 1.55, 1.15], parent: 'chest', pts: [[0,0,0,.07,.07],[0,-.26,-.1,.05,.05],[0,-.45,.18,.035,.035],[0,-.5,.32,.015,.015]], arm: true }],
    gait: 'biped', stride: 2.2, size: 6.5, col: { top: 0x55613f, belly: 0xbcb38a, mark: 0x2c3420, pattern: 'spots', mouth: 0x5a1e1c, crest: 0xb24a28 }, carn: true },
  trike: {
    nodes: [[-4.6,1.55,.05,.05,.05],[-3.8,1.8,.18,.2,.2],[-2.8,2.1,.36,.4,.4],[-1.8,2.38,.58,.6,.65],[-.8,2.62,.86,.78,.86],
      [.1,2.76,1.05,.78,1.06],[1.1,2.7,1.18,.76,1.16],[2.05,2.46,1.08,.7,1.06],[2.85,2.12,.8,.56,.76],[3.4,1.9,.55,.48,.5],
      [3.85,1.82,.5,.52,.42],[4.4,1.75,.48,.5,.38],[4.95,1.55,.38,.4,.34],[5.4,1.32,.24,.26,.24],[5.75,1.12,.08,.1,.12]],
    pel: 5, head: 10, chest: 7, eye: [.4, .25, .45, .06], frill: true, horns: true,
    legs: [
      { at: [.82, 2.2, .1], parent: 'pel', pts: [[0,0,0,.42,.55],[0,-1.05,.22,.28,.32],[0,-1.85,-.05,.2,.22],[0,-2.17,.08,.24,.26],[0,-2.2,.35,.24,.06]], hind: true },
      { at: [.8, 1.75, 2.65], parent: 'chest', pts: [[0,0,0,.34,.4],[.12,-.75,-.12,.24,.26],[.12,-1.45,.08,.18,.2],[.12,-1.72,.1,.2,.22],[.12,-1.75,.32,.2,.05]] }],
    gait: 'quad', stride: 2.6, size: 9, col: { top: 0x695846, belly: 0xa79878, mark: 0x463a2c, pattern: 'mottled', frill: 0x8c4a2c } },
  brachio: {
    nodes: [[-8.4,2.6,.08,.08,.08],[-7.2,3.1,.25,.25,.25],[-5.8,3.6,.45,.45,.45],[-4.3,4.1,.7,.72,.72],[-2.6,4.55,1.05,1.0,1.05],
      [-.8,4.8,1.35,1.1,1.4],[1.0,5.1,1.5,1.15,1.6],[2.7,5.6,1.4,1.05,1.5],[4.1,6.25,1.05,.9,1.1],[5.1,7.2,.7,.7,.72],[5.8,8.3,.52,.52,.52],
      [6.4,9.5,.42,.42,.42],[6.9,10.6,.34,.34,.34],[7.3,11.5,.3,.3,.28],
      [7.65,12.05,.34,.36,.24],[8.05,12.05,.3,.3,.2],[8.45,11.9,.22,.22,.15],[8.75,11.78,.08,.1,.07]],
    pel: 5, head: 13, chest: 7, eye: [.27, .2, .45, .06], nasal: true,
    legs: [
      { at: [1.05, 4.2, -.6], parent: 'pel', pts: [[0,0,0,.75,.95],[0,-2.1,.3,.5,.55],[0,-3.7,-.05,.38,.4],[0,-4.15,.1,.42,.45],[0,-4.2,.45,.4,.08]], hind: true },
      { at: [1.15, 5.0, 3.6], parent: 'chest', pts: [[0,0,0,.66,.78],[0,-2.4,-.25,.45,.5],[0,-4.4,.05,.34,.36],[0,-4.95,.1,.38,.4],[0,-5.0,.42,.36,.07]] }],
    gait: 'quad', stride: 4.2, size: 18, col: { top: 0x5c6253, belly: 0x9c9a88, mark: 0x3e4438, pattern: 'mottled' } },
  stego: {
    nodes: [[-4.3,1.45,.05,.05,.05],[-3.5,1.8,.15,.17,.17],[-2.5,2.15,.3,.33,.33],[-1.4,2.45,.52,.55,.58],[-.3,2.66,.75,.75,.82],
      [.6,2.62,.85,.8,.95],[1.5,2.35,.82,.72,.9],[2.3,1.85,.66,.56,.68],[2.9,1.38,.42,.38,.4],[3.32,1.08,.24,.22,.22],
      [3.6,.92,.17,.17,.12],[3.86,.85,.15,.13,.1],[4.1,.8,.1,.09,.07],[4.26,.76,.04,.04,.04]],
    pel: 4, head: 10, chest: 6, eye: [.13, .08, .1, .03], plates: true,
    legs: [
      { at: [.58, 2.15, -.05], parent: 'pel', pts: [[0,0,0,.4,.52],[0,-1.05,.25,.25,.3],[0,-1.85,-.05,.17,.19],[0,-2.12,.08,.2,.22],[0,-2.15,.32,.2,.05]], hind: true },
      { at: [.55, 1.32, 2.4], parent: 'chest', pts: [[0,0,0,.26,.3],[.08,-.55,-.08,.18,.2],[.1,-1.05,.05,.14,.15],[.1,-1.28,.08,.16,.17],[.1,-1.32,.28,.16,.04]] }],
    gait: 'quad', stride: 2.2, size: 8, col: { top: 0x66663f, belly: 0xb1a57f, mark: 0x3c3c26, pattern: 'mottled', plate: 0xa8522a } },
  para: {
    nodes: [[-4.8,2.2,.04,.04,.04],[-4.0,2.4,.12,.16,.16],[-3.0,2.62,.24,.32,.32],[-2.0,2.82,.4,.5,.52],[-1.0,2.95,.58,.68,.72],
      [0,3.0,.7,.75,.88],[1.0,2.88,.72,.72,.9],[1.85,2.75,.6,.58,.72],[2.55,2.85,.38,.38,.42],[3.05,3.25,.25,.25,.25],[3.35,3.65,.22,.22,.2],
      [3.6,3.85,.24,.25,.18],[3.95,3.78,.2,.2,.15],[4.3,3.62,.15,.14,.1],[4.52,3.52,.06,.06,.05]],
    pel: 5, head: 11, chest: 7, eye: [.17, .1, .2, .04], crest: 'para',
    legs: [
      { at: [.5, 2.6, .05], parent: 'pel', pts: [[0,0,0,.42,.6],[0,-1.2,.4,.24,.3],[0,-2.1,-.25,.13,.15],[0,-2.55,.08,.14,.16],[0,-2.6,.4,.15,.05]], hind: true },
      { at: [.45, 2.25, 2.0], parent: 'chest', pts: [[0,0,0,.18,.2],[0,-.95,-.15,.12,.13],[0,-2.0,.08,.08,.09],[0,-2.22,.12,.1,.1],[0,-2.25,.3,.1,.04]] }],
    gait: 'quad', stride: 2.6, size: 9.5, col: { top: 0x7a5839, belly: 0xc3ab84, mark: 0x4a321e, pattern: 'stripes', crest: 0xa3502c } },
  ankylo: {
    nodes: [[-3.9,.95,.22,.2,.2],[-3.55,1.0,.32,.24,.24],[-3.1,1.05,.12,.12,.12],[-2.3,1.2,.22,.2,.2],[-1.5,1.38,.48,.38,.4],
      [-.6,1.55,.95,.6,.6],[.4,1.6,1.3,.65,.7],[1.4,1.55,1.32,.62,.72],[2.3,1.4,1.05,.55,.6],[2.9,1.2,.6,.4,.4],
      [3.25,1.08,.45,.32,.3],[3.6,1.0,.42,.28,.24],[3.9,.92,.32,.22,.18],[4.08,.86,.12,.1,.08]],
    pel: 5, head: 10, chest: 7, eye: [.33, .1, .1, .04], armor: true, square: true,
    legs: [
      { at: [.82, 1.2, -.3], parent: 'pel', pts: [[0,0,0,.34,.42],[.05,-.6,.15,.24,.28],[.08,-1.0,-.02,.18,.2],[.08,-1.17,.06,.2,.22],[.08,-1.2,.28,.2,.05]], hind: true },
      { at: [.82, 1.05, 2.3], parent: 'chest', pts: [[0,0,0,.28,.32],[.08,-.5,-.06,.2,.22],[.12,-.86,.04,.16,.17],[.12,-1.02,.06,.18,.19],[.12,-1.05,.26,.18,.04]] }],
    gait: 'quad', stride: 1.6, size: 7, col: { top: 0x5a5242, belly: 0x8e8670, mark: 0x3a3428, pattern: 'mottled', plate: 0x7a7058 } },
};

/* ---------- geometry helpers ---------- */
function newBuf(){ return { pos: [], nrm: [], uv: [], col: [], si: [], sw: [], idx: [], n: 0 }; }
function pushV(b, p, u, v, c, bones, ws){ b.pos.push(p.x, p.y, p.z); b.nrm.push(0, 0, 0); b.uv.push(u, v); b.col.push(c.r, c.g, c.b);
  b.si.push(bones[0] || 0, bones[1] || 0, bones[2] || 0, bones[3] || 0); b.sw.push(ws[0] || 0, ws[1] || 0, ws[2] || 0, ws[3] || 0); return b.n++; }
function toGeo(b){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(b.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(b.sw, 4)); g.setIndex(b.idx); g.computeVertexNormals(); return g; }
// rigid primitive -> skinned to one bone; geometry already positioned in model rest space
function rigid(geo, color, bone, colorFn){ let g = geo.index ? geo : geo; if (!g.attributes.uv){ const n = g.attributes.position.count; g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); }
  { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.12, uv.getY(i) * 0.12); }
  const n = g.attributes.position.count, c = new THREE.Color(color), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); const v = new THREE.Vector3();
  for (let i = 0; i < n; i++){ let cc = c; if (colorFn){ v.fromBufferAttribute(g.attributes.position, i); cc = colorFn(v, c); } col[i*3] = cc.r; col[i*3+1] = cc.g; col[i*3+2] = cc.b; si[i*4] = bone; sw[i*4] = 1; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (!g.index){ const ix = []; for (let i = 0; i < n; i++) ix.push(i); g.setIndex(ix); }
  for (const k of Object.keys(g.attributes)) if (!['position','normal','uv','color','skinIndex','skinWeight'].includes(k)) g.deleteAttribute(k);
  return g; }

/* lofted tube: rings along a 3D polyline (Catmull-Rom), radii [rw, rUp, rDown] */
function loft(b, pts, ringsPer, radial, weightFn, colorFn, opts = {}){
  const P = pts.length, side0 = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(), side = new THREE.Vector3(), T = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  const rings = []; const total = (P - 1) * ringsPer; let arc = 0, prev = null;
  const at = (i) => pts[clamp(i, 0, P - 1)];
  const sample = (s) => { const i = Math.min(Math.floor(s), P - 2), f = s - i; const a = at(i - 1), b0 = at(i), c = at(i + 1), d = at(i + 2);
    return [0,1,2,3,4,5].map(k => k < 3 ? cr(a[k], b0[k], c[k], d[k], f) : Math.max(0.004, cr(a[k], b0[k], c[k], d[k], f) * (opts.rs || 1))); };
  for (let r = 0; r <= total; r++){
    const s = r / ringsPer; const c = sample(s); const c2 = sample(Math.min(s + 0.05, P - 1.0001)), c1 = sample(Math.max(s - 0.05, 0));
    T.set(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]).normalize();
    side.copy(opts.side || side0); side.addScaledVector(T, -side.dot(T)).normalize(); up.crossVectors(T, side).normalize(); if (up.y < 0 && !opts.side) up.negate();
    side.crossVectors(up, T).normalize();
    p.set(c[0], c[1], c[2]); if (prev) arc += p.distanceTo(prev); prev = p.clone();
    const ring = []; const wb = weightFn(s);
    for (let k = 0; k <= radial; k++){
      const a = (k / radial) * TAU; let sa = Math.sin(a), ca = Math.cos(a);
      if (opts.square){ const e = 0.55; sa = Math.sign(sa) * Math.pow(Math.abs(sa), e); ca = Math.sign(ca) * Math.pow(Math.abs(ca), e); }
      const rv = ca > 0 ? c[4] : c[5];
      q.copy(p).addScaledVector(side, sa * c[3]).addScaledVector(up, ca * rv);
      const nrmY = ca; const col = colorFn ? colorFn(q, nrmY, s, a) : new THREE.Color(0x888888);
      ring.push(pushV(b, q, k / radial * (opts.uRep || 3), arc * (opts.vRep || 1.6), col, wb[0], wb[1]));
    }
    rings.push(ring);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < radial; k++){ const a = rings[r][k], b1 = rings[r][k + 1], c = rings[r + 1][k], d = rings[r + 1][k + 1];
    if (opts.flip) b.idx.push(a, b1, c, b1, d, c); else b.idx.push(a, c, b1, b1, c, d); }
  // caps
  for (const [ri, dir] of [[0, -1], [rings.length - 1, 1]]){
    const ring = rings[ri]; let cx = 0, cy = 0, cz = 0; for (let k = 0; k < radial; k++){ cx += b.pos[ring[k]*3]; cy += b.pos[ring[k]*3+1]; cz += b.pos[ring[k]*3+2]; }
    const cen = new THREE.Vector3(cx / radial, cy / radial, cz / radial); const s = ri === 0 ? 0 : P - 1; const wb = weightFn(s);
    const ci = pushV(b, cen, 0.5, 0.5, colorFn ? colorFn(cen, 0, s, 0) : new THREE.Color(0x888888), wb[0], wb[1]);
    for (let k = 0; k < radial; k++){ const a = ring[k], c = ring[k + 1]; const fwd = (dir > 0) !== !!opts.flip; if (fwd) b.idx.push(a, c, ci); else b.idx.push(a, ci, c); }
  }
  return rings;
}

/* ---------- build one species' shared geometry + rig description ---------- */
const BUILT = {};
function buildSpecies(key){
  if (BUILT[key]) return BUILT[key];
  const S = SPECIES[key]; S.key = key; const N = S.nodes, b = newBuf(), r = mulberry(key.length * 97 + 13);
  const top = new THREE.Color(S.col.top), belly = new THREE.Color(S.col.belly), mark = new THREE.Color(S.col.mark), tmp = new THREE.Color();
  // bones: 0..S.head = spine nodes; then jaw, then legs (3-4 each)
  const rig = []; // {parent, pos:[x,y,z], name}
  for (let i = 0; i <= S.head; i++){
    const parent = i === S.pel ? -1 : (i < S.pel ? i + 1 : i - 1);
    rig.push({ parent, abs: [0, N[i][1], N[i][0]], name: 's' + i });
  }
  const headBone = S.head; let jawBone = -1;
  const H = N[S.head];
  if (S.jaw){ jawBone = rig.length; rig.push({ parent: headBone, abs: [0, H[1] + S.jaw.hinge[1], H[0] + S.jaw.hinge[2]], name: 'jaw' }); }
  const legInfo = [];
  for (const L of S.legs) for (const sd of [1, -1]){
    const base = rig.length; const parent = L.parent === 'pel' ? S.pel : S.chest; const bones = [];
    for (let j = 0; j < L.pts.length - 1; j++){
      const p = L.pts[j]; rig.push({ parent: j === 0 ? parent : base + j - 1, abs: [sd * (L.at[0] + p[0]), L.at[1] + p[1], L.at[2] + p[2]], name: 'leg' }); bones.push(base + j);
    }
    legInfo.push({ side: sd, bones, hind: !!L.hind, arm: !!L.arm, len: Math.abs(L.pts[L.pts.length - 1][1]) });
  }
  // body skin weights by spine param
  const owner = (j) => j >= S.head ? headBone : (j >= S.pel ? j : j + 1);
  const bodyW = (s) => { const j = Math.min(Math.floor(s), N.length - 2), f = s - j; const cur = owner(j);
    if (f < 0.5 && j > 0){ const o = owner(j - 1); return o === cur ? [[cur],[1]] : [[cur, o],[0.5 + f, 0.5 - f]]; }
    if (f >= 0.5 && j < N.length - 2){ const o = owner(j + 1); return o === cur ? [[cur],[1]] : [[cur, o],[1.5 - f, f - 0.5]]; }
    return [[cur],[1]]; };
  const pattern = S.col.pattern;
  const bodyCol = (q, ny, s, a) => {
    const t = clamp(0.5 - ny * 0.5, 0, 1); // 0 top 1 belly
    const c = tmp.copy(top).lerp(belly, Math.pow(clamp((t - 0.35) / 0.5, 0, 1), 0.8)).clone();
    const dors = 1 - clamp(t * 2.2, 0, 1);
    let m = 0;
    if (pattern === 'stripes'){ m = clamp((Math.sin(q.z * 5.5 / Math.max(0.4, S.size / 6) + fbm(q.x * 2 + 3, q.y * 2) * 3) - 0.35) * 2, 0, 1) * clamp(1.4 - t * 2, 0, 1); }
    else if (pattern === 'spots'){ const f = fbm(q.z * 3.2, q.y * 3.2 + q.x * 2); m = clamp((f - 0.6) * 6, 0, 1) * clamp(1.3 - t * 1.8, 0, 1); }
    else { const f = fbm(q.z * 1.6 / Math.max(0.5, S.size / 9), q.y * 1.6 + q.x * 1.3); m = clamp((f - 0.52) * 3.5, 0, 0.8) * clamp(1.2 - t * 1.6, 0, 1); }
    c.lerp(mark, m * 0.85); c.lerp(mark, dors * 0.25);
    const n = fbm(q.x * 4 + 11, q.z * 4) - 0.5; c.offsetHSL(0, 0, n * 0.06);
    return c; };
  // body
  const nodes3 = N.map(n => [0, n[1], n[0], n[2], n[3], n[4]]);
  const radial = 18;
  loft(b, nodes3, 4, radial, bodyW, bodyCol, { square: !!S.square, uRep: 2, vRep: 1.5 / Math.max(1, S.size / 6) });
  // jaw
  if (S.jaw){
    const J = S.jaw.pts.map(p => [0, H[1] + S.jaw.hinge[1] + p[1], H[0] + S.jaw.hinge[2] + p[0], p[2], p[3], p[4]]);
    const mouth = new THREE.Color(S.col.mouth);
    loft(b, J, 4, 14, () => [[jawBone],[1]], (q, ny) => ny > 0.55 ? mouth.clone() : bodyCol(q, Math.min(ny, -0.2) - 0.3, 0, 0), { uRep: 2, vRep: 4 });
    // upper mouth roof color: darken underside of head handled by belly color; teeth
    const tooth = new THREE.ConeGeometry(1, 1, 5); tooth.rotateX(Math.PI); const teeth = [];
    const hl = S.nodes.length - 1 - S.head; const head0 = N[S.head], tip = N[N.length - 1];
    for (let sd of [1, -1]) for (let i = 0; i < S.teeth; i++){
      const t = 0.12 + 0.82 * i / (S.teeth - 1); const z = lerp(head0[0] + S.jaw.hinge[2] + 0.1 * S.size / 12, tip[0] - 0.02 * S.size / 4, t);
      // find radius at z on head
      let j = S.head; while (j < N.length - 2 && N[j + 1][0] < z) j++; const f = clamp((z - N[j][0]) / (N[j + 1][0] - N[j][0]), 0, 1);
      const rw = lerp(N[j][2], N[j + 1][2], f) * 0.72, yy = lerp(N[j][1], N[j + 1][1], f) - lerp(N[j][4], N[j + 1][4], f) * 0.75;
      const sz = S.size / 12 * (0.1 - t * 0.03) * (key === 'trex' ? 1 : 1.5);
      const g = tooth.clone(); g.scale(sz * 0.3, sz, sz * 0.3); g.translate(sd * rw, yy - sz * 0.45, z); teeth.push(rigid(g, 0xe8e0c8, headBone));
    }
    b.extra = (b.extra || []).concat(teeth);
  }
  // legs
  const extras = b.extra || [];
  for (const [li, L] of S.legs.entries()) for (const sd of [1, -1]){
    const info = legInfo[li * 2 + (sd === 1 ? 0 : 1)];
    const pts = L.pts.map(p => [sd * (L.at[0] + p[0]), L.at[1] + p[1], L.at[2] + p[2], p[3], p[4], p[4]]);
    const legW = (s) => { const j = Math.min(Math.floor(s), pts.length - 2), f = s - j; const bj = info.bones[Math.min(j, info.bones.length - 1)];
      if (f < 0.3 && j > 0) return [[bj, info.bones[j - 1]], [0.5 + f / 0.6, 0.5 - f / 0.6]];
      return [[bj],[1]]; };
    const legCol = (q, ny, s) => { const c = bodyCol(q, ny * 0.5 - 0.15, s, 0); if (s > pts.length - 2.2) c.lerp(mark, 0.35); return c; };
    loft(b, pts, 5, 12, legW, legCol, { uRep: 2, vRep: 3, side: new THREE.Vector3(1, 0, 0) });
    // claws
    if (!L.arm || true){
      const last = pts[pts.length - 1], prevp = pts[pts.length - 2]; const claw = new THREE.ConeGeometry(1, 1, 6); claw.rotateX(Math.PI / 2);
      const n = L.arm ? 3 : (S.gait === 'quad' ? 4 : 3); const sz = (L.arm ? 0.05 : 0.09) * S.size / 6 * (S.gait === 'quad' ? 1.4 : 1);
      for (let k = 0; k < n; k++){ const spread = (k - (n - 1) / 2) * (S.gait === 'quad' ? last[3] * 0.7 : last[3] * 1.1);
        const g = claw.clone(); g.scale(sz * 0.32, sz * 0.32, sz); g.rotateY(spread * 0.6 / Math.max(0.1, last[3])); g.translate(last[0] + spread, last[1] + sz * 0.15, last[2] + sz * 0.2 - Math.abs(spread) * 0.4);
        extras.push(rigid(g, 0x2a241c, info.bones[info.bones.length - 1])); }
      if (L.sickle){ const g = new THREE.ConeGeometry(1, 1, 6); g.scale(0.025, 0.11, 0.025); g.rotateX(-0.9); g.translate(last[0], prevp[1] + 0.07, prevp[2] + 0.06); extras.push(rigid(g, 0x221c14, info.bones[info.bones.length - 1])); }
    }
  }
  // eyes (separate material group)
  const eyes = [];
  if (S.eye){ const [ex, ey, ez, er] = S.eye; for (const sd of [1, -1]){ const g = new THREE.SphereGeometry(er, 10, 8); g.translate(sd * ex, H[1] + ey, H[0] + ez); eyes.push(rigid(g, 0xffffff, headBone)); } }
  // species extras
  const ex = (geo, color, bone, fn) => extras.push(rigid(geo, color, bone, fn));
  if (S.crest === 'dilo'){ for (const sd of [1, -1]){ const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.12, 0.28, 0.42, 0.2); sh.quadraticCurveTo(0.5, 0.08, 0.5, 0); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 6 }); g.rotateY(-Math.PI / 2); g.translate(sd * 0.05, H[1] + 0.1, H[0] + 0.0);
      const crc = new THREE.Color(S.col.crest), cr2 = new THREE.Color(0xe8dcb8); ex(g, 0xffffff, headBone, (v) => { const k = Math.sin((v.z - H[0]) * 40) > 0.3 ? 1 : 0; return crc.clone().lerp(cr2, k * 0.5 * clamp((v.y - H[1] - 0.12) * 8, 0, 1)); }); } }
  if (S.crest === 'para'){ const pts = []; for (let i = 0; i <= 6; i++){ const t = i / 6; pts.push(new THREE.Vector3(0, H[1] + 0.18 + t * 0.42 + Math.sin(t * 2) * 0.04, H[0] + 0.22 - t * 1.15)); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.09, 8, false); ex(g, S.col.crest, headBone); const cap = new THREE.SphereGeometry(0.09, 8, 6); cap.translate(pts[6].x, pts[6].y, pts[6].z); ex(cap, S.col.crest, headBone); }
  if (S.frill){ const sh = new THREE.Shape(); sh.absarc(0, 0, 1.2, -0.15, Math.PI + 0.15, false); sh.lineTo(0, -0.35);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 14 });
    g.translate(0, 0, -0.04); g.rotateX(-0.55); g.translate(0, H[1] + 0.25, H[0] + 0.15);
    const fc = new THREE.Color(S.col.frill), fb = new THREE.Color(S.col.top); ex(g, 0xffffff, headBone, (v) => { const d = Math.hypot(v.x, (v.y - H[1] - 0.25) * 1.2); return fb.clone().lerp(fc, clamp((d - 0.55) * 2, 0, 1)).lerp(new THREE.Color(0x2c2218), d > 1.12 ? 0.6 : 0); });
    // knobs on frill edge
    for (let i = 0; i <= 12; i++){ const a = -0.1 + (Math.PI + 0.2) * i / 12; const k = new THREE.ConeGeometry(0.07, 0.18, 5); k.rotateZ(a - Math.PI / 2); k.translate(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0); k.rotateX(-0.55); k.translate(0, H[1] + 0.25, H[0] + 0.15); ex(k, 0xd8ccae, headBone); } }
  if (S.horns){ const horn = (len, rad, x, y, z, rx, ry) => { const g = new THREE.ConeGeometry(rad, len, 10, 3); g.translate(0, len / 2, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const t = p.getY(i) / len; p.setZ(i, p.getZ(i) + t * t * len * 0.18); } g.computeVertexNormals(); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return g; };
    const hc = (v, c) => c.clone().lerp(new THREE.Color(0x3a3024), clamp((v.z - H[0] - 0.9) * 0.6, 0, 1));
    for (const sd of [1, -1]) ex(horn(1.15, 0.12, sd * 0.28, H[1] + 0.35, H[0] + 0.45, 1.05, sd * -0.12), 0xe6dcc0, headBone, hc);
    ex(horn(0.4, 0.1, 0, H[1] + 0.12, H[0] + 1.35, 0.55, 0), 0xe6dcc0, headBone, hc); }
  if (S.nasal){ const g = new THREE.SphereGeometry(0.28, 12, 8); g.scale(0.9, 0.7, 1.1); g.translate(0, H[1] + 0.32, H[0] + 0.15); ex(g, S.col.top, headBone); }
  if (S.plates){ const pc = new THREE.Color(S.col.plate), pb = new THREE.Color(S.col.top);
    for (let i = 1; i < N.length - 3; i++){ if (i > S.head - 1) break; const n0 = N[i], n1 = N[i + 1];
      for (const half of [(i % 2) * 0.5]){ const z = lerp(n0[0], n1[0], half), y = lerp(n0[1], n1[1], half) + lerp(n0[3], n1[3], half) * 0.85;
        const mid = 1 - Math.abs((i + half) - (S.pel + 0.5)) / 6; if (mid < 0.15) continue; const hgt = 0.25 + mid * 0.75; const sd = (i % 2) ? 1 : -1;
        const sh = new THREE.Shape(); sh.moveTo(-hgt * 0.55, 0); sh.quadraticCurveTo(-hgt * 0.45, hgt * 0.75, 0, hgt); sh.quadraticCurveTo(hgt * 0.5, hgt * 0.6, hgt * 0.55, 0); sh.lineTo(-hgt * 0.55, 0);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, -0.025); g.rotateY(Math.PI / 2); g.rotateZ(sd * 0.12); g.translate(sd * 0.1, y - 0.06, z);
        const bone = owner(i); ex(g, 0xffffff, bone, (v) => pb.clone().lerp(pc, clamp((v.y - y) / hgt * 1.4, 0, 1))); } }
    for (const sd of [1, -1]) for (const k of [0, 1]){ const g = new THREE.ConeGeometry(0.06, 0.75, 6); g.rotateX(-0.6 - k * 0.3); g.rotateZ(sd * -1.0); const n = N[1 + k]; g.translate(sd * 0.25, n[1] + 0.12, n[0] - 0.1); ex(g, 0xd8ccae, owner(1 + k)); } }
  if (S.armor){ const knob = new THREE.ConeGeometry(1, 1, 5); for (let i = 3; i <= S.head; i++){ const n = N[i];
      for (let k = -2; k <= 2; k++){ const a = k * 0.45; const sz = 0.09 + (k === 0 ? 0.03 : 0) + n[2] * 0.05; const g = knob.clone(); g.scale(sz, sz * 1.2, sz); g.rotateZ(-a);
        g.translate(Math.sin(a) * n[2] * 0.98, n[1] + Math.cos(a) * n[3] * 0.98, n[0]); ex(g, S.col.plate, owner(i)); } }
    for (const sd of [1, -1]) for (let i = 4; i <= 8; i++){ const n = N[i]; const g = new THREE.ConeGeometry(0.08, 0.35, 5); g.rotateZ(sd * -Math.PI / 2 + sd * 0.2); g.translate(sd * (n[2] + 0.08), n[1] - 0.05, n[0]); ex(g, 0xcfc4a6, owner(i)); }
    const club = new THREE.SphereGeometry(0.42, 12, 8); club.scale(1.25, 0.6, 0.85); club.translate(0, N[0][1] + 0.05, N[0][0] + 0.25); ex(club, S.col.plate, owner(0)); }
  const all = [toGeo(b), ...extras]; const body = mergeGeometries(all, false); const eyeG = eyes.length ? mergeGeometries(eyes, false) : null;
  const geo = mergeGeometries(eyeG ? [body, eyeG] : [body], true);
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.3;
  const out = { geo, rig, legInfo, headBone, jawBone, S };
  BUILT[key] = out; return out;
}

let MATS = null;
function mats(){ if (MATS) return MATS;
  MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, normalMap: skinNormalMap(), normalScale: new THREE.Vector2(0.65, 0.65) }),
          new THREE.MeshStandardMaterial({ color: 0x1a0f06, roughness: 0.12, metalness: 0.1, emissive: 0x2a1800, emissiveIntensity: 0.3 })];
  return MATS; }

/* ---------- instance ---------- */
export class Dino {
  constructor(key){
    const B = buildSpecies(key); this.key = key; this.B = B; this.S = B.S;
    this.root = new THREE.Group();
    const bones = B.rig.map(r => { const b = new THREE.Bone(); b.name = r.name; return b; });
    B.rig.forEach((r, i) => { if (r.parent >= 0){ const p = B.rig[r.parent].abs; bones[i].position.set(r.abs[0] - p[0], r.abs[1] - p[1], r.abs[2] - p[2]); bones[r.parent].add(bones[i]); } else bones[i].position.set(r.abs[0], r.abs[1], r.abs[2]); });
    const mesh = new THREE.SkinnedMesh(B.geo, mats()); const rootBone = bones[B.S.pel]; mesh.add(rootBone); rootBone.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones)); mesh.castShadow = true; mesh.receiveShadow = true;
    this.mesh = mesh; this.bones = bones; this.root.add(mesh);
    this.rest = bones.map(b => b.position.clone());
    this.phase = Math.random() * TAU; this.t = Math.random() * 10; this.action = null; this.actT = 0; this.sleep = 0; this.lookY = 0; this.lookX = 0;
  }
  setAction(a, dur){ this.action = a; this.actT = 0; this.actDur = dur; }
  // speed m/s, turn rad/s
  animate(dt, speed, turn){
    const S = this.S, B = this.B, bones = this.bones; this.t += dt;
    const stride = S.stride, moving = clamp(speed / (stride * 0.6), 0, 1.6);
    this.phase += dt * (speed / stride) * TAU * 0.5 + (moving < 0.05 ? 0 : 0);
    const ph = this.phase; const t = this.t;
    if (this.action){ this.actT += dt; if (this.actT > this.actDur){ this.action = null; } }
    const act = this.action, at = this.actDur ? this.actT / this.actDur : 0;
    const sleepK = this.sleep; // 0..1
    // reset rotations
    for (let i = 0; i < bones.length; i++){ bones[i].rotation.set(0, 0, 0); bones[i].position.copy(this.rest[i]); }
    const pel = bones[S.pel];
    const bob = Math.abs(Math.sin(ph)) * 0.025 * S.size / 6 * Math.min(1, moving);
    pel.position.y += bob - sleepK * (S.legs[0].at[1] - S.nodes[S.pel][3] * 0.2) * 0.62 + Math.sin(t * 1.6) * 0.004 * S.size;
    pel.rotation.z = Math.sin(ph) * 0.03 * Math.min(1, moving) + sleepK * 0.12;
    pel.rotation.x = (S.gait === 'biped' ? 0.02 : 0) * moving;
    // tail sway
    const breath = Math.sin(t * 1.7);
    for (let i = 0; i < S.pel; i++){ const k = (S.pel - i) / S.pel; bones[i].rotation.y = Math.sin(ph * 0.5 + t * 0.6 - i * 0.6) * 0.05 * (0.4 + moving) - turn * 0.18 * k;
      bones[i].rotation.x = (i < S.pel - 1 ? -0.015 : 0) * (1 - moving * 0.3) + sleepK * 0.08; }
    // neck & head
    const neckN = S.head - S.pel; let headDown = 0, headUp = 0, jaw = 0, lunge = 0;
    if (act === 'eat'){ headDown = Math.sin(Math.min(1, at * 4) * Math.PI / 2) * (1 - Math.max(0, (at - 0.85) / 0.15)); jaw = (Math.sin(t * 9) * 0.5 + 0.5) * 0.25 * headDown; }
    if (act === 'roar'){ const e = Math.sin(clamp(at, 0, 1) * Math.PI); headUp = e * 0.8; jaw = e * 0.9 + Math.sin(t * 40) * 0.04 * e; }
    if (act === 'bite'){ const e = Math.sin(clamp(at, 0, 1) * Math.PI); lunge = e; jaw = at < 0.55 ? Math.sin(at / 0.55 * Math.PI / 2) : Math.max(0, 1 - (at - 0.55) * 6); headDown = e * 0.55; }
    const look = this.lookY;
    for (let i = S.pel + 1; i <= S.head; i++){ const b = bones[i]; const k = (i - S.pel) / neckN;
      b.rotation.y = look * 0.25 * k + turn * 0.12 * k + Math.sin(t * 0.7 + i) * 0.015;
      const isNeck = i >= S.chest;
      b.rotation.x = (isNeck ? (headDown * (S.key === 'brachio' ? 0.28 : 0.22) - headUp * 0.12 + sleepK * 0.18) : breath * 0.004) + (i === S.head ? this.lookX - lunge * 0.1 : 0);
    }
    if (S.carn) bones[S.chest].position.z += lunge * 0.06 * S.size / 6;
    if (B.jawBone >= 0) bones[B.jawBone].rotation.x = jaw * (S.key === 'trex' ? 0.55 : 0.6);
    // legs
    const legs = B.legInfo; const amp = clamp(moving, 0, 1) * (S.gait === 'biped' ? 0.5 : 0.36);
    for (let li = 0; li < legs.length; li++){ const L = legs[li]; const b0 = bones[L.bones[0]], b1 = bones[L.bones[1]], b2 = bones[L.bones[2]], b3 = L.bones[3] !== undefined ? bones[L.bones[3]] : null;
      if (L.arm){ b0.rotation.x = -0.2 + Math.sin(t * 1.3 + L.side) * 0.05 - jaw * 0.2; b1.rotation.x = -0.3; continue; }
      let off = L.side > 0 ? 0 : Math.PI; if (S.gait === 'quad' && !L.hind) off += Math.PI * 0.5 + Math.PI;
      const p = ph + off; const s = Math.sin(p), c = Math.cos(p);
      const swing = c > 0 ? 1 : 0; // forward swing phase -> lift
      const lift = Math.max(0, c) * amp;
      b0.rotation.x = -s * amp * (L.hind ? 1 : 0.8);
      b1.rotation.x = (L.hind ? 1 : -1) * lift * 1.1;
      b2.rotation.x = -(b0.rotation.x + b1.rotation.x) * (L.hind ? 0.6 : 0.4);
      if (b3) b3.rotation.x = Math.max(0, -s) * amp * 0.6 * (L.hind ? 1 : 0);
      if (sleepK > 0){ const k = sleepK; b0.rotation.x = lerp(b0.rotation.x, L.hind ? -0.9 : -0.6, k); b1.rotation.x = lerp(b1.rotation.x, L.hind ? 1.6 : -1.2, k); b2.rotation.x = lerp(b2.rotation.x, L.hind ? -1.0 : 1.0, k); b0.rotation.z = L.side * 0.25 * k; }
    }
  }
}
export const SPECIES_DATA = SPECIES;
export function prewarm(keys){ for (const k of keys) buildSpecies(k); }
export function dinoMaterials(){ return mats(); }
