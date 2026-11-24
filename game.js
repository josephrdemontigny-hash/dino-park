/* Primeval Park v1 - a dinosaur park tycoon. Three.js r160 (vendored), no build step. */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { Dino, SPECIES_DATA, prewarm, setDinoCamera, setDinoQuality } from './dino.js';
import * as M from './models.js';
import * as SFX from './audio.js';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const { clamp, lerp, mulberry } = M;
const smooth = t => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const fmt = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const fmtK = n => { const a = Math.abs(n), s = n < 0 ? '-$' : '$'; return a >= 1e6 ? s + (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? s + Math.round(a / 1000) + 'k' : s + Math.round(a).toLocaleString('en-US'); };
function vn(x, y){ const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
function noise2(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(vn(xi, yi), vn(xi + 1, yi), u), lerp(vn(xi, yi + 1), vn(xi + 1, yi + 1), u), v); }
function fbm(x, y){ return noise2(x, y) * 0.5 + noise2(x * 2.03 + 17, y * 2.03 + 9) * 0.28 + noise2(x * 4.1 + 3, y * 4.1 + 41) * 0.14 + noise2(x * 8.3, y * 8.3) * 0.08; }
const rnd = Math.random, fr = (a, b) => a + (b - a) * Math.random();

/* ================= constants ================= */
const GRID = 56, TILE = 4, HALF = GRID * TILE / 2;
const tX = i => (i + 0.5) * TILE - HALF, tZ = j => (j + 0.5) * TILE - HALF;
const eX = i => i * TILE - HALF; // tile edge coordinate
const toI = x => Math.floor((x + HALF) / TILE);
const inGrid = (i, j) => i >= 0 && j >= 0 && i < GRID && j < GRID;
const DAY_START = 7, DAY_END = 21, OPEN = 8, CLOSE = 19, SEC_PER_HOUR = 10;
const SAVE_KEY = 'primeval-park-v1';
const QS = new URLSearchParams(location.search);

const SPECIES = {
  para:    { name: 'Parasaurolophus', short: 'Parasaurolophus', diet: 'plant', str: 1.0, appeal: 28, cost: 14000, hatch: 25, space: 10, group: [2, 8], stars: 0, walk: 2.2, run: 7, darts: 1, feed: 250, desc: 'Gentle herd animal with a trumpet crest.' },
  trike:   { name: 'Triceratops', short: 'Triceratops', diet: 'plant', str: 2.6, appeal: 36, cost: 32000, hatch: 35, space: 14, group: [1, 4], stars: 0, walk: 2.0, run: 6, darts: 3, feed: 400, desc: 'Three horns, one bad temper. Charges fences.' },
  stego:   { name: 'Stegosaurus', short: 'Stegosaurus', diet: 'plant', str: 2.0, appeal: 30, cost: 24000, hatch: 30, space: 12, group: [1, 5], stars: 1, walk: 1.7, run: 4, darts: 2, feed: 350, desc: 'Plated and slow. A crowd favourite.' },
  dilo:    { name: 'Dilophosaurus', short: 'Dilophosaurus', diet: 'meat', str: 2.5, appeal: 42, cost: 38000, hatch: 35, space: 8, group: [1, 4], stars: 1, walk: 2.4, run: 8, darts: 2, feed: 600, desc: 'Crested hunter. Small, quick and spiteful.' },
  ankylo:  { name: 'Ankylosaurus', short: 'Ankylosaurus', diet: 'plant', str: 2.5, appeal: 32, cost: 30000, hatch: 35, space: 10, group: [1, 3], stars: 2, walk: 1.4, run: 3.5, darts: 2, feed: 380, desc: 'Armoured tank with a bone-club tail.' },
  raptor:  { name: 'Velociraptor', short: 'Velociraptor', diet: 'meat', str: 3.5, appeal: 58, cost: 52000, hatch: 40, space: 6, group: [3, 6], stars: 2, walk: 2.6, run: 12, darts: 2, feed: 700, clever: true, desc: 'Pack hunter. Tests the fences, systematically.' },
  brachio: { name: 'Brachiosaurus', short: 'Brachiosaurus', diet: 'plant', str: 4.0, appeal: 64, cost: 85000, hatch: 50, space: 30, group: [1, 4], stars: 3, walk: 2.2, run: 4, darts: 4, feed: 1200, desc: 'Twelve metres tall. Guests cry. In a good way.' },
  trex:    { name: 'Tyrannosaurus rex', short: 'T. rex', diet: 'meat', str: 6.5, appeal: 110, cost: 150000, hatch: 60, space: 30, group: [1, 1], stars: 3.5, walk: 3.0, run: 8.5, darts: 4, feed: 2000, desc: 'The star attraction. Needs concrete walls.' },
};
const SP_KEYS = ['para', 'trike', 'stego', 'dilo', 'ankylo', 'raptor', 'brachio', 'trex'];
const BUILD = {
  path:     { name: 'Footpath', cost: 150, desc: 'Guests walk on paths. Tap point to point.', stars: 0 },
  hatchery: { name: 'Hatchery', cost: 60000, upkeep: 900, idleUpkeep: 200, desc: 'Incubates dinosaur eggs. Two at a time. Costs little while empty.', stars: 0 },
  ranger:   { name: 'Ranger Station', cost: 40000, upkeep: 1200, desc: 'Maintains nearby fences. Cheaper, faster containment.', stars: 0 },
  food:     { name: 'Food Stand', cost: 9000, upkeep: 300, desc: 'Burgers and drinks. Must face a path.', stars: 0 },
  restroom: { name: 'Restrooms', cost: 6000, upkeep: 200, desc: 'Keeps guests comfortable. Must face a path.', stars: 0 },
  gift:     { name: 'Gift Shop', cost: 14000, upkeep: 400, desc: 'Plush raptors at premium prices.', stars: 0.5 },
  viewing:  { name: 'Viewing Platform', cost: 12000, upkeep: 150, desc: 'Raises the appeal of nearby enclosures.', stars: 1 },
  meat:     { name: 'Meat Feeder', cost: 8000, upkeep: 200, desc: 'Place inside an enclosure. Feeds carnivores.', stars: 0, inPen: true },
  plant:    { name: 'Plant Feeder', cost: 5000, upkeep: 120, desc: 'Place inside an enclosure. Feeds herbivores.', stars: 0, inPen: true },
  visitor:  { name: 'Visitor Centre', cost: 0, upkeep: 300, desc: 'Food, restrooms and souvenirs.', stars: 0, fixed: true },
  gate:     { name: 'Main Gate', cost: 0, upkeep: 0, desc: 'Guests arrive here.', stars: 0, fixed: true },
};
const FT = M.FENCE_TIERS;
const FENCE_STARS = [0, 0, 1, 2];
function tierNeeded(str){ for (let t = 0; t < FT.length; t++) if (FT[t].str - 0.75 >= str) return t; return FT.length - 1; }
const NAMES = ['Rexy', 'Blue', 'Delta', 'Echo', 'Clara', 'Margo', 'Bruno', 'Petra', 'Ivy', 'Hugo', 'Nell', 'Otto', 'Bertha', 'Sable', 'Juno', 'Rook', 'Mabel', 'Fern', 'Gus', 'Tilda', 'Vera', 'Moss', 'Olga', 'Rufus', 'Willa', 'Hank', 'Pip', 'Dora', 'Lux', 'Kit'];

/* ================= renderer / quality ================= */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const DPR = window.devicePixelRatio || 1;
const QUALITY = { level: 2, forced: false, pr: [1, 1.5, 2], shadow: [1024, 1536, 2048], veg: [0.5, 0.75, 1], guests: [140, 200, 260] };
if (QS.has('q')){ QUALITY.level = clamp(parseInt(QS.get('q')) || 0, 0, 2); QUALITY.forced = true; }
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2400); setDinoCamera(camera);
const FOG_COL = new THREE.Color(0xbfd0c8);
scene.fog = new THREE.FogExp2(FOG_COL.clone(), 0.0016);
const hemi = new THREE.HemisphereLight(0xd4e4ff, 0x4d4630, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 3.1); sun.castShadow = true; scene.add(sun); scene.add(sun.target);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4; sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
const SUN_DIR = new THREE.Vector3();

/* ================= textures ================= */
const texLoader = new THREE.TextureLoader();
let texPending = 0;
function loadTex(url, srgb){ texPending++; const t = texLoader.load(url, () => texPending--, undefined, () => texPending--); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO; return t; }
function canvasTex(c, srgb = true, rep = true){ const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO; return t; }
const TEX = {
  grass: loadTex('tex/grass_col.jpg', true), grassN: loadTex('tex/grass_nrm.jpg', false), dirt: loadTex('tex/dirt_col.jpg', true), gravel: loadTex('tex/gravel_col.jpg', true),
  sand: loadTex('tex/sand_col.jpg', true), rock: loadTex('tex/rock_col.jpg', true),
  leaf: canvasTex(M.leafClusterCanvas(), true, false), frond: canvasTex(M.frondCanvas(false), true, false), fern: canvasTex(M.frondCanvas(true), true, false),
  chain: canvasTex(M.chainCanvas(), true, true),
};
function waterNormalCanvas(){ const N = 256, c = M.mk(N, N), g = c.getContext('2d'), img = g.createImageData(N, N); const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ let v = 0; for (let k = 0; k < 6; k++){ const f = (k + 1) * 2, a = k * 1.7; v += Math.sin((x * Math.cos(a) + y * Math.sin(a)) / N * TAU * f + k) / (k + 1); } h[y * N + x] = v; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const l = h[y * N + (x + N - 1) % N], r = h[y * N + (x + 1) % N], u = h[((y + N - 1) % N) * N + x], d = h[((y + 1) % N) * N + x];
    let nx = (l - r) * 0.6, ny = (u - d) * 0.6, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); const k = (y * N + x) * 4; img.data[k] = (nx * il * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * il * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * il * 0.5 + 0.5) * 255; img.data[k + 3] = 255; }
  g.putImageData(img, 0, 0); return c; }
TEX.water = canvasTex(waterNormalCanvas(), false, true); TEX.water.repeat.set(60, 60);
function softDot(){ const c = M.mk(64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
TEX.soft = softDot();

/* ================= sky + environment ================= */
const skyU = { uTop: { value: new THREE.Color(0x4f7fae) }, uHor: { value: FOG_COL.clone() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xfff2d0) } };
const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }',
  fragmentShader: `uniform vec3 uTop, uHor, uSunDir, uSunCol; varying vec3 vD;
    void main(){ float h = clamp(vD.y, -0.2, 1.0); vec3 c = mix(uHor, uTop, pow(max(h, 0.0), 0.55)); c = mix(c, uHor * 0.92, smoothstep(0.0, -0.2, vD.y));
      float s = max(dot(normalize(vD), uSunDir), 0.0); c += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.18 + pow(s, 4.0) * 0.06);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
function buildEnv(){ const s = new THREE.Scene(); const m = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat); s.add(m); const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a4a2c })); g.position.y = -2; s.add(g);
  const rt = pmrem.fromScene(s, 0.02); scene.environment = rt.texture; }

/* ================= terrain ================= */
const VOLC = { x: 30, z: -205, r: 125, h: 78 };
function coastR(x, z){ const a = Math.atan2(z, x); return 126 + (fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 2) - 0.5) * 46; }
function H(x, z){
  const d = Math.hypot(x, z * 0.96), R = coastR(x, z);
  const land = sstep(R + 18, R - 16, d);
  let h = lerp(-7, 1.7, land) + (fbm(x * 0.017 + 3, z * 0.017 + 7) - 0.5) * 2.4 * land;
  // gate plaza flattening near the south entrance
  const pd = Math.hypot(x - 0, z - 100); if (pd < 40) h = lerp(h, Math.max(h, 1.1), sstep(40, 14, pd));
  const vd = Math.hypot(x - VOLC.x, z - VOLC.z);
  if (vd < VOLC.r){ const k = 1 - vd / VOLC.r; let c = VOLC.h * Math.pow(k, 1.7) * (0.82 + 0.36 * fbm(x * 0.03, z * 0.03)); if (vd < 13) c -= (13 - vd) * 1.6; h = Math.max(h, c - 1.5 + land * 0); }
  // ridges on west/east rims beyond the plot
  const rim = Math.max(Math.abs(x) - 118, 0); if (rim > 0) h += rim * 0.25 * fbm(x * 0.05, z * 0.05) * land;
  return h;
}
const TERR = { cx: 0, cz: -70, size: 560, seg: 220 };
const terrGeo = new THREE.PlaneGeometry(TERR.size, TERR.size, TERR.seg, TERR.seg); terrGeo.rotateX(-Math.PI / 2); terrGeo.translate(TERR.cx, 0, TERR.cz);
{
  const p = terrGeo.attributes.position, n = p.count, splat = new Float32Array(n * 4), uv = terrGeo.attributes.uv;
  for (let i = 0; i < n; i++){ const x = p.getX(i), z = p.getZ(i); const h = H(x, z); p.setY(i, h); uv.setXY(i, x / 7, z / 7); }
  terrGeo.computeVertexNormals(); const nr = terrGeo.attributes.normal;
  for (let i = 0; i < n; i++){ const x = p.getX(i), z = p.getZ(i), h = p.getY(i), ny = nr.getY(i);
    const sand = sstep(0.95, 0.3, h); const rock = clamp(sstep(0.86, 0.7, ny) + sstep(26, 40, h) * 0.8, 0, 1);
    const dirt = clamp((fbm(x * 0.05 + 11, z * 0.05 + 3) - 0.56) * 4, 0, 0.8) * (1 - sand) * (1 - rock) + sstep(14, 22, h) * 0.5 * (1 - rock);
    let grass = Math.max(0, 1 - sand - rock - dirt);
    const s = grass + dirt + sand + rock || 1; splat[i*4] = grass / s; splat[i*4+1] = dirt / s; splat[i*4+2] = sand / s; splat[i*4+3] = rock / s; }
  terrGeo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
}
// path / pen mask (canvas covering the build grid)
const MASK_N = 512; const maskCanvas = M.mk(MASK_N, MASK_N); const maskCtx = maskCanvas.getContext('2d');
const maskTex = new THREE.CanvasTexture(maskCanvas); maskTex.colorSpace = THREE.NoColorSpace; maskTex.flipY = false; maskTex.minFilter = THREE.LinearMipmapLinearFilter; maskTex.magFilter = THREE.LinearFilter;
const TU = { tGrass: { value: TEX.grass }, tDirt: { value: TEX.dirt }, tSand: { value: TEX.sand }, tRock: { value: TEX.rock }, tGravel: { value: TEX.gravel }, tMask: { value: maskTex },
  uMask: { value: new THREE.Vector4(-HALF, -HALF, 1 / (GRID * TILE), 0) }, uGrid: { value: 0 } };
const terrMat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, normalMap: TEX.grassN, normalScale: new THREE.Vector2(0.7, 0.7) });
terrMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, TU);
  sh.vertexShader = 'attribute vec4 splat; varying vec4 vSplat; varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vSplat = splat; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'uniform sampler2D tGrass, tDirt, tSand, tRock, tGravel, tMask; uniform vec4 uMask; uniform float uGrid; varying vec4 vSplat; varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
    vec2 w1 = vWP.xz / 9.0, w2 = vWP.xz / 41.0;
    float macro = texture2D(tDirt, vWP.xz / 173.0).g * 1.6 + 0.35;
    vec3 gr = texture2D(tGrass, w1).rgb * 0.6 + texture2D(tGrass, w2 * 1.3 + 0.37).rgb * 0.4; gr *= vec3(0.5, 0.74, 0.3) * (0.7 + 0.35 * macro);
    vec3 di = texture2D(tDirt, w1 * 0.8).rgb * vec3(0.95, 0.9, 0.8);
    vec3 sa = texture2D(tSand, w1).rgb * vec3(1.02, 0.96, 0.86);
    vec3 ro = texture2D(tRock, vWP.xz / 14.0 + vec2(vWP.y * 0.05)).rgb * vec3(0.8, 0.78, 0.74);
    vec3 col = gr * vSplat.x + di * vSplat.y + sa * vSplat.z + ro * vSplat.w;
    vec2 muv = (vWP.xz - uMask.xy) * uMask.z;
    vec4 mk = (muv.x > 0.0 && muv.y > 0.0 && muv.x < 1.0 && muv.y < 1.0) ? texture2D(tMask, muv) : vec4(0.0);
    vec3 pen = texture2D(tDirt, w1 * 1.3).rgb * vec3(0.92, 0.86, 0.74);
    col = mix(col, mix(col, pen, 0.75), mk.g);
    vec3 gv = texture2D(tGravel, vWP.xz / 4.0).rgb * vec3(0.86, 0.78, 0.62);
    col = mix(col, gv, smoothstep(0.25, 0.65, mk.r));
    col *= mix(0.4, 1.0, smoothstep(-3.0, 0.2, vWP.y));
    if (uGrid > 0.5 && mk.a >= 0.0){ vec2 g = abs(fract((vWP.xz - uMask.xy) / ${TILE.toFixed(1)}) - 0.5); float l = smoothstep(0.47, 0.495, max(g.x, g.y)); if (muv.x > 0.0 && muv.y > 0.0 && muv.x < 1.0 && muv.y < 1.0) col = mix(col, vec3(0.95, 0.85, 0.55), l * 0.35); }
    diffuseColor.rgb *= col;`);
};
terrMat.customProgramCacheKey = () => 'terrain1';
const terrain = new THREE.Mesh(terrGeo, terrMat); terrain.receiveShadow = true; scene.add(terrain);

/* ================= water ================= */
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b4a4a, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.84, normalMap: TEX.water, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.1 });
const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), waterMat); water.position.y = 0.0; water.receiveShadow = true; water.renderOrder = 2; scene.add(water);
// surf ring: a soft light band at the shoreline drawn on the water
// volcano smoke
const smokeMat = new THREE.SpriteMaterial({ map: TEX.soft, color: 0xb8b4ac, transparent: true, opacity: 0.35, depthWrite: false, fog: true });
const smoke = []; for (let i = 0; i < 14; i++){ const s = new THREE.Sprite(smokeMat.clone()); s.userData.t = i / 14; scene.add(s); smoke.push(s); }
function updateSmoke(dt){ const top = H(VOLC.x, VOLC.z) + 8; for (const s of smoke){ s.userData.t = (s.userData.t + dt * 0.02) % 1; const t = s.userData.t;
  s.position.set(VOLC.x + t * 40 + Math.sin(t * 6 + s.id) * 4, top + t * 70, VOLC.z + t * 18); const sc = 14 + t * 60; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(t * Math.PI) * 0.32; } }

/* ================= vegetation ================= */
const leafMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: 0xb8c890 }), 0.018, 6);
const frondMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.frond, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.8, color: 0xc0cc98 }), 0.03, 8);
const fernMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.fern, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: 0xb0c088 }), 0.05, 0.2);
const cycFrondMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.fern, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: 0xa8bc80 }), 0.03, 2);
const bushMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, color: 0x9cae78 }), 0.04, 0.3);
const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
const VEG = {}; // kind -> {parts:[InstancedMesh], items:[{m:Matrix4, i, j, x, z, r}]}
function vegKind(name, parts, cap){ const ims = parts.map(([geo, mat, cast]) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.castShadow = !!cast; im.receiveShadow = true; im.count = 0; scene.add(im); return im; }); VEG[name] = { ims, items: [] }; }
{
  const palm = M.palmGeos(), cyc = M.cycadGeos(), bl1 = M.broadleafGeos(1), bl2 = M.broadleafGeos(2);
  vegKind('broad1', [[bl1.trunk, barkMat, true], [bl1.canopy, leafMat, true]], 420);
  vegKind('broad2', [[bl2.trunk, barkMat, true], [bl2.canopy, leafMat, true]], 420);
  vegKind('palm', [[palm.trunk, barkMat, true], [palm.crown, frondMat, true]], 320);
  vegKind('cycad', [[cyc.trunk, barkMat, true], [cyc.crown, cycFrondMat, true]], 320);
  vegKind('bush', [[M.bushGeo(), bushMat, false]], 1600);
  vegKind('fern', [[M.fernGeo(), fernMat, false]], 1400);
  vegKind('rock', [[M.rockGeo(5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: TEX.rock }), true]], 200);
}
function scatterVegetation(){
  const r = mulberry(1234); const _m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const tries = { broad1: 2600, broad2: 2600, palm: 1800, cycad: 1600, bush: 6000, fern: 5000, rock: 900 };
  for (const kind in tries){ const V = VEG[kind], cap = V.ims[0].instanceMatrix.count;
    for (let t = 0; t < tries[kind] && V.items.length < cap; t++){
      const x = TERR.cx + (r() - 0.5) * TERR.size * 0.92, z = TERR.cz + (r() - 0.5) * TERR.size * 0.92; const h = H(x, z);
      if (h < (kind === 'palm' ? 0.6 : 1.0) || h > (kind === 'rock' ? 50 : 34)) continue;
      const slope = Math.abs(H(x + 2, z) - h) + Math.abs(H(x, z + 2) - h); if (slope > (kind === 'rock' ? 3 : 1.6)) continue;
      const i = toI(x), j = toI(z), inside = inGrid(i, j) && Math.abs(x) < HALF - 6 && Math.abs(z) < HALF - 6;
      // density: jungle thick at the plot border, sparse clearing inside
      const edge = inside ? sstep(HALF - 40, HALF - 4, Math.max(Math.abs(x), Math.abs(z))) : 1;
      const clump = fbm(x * 0.03 + 50, z * 0.03 + 20);
      let dens = kind === 'palm' ? 0.25 + sstep(2.6, 0.9, h) * 0.75 : kind === 'rock' ? 0.35 : 0.2 + clump * 0.9;
      if (inside) dens *= kind === 'bush' || kind === 'fern' ? 0.35 + edge * 0.65 : kind === 'rock' ? 0.4 : 0.08 + edge * 0.92;
      if (Math.hypot(x, z - 96) < 30) dens = 0; // keep the gate plaza clear
      if (r() > dens) continue;
      const sc = kind === 'rock' ? 0.6 + r() * 2.2 : kind.startsWith('broad') ? 0.75 + r() * 0.5 : kind === 'palm' ? 0.8 + r() * 0.45 : kind === 'cycad' ? 0.8 + r() * 0.7 : 0.7 + r() * 0.8;
      e.set(kind === 'rock' ? r() * 0.4 : (r() - 0.5) * 0.08, r() * TAU, kind === 'rock' ? r() * 0.4 : (r() - 0.5) * 0.08); q.setFromEuler(e); s.set(sc, sc * (kind.startsWith('broad') ? 0.85 + r() * 0.35 : 1), sc); p.set(x, h - (kind === 'rock' ? 0.4 * sc : 0.15), z);
      V.items.push({ m: new THREE.Matrix4().compose(p, q, s), i, j, x, z, r: kind.startsWith('broad') ? 2.2 * sc : kind === 'palm' ? 1.4 : 1.2 * sc, hidden: false });
    }
  }
}
function vegBlocked(it){ // trees cleared by paths, buildings and fence lines
  if (!inGrid(it.i, it.j)) return false;
  const k = it.j * GRID + it.i, ty = tileType[k];
  if (ty === T_PATH || ty === T_BUILD) return true;
  if (ty === T_PEN || tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); if (pen){ const x0 = eX(pen.i0), x1 = eX(pen.i1 + 1), z0 = eX(pen.j0), z1 = eX(pen.j1 + 1);
    const d = Math.min(it.x - x0, x1 - it.x, it.z - z0, z1 - it.z); if (d < it.r + 0.8) return true; if (pen.feeders.some(f => Math.hypot(tX(f.i) - it.x, tZ(f.j) - it.z) < 4)) return true; } }
  // near fences of a neighbouring pen
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){ const ii = it.i + di, jj = it.j + dj; if (!inGrid(ii, jj)) continue; const kk = jj * GRID + ii; if (tileType[kk] === T_PEN && tileRef[kk] !== (ty === T_PEN ? tileRef[k] : -1)){ const pen = pens.get(tileRef[kk]);
    if (pen){ const x0 = eX(pen.i0), x1 = eX(pen.i1 + 1), z0 = eX(pen.j0), z1 = eX(pen.j1 + 1); const dx = Math.max(x0 - it.x, 0, it.x - x1), dz = Math.max(z0 - it.z, 0, it.z - z1); if (Math.hypot(dx, dz) < it.r + 0.8) return true; } } }
  return false;
}
function refreshVegetation(){
  const lvl = QUALITY.veg[QUALITY.level];
  for (const kind in VEG){ const V = VEG[kind]; let n = 0; const lim = Math.floor(V.items.length * lvl);
    for (let a = 0; a < V.items.length && a < lim; a++){ const it = V.items[a]; if (vegBlocked(it)) continue; for (const im of V.ims) im.setMatrixAt(n, it.m); n++; }
    for (const im of V.ims){ im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } }
}

/* ================= world state ================= */
const T_BLOCK = -1, T_EMPTY = 0, T_PATH = 1, T_BUILD = 2, T_PEN = 3;
const tileType = new Int8Array(GRID * GRID), tileRef = new Int32Array(GRID * GRID).fill(-1), tileH = new Float32Array(GRID * GRID);
const buildings = new Map(), pens = new Map();
let dinos = [], eggs = [];
let G = null;
function freshState(){ return { v: 1, econ6: true, money: 300000, day: 1, hour: OPEN - 0.5, price: 35, rep: 55, safety: 85, stars: 0, speed: 1, nextId: 1,
  ledger: { tickets: 0, shops: 0, upkeep: 0, feed: 0, build: 0, hatch: 0, fines: 0, other: 0 }, prevLedger: null,
  stats: { guestsTotal: 0, guestsToday: 0, deaths: 0, fed: 0, breakouts: 0, hatched: 0, carnHatched: 0, bestProfit: -1e9, trex: 0 },
  missions: [], thrill: 0, tutorialDone: false, feedCooldown: 0 }; }
const GATE = { i: 27, j: 53 };
function computeBuildable(){
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++){
    const x0 = eX(i), z0 = eX(j), hs = [H(x0, z0), H(x0 + TILE, z0), H(x0, z0 + TILE), H(x0 + TILE, z0 + TILE), H(x0 + 2, z0 + 2)];
    const mn = Math.min(...hs), mx = Math.max(...hs); const k = j * GRID + i; tileH[k] = hs[4];
    tileType[k] = (mn < 0.55 || mx > 7 || mx - mn > 1.9) ? T_BLOCK : T_EMPTY; }
}
const isPath = (i, j) => inGrid(i, j) && tileType[j * GRID + i] === T_PATH;
const idx = (i, j) => j * GRID + i;

/* ---------- mask (paths + pen floors painted into the terrain) ---------- */
function drawMask(){
  const g = maskCtx, s = MASK_N / (GRID * TILE), tp = TILE * s;
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, MASK_N, MASK_N); g.globalCompositeOperation = 'lighter';
  const r = mulberry(99);
  for (const pen of pens.values()){ g.fillStyle = 'rgb(0,120,0)'; g.fillRect(pen.i0 * tp + 1, pen.j0 * tp + 1, (pen.i1 - pen.i0 + 1) * tp - 2, (pen.j1 - pen.j0 + 1) * tp - 2);
    for (let k = 0; k < (pen.i1 - pen.i0 + 1) * (pen.j1 - pen.j0 + 1) * 6; k++){ g.fillStyle = `rgba(0,${60 + r() * 120 | 0},0,0.6)`; const x = (pen.i0 + r() * (pen.i1 - pen.i0 + 1)) * tp, y = (pen.j0 + r() * (pen.j1 - pen.j0 + 1)) * tp; g.beginPath(); g.arc(x, y, 1 + r() * 4, 0, TAU); g.fill(); } }
  g.fillStyle = 'rgb(255,0,0)';
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (tileType[idx(i, j)] === T_PATH){
    const L = isPath(i - 1, j), R = isPath(i + 1, j), U = isPath(i, j - 1), D = isPath(i, j + 1); const ins = tp * 0.14;
    g.fillRect(i * tp + (L ? 0 : ins), j * tp + (U ? 0 : ins), tp - (L ? 0 : ins) - (R ? 0 : ins), tp - (U ? 0 : ins) - (D ? 0 : ins)); }
  // gate apron
  g.fillRect(GATE.i * tp, (GATE.j) * tp, tp * 2, tp * 3);
  maskTex.needsUpdate = true;
}

/* ---------- buildings ---------- */
const bldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
const bldGeoCache = {};
function bldGeo(type){ return bldGeoCache[type] || (bldGeoCache[type] = M.buildingGeo(type)); }
const signTex = canvasTex(M.signCanvas('PRIMEVAL PARK', 'ISLA SOMBRA  -  EST. 2026'), true, false);
function makeBuildingMesh(type){
  const g = new THREE.Group(); const m = new THREE.Mesh(bldGeo(type), bldMat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  if (type === 'gate'){ const s = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 2.4), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 })); s.position.set(0, 9.2, 0.6); g.add(s);
    const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.6; g.add(s2);
    for (const sd of [-1, 1]){ const f = new THREE.PointLight(0xff9a40, 0, 18, 2); f.position.set(sd * 5.2, 13.2, 0); g.add(f); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.set(1.6, 2.2, 1); fl.position.set(sd * 5.2, 13.3, 0); g.add(fl); g.userData.flames = (g.userData.flames || []).concat(fl); } }
  return g;
}
function footprint(type, rot){ const f = M.FOOT[type] || [1, 1]; return (Math.abs(Math.sin(rot)) > 0.5) ? [f[1], f[0]] : [f[0], f[1]]; }
function canPlace(type, i, j){
  const B = BUILD[type]; const [w, h] = footprint(type, 0);
  if (B.inPen){ if (!inGrid(i, j)) return { ok: false, why: 'Outside the park' }; const k = idx(i, j); if (tileType[k] !== T_PEN) return { ok: false, why: 'Feeders go inside an enclosure' };
    const pen = pens.get(tileRef[k]); if (pen.feeders.some(f => f.i === i && f.j === j)) return { ok: false, why: 'Tile already has a feeder' }; return { ok: true, pen }; }
  for (let dj = 0; dj < h; dj++) for (let di = 0; di < w; di++){ const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) return { ok: false, why: 'Outside the park' }; const t = tileType[idx(ii, jj)]; if (t !== T_EMPTY) return { ok: false, why: t === T_BLOCK ? 'Ground too rough' : 'Tile is occupied' }; }
  return { ok: true };
}
function faceRot(i, j, w, h){
  const sides = [[0, 0, h, 1, 0], [Math.PI / 2, w, 0, 0, 1], [Math.PI, 0, -1, 1, 0], [-Math.PI / 2, -1, 0, 0, 1]];
  for (const [rot, ox, oz, sx, sz] of sides){ const n = sx ? w : h; for (let k = 0; k < n; k++){ const ii = i + ox + sx * k, jj = j + oz + sz * k; if (isPath(ii, jj)) return rot; } }
  return 0;
}
function placeBuilding(type, i, j, opts = {}){
  const B = BUILD[type]; const [w, h] = footprint(type, 0); const id = opts.id || G.nextId++;
  const b = { id, type, i, j, w, h, rot: 0, pen: -1 };
  if (B.inPen){ const pen = pens.get(tileRef[idx(i, j)]); b.pen = pen.id; pen.feeders.push({ id, type, i, j }); }
  else for (let dj = 0; dj < h; dj++) for (let di = 0; di < w; di++){ const k = idx(i + di, j + dj); tileType[k] = T_BUILD; tileRef[k] = id; }
  b.rot = opts.rot !== undefined ? opts.rot : (B.inPen ? 0 : faceRot(i, j, w, h));
  const cx = tX(i) + (w - 1) * TILE / 2, cz = tZ(j) + (h - 1) * TILE / 2; let mn = 99; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) mn = Math.min(mn, H(cx + dx * w * TILE * 0.45, cz + dz * h * TILE * 0.45));
  const mesh = makeBuildingMesh(type); mesh.position.set(cx, mn - 0.05, cz); mesh.rotation.y = b.rot; scene.add(mesh); b.mesh = mesh; b.x = cx; b.z = cz;
  buildings.set(id, b); return b;
}
function removeBuilding(b){
  scene.remove(b.mesh); buildings.delete(b.id);
  if (b.pen >= 0){ const pen = pens.get(b.pen); if (pen) pen.feeders = pen.feeders.filter(f => f.id !== b.id); }
  else for (let dj = 0; dj < b.h; dj++) for (let di = 0; di < b.w; di++){ const k = idx(b.i + di, b.j + dj); tileType[k] = T_EMPTY; tileRef[k] = -1; }
}

/* ---------- pens + fences ---------- */
const fenceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 });
const chainMat = new THREE.MeshStandardMaterial({ map: TEX.chain, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6, color: 0xbfc4c2 });
const FENCE_IM = FT.map((_, t) => { const g = M.fenceGeos(t); const mk = (geo, mat, cast) => { const im = new THREE.InstancedMesh(geo, mat, 1400); im.count = 0; im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
  return { post: mk(g.post, fenceMat, true), panel: mk(g.panel, fenceMat, true), mesh: g.mesh ? mk(g.mesh, chainMat, false) : null }; });
function penSegments(pen){
  const segs = []; const { i0, i1, j0, j1 } = pen;
  for (let i = i0; i <= i1; i++) segs.push([eX(i), eX(j0), eX(i + 1), eX(j0), 0, -1]);
  for (let i = i0; i <= i1; i++) segs.push([eX(i), eX(j1 + 1), eX(i + 1), eX(j1 + 1), 0, 1]);
  for (let j = j0; j <= j1; j++) segs.push([eX(i0), eX(j), eX(i0), eX(j + 1), -1, 0]);
  for (let j = j0; j <= j1; j++) segs.push([eX(i1 + 1), eX(j), eX(i1 + 1), eX(j + 1), 1, 0]);
  return segs;
}
function rebuildFences(){
  const _m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(); const counts = FT.map(() => [0, 0, 0]);
  for (const pen of pens.values()){
    const F = FENCE_IM[pen.tier], c = counts[pen.tier]; const posts = new Set();
    pen.geom.forEach((sg, k) => { const [ax, az, bx, bz] = sg; const st = pen.segs[k];
      for (const [x, z] of [[ax, az], [bx, bz]]){ const key = x + ',' + z; if (posts.has(key)) continue; posts.add(key); const tilt = st.broken && (x === ax && z === az) ? 0.35 : 0;
        e.set(tilt, 0, tilt * 0.6); q.setFromEuler(e); p.set(x, H(x, z) - 0.15, z); s.set(1, 1, 1); _m.compose(p, q, s); F.post.setMatrixAt(c[0]++, _m); }
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, y = Math.min(H(ax, az), H(bx, bz), H(mx, mz)) - (pen.tier === 3 ? 0.3 : 0.1);
      const rotY = ax === bx ? Math.PI / 2 : 0; const worn = 1 - st.cond;
      if (st.broken){ e.set(0, rotY, 0, 'YXZ'); q.setFromEuler(e); const tq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), sg[4] + sg[5] > 0 ? 1.35 : -1.35); q.multiply(tq); p.set(mx + sg[4] * 1.2, y + 0.2, mz + sg[5] * 1.2); s.set(1, pen.tier === 3 ? 0.4 : 1, 1); }
      else { e.set(worn * 0.12 * Math.sin(k * 3.7), rotY, worn * 0.08 * Math.cos(k * 2.3), 'YXZ'); q.setFromEuler(e); p.set(mx, y, mz); s.set(1, 1, 1); }
      _m.compose(p, q, s); F.panel.setMatrixAt(c[1]++, _m); if (F.mesh){ F.mesh.setMatrixAt(c[2]++, _m); }
    });
  }
  FENCE_IM.forEach((F, t) => { F.post.count = counts[t][0]; F.panel.count = counts[t][1]; F.post.instanceMatrix.needsUpdate = true; F.panel.instanceMatrix.needsUpdate = true; if (F.mesh){ F.mesh.count = counts[t][2]; F.mesh.instanceMatrix.needsUpdate = true; } });
}
function penCanBuild(i0, j0, i1, j1){
  if (i1 - i0 < 2 || j1 - j0 < 2) return { ok: false, why: 'Enclosures must be at least 3 x 3 tiles' };
  if (i1 - i0 > 15 || j1 - j0 > 15) return { ok: false, why: 'Maximum size is 16 x 16 tiles' };
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ if (!inGrid(i, j)) return { ok: false, why: 'Outside the park' }; const t = tileType[idx(i, j)]; if (t !== T_EMPTY) return { ok: false, why: t === T_BLOCK ? 'Ground too rough or wet' : 'Overlaps a path, building or enclosure' }; }
  return { ok: true };
}
function penCost(i0, j0, i1, j1, tier){ return (2 * (i1 - i0 + 1) + 2 * (j1 - j0 + 1)) * FT[tier].cost + (i1 - i0 + 1) * (j1 - j0 + 1) * 60; }
function createPen(i0, j0, i1, j1, tier, opts = {}){
  const id = opts.id || G.nextId++; const pen = { id, i0, j0, i1, j1, tier, feeders: [], name: opts.name || ('Enclosure ' + (pens.size + 1)) };
  pen.geom = penSegments(pen); pen.segs = pen.geom.map((_, k) => ({ cond: opts.segs ? opts.segs[k] : 1, broken: opts.broken ? opts.broken.includes(k) : false }));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const k = idx(i, j); tileType[k] = T_PEN; tileRef[k] = id; }
  pens.set(id, pen); return pen;
}
function removePen(pen){
  for (const f of pen.feeders.slice()){ const b = buildings.get(f.id); if (b) removeBuilding(b); }
  for (const d of dinos.filter(d => d.pen === pen.id)) removeDino(d);
  for (let j = pen.j0; j <= pen.j1; j++) for (let i = pen.i0; i <= pen.i1; i++){ const k = idx(i, j); tileType[k] = T_EMPTY; tileRef[k] = -1; }
  pens.delete(pen.id);
}
const penArea = pen => (pen.i1 - pen.i0 + 1) * (pen.j1 - pen.j0 + 1);
const penRect = (pen, m = 1.5) => [eX(pen.i0) + m, eX(pen.j0) + m, eX(pen.i1 + 1) - m, eX(pen.j1 + 1) - m];
const penCenter = pen => [(eX(pen.i0) + eX(pen.i1 + 1)) / 2, (eX(pen.j0) + eX(pen.j1 + 1)) / 2];
const penMinCond = pen => pen.segs.reduce((a, s) => Math.min(a, s.broken ? 0 : s.cond), 1);
const penBroken = pen => pen.segs.some(s => s.broken);
const penDinos = pen => dinos.filter(d => d.pen === pen.id && d.state !== 'holding');
function penWeak(pen){ let worst = null; for (const d of dinos) if (d.pen === pen.id){ const S = SPECIES[d.sp]; if (S.str > FT[pen.tier].str - 0.75 && (!worst || S.str > SPECIES[worst].str)) worst = d.sp; } return worst; }
function fenceStrength(pen){ return FT[pen.tier].str * (0.5 + 0.5 * penMinCond(pen)); }
// a worn fence is flagged before it gets weak enough for its strongest animal to push through
function penWorn(pen){ let s = 0; for (const d of dinos) if (d.pen === pen.id && d.state !== 'wild') s = Math.max(s, SPECIES[d.sp].str); return s > 0 && fenceStrength(pen) < s * 1.1 + 0.4 && penMinCond(pen) < 0.95; }
function repairCost(pen){ let c = 0; for (const s of pen.segs) c += s.broken ? FT[pen.tier].cost * 1.2 : (1 - s.cond) * FT[pen.tier].cost * 0.5; return Math.round(c / 10) * 10; }
// warning markers above pens
function warnCanvas(){ const c = M.mk(128, 128), g = c.getContext('2d'); g.fillStyle = '#f2c230'; g.strokeStyle = '#111'; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath(); g.moveTo(64, 12); g.lineTo(120, 112); g.lineTo(8, 112); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#111'; g.fillRect(58, 44, 12, 40); g.fillRect(58, 92, 12, 12); return c; }
const warnMat = new THREE.SpriteMaterial({ map: canvasTex(warnCanvas(), true, false), depthTest: false, transparent: true, fog: false });
const warnSprites = new Map();
function updateWarnMarkers(t){
  for (const pen of pens.values()){ const show = !!penWeak(pen) || penBroken(pen) || penMinCond(pen) < 0.45 || penWorn(pen); let s = warnSprites.get(pen.id);
    if (show && !s){ s = new THREE.Sprite(warnMat); s.renderOrder = 10; scene.add(s); warnSprites.set(pen.id, s); }
    if (s){ s.visible = show; if (show){ const [cx, cz] = penCenter(pen); s.position.set(cx, H(cx, cz) + 16, cz); const sc = clamp(cam.dist * 0.05, 3, 9) * (1 + Math.sin(t * 6) * 0.08); s.scale.set(sc, sc, 1); } } }
  for (const [id, s] of warnSprites) if (!pens.has(id)){ scene.remove(s); warnSprites.delete(id); }
}

/* ================= particles ================= */
const bloodIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshStandardMaterial({ color: 0x7a0a08, roughness: 0.35 }), 120); bloodIM.count = 0; bloodIM.frustumCulled = false; scene.add(bloodIM);
const blood = [];
const dustMat = new THREE.SpriteMaterial({ map: TEX.soft, color: 0x9a8a6a, transparent: true, depthWrite: false, opacity: 0.6 });
const dusts = [];
function splash(x, y, z, n = 40){ SFX.chomp(1); for (let k = 0; k < n && blood.length < 120; k++){ const a = rnd() * TAU, u = rnd(); blood.push({ x, y, z, vx: Math.cos(a) * u * 4, vy: 2 + rnd() * 4.5, vz: Math.sin(a) * u * 4, life: 0.6 + rnd() * 0.7, s: 0.6 + rnd() * 1.2 }); }
  $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 140); }
function dust(x, z, size = 3, n = 6, col){ for (let k = 0; k < n; k++){ let s = dusts.find(d => !d.alive); if (!s){ if (dusts.length > 40) return; s = { sp: new THREE.Sprite(dustMat.clone()) }; scene.add(s.sp); dusts.push(s); }
  s.alive = true; s.t = 0; s.life = 1.2 + rnd() * 0.8; s.size = size * (0.6 + rnd() * 0.6); const a = rnd() * TAU; s.vx = Math.cos(a) * size * 0.5; s.vz = Math.sin(a) * size * 0.5; s.sp.position.set(x + Math.cos(a) * size * 0.3, H(x, z) + size * 0.25, z + Math.sin(a) * size * 0.3); s.sp.material.color.set(col || 0x9a8a6a); s.sp.visible = true; } }
const _pm = new THREE.Matrix4();
function updateParticles(dt){
  let n = 0; for (let k = blood.length - 1; k >= 0; k--){ const b = blood[k]; b.life -= dt; b.vy -= 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; const g = H(b.x, b.z) + 0.05; if (b.y < g){ b.y = g; b.vx *= 0.3; b.vz *= 0.3; b.vy = 0; }
    if (b.life <= 0){ blood.splice(k, 1); continue; } const s = b.s * Math.min(1, b.life * 2); _pm.makeScale(s, b.y <= g + 0.01 ? s * 0.25 : s, s).setPosition(b.x, b.y, b.z); bloodIM.setMatrixAt(n++, _pm); }
  bloodIM.count = n; bloodIM.instanceMatrix.needsUpdate = true;
  for (const s of dusts){ if (!s.alive) continue; s.t += dt; const k = s.t / s.life; if (k >= 1){ s.alive = false; s.sp.visible = false; continue; } s.sp.position.x += s.vx * dt; s.sp.position.z += s.vz * dt; s.sp.position.y += dt * 0.6; const sc = s.size * (0.6 + k * 1.4); s.sp.scale.set(sc, sc, 1); s.sp.material.opacity = 0.55 * (1 - k); }
}

/* ================= dinosaurs ================= */
function dinoRadius(d){ return SPECIES_DATA[d.sp].size * 0.22; }
function randomPenPoint(pen, m){ const [x0, z0, x1, z1] = penRect(pen, m); return [fr(x0, Math.max(x0, x1)), fr(z0, Math.max(z0, z1))]; }
function spawnDino(sp, pen, opts = {}){
  const model = new Dino(sp); scene.add(model.root);
  const m = Math.min(1.5 + SPECIES_DATA[sp].size * 0.18, (pen.i1 - pen.i0 + 1) * TILE / 2 - 0.5);
  const [x, z] = opts.x !== undefined ? [opts.x, opts.z] : randomPenPoint(pen, m);
  const used = new Set(dinos.map(d => d.name)); const name = opts.name || NAMES.find(n => !used.has(n)) || NAMES[(rnd() * NAMES.length) | 0];
  const d = { id: opts.id || G.nextId++, sp, pen: pen.id, x, z, hd: rnd() * TAU, v: 0, tx: x, tz: z, wait: 1 + rnd() * 3, state: opts.state || 'pen', hunger: opts.hunger ?? 0.25, stress: 0, name, model, darts: 0, sleep: 0, sedT: 0, eatT: 0, roarCD: 5 + rnd() * 20, killCD: 0, fedSkip: opts.fedSkip || 0, lastStep: 0, visible: true };
  if (d.state === 'holding'){ model.root.visible = false; }
  dinos.push(d); placeDinoModel(d, 0); return d;
}
function removeDino(d){ scene.remove(d.model.root); dinos = dinos.filter(x => x !== d); if (sel && sel.kind === 'dino' && sel.ref === d) closeSheet(); }
function placeDinoModel(d, turn){ d.model.root.position.set(d.x, H(d.x, d.z), d.z); d.model.root.rotation.y = d.hd; }
function feederOf(pen, diet){ return pen.feeders.find(f => (diet === 'meat' ? f.type === 'meat' : f.type === 'plant')); }
function dinoComfort(d){
  const S = SPECIES[d.sp], pen = pens.get(d.pen); if (!pen) return { space: 1, social: 1, food: 1, mixed: false, total: 1 };
  const mates = dinos.filter(o => o.pen === pen.id && o.state !== 'holding'); const need = mates.reduce((a, o) => a + SPECIES[o.sp].space, 0);
  const space = clamp(penArea(pen) / Math.max(1, need), 0, 1); const same = mates.filter(o => o.sp === d.sp).length;
  const social = same < S.group[0] ? same / S.group[0] : same > S.group[1] ? S.group[1] / same : 1;
  const food = feederOf(pen, S.diet) ? 1 : 0.2; const mixed = mates.some(o => SPECIES[o.sp].diet !== S.diet || (S.diet === 'meat' && o.sp !== d.sp));
  return { space, social, food, mixed, total: clamp(space * 0.35 + social * 0.25 + food * 0.3 + (mixed ? 0 : 0.1), 0, 1) };
}
function moveToward(d, tx, tz, maxV, dt, turnRate, hunt){
  const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz); let want = 0;
  if (dist > 0.6){ const th = Math.atan2(dx, dz); let dh = th - d.hd; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU; const tr = turnRate * dt; const turn = clamp(dh, -tr, tr); d.hd += turn; d.turn = turn / Math.max(dt, 1e-3); want = hunt ? maxV * (Math.abs(dh) > 1.8 ? 0.5 : 1) : maxV * clamp(dist / 4, 0.25, 1) * (Math.abs(dh) > 1.4 ? 0.3 : 1); }
  else d.turn = 0;
  d.v = damp(d.v, want, 2.5, dt); d.x += Math.sin(d.hd) * d.v * dt; d.z += Math.cos(d.hd) * d.v * dt; return dist;
}
function nearestGuest(x, z, maxD, filter){ let best = null, bd = maxD; for (const g of guests){ if (g.gone || (filter && !filter(g))) continue; const d = Math.hypot(g.x - x, g.z - z); if (d < bd){ bd = d; best = g; } } return best; }
function updateDino(d, dt){
  const S = SPECIES[d.sp], SD = SPECIES_DATA[d.sp], pen = pens.get(d.pen); let speedMax = S.walk; const turnRate = 2.4 / Math.sqrt(SD.size / 3);
  d.roarCD -= dt; d.killCD -= dt; d.turn = 0;
  if (d.prey && !d.prey.gone){ d.lookV = d.lookV || new THREE.Vector3(); d.model.setLook(d.lookV.set(d.prey.x, H(d.prey.x, d.prey.z) + 1.6, d.prey.z)); } else d.model.setLook(null);
  if (d.state === 'holding'){ return; }
  if (d.state === 'transfer'){ updateTransfer(d, dt); return; }
  if (pen && pen.held){ d.v = 0; d.model.animate(dt, 0, 0); return; } // picked up: AI and breakouts paused
  if (d.state === 'sedated' || d.state === 'airlift'){
    d.sleep = damp(d.sleep, 1, 2, dt); d.v = damp(d.v, 0, 4, dt); d.sedT += dt;
    if (d.state === 'sedated' && d.sedT > 5){ d.state = 'airlift'; d.sedT = 0; dust(d.x, d.z, SD.size * 0.4, 8, 0xb0a890); }
    if (d.state === 'airlift'){ const k = d.sedT / 1.6; d.model.root.position.y += dt * 6 * k; if (k >= 1) returnDino(d); }
    d.model.sleep = d.sleep; d.model.animate(dt, 0, 0); if (d.state !== 'airlift') placeDinoModel(d); return;
  }
  d.sleep = damp(d.sleep, 0, 2, dt); d.model.sleep = d.sleep;
  if (d.eatT > 0){ d.eatT -= dt; d.v = damp(d.v, 0, 5, dt); if (d.eatT <= 0){ d.hunger = 0; if (d.fedSkip > 0) d.fedSkip--; else spend('feed', S.feed / 2); } }
  else if (d.state === 'pen' && pen){
    const m = Math.min(1.5 + SD.size * 0.16, (Math.min(pen.i1 - pen.i0, pen.j1 - pen.j0) + 1) * TILE / 2 - 0.5); const [x0, z0, x1, z1] = penRect(pen, m);
    if (d.prey && !d.prey.gone && d.prey.state === 'inpen'){
      speedMax = S.run; const g = d.prey; const dist = moveToward(d, g.x, g.z, speedMax, dt, turnRate * 2.6, true);
      if (dist < SD.size * 0.36 + 1.6 && !d.biting){ d.biting = true; d.model.setAction('bite', 0.7); setTimeout(() => { if (!g.gone){ eatGuest(d, g, true); } d.biting = false; d.prey = null; setTimeout(() => d.model.setAction('roar', 2.2), 900); if (d.sp === 'trex') setTimeout(() => SFX.roar(2.2, camVol(d.x, d.z)), 1000); }, 300); }
    } else {
      d.prey = null; const feeder = feederOf(pen, S.diet);
      if (d.hunger > 0.55 && feeder){ const fx = tX(feeder.i), fz = tZ(feeder.j); const reach = 2.2 + SD.size * 0.3; d.tx = fx; d.tz = fz;
        const dist = moveToward(d, fx, fz, speedMax, dt, turnRate); if (dist < reach){ d.eatT = 5; d.model.setAction('eat', 5); } }
      else { d.wait -= dt; const dist = Math.hypot(d.tx - d.x, d.tz - d.z);
        if (dist < 1.2 || d.wait < -12){ if (d.wait <= 0){ if (d.stress > 0.55 && rnd() < 0.6){ // pace along the fence
              const side = (rnd() * 4) | 0; d.tx = side === 0 ? x0 : side === 1 ? x1 : fr(x0, x1); d.tz = side === 2 ? z0 : side === 3 ? z1 : fr(z0, z1); }
            else { d.tx = fr(x0, Math.max(x0, x1)); d.tz = fr(z0, Math.max(z0, z1)); } d.wait = 1.5 + rnd() * 5; if (rnd() < 0.25 && d.roarCD < 0){ d.model.setAction('roar', 2); d.roarCD = 20 + rnd() * 40; if (S.diet === 'meat' || d.sp === 'trike' || d.sp === 'para') ambientCall(d); } else if (rnd() < 0.3) d.model.setAction('eat', 3); } }
        else moveToward(d, d.tx, d.tz, speedMax * (d.stress > 0.6 ? 1.3 : 1), dt, turnRate); }
    }
    d.x = clamp(d.x, x0, Math.max(x0, x1)); d.z = clamp(d.z, z0, Math.max(z0, z1));
  }
  else if (d.state === 'loose'){
    speedMax = S.run * 0.75;
    if (d.exitP){ const dist = moveToward(d, d.exitP[0], d.exitP[1], speedMax, dt, turnRate); if (dist < 2) d.exitP = null; }
    else if (S.diet === 'meat' && d.killCD <= 0){ const g = d.prey && !d.prey.gone ? d.prey : nearestGuest(d.x, d.z, 70, g => g.state !== 'tossed' && g.state !== 'inpen');
      d.prey = g; if (g){ const dist = moveToward(d, g.x, g.z, S.run * 0.85, dt, turnRate * 2.2, true); if (dist < SD.size * 0.36 + 1.6 && !d.biting){ d.biting = true; d.model.setAction('bite', 0.7); setTimeout(() => { if (!g.gone) eatGuest(d, g, false); d.biting = false; d.prey = null; d.killCD = 9; }, 300); } }
      else wanderLoose(d, dt, speedMax * 0.6, turnRate); }
    else wanderLoose(d, dt, speedMax * 0.55, turnRate);
    // scare guests
    if ((G.tick | 0) % 2 === 0) for (const g of guests){ if (g.gone || g.state === 'flee' || g.state === 'tossed' || g.state === 'inpen' || g.state === 'lured') continue; if (Math.hypot(g.x - d.x, g.z - d.z) < 38){ panicGuest(g, 22); } }
    // trample: stay in the park
    d.x = clamp(d.x, -HALF + 6, HALF - 6); d.z = clamp(d.z, -HALF + 6, HALF - 4);
    if (H(d.x, d.z) < 0.4){ d.hd += Math.PI * dt; }
    if (d.roarCD < 0){ d.roarCD = 20 + rnd() * 20; d.model.setAction('roar', 2); ambientCall(d); }
  }
  // separation inside pens
  if (d.state === 'pen') for (const o of dinos){ if (o === d || o.pen !== d.pen || o.state !== 'pen') continue; const dx = d.x - o.x, dz = d.z - o.z, dd = Math.hypot(dx, dz), r = dinoRadius(d) + dinoRadius(o);
    if (dd < r && dd > 0.01){ const k = (r - dd) * 0.5 * Math.min(1, dt * 4); d.x += dx / dd * k; d.z += dz / dd * k; } }
  d.model.animate(dt, d.v, d.turn || 0); placeDinoModel(d);
}
function wanderLoose(d, dt, v, tr){ d.wait -= dt; const dist = Math.hypot(d.tx - d.x, d.tz - d.z); if (dist < 3 || d.wait < 0){ d.tx = clamp(d.x + fr(-40, 40), -HALF + 10, HALF - 10); d.tz = clamp(d.z + fr(-40, 40), -HALF + 10, HALF - 10); d.wait = 6 + rnd() * 6; } moveToward(d, d.tx, d.tz, v, dt, tr); }
/* occasional calls only: each animal waits 20-60 s (roarCD), only nearby on-screen animals are heard, and the park plays at most one ambient call every ~8 s */
let lastAmbientCall = -1e9; const _vc = new THREE.Vector3();
function ambientCall(d){ const now = performance.now(); if (now - lastAmbientCall < 8000) return; const vol = camVol(d.x, d.z); if (vol < 0.2) return;
  _vc.set(d.x, H(d.x, d.z) + 2, d.z).project(camera); if (_vc.z > 1 || Math.abs(_vc.x) > 1.1 || Math.abs(_vc.y) > 1.1) return; lastAmbientCall = now; vocal(d); }
function vocal(d){ const vol = camVol(d.x, d.z); const SD = SPECIES_DATA[d.sp]; if (d.sp === 'raptor' || d.sp === 'dilo') SFX.screech(vol); else SFX.roar(SD.size / 5, vol); }
function camVol(x, z){ const d = Math.hypot(camera.position.x - x, camera.position.z - z, camera.position.y - H(x, z)); return clamp(1.3 - d / 160, 0, 1); }
function dinoHourly(d){
  const S = SPECIES[d.sp], pen = pens.get(d.pen); if (d.state === 'holding' || !pen || pen.held) return;
  d.hunger = clamp(d.hunger + (S.diet === 'meat' ? 0.075 : 0.09) * (d.state === 'loose' ? 1.5 : 1), 0, 1);
  const c = dinoComfort(d); const target = clamp(Math.max(0, d.hunger - 0.6) * 1.8 + (1 - c.space) * 0.6 + (1 - c.social) * 0.4 + (c.mixed ? 0.4 : 0) + (S.clever ? 0.15 : 0), 0, 1);
  d.stress = lerp(d.stress, target, 0.35);
  if (d.state !== 'pen') return;
  // breakout check: strength vs fence
  const fence = fenceStrength(pen), eff = S.str * (1 + 0.5 * d.stress); let p = 0;
  if (penBroken(pen)) p = 0.3;
  else if (eff > fence) p = Math.min(0.35, 0.06 + 0.12 * (eff - fence));
  else if (eff > fence - 0.4) p = 0.002 + (d.stress > 0.7 ? 0.004 : 0);
  if (rnd() < p) breakout(d, pen);
  else if (eff > fence * 0.6){ // fence pressure: ram / test the wires
    const seg = nearestSeg(pen, d.x, d.z); seg.cond = clamp(seg.cond - 0.01 * (eff / FT[pen.tier].str) * (0.5 + d.stress), 0, 1); }
}
function nearestSeg(pen, x, z){ let best = 0, bd = 1e9; pen.geom.forEach((g, k) => { const mx = (g[0] + g[2]) / 2, mz = (g[1] + g[3]) / 2; const dd = Math.hypot(mx - x, mz - z); if (dd < bd){ bd = dd; best = k; } }); return Object.assign(pen.segs[best], { k: best }); }
function breakout(d, pen){
  const seg = nearestSeg(pen, d.x, d.z); const g = pen.geom[seg.k]; seg.broken = true; seg.cond = 0; rebuildFences();
  const mx = (g[0] + g[2]) / 2, mz = (g[1] + g[3]) / 2; d.state = 'loose'; d.exitP = [mx + g[4] * 10, mz + g[5] * 10]; d.prey = null; d.darts = 0;
  // squeeze through the gap: start at the breach
  d.x = mx - g[4] * 2; d.z = mz - g[5] * 2;
  dust(mx, mz, 5, 10); SFX.siren(); vocal(d); d.model.setAction('roar', 2.2);
  G.safety = clamp(G.safety - 10, 0, 100); G.stats.breakouts++;
  toast(`Containment breach: ${SPECIES[d.sp].short} "${d.name}" broke through the ${FT[pen.tier].name.toLowerCase()} fence.`, 'bad');
  showAlert(); refreshSheet();
}
function returnDino(d){
  const pen = pens.get(d.pen); d.darts = 0; d.sleep = 0; d.model.sleep = 0; d.prey = null; d.exitP = null;
  if (!pen){ removeDino(d); return; }
  if (penBroken(pen)){ d.state = 'holding'; d.model.root.visible = false; toast(`${d.name} is sedated in holding. Repair ${pen.name} to release.`, ''); }
  else { d.state = 'pen'; d.model.root.visible = true; const [x, z] = randomPenPoint(pen, 3); d.x = x; d.z = z; dust(x, z, 4, 8); toast(`${d.name} is back in ${pen.name}.`, 'good'); }
  showAlert(); refreshSheet();
}
function releaseHeld(pen){ for (const d of dinos) if (d.pen === pen.id && d.state === 'holding'){ d.state = 'pen'; d.model.root.visible = true; const [x, z] = randomPenPoint(pen, 3); d.x = x; d.z = z; dust(x, z, 4, 8); } }

/* ================= guests ================= */
const GCAP = 300;
const GG = M.guestGeos();
const guestShirtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const guestBodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
guestBodyMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = M.WIND;
  sh.vertexShader = 'uniform float uTime; attribute float aLeg; attribute vec2 aWalk;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    if (aLeg != 0.0){ float a = sin(uTime * 9.0 + aWalk.x) * aLeg * 0.5 * aWalk.y; float py = 0.92; float yy = transformed.y - py; float zz = transformed.z; transformed.y = py + yy * cos(a) - zz * sin(a); transformed.z = yy * sin(a) + zz * cos(a); }`); };
guestBodyMat.customProgramCacheKey = () => 'guestwalk';
const walkAttr = new THREE.InstancedBufferAttribute(new Float32Array(GCAP * 2), 2); walkAttr.setUsage(THREE.DynamicDrawUsage); GG.body.setAttribute('aWalk', walkAttr);
const guestShirtIM = new THREE.InstancedMesh(GG.shirt, guestShirtMat, GCAP), guestBodyIM = new THREE.InstancedMesh(GG.body, guestBodyMat, GCAP);
for (const im of [guestShirtIM, guestBodyIM]){ im.count = 0; im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); }
const SHIRTS = [0xd8cfb8, 0x2f4a6a, 0x7a2e24, 0x3c5a34, 0xc9a038, 0x4a4a48, 0xe8e4da, 0x6a4a7a, 0x2a6a6a, 0xb86a3a, 0x8a8a5a, 0x1e2a3a];
let guests = [];
const exitDist = new Int32Array(GRID * GRID); const viewMap = new Float32Array(GRID * GRID);
function computeExitField(){ exitDist.fill(1e6); const q = []; for (const i of [GATE.i, GATE.i + 1]){ const k = idx(i, GATE.j); exitDist[k] = 0; q.push(k); }
  while (q.length){ const k = q.shift(); const i = k % GRID, j = (k / GRID) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!isPath(ii, jj)) continue; const kk = idx(ii, jj); if (exitDist[kk] > exitDist[k] + 1){ exitDist[kk] = exitDist[k] + 1; q.push(kk); } } } }
function computeViewMap(){
  viewMap.fill(0); const plats = [...buildings.values()].filter(b => b.type === 'viewing'); penSpots = [];
  for (const pen of pens.values()){ const ds = dinos.filter(d => d.pen === pen.id && (d.state === 'pen')); if (!ds.length) continue; let spot = -1, sv = 0;
    const counts = {}; let ap = 0; for (const d of ds){ counts[d.sp] = (counts[d.sp] || 0) + 1; ap += SPECIES[d.sp].appeal * Math.pow(0.6, counts[d.sp] - 1) * (0.7 + 0.3 * (1 - d.stress)); }
    const vis = pen.tier === 3 ? 0.4 : 1;
    for (let j = pen.j0 - 5; j <= pen.j1 + 5; j++) for (let i = pen.i0 - 5; i <= pen.i1 + 5; i++){ if (!isPath(i, j)) continue; const dd = Math.max(pen.i0 - i, 0, i - pen.i1, pen.j0 - j, 0, j - pen.j1);
      let v = ap * (1 - dd / 6) * vis; for (const p of plats){ if (Math.abs(p.i - i) <= 2 && Math.abs(p.j - j) <= 2 && Math.max(pen.i0 - p.i, 0, p.i - pen.i1, pen.j0 - p.j, 0, p.j - pen.j1) <= 3){ v *= pen.tier === 3 ? 2.6 : 1.6; break; } }
      viewMap[idx(i, j)] += v; if (v > sv && exitDist[idx(i, j)] < 1e6){ sv = v; spot = idx(i, j); } }
    if (spot >= 0) penSpots.push({ pen: pen.id, k: spot, ap }); }
}
/* ---- guest destinations: walk the connected path network to a chosen spot (an unseen exhibit, a shop when needed, or a far corner), linger, pick the next ---- */
const pathFields = new Map(); let penSpots = [], shopSpots = [], explorable = [];
function pathField(k){ let f = pathFields.get(k); if (f) return f; if (pathFields.size > 96) pathFields.clear();
  f = new Int16Array(GRID * GRID).fill(-1); f[k] = 0; const q = [k]; let h = 0;
  while (h < q.length){ const c = q[h++]; const i = c % GRID, j = (c / GRID) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!isPath(ii, jj)) continue; const kk = idx(ii, jj); if (f[kk] < 0){ f[kk] = f[c] + 1; q.push(kk); } } }
  pathFields.set(k, f); return f; }
function rebuildGuestSpots(){ pathFields.clear(); shopSpots = []; explorable = [];
  for (let k = 0; k < GRID * GRID; k++) if (tileType[k] === T_PATH && exitDist[k] < 1e6 && (k / GRID | 0) < GATE.j) explorable.push(k);
  for (const b of buildings.values()){ if (!['food', 'gift', 'restroom', 'visitor'].includes(b.type)) continue; const seen = new Set();
    for (let dj = -1; dj <= b.h; dj++) for (let di = -1; di <= b.w; di++){ if ((di === -1 || di === b.w) === (dj === -1 || dj === b.h)) continue; const i = b.i + di, j = b.j + dj; if (!isPath(i, j)) continue; const k = idx(i, j); if (exitDist[k] >= 1e6 || seen.has(k)) continue; seen.add(k); shopSpots.push({ k, type: b.type, i, j }); } } }
function pickDest(g){ const here = idx(g.ci, g.cj); const pick = (arr) => { let tot = 0; for (const o of arr) tot += o.w; let r = rnd() * tot; for (const o of arr){ r -= o.w; if (r <= 0) return o; } return arr[arr.length - 1]; };
  const near = (types, goal) => { const c = shopSpots.filter(s => types.includes(s.type) && s.k !== here); if (!c.length) return null; const f = pathField(here);
    const o = c.map(s => ({ k: s.k, d: f[s.k] < 0 ? 1e4 : f[s.k] })).filter(o => o.d < 1e4).sort((a, b) => a.d - b.d); return o.length ? { k: o[Math.min(o.length - 1, (rnd() * 2) | 0)].k, goal } : null; };
  let d = null;
  if (g.bladder > 0.6) d = near(['restroom', 'visitor'], 'restroom');
  if (!d && g.hunger > 0.55 && g.money > 15) d = near(['food', 'visitor'], 'food');
  if (!d){ const opts = [];
    for (const s of penSpots){ if (s.k === here) continue; opts.push({ k: s.k, goal: 'view', pen: s.pen, w: (8 + s.ap) * (g.seen.has(s.pen) ? 0.15 : 1.6) }); }
    if (explorable.length){ let best = -1, bd = -1; for (let n = 0; n < 5; n++){ const k = explorable[(rnd() * explorable.length) | 0]; const dd = Math.abs(k % GRID - g.ci) + Math.abs((k / GRID | 0) - g.cj); if (dd > bd){ bd = dd; best = k; } } if (best >= 0 && best !== here) opts.push({ k: best, goal: 'explore', w: 14 }); }
    const gift = shopSpots.filter(s => s.type === 'gift'); if (gift.length && g.happy > 62 && g.money > 30 && !g.boughtGift) opts.push({ k: gift[(rnd() * gift.length) | 0].k, goal: 'gift', w: 12 });
    if (opts.length) d = pick(opts); }
  if (d){ g.dest = d.k; g.goal = d.goal; g.goalPen = d.pen ?? -1; } else { g.dest = -1; g.goal = 'wander'; } }
function stepToward(g){ const f = pathField(g.dest); const here = f[idx(g.ci, g.cj)]; if (here < 0) return null; let best = null, bd = here;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = g.ci + di, jj = g.cj + dj; if (!isPath(ii, jj)) continue; const v = f[idx(ii, jj)]; if (v >= 0 && (v < bd || (v === bd && best && rnd() < 0.5))){ bd = v; best = [ii, jj]; } }
  return bd < here ? best : null; }
/* ---- what guests want ---- */
const GNAMES = ['Ava', 'Ben', 'Chloe', 'Dev', 'Ella', 'Finn', 'Grace', 'Hugo', 'Isla', 'Jack', 'Kai', 'Lena', 'Max', 'Nora', 'Omar', 'Pia', 'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Vic', 'Wes', 'Yara', 'Zoe', 'Leo', 'Mia', 'Noah', 'Ivy', 'Eli'];
const GLAST = 'ABCDEFGHJKLMNPRSTVW';
function guestName(g){ return g.name || (g.name = GNAMES[g.id % GNAMES.length] + ' ' + GLAST[(g.id * 7) % GLAST.length] + '.'); }
function guestThought(g){ if (g.gone) return null;
  if (g.state === 'flee' || g.state === 'lured' || g.state === 'tossed' || g.state === 'inpen') return 'scared';
  if (g.state !== 'walk' && g.state !== 'leave') return null;
  if (g.bladder > 0.75) return 'restroom'; if (g.hunger > 0.7) return 'food';
  if ((g.bored || 0) > 0.6 && g.state === 'walk') return 'dinos'; if (g.state === 'leave' && g.stay <= 0.3) return 'tired'; if (g.happy > 84) return 'happy'; return null; }
const THOUGHT_TEXT = { food: 'I am hungry. Where can I eat?', restroom: 'I really need a restroom.', dinos: 'I want to see more dinosaurs.', scared: 'Get me out of here!', tired: 'What a day. Time to head home.', happy: 'This park is amazing!' };
function bubbleTex(kind){ const c = M.mk(128, 128), g = c.getContext('2d');
  g.fillStyle = 'rgba(255,250,238,.96)'; g.strokeStyle = 'rgba(40,30,20,.5)'; g.lineWidth = 4; g.beginPath(); g.arc(64, 56, 46, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(40, 108, 9, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(28, 122, 5, 0, TAU); g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'food'){ g.fillStyle = '#d99a3a'; g.beginPath(); g.ellipse(64, 46, 30, 16, 0, Math.PI, 0); g.fill(); g.fillStyle = '#6a3a1c'; g.fillRect(34, 50, 60, 9); g.fillStyle = '#5aa83a'; g.fillRect(36, 59, 56, 5); g.fillStyle = '#d99a3a'; g.beginPath(); g.roundRect ? g.roundRect(34, 64, 60, 12, 6) : g.rect(34, 64, 60, 12); g.fill(); }
  else if (kind === 'restroom'){ g.fillStyle = '#2f6aa8'; g.font = 'bold 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WC', 64, 58); }
  else if (kind === 'dinos'){ g.strokeStyle = '#3c6a2a'; g.lineWidth = 9; g.beginPath(); g.moveTo(30, 74); g.quadraticCurveTo(44, 70, 52, 54); g.lineTo(62, 40); g.quadraticCurveTo(70, 30, 84, 32); g.lineTo(96, 38); g.stroke(); g.beginPath(); g.moveTo(52, 58); g.lineTo(50, 80); g.moveTo(66, 52); g.lineTo(72, 78); g.stroke(); g.fillStyle = '#a8342a'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('?', 96, 76); }
  else if (kind === 'scared'){ g.fillStyle = '#c0302a'; g.font = 'bold 70px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 58); }
  else if (kind === 'tired'){ g.fillStyle = '#5a5a8a'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 48, 66); g.font = 'bold 46px system-ui, sans-serif'; g.fillText('Z', 78, 46); }
  else if (kind === 'happy'){ g.strokeStyle = '#c88a1a'; g.lineWidth = 7; g.beginPath(); g.arc(64, 56, 28, 0, TAU); g.stroke(); g.fillStyle = '#c88a1a'; g.beginPath(); g.arc(54, 48, 4, 0, TAU); g.arc(74, 48, 4, 0, TAU); g.fill(); g.beginPath(); g.arc(64, 58, 15, 0.2, Math.PI - 0.2); g.stroke(); }
  return new THREE.SpriteMaterial({ map: canvasTex(c, true, false), depthTest: true, transparent: true, fog: false }); }
const BUBBLE_MAX = 15; const bubbleMats = {}; const bubbles = []; let bubbleT = 0; const _bv = new THREE.Vector3();
function updateBubbles(dt){ bubbleT -= dt; if (bubbleT <= 0){ bubbleT = 0.3; const cand = [];
    for (const g of guests){ const th = guestThought(g); if (!th) continue; _bv.set(g.x, walkH(g.x, g.z) + 2.5, g.z).project(camera); if (_bv.z > 1 || Math.abs(_bv.x) > 1.05 || Math.abs(_bv.y) > 1.05) continue;
      const pr = (th === 'scared' ? 3 : th === 'happy' ? 0.6 : th === 'tired' ? 0.5 : 1.5) + ((g.id * 13) % 7) * 0.03; cand.push({ g, th, pr: pr - camera.position.distanceTo(_bv.set(g.x, 0, g.z)) * 0.002 }); }
    cand.sort((a, b) => b.pr - a.pr); const pick = cand.slice(0, cam.dist > 260 ? 0 : BUBBLE_MAX);
    while (bubbles.length < pick.length){ const s = new THREE.Sprite(); s.renderOrder = 9; scene.add(s); bubbles.push({ s, g: null }); }
    bubbles.forEach((b, k) => { const p = pick[k]; if (!p){ b.s.visible = false; b.g = null; return; } b.g = p.g; b.s.material = bubbleMats[p.th] || (bubbleMats[p.th] = bubbleTex(p.th)); b.s.visible = true; }); }
  const sc = clamp(cam.dist * 0.022, 1.4, 4.2);
  for (const b of bubbles){ if (!b.g || !b.s.visible) continue; if (b.g.gone){ b.s.visible = false; continue; } b.s.position.set(b.g.x, walkH(b.g.x, b.g.z) + 2.6 + sc * 0.5 + (b.g.yOff || 0), b.g.z); b.s.scale.set(sc, sc, 1); } }
function guestNeeds(){ const inPark = guests.filter(g => !g.gone && (g.state === 'walk' || g.state === 'leave' || g.state === 'flee'));
  const n = inPark.length; const tally = { food: [], restroom: [], dinos: [], scared: [] }; let hp = 0;
  for (const g of inPark){ hp += g.happy; if (g.hunger > 0.6) tally.food.push(g); if (g.bladder > 0.65) tally.restroom.push(g); if ((g.bored || 0) > 0.5 && g.state === 'walk') tally.dinos.push(g); if (g.state === 'flee') tally.scared.push(g); }
  const where = (arr) => { if (!arr.length) return 'busiest'; let x = 0, z = 0; for (const g of arr){ x += g.x; z += g.z; } x /= arr.length; z /= arr.length; const cx = tX(GATE.i), cz = 0;
    const dx = x - cx, dz = z - cz; if (Math.hypot(dx, dz) < 25) return 'central'; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north'); };
  const has = t => [...buildings.values()].some(b => b.type === t);
  const tip = { food: (a) => has('food') ? `Add another Food Stand by the ${where(a)} path, or bring paths past the one you have.` : `Build a Food Stand touching the ${where(a)} path. Each meal pays ${fmt(FOOD_PRICE)}.`,
    restroom: (a) => has('restroom') ? `Add Restrooms near the ${where(a)} path.` : `Build Restrooms touching the ${where(a)} path. Unhappy bladders mean unhappy guests.`,
    dinos: (a) => `Guests on the ${where(a)} paths see no dinosaurs. Put an enclosure beside that path, or add animals.`,
    scared: () => 'Recapture loose animals and use stronger fences.' };
  const label = { food: 'hungry', restroom: 'need a restroom', dinos: 'want to see more dinosaurs', scared: 'are scared' };
  const top = Object.keys(tally).map(k => ({ k, pct: n ? Math.round(tally[k].length / n * 100) : 0, label: label[k], tip: tip[k](tally[k]) })).filter(o => o.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
  return { n, happy: n ? hp / n : 0, top }; }
function pickGuest(x, y){ let best = null, bd = 30; for (const g of guests){ if (g.gone || g.state === 'enter') continue; _bv.set(g.x, walkH(g.x, g.z) + 1, g.z).project(camera); if (_bv.z > 1) continue;
  const sx = (_bv.x * 0.5 + 0.5) * innerWidth, sy = (-_bv.y * 0.5 + 0.5) * innerHeight; const dd = Math.hypot(sx - x, sy - y); if (dd < bd){ bd = dd; best = g; } } return best; }
/* ---- ferry pier: guests arrive and leave by boat, never through the surf ----
   boardwalk from the gate plaza straight out over the beach to a T-shaped dock head; ferries berth along its seaward face */
const PIER = { x0: -2.3, x1: 2.3, z0: 103, z1: 137 }, DOCKH = { x0: -15, x1: 15, z0: 136, z1: 144.5 }, BERTH = { x: 0, z: 147.9 }, GANG = [0, 143.6];
const DECK_MIN = 1.35;
function onPier(x, z){ return (x >= PIER.x0 && x <= PIER.x1 && z >= PIER.z0 && z <= PIER.z1) || (x >= DOCKH.x0 && x <= DOCKH.x1 && z >= DOCKH.z0 && z <= DOCKH.z1); }
function deckY(z){ return z >= DOCKH.z0 ? DECK_MIN : Math.max(H(0, z) + 0.16, DECK_MIN); }
function walkH(x, z){ return onPier(x, z) ? deckY(z) : H(x, z); }
function pierGeo(){ const P = [], add = (g, c, m) => P.push([g, c, m]); const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), cy = (r, h, s = 7) => new THREE.CylinderGeometry(r, r, h, s);
  const plank = (k) => [0x8a6a48, 0x7d5f40, 0x94744f, 0x86664a][k % 4];
  // boardwalk planks (across the walk), stringers, piles and rails
  let k = 0; for (let z = PIER.z0; z < DOCKH.z0; z += 0.55, k++){ const y = deckY(z + 0.27); add(bx(PIER.x1 - PIER.x0, 0.12, 0.5), plank(k), M.M(0, y - 0.06, z + 0.27)); }
  for (const sx of [-1.9, 0, 1.9]) for (let z = PIER.z0; z < DOCKH.z0; z += 4){ const y0 = deckY(z), y1 = deckY(z + 4); add(bx(0.22, 0.3, 4.05), 0x4a3420, M.M(sx, (y0 + y1) / 2 - 0.27, z + 2, Math.atan2(y0 - y1, 4), 0, 0)); }
  for (let z = PIER.z0 + 2; z < DOCKH.z0; z += 4){ const y = deckY(z), g = H(0, z); if (y - g < 0.25) continue; for (const sx of [-2.1, 2.1]){ const bot = Math.min(g, -1) - 1; add(cy(0.2, y - bot), 0x3e2c1c, M.M(sx, (y + bot) / 2 - 0.1, z)); } }
  for (const sx of [-2.25, 2.25]){ for (let z = PIER.z0 + 1; z <= DOCKH.z0; z += 2.4){ const y = deckY(z); add(bx(0.12, 1.05, 0.12), 0x5a4128, M.M(sx, y + 0.5, z)); }
    for (let z = PIER.z0 + 1; z < DOCKH.z0 - 1; z += 2.4){ const y0 = deckY(z), y1 = deckY(Math.min(z + 2.4, DOCKH.z0)); add(bx(0.1, 0.1, 2.45), 0x6b4c2e, M.M(sx, (y0 + y1) / 2 + 1.02, z + 1.2, Math.atan2(y0 - y1, 2.4), 0, 0)); add(bx(0.06, 0.06, 2.45), 0x6b4c2e, M.M(sx, (y0 + y1) / 2 + 0.55, z + 1.2, Math.atan2(y0 - y1, 2.4), 0, 0)); } }
  // dock head deck, fascia, piles, bollards, rails on the three non-berth sides, lamps and a ferry sign
  k = 0; for (let x = DOCKH.x0; x < DOCKH.x1; x += 0.55, k++) add(bx(0.5, 0.14, DOCKH.z1 - DOCKH.z0), plank(k), M.M(x + 0.27, DECK_MIN - 0.07, (DOCKH.z0 + DOCKH.z1) / 2));
  add(bx(DOCKH.x1 - DOCKH.x0 + 0.3, 0.45, 0.25), 0x3e2c1c, M.M(0, DECK_MIN - 0.3, DOCKH.z1 + 0.1)); add(bx(DOCKH.x1 - DOCKH.x0 + 0.3, 0.12, 0.35), 0x2a2a26, M.M(0, DECK_MIN - 0.55, DOCKH.z1 + 0.2));
  for (let x = DOCKH.x0 + 0.6; x <= DOCKH.x1; x += 3.6) for (const z of [DOCKH.z0 + 0.5, DOCKH.z1 - 0.2]) add(cy(0.24, 10), 0x3e2c1c, M.M(x, DECK_MIN - 5.2, z));
  for (const x of [-12, -6, 6, 12]){ add(cy(0.22, 0.55, 9), 0x1c1c18, M.M(x, DECK_MIN + 0.27, DOCKH.z1 - 0.45)); add(cy(0.32, 0.1, 9), 0x1c1c18, M.M(x, DECK_MIN + 0.58, DOCKH.z1 - 0.45)); }
  for (const x of [-9, 9]){ add(new THREE.TorusGeometry(0.42, 0.11, 6, 14), (v, c) => c.setHex(Math.floor((Math.atan2(v.y - DECK_MIN - 1.2, v.x - x) + 4) * 1.27) % 2 ? 0xf0f0ea : 0xe0561f), M.M(x, DECK_MIN + 1.2, DOCKH.z0 + 0.2)); }
  const railX = (x0, x1, z) => { for (let x = x0; x <= x1 + 0.01; x += 2.5) add(bx(0.12, 1.05, 0.12), 0x5a4128, M.M(x, DECK_MIN + 0.5, z)); add(bx(x1 - x0, 0.1, 0.1), 0x6b4c2e, M.M((x0 + x1) / 2, DECK_MIN + 1.02, z)); };
  railX(DOCKH.x0, PIER.x0 - 0.1, DOCKH.z0 + 0.05); railX(PIER.x1 + 0.1, DOCKH.x1, DOCKH.z0 + 0.05);
  for (const sx of [DOCKH.x0, DOCKH.x1]){ for (let z = DOCKH.z0; z <= DOCKH.z1; z += 2.8) add(bx(0.12, 1.05, 0.12), 0x5a4128, M.M(sx, DECK_MIN + 0.5, z)); add(bx(0.1, 0.1, DOCKH.z1 - DOCKH.z0), 0x6b4c2e, M.M(sx, DECK_MIN + 1.02, (DOCKH.z0 + DOCKH.z1) / 2)); }
  for (const x of [-13.5, 13.5, -2.6, 2.6]){ const z = Math.abs(x) > 3 ? DOCKH.z1 - 0.6 : DOCKH.z0 - 6; const y = deckY(z); add(cy(0.07, 3.6, 6), 0x1c1c18, M.M(x, y + 1.8, z)); add(new THREE.SphereGeometry(0.24, 8, 6), 0xfff0c8, M.M(x, y + 3.7, z)); add(cy(0.3, 0.12, 8), 0x1c1c18, M.M(x, y + 3.95, z)); }
  // ticket kiosk with a striped awning at the dock head
  add(bx(2.4, 2.3, 1.8), 0xe6dcc4, M.M(-10.5, DECK_MIN + 1.15, DOCKH.z0 + 2.2)); add(bx(1.6, 0.8, 0.06), 0x2e4a52, M.M(-10.5, DECK_MIN + 1.5, DOCKH.z0 + 3.12)); add(bx(2.9, 0.12, 2.5), (v, c) => c.setHex(Math.floor((v.x + 20) * 1.6) % 2 ? 0xf0ead8 : 0x2f6f5e), M.M(-10.5, DECK_MIN + 2.45, DOCKH.z0 + 2.4, 0.12, 0, 0));
  add(bx(3.2, 0.7, 0.12), 0x2f6f5e, M.M(-10.5, DECK_MIN + 3.0, DOCKH.z0 + 1.3)); add(bx(2.6, 0.3, 0.14), 0xf2c230, M.M(-10.5, DECK_MIN + 3.0, DOCKH.z0 + 1.3));
  // benches for the homeward queue
  for (const x of [5.5, 9.5]){ add(bx(2.6, 0.08, 0.5), 0x7d5f40, M.M(x, DECK_MIN + 0.5, DOCKH.z0 + 1.0)); add(bx(2.6, 0.5, 0.08), 0x7d5f40, M.M(x, DECK_MIN + 0.8, DOCKH.z0 + 0.75)); for (const dx of [-1.1, 1.1]) add(bx(0.08, 0.5, 0.45), 0x1c1c18, M.M(x + dx, DECK_MIN + 0.25, DOCKH.z0 + 1.0)); }
  return M.mergeColored(P); }
/* three boats, all with the bow along +z; waterline at y = 0 */
function hullShape(L, B, bowK = 0.32, sternK = 0.86){ const s = new THREE.Shape(); const h = L / 2, b = B / 2;
  s.moveTo(-b * sternK, h); s.lineTo(b * sternK, h); s.quadraticCurveTo(b, h * 0.4, b, -h * 0.2); s.quadraticCurveTo(b * 0.95, -h * 0.75, 0, -h); s.quadraticCurveTo(-b * 0.95, -h * 0.75, -b, -h * 0.2); s.quadraticCurveTo(-b, h * 0.4, -b * sternK, h); return s; }
function hullGeo(L, B, y0, y1, bowK){ const g = new THREE.ExtrudeGeometry(hullShape(L, B, bowK), { depth: y1 - y0, bevelEnabled: false, curveSegments: 8 }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g; }
function boatGeo(kind){ const P = [], add = (g, c, m) => P.push([g, c, m]); const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), cy = (r, h, s = 8) => new THREE.CylinderGeometry(r, r, h, s);
  // hull built from stacked slices so each colour band has hard edges (antifouling, topsides, stripe, rubbing strake)
  const hull = (L, B, bands, dx = 0, bow) => { for (const [y0, y1, col] of bands){ const g = hullGeo(L, B, y0, y1, bow); if (dx) g.translate(dx, 0, 0); add(g, col); } };
  // a cabin: solid block, a row of dark windows on every face with white mullions
  const cabin = (w, h, d, x, y, z, base, glass, wy0, wy1, step = 1.15) => { add(bx(w, h, d), base, M.M(x, y, z)); const wy = (wy0 + wy1) / 2, wh = wy1 - wy0;
    for (const sx of [-1, 1]){ add(bx(0.04, wh, d - 0.5), glass, M.M(x + sx * (w / 2 + 0.01), wy, z)); for (let k = -d / 2 + 0.25 + step; k < d / 2 - 0.3; k += step) add(bx(0.06, wh, 0.1), base, M.M(x + sx * (w / 2 + 0.02), wy, z + k)); }
    for (const sz of [-1, 1]) add(bx(w - 0.5, wh, 0.04), glass, M.M(x, wy, z + sz * (d / 2 + 0.01))); };
  const rails = (L, B, y, every = 1.6, z0 = -L / 2 + 2.2, z1 = L / 2 - 0.6) => { for (let z = z0; z <= z1; z += every) for (const sx of [-1, 1]) add(bx(0.06, 0.9, 0.06), 0xd8dcd8, M.M(sx * (B / 2 - 0.18), y + 0.45, z)); for (const sx of [-1, 1]) add(bx(0.06, 0.06, z1 - z0), 0xd8dcd8, M.M(sx * (B / 2 - 0.18), y + 0.9, (z0 + z1) / 2)); };
  const ring = (x, y, z, ry) => add(new THREE.TorusGeometry(0.34, 0.09, 6, 12), (v, c) => c.setHex(((Math.atan2(v.y - y, v.x - x) + 7) * 1.27 | 0) % 2 ? 0xf0f0ea : 0xe0561f), M.M(x, y, z, 0, ry, 0));
  const GL = 0x1b2830;
  if (kind === 0){ // island ferry: white steel hull, navy stripe, two passenger decks, wheelhouse, yellow funnel
    const L = 22, B = 6.4; hull(L, B, [[-1.1, 0.02, 0x7a2a20], [0.02, 0.8, 0xf2f2ee], [0.8, 1.15, 0x1f3a5f], [1.15, 1.5, 0xf2f2ee], [1.5, 1.6, 0x2a2a26]]); add(hullGeo(L - 0.5, B - 0.5, 1.6, 1.66), 0x9a8a70);
    cabin(B - 1.4, 2.1, 12, 0, 2.7, 1.2, 0xf2f2ee, GL, 2.3, 3.2); add(bx(B - 0.9, 0.16, 13), 0xe2e2de, M.M(0, 3.82, 1.2));
    cabin(B - 2.4, 1.5, 7, 0, 4.65, 2.4, 0xf2f2ee, GL, 4.25, 4.95); add(bx(B - 2.0, 0.14, 7.6), 0x1f3a5f, M.M(0, 5.47, 2.4));
    cabin(2.6, 1.25, 2.2, 0, 6.18, -0.6, 0xf2f2ee, GL, 6.0, 6.55, 0.9); add(bx(3.0, 0.12, 2.6), 0xe2e2de, M.M(0, 6.88, -0.6));
    add(cy(0.55, 2.2, 10), 0xf2c230, M.M(0, 6.5, 4.6)); add(cy(0.57, 0.4, 10), 0x1c1c18, M.M(0, 7.7, 4.6)); add(cy(0.05, 2.6, 5), 0xd8dcd8, M.M(0, 8.2, -0.6)); add(bx(1.2, 0.08, 0.08), 0xd8dcd8, M.M(0, 9.0, -0.6));
    rails(L, B, 1.62); for (const sx of [-1, 1]) for (let z = -1; z <= 5.8; z += 1.2) add(bx(0.06, 0.8, 0.06), 0xd8dcd8, M.M(sx * (B / 2 - 0.9), 4.25, z));
    for (const sx of [-1, 1]) ring(sx * (B / 2 + 0.02), 2.3, 7.4, Math.PI / 2); add(bx(1.4, 0.6, 3.2), 0xe0561f, M.M(2.1, 4.25, 6.6)); add(bx(0.8, 0.5, 0.6), 0x2a2a26, M.M(0, 2.0, -9.6));
    for (let z = 8; z <= 10; z += 1) add(bx(B - 1.6, 0.1, 0.45), 0x8a6a48, M.M(0, 2.05, z)); // stern benches
  } else if (kind === 1){ // catamaran: twin hulls, low sleek cabin, red flash, radar arch
    const L = 18, B = 7.2; for (const sx of [-1, 1]) hull(L, 1.9, [[-0.8, 0.02, 0x2a2a30], [0.02, 0.55, 0xf4f4f0], [0.55, 0.85, 0xc0262a], [0.85, 1.2, 0xf4f4f0]], sx * 2.55);
    add(bx(B, 0.45, L - 2.4), 0xeeeeea, M.M(0, 1.35, 0.8)); add(bx(B - 0.4, 0.1, L - 2.6), 0x8a7a64, M.M(0, 1.62, 0.8));
    cabin(B - 1.0, 1.9, 9.5, 0, 2.6, 0.2, 0xf4f4f0, 0x16222a, 2.0, 3.25, 1.4); add(bx(B - 0.6, 0.18, 10.4), 0xdcdcd8, M.M(0, 3.62, 0.2));
    cabin(B - 2.6, 1.0, 3.2, 0, 4.2, -1.6, 0xf4f4f0, 0x16222a, 3.95, 4.45, 1.0); add(bx(B - 2.2, 0.1, 3.6), 0xc0262a, M.M(0, 4.75, -1.6));
    for (const sx of [-1, 1]) add(bx(0.18, 2.0, 0.3), 0xdcdcd8, M.M(sx * 2.2, 4.7, 1.6, 0, 0, sx * -0.2)); add(bx(4.8, 0.2, 0.4), 0xdcdcd8, M.M(0, 5.7, 1.6)); add(bx(1.6, 0.1, 0.3), 0x1c1c18, M.M(0, 5.95, 1.6));
    rails(L - 1, B, 1.62, 1.4); for (const sx of [-1, 1]) ring(sx * (B / 2 + 0.02), 2.2, 6.2, Math.PI / 2); add(bx(B - 1.2, 0.08, 0.12), 0xc0262a, M.M(0, 1.6, -8.1));
  } else { // classic wooden launch: varnished planked hull, white sheer strake, striped canvas canopy, benches
    const L = 15, B = 4.6; const planks = []; for (let y = 0.02, k = 0; y < 0.95; y += 0.19, k++) planks.push([y, Math.min(0.95, y + 0.19), k % 2 ? 0x7a4a26 : 0x6a3e1e]);
    hull(L, B, [[-0.9, 0.02, 0x2f4f3a], ...planks, [0.95, 1.25, 0xf0ece0]], 0, 0.25); add(hullGeo(L - 0.5, B - 0.5, 1.25, 1.33), 0xb08a5a);
    for (let z = -4; z <= 4.5; z += 1.5) add(bx(B - 1.0, 0.12, 0.45), 0x8a5a30, M.M(0, 1.8, z)); for (const sx of [-1, 1]) for (let z = -4.6; z <= 5; z += 2.4) add(cy(0.06, 1.9, 6), 0xd8d0c0, M.M(sx * (B / 2 - 0.45), 2.3, z));
    for (let k = 0; k < 8; k++) add(bx((B - 0.4) / 8, 0.12, 10.6), k % 2 ? 0xf4efe2 : 0x2f6f5e, M.M(-(B - 0.4) / 2 + (k + 0.5) * (B - 0.4) / 8, 3.3, 0.2));
    cabin(1.4, 1.1, 1.4, 0, 1.85, -5.2, 0x7a4a26, GL, 1.95, 2.3, 0.6); add(cy(0.18, 1.4, 8), 0xb8a070, M.M(0, 3.9, 5.6));
    for (const sx of [-1, 1]) ring(sx * (B / 2 + 0.02), 1.5, 2.5, Math.PI / 2); add(bx(0.3, 0.3, 0.6), 0xd8b84a, M.M(0, 1.45, -7.1));
  }
  return M.mergeColored(P); }
const boatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.06 });
const pierMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.0 });
let pierMesh = null; const boatPool = []; const wakePool = [];
const wakeMat = new THREE.MeshBasicMaterial({ map: TEX.soft, color: 0xf4fbf8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
const wakeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function buildPier(){ if (pierMesh) return; pierMesh = new THREE.Mesh(pierGeo(), pierMat); pierMesh.castShadow = true; pierMesh.receiveShadow = true; scene.add(pierMesh);
  for (let k = 0; k < 3; k++){ const m = new THREE.Mesh(boatGeo(k), boatMat); m.castShadow = true; m.visible = false; scene.add(m); boatPool.push({ mesh: m, kind: k, busy: false }); }
  for (let k = 0; k < 28; k++){ const w = new THREE.Mesh(wakeGeo, wakeMat.clone()); w.visible = false; w.renderOrder = 3; scene.add(w); wakePool.push({ m: w, t: 1 }); } }
/* ferry timetable: arrivals queue at the mainland and come over in batches; departing guests wait on the dock head */
const FERRY = { pendingIn: 0, boats: [], nextK: 0, cool: 0, waitT: 0 };
const FERRY_CAP = 60, FERRY_IN = 7, FERRY_OUT = 7;
const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
const ROUTE_IN = [[150, 250], [110, 172], [42, BERTH.z], [BERTH.x, BERTH.z]], ROUTE_OUT = [[BERTH.x, BERTH.z], [-44, BERTH.z], [-110, 176], [-160, 260]];
function routeAt(R, t){ return [bez(R[0][0], R[1][0], R[2][0], R[3][0], t), bez(R[0][1], R[1][1], R[2][1], R[3][1], t)]; }
function ferryDocked(){ return FERRY.boats.find(b => b.state === 'dock' && b.t > 0.6); }
function ferryArrival(){ const cap = QUALITY.guests[QUALITY.level]; if (guests.length + FERRY.pendingIn >= cap) unseenGuest(); else FERRY.pendingIn++; }
function waitingAtDock(){ let n = 0; for (const g of guests) if (!g.gone && g.exiting && g.wp && !g.wp.length) n++; return n; }
function updateFerries(dt){ if (!pierMesh) return; FERRY.cool -= dt;
  const busy = FERRY.boats.some(b => b.state !== 'out');
  if (FERRY.pendingIn > 0 && !busy) FERRY.waitT += dt; else if (!FERRY.pendingIn) FERRY.waitT = 0;
  if (!busy && FERRY.cool <= 0 && (FERRY.pendingIn >= 6 || (FERRY.pendingIn > 0 && FERRY.waitT > 2.5) || waitingAtDock() > 0)){ FERRY.waitT = 0;
    const slot = boatPool.find(p => !p.busy && p.kind === FERRY.nextK % 3) || boatPool.find(p => !p.busy);
    if (slot){ FERRY.nextK++; slot.busy = true; FERRY.boats.push({ slot, state: 'in', t: 0, carry: 0, out: 0, ph: rnd() * TAU }); FERRY.cool = 2; } }
  for (const b of FERRY.boats){ b.t += dt; const m = b.slot.mesh; let x, z, hd, sp = 0;
    if (b.state === 'in'){ const k = Math.min(1, b.t / FERRY_IN), s = 1 - (1 - k) * (1 - k); [x, z] = routeAt(ROUTE_IN, s); const [x2, z2] = routeAt(ROUTE_IN, Math.min(1, s + 0.01)); hd = s < 0.99 ? Math.atan2(x2 - x, z2 - z) : -Math.PI / 2; sp = 2 * (1 - k);
      if (k >= 1){ b.state = 'dock'; b.t = 0; b.carry = Math.min(FERRY.pendingIn, FERRY_CAP); FERRY.pendingIn -= b.carry; b.spawnT = 0; } }
    else if (b.state === 'dock'){ x = BERTH.x; z = BERTH.z; hd = -Math.PI / 2;
      if (b.t > 0.8 && b.carry > 0){ b.spawnT -= dt; while (b.spawnT <= 0 && b.carry > 0){ b.spawnT += 0.14; b.carry--; if (!spawnGuest()) unseenGuest(); } }
      const boarding = guests.some(g => !g.gone && g.boarding);
      if (b.carry <= 0 && b.t > 5 && (!boarding || b.t > 11)){ b.state = 'out'; b.t = 0; for (const g of guests) if (g.boarding && !g.gone){ removeGuest(g); onGuestLeft(g); } } }
    else { const k = Math.min(1, b.t / FERRY_OUT), s = k * k; [x, z] = routeAt(ROUTE_OUT, s); const [x2, z2] = routeAt(ROUTE_OUT, Math.min(1, s + 0.01)); hd = Math.atan2(x2 - x, z2 - z); sp = 2 * k;
      if (k >= 1){ b.done = true; b.slot.busy = false; m.visible = false; continue; } }
    const T = performance.now() * 0.001 + b.ph; m.visible = true; m.position.set(x, Math.sin(T * 1.1) * 0.09 - 0.05, z); m.rotation.set(Math.sin(T * 1.3) * 0.012, hd, Math.sin(T * 0.9) * 0.022 + (b.state === 'in' ? -sp * 0.01 : sp * 0.01));
    if (sp > 0.25){ b.wk = (b.wk || 0) - dt; if (b.wk <= 0){ b.wk = 0.16; const w = wakePool.find(q => q.t >= 1); if (w){ w.t = 0; w.sp = sp; w.m.visible = true; w.m.position.set(x - Math.sin(hd) * 8.5, 0.06, z - Math.cos(hd) * 8.5); w.m.rotation.y = hd; } const bw = wakePool.find(q => q.t >= 1); if (bw){ bw.t = 0.45; bw.sp = sp * 0.7; bw.m.visible = true; bw.m.position.set(x + Math.sin(hd) * 8, 0.06, z + Math.cos(hd) * 8); bw.m.rotation.y = hd; } } } }
  FERRY.boats = FERRY.boats.filter(b => !b.done);
  for (const w of wakePool){ if (w.t >= 1) continue; w.t = Math.min(1, w.t + dt / 3.2); const s = 3 + w.t * 9; w.m.scale.set(s * 0.9, 1, s * 1.6); w.m.material.opacity = (1 - w.t) * 0.62 * Math.min(1, w.sp + 0.3); if (w.t >= 1) w.m.visible = false; } }

const GATE_OUT = () => [tX(GATE.i) + TILE / 2, tZ(GATE.j) + 6];
function spawnGuest(){
  if (guests.length >= QUALITY.guests[QUALITY.level] || G.money < -1e9) return null;
  const g = { id: G.nextId++, x: GANG[0] + fr(-1.2, 1.2), z: GANG[1] - fr(0, 0.6), hd: Math.PI, state: 'enter', wp: [[fr(-1.3, 1.3), DOCKH.z0 - 0.5], [fr(-1.3, 1.3), PIER.z0 + 1.5]], ci: GATE.i + (rnd() < 0.5 ? 0 : 1), cj: GATE.j, pi: -1, pj: -1, ni: -1, nj: -1,
    off: fr(-1.2, 1.2), speed: fr(2.8, 3.6), money: fr(60, 220), happy: fr(55, 75), hunger: fr(0, 0.4), bladder: fr(0, 0.4), stay: fr(5, 9), dest: -1, goal: '', linger: 0, seen: new Set(), bored: 0, phase: rnd() * TAU, shirt: SHIRTS[(rnd() * SHIRTS.length) | 0], visited: new Set(), moving: 1, gone: false, panicT: 0 };
  g.tx = g.wp[0][0]; g.tz = g.wp[0][1];
  guests.push(g); return g;
}
function nextTile(g){
  const opts = []; const leaving = g.state === 'leave' || g.state === 'flee';
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = g.ci + di, jj = g.cj + dj; if (!isPath(ii, jj)) continue; opts.push([ii, jj]); }
  if (!opts.length) return null;
  if (leaving){ let best = null, bd = exitDist[idx(g.ci, g.cj)]; for (const [ii, jj] of opts){ const dd = exitDist[idx(ii, jj)]; if (dd < bd){ bd = dd; best = [ii, jj]; } } return best; }
  if (g.state === 'walk'){ if (g.dest < 0 || g.dest === idx(g.ci, g.cj)) pickDest(g); if (g.dest >= 0){ const st = stepToward(g); if (st) return st; g.dest = -1; } }
  let tot = 0; const w = opts.map(([ii, jj]) => { const k = idx(ii, jj); let v = 1 + Math.min(viewMap[k], 200) * 0.03 + (g.visited.has(k) ? 0 : 2); if (ii === g.pi && jj === g.pj) v *= opts.length > 1 ? 0.08 : 1; if (jj === GATE.j && g.state === 'walk') v *= 0.05; tot += v; return v; });
  let r = rnd() * tot; for (let k = 0; k < opts.length; k++){ r -= w[k]; if (r <= 0) return opts[k]; } return opts[opts.length - 1];
}
function shopsNear(i, j){ const out = new Set(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) continue; const k = idx(ii, jj); if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); if (b) out.add(b.type); } } return out; }
const FOOD_PRICE = 14, GIFT_PRICE = 24;
function guestArrive(g){
  const k = idx(g.ci, g.cj); if (g.lastArr === k) return; g.lastArr = k; g.visited.add(k);
  if (g.state === 'walk' && g.dest === k){ g.dest = -1; if (g.goal === 'view'){ g.linger = fr(3, 7); if (g.goalPen >= 0 && !g.seen.has(g.goalPen)){ g.seen.add(g.goalPen); g.happy = Math.min(100, g.happy + 5); } } else if (g.goal !== 'explore') g.linger = fr(0.8, 1.6); else g.linger = fr(0, 1); }
  if (g.state === 'walk'){ const s = shopsNear(g.ci, g.cj);
    if ((s.has('food') || s.has('visitor')) && g.hunger > 0.4 && g.money > 15){ g.money -= FOOD_PRICE; g.hunger = 0; g.happy += 4; earn('shops', FOOD_PRICE); }
    if ((s.has('restroom') || s.has('visitor')) && g.bladder > 0.45){ g.bladder = 0; g.happy += 4; }
    if ((s.has('gift') || s.has('visitor')) && g.happy > 62 && g.money > 30 && rnd() < (s.has('gift') ? 0.35 : 0.12)){ g.boughtGift = true; g.money -= GIFT_PRICE; earn('shops', GIFT_PRICE); }
  }
}
function panicGuest(g, hit){ if (g.state === 'flee') return; g.state = 'flee'; g.happy -= hit; g.speed = fr(3.2, 4.2); g.panicT = 0; }
function leaveGuest(g){ if (g.state === 'walk') g.state = 'leave'; }
function removeGuest(g){ g.gone = true; }
function eatGuest(d, g, fedOnPurpose){
  const y = H(g.x, g.z) + 1.2; splash(g.x, y, g.z, 46); SFX.scream(0.6); dust(g.x, g.z, 2.5, 4, 0x8a5a4a); removeGuest(g);
  d.hunger = 0; d.fedSkip = Math.max(d.fedSkip, 1);
  if (!fedOnPurpose){ G.stats.deaths++; G.rep = clamp(G.rep - 7, 0, 100); G.safety = clamp(G.safety - 9, 0, 100); toast(`A guest was eaten by ${d.name}.`, 'bad'); lawsuit(0.7, 30000, 90000); }
  for (const o of guests) if (!o.gone && Math.hypot(o.x - g.x, o.z - g.z) < 45 && o.state !== 'tossed' && o.state !== 'inpen') panicGuest(o, 25);
}
function lawsuit(p, a, b){ if (rnd() < p) setTimeout(() => { const fine = Math.round(fr(a, b) / 500) * 500; spend('fines', fine); toast(`Lawsuit settled out of court: ${fmt(fine)}.`, 'bad'); }, 3500 + rnd() * 4000); }
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(1, 1, 1), _gp = new THREE.Vector3(), _gc = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
function updateGuests(dt, hourDt){
  let n = 0;
  for (const g of guests){
    if (g.gone) continue;
    if (g.state === 'enter' || g.state === 'walk' || g.state === 'leave' || g.state === 'flee'){
      if (g.state !== 'enter') g.stay -= hourDt; g.hunger += hourDt * 0.1; g.bladder += hourDt * 0.11; const v = viewMap[idx(clamp(g.ci, 0, GRID - 1), clamp(g.cj, 0, GRID - 1))];
      g.bored = clamp((g.bored || 0) + hourDt * (v > 0 ? -1.2 : 0.22), 0, 1);
      if (g.state !== 'leave') g.happy += hourDt * ((v > 0 ? Math.min(14, v * 0.12) : (g.linger > 0 ? 0 : -1.2)) - (g.hunger > 0.75 ? 6 : 0) - (g.bladder > 0.85 ? 8 : 0)); g.happy = clamp(g.happy, 0, 100);
      if (g.state === 'walk' && (g.stay <= 0 || g.happy < 18 || G.hour >= CLOSE)) g.state = 'leave';
      const dx = g.tx - g.x, dz = g.tz - g.z, dd = Math.hypot(dx, dz); const sp = g.speed * ((g.state === 'enter' || g.exiting) && onPier(g.x, g.z) ? 1.45 : 1);
      if (dd < 0.3 && g.wp && g.wp.length && (g.state === 'enter' || g.exiting)){ g.wp.shift(); if (g.wp.length){ g.tx = g.wp[0][0]; g.tz = g.wp[0][1]; } else if (g.state === 'enter'){ g.tx = tX(g.ci) + g.off * 0.5; g.tz = tZ(g.cj); } else { g.moving = 0; } }
      else if (dd < 0.3 && g.exiting){ // on the dock head: wait for a ferry, then walk up the gangway and sail home
        if (g.boarding){ removeGuest(g); onGuestLeft(g); continue; }
        if (ferryDocked()){ g.boarding = true; g.tx = GANG[0] + fr(-0.8, 0.8); g.tz = GANG[1] + 0.6; } else { g.moving = 0; if (rnd() < dt * 0.3) g.hd = fr(-1, 1) + Math.PI * (rnd() < 0.7 ? 0 : 1); } }
      else if (dd < 0.3){
        if (g.state === 'enter'){ g.state = 'walk'; G.stats.guestsTotal++; G.stats.guestsToday++; if (g.money >= G.price){ g.money -= G.price; earn('tickets', G.price); } }
        if ((g.state === 'leave' || g.state === 'flee') && g.cj === GATE.j && (g.ci === GATE.i || g.ci === GATE.i + 1)){ g.exiting = true; g.wp = [[fr(-1.3, 1.3), PIER.z0 + 1.5], [fr(-1.3, 1.3), DOCKH.z0 + 0.6], [fr(-13, 13), fr(DOCKH.z0 + 1.2, DOCKH.z1 - 1.4)]]; g.tx = g.wp[0][0]; g.tz = g.wp[0][1]; continue; }
        guestArrive(g);
        if (g.linger > 0 && g.state === 'walk'){ g.linger -= dt; g.moving = 0; if (g.goalPen >= 0){ const P = pens.get(g.goalPen); if (P){ const [cx, cz] = penCenter(P); g.hd = Math.atan2(cx - g.x, cz - g.z); } } }
        else { const nt = nextTile(g); if (!nt){ if (g.state !== 'walk'){ g.stuck = (g.stuck || 0) + dt; if (g.stuck > 4){ removeGuest(g); onGuestLeft(g); } } g.tx = tX(g.ci) + fr(-1.5, 1.5); g.tz = tZ(g.cj) + fr(-1.5, 1.5); }
        else { g.pi = g.ci; g.pj = g.cj; g.ci = nt[0]; g.cj = nt[1]; const di = g.ci - g.pi, dj = g.cj - g.pj; g.tx = tX(g.ci) - dj * g.off; g.tz = tZ(g.cj) + di * g.off; } }
      } else { const s = Math.min(dd, sp * dt); g.x += dx / dd * s; g.z += dz / dd * s; g.hd = Math.atan2(dx, dz); }
      if (!(g.linger > 0 && g.state === 'walk') && !(g.exiting && !g.boarding && g.wp && !g.wp.length && Math.hypot(g.tx - g.x, g.tz - g.z) < 0.3)) g.moving = 1;
    }
    else if (g.state === 'lured'){ const dx = g.tx - g.x, dz = g.tz - g.z, dd = Math.hypot(dx, dz); if (dd < 0.4){ startToss(g); } else { const s = Math.min(dd, 3.4 * dt); g.x += dx / dd * s; g.z += dz / dd * s; g.hd = Math.atan2(dx, dz); } g.moving = 1.4; }
    else if (g.state === 'tossed'){ g.tt += dt / g.tDur; const k = Math.min(1, g.tt); g.x = lerp(g.ax, g.bx, k); g.z = lerp(g.az, g.bz, k); g.yOff = Math.sin(k * Math.PI) * g.arc; g.spin = k * 5; g.moving = 1.5;
      if (k >= 1){ g.state = 'inpen'; g.yOff = 0; g.spin = 0; dust(g.x, g.z, 1.5, 3); } }
    else if (g.state === 'inpen'){ const pen = pens.get(g.pen); const d = g.hunter; g.moving = 1.6;
      if (pen){ const [x0, z0, x1, z1] = penRect(pen, 1.2); let ax = g.x - (d ? d.x : g.x), az = g.z - (d ? d.z : g.z); const al = Math.hypot(ax, az) || 1; ax /= al; az /= al; ax += Math.sin(G.tick * 0.07 + g.id) * 0.6;
        g.tired = (g.tired || 0) + dt; const gs = Math.max(1.2, 3.8 - g.tired * 0.25); g.x = clamp(g.x + ax * gs * dt, x0, x1); g.z = clamp(g.z + az * gs * dt, z0, z1); g.hd = Math.atan2(ax, az); } }
    // write instance
    const y = walkH(g.x, g.z) + (g.yOff || 0); _gq.setFromAxisAngle(_up, g.hd); if (g.spin){ const t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), g.spin); _gq.multiply(t); }
    _gp.set(g.x, y, g.z); _gm.compose(_gp, _gq, _gs); guestShirtIM.setMatrixAt(n, _gm); guestBodyIM.setMatrixAt(n, _gm);
    guestShirtIM.setColorAt(n, _gc.setHex(g.shirt)); walkAttr.setXY(n, g.phase, g.moving * (g.state === 'flee' || g.state === 'inpen' ? 1.4 : 1)); n++;
  }
  guestShirtIM.count = n; guestBodyIM.count = n; guestShirtIM.instanceMatrix.needsUpdate = true; guestBodyIM.instanceMatrix.needsUpdate = true; if (guestShirtIM.instanceColor) guestShirtIM.instanceColor.needsUpdate = true; walkAttr.needsUpdate = true;
  if ((G.tick | 0) % 60 === 0) guests = guests.filter(g => !g.gone);
}
function onGuestLeft(g){ G.rep = clamp(G.rep + (g.happy - G.rep) * 0.025, 0, 100); }
function guestsInPark(){ let n = 0; for (const g of guests) if (!g.gone && g.state !== 'enter') n++; return n; }

/* ================= feeding a guest (deliberate) ================= */
function canFeed(pen){ const c = penDinos(pen).filter(d => SPECIES[d.sp].diet === 'meat' && d.state === 'pen'); return c; }
function feedGuest(pen){
  const carns = canFeed(pen); if (!carns.length){ toast('No carnivore in this enclosure.', 'bad'); return false; }
  if (G.feedCooldown > 0){ toast('Security is still asking questions. Wait a moment.', ''); return false; }
  const [cx, cz] = penCenter(pen); const g = nearestGuest(cx, cz, 400, g => g.state === 'walk' || g.state === 'leave');
  if (!g){ toast('There are no guests in the park to feed.', 'bad'); return false; }
  // walk to the nearest fence point, outside
  const [x0, z0, x1, z1] = penRect(pen, 0); const px = clamp(g.x, x0, x1), pz = clamp(g.z, z0, z1);
  const dl = px - x0, dr = x1 - px, dt = pz - z0, db = z1 - pz; const m = Math.min(dl, dr, dt, db); let ox = px, oz = pz;
  if (m === dl) ox = x0 - 1.6; else if (m === dr) ox = x1 + 1.6; else if (m === dt) oz = z0 - 1.6; else oz = z1 + 1.6;
  g.state = 'lured'; g.tx = ox; g.tz = oz; g.pen = pen.id; g.speed = 3.4; const hunter = carns.sort((a, b) => SPECIES[b.sp].appeal - SPECIES[a.sp].appeal)[0]; g.hunter = hunter;
  G.feedCooldown = 20; G.feeding = { pen: pen.id, guest: g, dino: hunter, t: 0 };
  focusOn(cx, cz, Math.max(45, (pen.i1 - pen.i0 + 1) * TILE * 1.5));
  toast(`Security escorts a guest toward ${pen.name}...`, ''); return true;
}
function startToss(g){
  const pen = pens.get(g.pen); if (!pen){ g.state = 'leave'; return; } const [cx, cz] = penCenter(pen);
  g.state = 'tossed'; g.tt = 0; g.tDur = 1.3; g.ax = g.x; g.az = g.z; const dx = cx - g.x, dz = cz - g.z, dl = Math.hypot(dx, dz); const inside = Math.min(dl * 0.55, 7 + rnd() * 3);
  g.bx = g.x + dx / dl * inside; g.bz = g.z + dz / dl * inside; g.arc = (pen.tier === 3 ? 8 : pen.tier === 2 ? 6.5 : 4.5);
  SFX.scream(0.9);
  setTimeout(() => { const d = g.hunter; if (d && d.state === 'pen' && !g.gone){ d.prey = g; d.model.setAction('roar', 1.2); vocal(d); } }, 900);
  // consequences
  G.stats.fed++; G.thrill = Math.min(3, G.thrill + 1); G.rep = clamp(G.rep - 6, 0, 100); G.safety = clamp(G.safety - 12, 0, 100);
  setTimeout(() => toast('Ticket sales spike. The internet cannot look away.', 'money'), 2500);
  lawsuit(0.55, 20000, 60000);
  for (const o of guests) if (!o.gone && o !== g && (o.state === 'walk' || o.state === 'leave') && Math.hypot(o.x - g.x, o.z - g.z) < 42) panicGuest(o, 30);
}

/* ================= rangers ================= */
const jeepGeo = M.jeepGeo(); const jeeps = [];
const dartMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a1a })); dartMesh.visible = false; scene.add(dartMesh);
const darts = [];
function looseDinos(){ return dinos.filter(d => d.state === 'loose'); }
function dispatchCost(){ return [...buildings.values()].some(b => b.type === 'ranger') ? 2500 : 6000; }
function dispatchRangers(){
  const loose = looseDinos(); if (!loose.length) return; if (jeeps.some(j => j.state !== 'return')){ toast('Rangers are already responding.', ''); return; }
  const cost = dispatchCost(); spend('other', cost);
  const st = [...buildings.values()].filter(b => b.type === 'ranger'); let sx, sz;
  if (st.length){ const t = loose[0]; st.sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z)); sx = st[0].x + 5; sz = st[0].z + 5; } else { [sx, sz] = GATE_OUT(); }
  const mesh = new THREE.Mesh(jeepGeo, bldMat); mesh.castShadow = true; scene.add(mesh);
  const j = { mesh, x: sx, z: sz, hd: 0, v: 0, state: 'drive', home: [sx, sz], fire: 0, wait: 0, contractor: !st.length };
  jeeps.push(j); toast(st.length ? 'Ranger team dispatched with tranquilizer rifles.' : 'No ranger station: an outside containment team is on its way.', ''); showAlert();
}
function updateJeeps(dt){
  for (const j of jeeps.slice()){
    const targ = looseDinos().sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z))[0];
    if (j.state !== 'return' && !targ){ j.wait += dt; if (j.wait > 2.5) j.state = 'return'; }
    let tx, tz, vmax = j.contractor ? 12 : 16;
    if (j.state === 'return'){ [tx, tz] = j.home; } else if (targ){ tx = targ.x; tz = targ.z; }
    if (tx !== undefined){ const dx = tx - j.x, dz = tz - j.z, dd = Math.hypot(dx, dz); const th = Math.atan2(dx, dz); let dh = th - j.hd; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU; j.hd += clamp(dh, -2 * dt, 2 * dt);
      const stopAt = j.state === 'return' ? 1 : 17; const want = dd > stopAt ? vmax : 0; j.v = damp(j.v, want, 2, dt); j.x += Math.sin(j.hd) * j.v * dt; j.z += Math.cos(j.hd) * j.v * dt;
      if (j.state === 'drive' && targ && dd < 24){ j.fire -= dt; if (j.fire <= 0){ j.fire = 1.1; fireDart(j, targ); } }
      if (j.state === 'return' && dd < 2){ scene.remove(j.mesh); jeeps.splice(jeeps.indexOf(j), 1); showAlert(); continue; } }
    const y = H(j.x, j.z); j.mesh.position.set(j.x, y, j.z); j.mesh.rotation.set(0, j.hd, 0); if (j.v > 2 && rnd() < dt * 6) dust(j.x - Math.sin(j.hd) * 2, j.z - Math.cos(j.hd) * 2, 1.6, 1);
  }
  for (const a of darts.slice()){ a.t += dt / 0.28; const k = Math.min(1, a.t); a.m.position.set(lerp(a.ax, a.d.x, k), lerp(a.ay, H(a.d.x, a.d.z) + SPECIES_DATA[a.d.sp].legs[0].at[1], k), lerp(a.az, a.d.z, k)); a.m.lookAt(a.d.x, a.m.position.y, a.d.z);
    if (k >= 1){ scene.remove(a.m); darts.splice(darts.indexOf(a), 1); hitDart(a.d); } }
}
function fireDart(j, d){ SFX.dart(); const m = dartMesh.clone(); m.visible = true; scene.add(m); darts.push({ m, d, t: 0, ax: j.x, ay: H(j.x, j.z) + 2.2, az: j.z }); }
function hitDart(d){ if (d.state !== 'loose') return; d.darts++; const need = SPECIES[d.sp].darts; d.model.setAction('roar', 0.8);
  if (d.darts >= need){ d.state = 'sedated'; d.sedT = 0; d.v = 0; toast(`${d.name} is down. Airlifting back to the enclosure.`, 'good'); SFX.thud(0.9, 3); dust(d.x, d.z, 4, 8); showAlert(); } }

/* ================= economy ================= */
function earn(cat, amt){ G.money += amt; G.ledger[cat] = (G.ledger[cat] || 0) + amt; flowAdd(cat === 'other' ? 'none' : cat, amt); }
function spend(cat, amt){ G.money -= amt; G.ledger[cat] = (G.ledger[cat] || 0) + amt; flowAdd(cat, amt); }
const INCOME = ['tickets', 'shops'];
function ledgerProfit(L){ let p = 0; for (const k in L) p += INCOME.includes(k) ? L[k] : -L[k]; return p; }
function appealTotal(){ const seen = {}; let a = 0; for (const d of dinos){ if (d.state === 'holding' || d.state === 'wild') continue; seen[d.sp] = (seen[d.sp] || 0) + 1; a += SPECIES[d.sp].appeal * Math.pow(0.75, seen[d.sp] - 1); } return a; }
const DINO_UPKEEP = 400;
// a hatchery with no egg in it only needs a caretaker; the full bill applies while it incubates
function bldUpkeep(b){ const B = BUILD[b.type]; if (b.type === 'hatchery'){ const hs = hatcheries(), k = hs.indexOf(b); return k >= 0 && eggs.length > k * 2 ? B.upkeep : B.idleUpkeep; } return B.upkeep || 0; }
function dailyUpkeep(){ let u = 0; for (const b of buildings.values()) u += bldUpkeep(b); for (const pen of pens.values()) u += pen.segs.length * FT[pen.tier].upkeep; u += dinos.filter(d => d.state !== 'wild').length * DINO_UPKEEP; return u; }
function unseenGuest(){ G.stats.guestsTotal++; G.stats.guestsToday++; const money = fr(60, 220); if (money < G.price) return; earn('tickets', G.price);
  const shops = new Set([...buildings.values()].map(b => b.type)); if (shops.has('food') || shops.has('visitor')) earn('shops', FOOD_PRICE * (rnd() < 0.6 ? 1 : 0)); if (shops.has('gift') && rnd() < 0.2) earn('shops', GIFT_PRICE);
  G.rep = clamp(G.rep + ((G.avgHappy || G.rep) - G.rep) * 0.025, 0, 100); }
function guestRatePerHour(){ const ap = appealTotal(); const priceF = clamp(1.6 - G.price / 60, 0.12, 1.5), repF = 0.4 + G.rep / 100, starF = 0.8 + G.stars * 0.12;
  return (24 + ap * 1.8) * priceF * repF * starF * (1 + G.thrill * 0.55) / (CLOSE - OPEN); }
function computeStars(){
  const ap = appealTotal(); const species = new Set(dinos.filter(d => d.state !== 'wild').map(d => d.sp)).size;
  const amen = [...buildings.values()].filter(b => ['food', 'gift', 'restroom', 'viewing'].includes(b.type)).length;
  const avgHappy = (() => { let s = 0, n = 0; for (const g of guests) if (!g.gone && g.state === 'walk'){ s += g.happy; n++; } return n ? s / n : G.rep; })();
  const pts = Math.min(36, ap / 9) + Math.min(15, species * 2.5) + G.rep * 0.2 + avgHappy * 0.06 + G.safety * 0.12 + Math.min(10, amen * 1.4) - (looseDinos().length ? 8 : 0);
  G.score = pts; G.avgHappy = avgHappy; return clamp(Math.round(pts / 20 * 2) / 2, 0, 5);
}
const MISSIONS = [
  { id: 'first', name: 'First Exhibit', desc: 'Build an enclosure and hatch your first dinosaur.', reward: 20000, check: () => G.stats.hatched >= 1 },
  { id: 'guests50', name: 'Open for Business', desc: 'Welcome 50 guests.', reward: 25000, check: () => G.stats.guestsTotal >= 50 },
  { id: 'stars2', name: 'Something Has Survived', desc: 'Reach a 2-star rating.', reward: 40000, check: () => G.stars >= 2 },
  { id: 'carn', name: 'Clever Girl', desc: 'Hatch a carnivore.', reward: 30000, check: () => G.stats.carnHatched >= 1 },
  { id: 'profit', name: 'Spared No Expense', desc: 'Make a daily profit of $40,000.', reward: 50000, check: () => G.stats.bestProfit >= 40000 },
  { id: 'king', name: 'The King', desc: 'Hatch a Tyrannosaurus rex.', reward: 80000, check: () => G.stats.trex >= 1 },
  { id: 'five', name: 'Welcome to the Park', desc: 'Exhibit 5 species and reach 3.5 stars.', reward: 120000, check: () => G.stars >= 3.5 && new Set(dinos.filter(d => d.state !== 'wild').map(d => d.sp)).size >= 5 },
];
function checkMissions(){ for (const m of MISSIONS){ if (G.missions.includes(m.id)) continue; if (m.check()){ G.missions.push(m.id); earn('other', 0); G.money += m.reward; toast(`Goal complete: ${m.name}. Investors send ${fmt(m.reward)}.`, 'money'); SFX.cash(); } } }
function hatcheries(){ return [...buildings.values()].filter(b => b.type === 'hatchery'); }
function unlocked(sp){ return G.stars >= SPECIES[sp].stars || G.unlockAll; }
function orderEgg(sp, pen){
  const S = SPECIES[sp]; if (!hatcheries().length){ toast('Build a Hatchery first.', 'bad'); return false; }
  if (!unlocked(sp)){ toast(`${S.name} unlocks at ${S.stars} stars.`, 'bad'); return false; }
  if (G.money < S.cost){ toast('Not enough funds.', 'bad'); return false; }
  spend('hatch', S.cost); eggs.push({ sp, pen: pen.id, t: S.hatch, total: S.hatch }); SFX.click(); toast(`${S.name} egg incubating for ${pen.name}.`, ''); return true;
}
function updateEggs(gdt){ const cap = hatcheries().length * 2; for (let k = 0; k < eggs.length && k < cap; k++){ const e = eggs[k]; e.t -= gdt; if (e.t <= 0){ eggs.splice(k, 1); k--; hatchEgg(e); } } }
function hatchEgg(e){
  const pen = pens.get(e.pen); if (!pen){ toast(`A ${SPECIES[e.sp].short} hatched with nowhere to go. Refunded half.`, ''); G.money += SPECIES[e.sp].cost / 2; return; }
  const d = spawnDino(e.sp, pen, { state: penBroken(pen) ? 'holding' : 'pen', hunger: 0.3 }); dust(d.x, d.z, SPECIES_DATA[e.sp].size * 0.35, 10, 0xb0a07a); d.model.setAction('roar', 2); vocal(d);
  G.stats.hatched++; if (SPECIES[e.sp].diet === 'meat') G.stats.carnHatched++; if (e.sp === 'trex') G.stats.trex++;
  toast(`${SPECIES[e.sp].name} "${d.name}" released into ${pen.name}.`, 'good');
  const weak = SPECIES[e.sp].str > FT[pen.tier].str - 0.75; if (weak) setTimeout(() => toast(`Warning: ${FT[pen.tier].name} fencing is too weak for a ${SPECIES[e.sp].short}.`, 'bad'), 1500);
  refreshSheet();
}
function hourTick(){
  flowHour(); spend('upkeep', dailyUpkeep() / (DAY_END - DAY_START));
  const rangerSt = [...buildings.values()].filter(b => b.type === 'ranger');
  for (const pen of pens.values()){ const [cx, cz] = penCenter(pen); const near = rangerSt.some(b => Math.hypot(b.x - cx, b.z - cz) < 60);
    for (const s of pen.segs){ if (s.broken) continue; s.cond = clamp(s.cond - FT[pen.tier].decay + (near ? 0.03 : 0), 0, 1); } }
  for (const d of dinos.slice()) if (d.state !== 'wild') dinoHourly(d);
  rebuildFencesSoon = true;
  G.thrill = Math.max(0, G.thrill - 0.08);
}
function endDay(){
  const L = G.ledger; const profit = ledgerProfit(L); G.stats.bestProfit = Math.max(G.stats.bestProfit, profit);
  const summary = { day: G.day, L: { ...L }, profit, guests: G.stats.guestsToday, rep: G.rep, safety: G.safety, stars: G.stars };
  G.prevLedger = summary; G.ledger = { tickets: 0, shops: 0, upkeep: 0, feed: 0, build: 0, hatch: 0, fines: 0, other: 0 };
  G.day++; G.hour = DAY_START; G.stats.guestsToday = 0; for (const g of guests) g.gone = true; guests = []; FERRY.pendingIn = 0;
  const st = [...buildings.values()].filter(b => b.type === 'ranger').length; G.safety = clamp(G.safety + 4 + st * 3, 0, 100); G.thrill *= 0.5;
  checkMissions(); saveGame(); if (!G.headless) showDaySummary(summary);
}

/* ================= UI ================= */
const IC = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  build: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>',
  fence: '<path d="M4 20V7l2-3 2 3v13M16 20V7l2-3 2 3v13M4 10h16M4 16h16"/>',
  dino: '<path d="M3 17c2 0 3-1 4-3l2-5c1-2 3-3 5-3h3l3 2-2 2h-3l-1 3 2 2v4M9 14l-1 6M13 15l1 5M7 14c-2 1-3 3-4 3"/><circle cx="17.5" cy="7.5" r=".6" fill="currentColor"/>',
  park: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  goals: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  path: '<path d="M8 21c0-5 8-6 8-11 0-3-2-5-4-7M5 21c0-6 8-7 8-12M19 21c0-4-4-6-4-9"/>',
  bulldoze: '<path d="M3 17h11l3-6h4M3 17v-5h7l2 5M6 20a2 2 0 1 0 0-.1M14 20a2 2 0 1 0 0-.1"/>',
  egg: '<path d="M12 3c-4 0-7 6-7 11a7 7 0 0 0 14 0c0-5-3-11-7-11z"/><path d="M8 13l2 2 2-2 2 2 2-2"/>',
  ranger: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  food: '<path d="M4 11h16M5 11a7 4 0 0 1 14 0M4 15h16M6 15v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"/>',
  gift: '<path d="M4 9h16v4H4zM6 13v8h12v-8M12 9v12M12 9c-2-4-6-4-6-1 0 1 2 1 6 1 4 0 6 0 6-1 0-3-4-3-6 1"/>',
  restroom: '<circle cx="7" cy="5" r="1.6"/><circle cx="17" cy="5" r="1.6"/><path d="M5 9h4v6H8v6H6v-6H5zM15 9h4l1 7h-2v5h-2v-5h-2z"/>',
  viewing: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  meat: '<path d="M15 3c3 0 6 3 6 6 0 5-6 8-10 8l-4 4-2-2 4-4c0-4 3-12 6-12z"/><path d="M5 19l-2 2"/>',
  plant: '<path d="M12 21V11M12 11C12 6 8 3 4 3c0 5 3 8 8 8zM12 14c0-4 3-7 8-7 0 4-3 7-8 7"/>',
  hatchery: '<path d="M3 21V9l9-5 9 5v12M8 21v-5h8v5"/><path d="M12 8c-1.5 0-2.5 2-2.5 3.5a2.5 2.5 0 0 0 5 0C14.5 10 13.5 8 12 8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M7 4l13 8-13 8z"/>', fast: '<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z"/>', faster: '<path d="M2 6l6 6-6 6zM9 6l6 6-6 6zM16 6l6 6-6 6z"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4zM17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13"/>', mute: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5 9-11"/>', warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  guests: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M21 21v-2a5 5 0 0 0-3-4.6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>', star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', follow: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  skull: '<path d="M12 3c-5 0-8 3-8 7 0 3 2 4 2 6v2h3v2h6v-2h3v-2c0-2 2-3 2-6 0-4-3-7-8-7z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', save: '<path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>',
};
const ic = (k, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${IC[k] || ''}</svg>`;
const starSvg = (fill) => `<svg viewBox="0 0 24 24"><defs><linearGradient id="sg${fill}"><stop offset="${fill * 100}%" stop-color="#f0bf5c"/><stop offset="${fill * 100}%" stop-color="rgba(239,230,210,.2)"/></linearGradient></defs><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z" fill="url(#sg${fill})"/></svg>`;
const starsHtml = (s) => { let h = ''; for (let k = 0; k < 5; k++) h += starSvg(clamp(s - k, 0, 1)); return h; };
let sel = null, tool = null, sheetHeld = false, rebuildFencesSoon = false;
const SPEEDS = [0, 1, 2, 4];
function toast(msg, kind = ''){ if (G && G.headless) return; const t = document.createElement('div'); t.className = 'toast glass ' + kind; t.textContent = msg; const box = $('toasts'); for (const o of box.children) if (o.textContent === msg) return; box.appendChild(t); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 450); }, 3600); }
function buildDock(){
  $('dock').innerHTML = [['build', 'build', 'Build'], ['fence', 'pen', 'Enclosure'], ['dino', 'dinos', 'Dinosaurs'], ['park', 'park', 'Park'], ['goals', 'goals', 'Goals']].map(([i, k, l]) => `<button data-dock="${k}">${ic(i)}<span>${l}</span></button>`).join('');
  $('dock').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; SFX.unlock(); SFX.click(); const k = b.dataset.dock; if (b.classList.contains('on')){ closeSheet(); return; } cancelTool();
    if (k === 'pen') openSheet('build', 'pens'); else if (k === 'build') openSheet('build', 'facilities'); else openSheet(k); };
}
function updateDockState(){ for (const b of $('dock').children){ const k = b.dataset.dock; b.classList.toggle('on', !!sel && ((sel.kind === k && k !== 'pen') || (k === 'pen' && sel.kind === 'build' && sel.ref === 'pens') || (k === 'build' && sel.kind === 'build' && sel.ref !== 'pens'))); } }
let hudT = 0;
function updateHUD(){
  const mv = $('moneyV'); mv.textContent = fmt(G.money); mv.classList.toggle('neg', G.money < 0); updateIncomeChip();
  $('dayV').textContent = 'Day ' + G.day; const h = Math.floor(G.hour), mi = Math.floor((G.hour - h) * 60 / 15) * 15; $('timeV').textContent = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  $('speedBtn').innerHTML = ic(G.speed === 0 ? 'pause' : G.speed === 1 ? 'play' : G.speed === 2 ? 'fast' : 'faster') + `<span>${G.speed === 0 ? 'PAUSED' : G.speed + 'X'}</span>`;
  $('soundBtn').innerHTML = ic(SFX.isMuted() ? 'mute' : 'sound');
  $('cGuests').innerHTML = ic('guests') + `<b>${guestsInPark()}</b>`;
  $('cStars').innerHTML = `<span id="stars">${starsHtml(G.stars)}</span>`;
  const sf = $('cSafety'); sf.innerHTML = ic('shield') + `<b>${Math.round(G.safety)}</b>`; sf.classList.toggle('bad', G.safety < 50);
  const hc = $('hatchChip'); if (eggs.length){ hc.classList.remove('hidden'); const e = eggs[0]; hc.innerHTML = ic('egg') + `<span>${SPECIES[e.sp].short}</span><i><u style="width:${(1 - e.t / e.total) * 100}%"></u></i>` + (eggs.length > 1 ? `<span>+${eggs.length - 1}</span>` : ''); } else hc.classList.add('hidden');
}
function showAlert(){
  const loose = looseDinos(), sed = dinos.filter(d => d.state === 'sedated' || d.state === 'airlift'); const el = $('alert');
  if (!loose.length && !sed.length){ el.classList.add('hidden'); return; }
  const responding = jeeps.some(j => j.state !== 'return');
  const cnt = {}; for (const d of loose) cnt[SPECIES[d.sp].short] = (cnt[SPECIES[d.sp].short] || 0) + 1; const names = Object.entries(cnt).map(([n, c]) => c > 1 ? `${c} ${/(s|us)$/.test(n) || n === 'T. rex' ? n : n + 's'}` : n).join(', ');
  el.innerHTML = `<div class="stripe"></div><div class="body"><div class="txt"><b>Containment breach</b><span>${loose.length ? `${names} loose in the park.` : 'Target sedated. Recovering.'} ${responding ? 'Rangers responding.' : ''}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px">${!responding && loose.length ? `<button class="btn hz" data-act="dispatch">${ic('ranger')}Rangers <small>${fmtK(dispatchCost())}</small></button>` : ''}${loose.length ? `<button class="btn" data-act="locate">${ic('target')}Locate</button>` : ''}</div></div><div class="stripe"></div>`;
  el.classList.remove('hidden');
}
$('alert').onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b) return; SFX.click(); if (b.dataset.act === 'dispatch') dispatchRangers(); if (b.dataset.act === 'locate'){ const d = looseDinos()[0]; if (d){ focusOn(d.x, d.z, 60); cam.follow = d; } } showAlert(); };
function closeSheet(){ sel = null; $('sheet').classList.add('hidden'); updateDockState(); cam.follow = null; }
function openSheet(kind, ref){ sel = { kind, ref }; renderSheet(); $('sheet').classList.remove('hidden'); $('sheet').querySelector('.bd') && ($('sheet').querySelector('.bd').scrollTop = 0); updateDockState(); }
function refreshSheet(){ if (sel && !sheetHeld) { const bd = $('sheet').querySelector('.bd'); const st = bd ? bd.scrollTop : 0; renderSheet(); const bd2 = $('sheet').querySelector('.bd'); if (bd2) bd2.scrollTop = st; } }
const meter = (v, inv) => { const cls = inv ? (v > 0.66 ? 'bad' : v > 0.4 ? 'warn' : '') : (v < 0.34 ? 'bad' : v < 0.6 ? 'warn' : ''); return `<span class="meter ${cls}"><u style="width:${clamp(v, 0, 1) * 100}%"></u></span>`; };
function header(title, icon){ return `<div class="hd">${icon ? ic(icon) : ''}<h2>${title}</h2><button class="hb" data-act="close" aria-label="Close">${ic('close')}</button></div>`; }
function renderSheet(){
  const sh = $('sheet'); if (!sel){ sh.classList.add('hidden'); return; } let h = '';
  const k = sel.kind;
  if (k === 'build'){
    const tab = sel.ref || 'facilities';
    h += header(tab === 'pens' ? 'Build an Enclosure' : 'Build', tab === 'pens' ? 'fence' : 'build');
    h += `<div class="tabs">${[['facilities', 'Facilities'], ['pens', 'Enclosures'], ['care', 'Dino Care'], ['paths', 'Paths']].map(([t, l]) => `<button class="tab ${t === tab ? 'on' : ''}" data-tab="${t}">${l}</button>`).join('')}</div><div class="bd">`;
    if (tab === 'pens'){ h += `<div class="note">Pick a fence, then tap two opposite corners on open ground and press Build. Stronger fences cost more but hold bigger animals. Cheap fences mean breakouts.</div><div class="cards">`;
      FT.forEach((f, t) => { const lock = G.stars < FENCE_STARS[t] && !G.unlockAll; const holds = SP_KEYS.filter(s => SPECIES[s].str <= f.str - 0.75).map(s => SPECIES[s].short);
        h += `<button class="card ${lock ? 'lock' : ''}" data-fence="${t}">${lock ? `<span class="tag">${FENCE_STARS[t]} STARS</span>` : ''}<span class="nm"><span class="swatch" style="background:${f.color}"></span>${f.name}</span><span class="ds">${f.desc}</span><span class="ds">Holds: ${holds.length ? holds.join(', ') : 'nothing dangerous'}</span><span class="pr">${fmt(f.cost)} <small style="font-size:11px;color:var(--bone2)">per tile edge</small></span></button>`; });
      h += `</div>`; }
    else if (tab === 'paths'){ h += `<div class="cards"><button class="card" data-tool="path"><span class="nm">${ic('path')}Footpath</span><span class="ds">Tap point to point to lay gravel paths, then Done. Guests only walk on paths connected to the gate.</span><span class="pr">${fmt(BUILD.path.cost)} / tile</span></button>
      <button class="card" data-tool="bulldoze"><span class="nm">${ic('bulldoze')}Bulldoze</span><span class="ds">Tap a path tile, building or feeder to remove it. Half refund.</span><span class="pr">Refunds 50%</span></button></div>`; }
    else { const list = tab === 'care' ? ['hatchery', 'meat', 'plant', 'ranger'] : ['hatchery', 'food', 'restroom', 'gift', 'viewing', 'ranger'];
      h += `<div class="cards">` + list.map(t => { const B = BUILD[t]; const lock = G.stars < B.stars && !G.unlockAll; return `<button class="card ${lock ? 'lock' : ''}" data-bld="${t}">${lock ? `<span class="tag">${B.stars} STARS</span>` : ''}<span class="nm">${ic(t)}${B.name}</span><span class="ds">${B.desc}</span><span class="pr">${fmt(B.cost)}${B.upkeep ? ` <small style="font-size:11px;color:var(--bone2)">+${fmtK(B.upkeep)}/day</small>` : ''}</span></button>`; }).join('') + `</div>`; }
    h += `</div>`;
  }
  else if (k === 'pen'){
    const pen = pens.get(sel.ref); if (!pen){ closeSheet(); return; }
    const ds = dinos.filter(d => d.pen === pen.id); const weak = penWeak(pen), broken = penBroken(pen), cond = penMinCond(pen); const rc = repairCost(pen);
    const need = ds.reduce((a, d) => a + SPECIES[d.sp].space, 0); const carn = canFeed(pen);
    h += header(pen.name, 'fence') + `<div class="bd">`;
    if (broken) h += `<div class="note bad">${ic('warn')} Fence breached. Repair it to contain the animals${ds.some(d => d.state === 'holding') ? ' and release the ones in holding' : ''}.</div>`;
    if (weak) h += `<div class="note bad">The ${FT[pen.tier].name.toLowerCase()} fence is too weak for a ${SPECIES[weak].short}. Upgrade to ${FT[tierNeeded(SPECIES[weak].str)].name} or expect a breakout.</div>`;
    else if (cond < 0.5 && !broken) h += `<div class="note warn">The fence is badly worn. Repair it, or build a Ranger Station nearby.</div>`;
    h += `<div class="row"><span class="k">Fence</span><span class="v">${FT[pen.tier].name}</span></div><div class="row"><span class="k">Condition</span>${meter(cond)}</div>
      <div class="row"><span class="k">Space used</span><span class="v">${need} / ${penArea(pen)} tiles</span></div>
      <div class="row"><span class="k">Feeders</span><span class="v">${pen.feeders.length ? pen.feeders.map(f => BUILD[f.type].name).join(', ') : 'None'}</span></div>`;
    if (ds.length){ h += `<div class="list" style="margin-top:8px">` + ds.map(d => `<button class="li" data-dino="${d.id}">${ic('dino')}<span class="t"><b>${d.name}</b><span>${SPECIES[d.sp].name} - ${dinoStatus(d)}</span></span>${meter(1 - d.hunger)}</button>`).join('') + `</div>`; }
    else h += `<div class="note">Empty. Add a dinosaur from the Hatchery and a feeder that matches its diet.</div>`;
    h += `<div class="btns"><button class="btn pri" data-act="adddino">${ic('egg')}Add dinosaur</button><button class="btn" data-act="feeder">${ic('plant')}Add feeder</button></div><div class="btns">`;
    if (pen.tier < FT.length - 1){ const t2 = pen.tier + 1, cost = pen.segs.length * Math.round(FT[t2].cost - FT[pen.tier].cost * 0.3); h += `<button class="btn" data-act="upgrade" ${G.stars < FENCE_STARS[t2] && !G.unlockAll ? 'disabled' : ''}>${ic('up')}${FT[t2].name} <small>${fmtK(cost)}</small></button>`; }
    if (rc > 0) h += `<button class="btn ${broken ? 'hz' : ''}" data-act="repair">${ic('wrench')}Repair <small>${fmtK(rc)}</small></button>`;
    h += `</div>`;
    if (carn.length) h += `<div class="btns"><button class="btn dng" data-act="feed" ${G.feedCooldown > 0 ? 'disabled' : ''}>${ic('skull')}Feed a guest to ${carn[0].name}</button></div><div class="ds" style="font-size:11px;color:var(--bone2);margin-top:6px;line-height:1.35">Thrill-seekers flock in and the carnivore skips a feeding. Reputation and safety drop, nearby guests panic, and lawyers circle.</div>`;
    h += `<div class="btns"><button class="btn" data-act="demolish">${ic('bulldoze')}Demolish</button></div></div>`;
  }
  else if (k === 'dino'){
    const d = sel.ref; if (!dinos.includes(d)){ closeSheet(); return; } const S = SPECIES[d.sp], c = dinoComfort(d), pen = pens.get(d.pen);
    h += header(`${d.name}`, 'dino') + `<div class="bd"><div class="ds" style="margin:-4px 0 6px;color:var(--bone2);font-size:13px">${S.name} - ${S.diet === 'meat' ? 'Carnivore' : 'Herbivore'} - ${dinoStatus(d)}</div>
      <div class="row"><span class="k">Fed</span>${meter(1 - d.hunger)}</div><div class="row"><span class="k">Space</span>${meter(c.space)}</div><div class="row"><span class="k">Social group</span>${meter(c.social)}</div>
      <div class="row"><span class="k">Stress</span>${meter(d.stress, true)}</div><div class="row"><span class="k">Fence needed</span><span class="v">${FT[tierNeeded(S.str)].name}</span></div><div class="row"><span class="k">Appeal</span><span class="v">${S.appeal}</span></div>`;
    if (!feederOf(pen || { feeders: [] }, S.diet)) h += `<div class="note warn">No ${S.diet === 'meat' ? 'meat' : 'plant'} feeder in this enclosure.</div>`;
    if (c.mixed) h += `<div class="note warn">Stressed by the other species sharing the enclosure.</div>`;
    h += `<div class="btns"><button class="btn" data-act="follow">${ic('follow')}${cam.follow === d ? 'Stop following' : 'Follow'}</button>${pen ? `<button class="btn" data-act="openpen">${ic('fence')}${pen.name}</button>` : ''}</div>`;
    if (S.diet === 'meat' && pen && d.state === 'pen') h += `<div class="btns"><button class="btn dng" data-act="feedd" ${G.feedCooldown > 0 ? 'disabled' : ''}>${ic('skull')}Feed a guest</button></div>`;
    h += `<div class="btns"><button class="btn" data-act="transfer" ${d.state === 'pen' ? '' : 'disabled'}>${ic('fence')}Move <small>${fmtK(TRANSFER_FEE)}</small></button><button class="btn" data-act="sell">Sell to a zoo <small>${fmtK(S.cost * 0.4)}</small></button></div></div>`;
  }
  else if (k === 'species'){
    const pen = pens.get(sel.ref); if (!pen){ closeSheet(); return; }
    h += header('Hatch for ' + pen.name, 'egg') + `<div class="bd">`;
    if (!hatcheries().length) h += `<div class="note bad">You need a Hatchery first. Build one from Build, Facilities.</div>`;
    h += `<div class="cards">` + SP_KEYS.map(s => { const S = SPECIES[s]; const lock = !unlocked(s); const weak = S.str > FT[pen.tier].str - 0.75;
      return `<button class="card ${lock ? 'lock' : ''}" data-sp="${s}">${lock ? `<span class="tag">${S.stars} STARS</span>` : weak ? `<span class="tag red">FENCE TOO WEAK</span>` : ''}<img src="${THUMBS[s] || ''}" alt=""><span class="nm">${S.short}</span><span class="ds">${S.desc}</span><span class="ds">${S.diet === 'meat' ? 'Carnivore' : 'Herbivore'} - needs ${FT[tierNeeded(S.str)].name} - group ${S.group[0]}-${S.group[1]}</span><span class="pr">${fmt(S.cost)}</span></button>`; }).join('') + `</div></div>`;
  }
  else if (k === 'building'){
    const b = buildings.get(sel.ref); if (!b){ closeSheet(); return; } const B = BUILD[b.type];
    h += header(B.name, b.type === 'visitor' || b.type === 'gate' ? 'build' : b.type) + `<div class="bd"><div class="note">${B.desc}</div>`;
    if (B.upkeep) h += `<div class="row"><span class="k">Upkeep</span><span class="v">${fmt(B.upkeep)} / day${B.idleUpkeep ? ` (${fmt(B.idleUpkeep)} when empty)` : ''}</span></div>`;
    if (b.type === 'hatchery'){ h += `<div class="row"><span class="k">Incubating</span><span class="v">${eggs.length ? eggs.map(e => SPECIES[e.sp].short).join(', ') : 'Nothing'}</span></div><div class="note">To hatch, tap an enclosure and choose Add dinosaur.</div>`; }
    if (!B.inPen && !['visitor', 'food', 'gift', 'restroom', 'viewing', 'hatchery', 'ranger'].includes(b.type)) {}
    if (['food', 'gift', 'restroom'].includes(b.type) && b.rot === 0 && !isPath(b.i, b.j + 1)) h += `<div class="note warn">Not next to a path. Guests cannot use it.</div>`;
    if (!B.fixed) h += `<div class="btns"><button class="btn" data-act="demob">${ic('bulldoze')}Demolish <small>refund ${fmtK(B.cost * 0.5)}</small></button></div>`;
    h += `</div>`;
  }
  else if (k === 'dinos'){
    const list = dinos.filter(d => d.state !== 'wild');
    h += header('Dinosaurs', 'dino') + `<div class="bd">`;
    if (!list.length) h += `<div class="note">No dinosaurs yet. Build an enclosure and a Hatchery, then tap the enclosure and choose Add dinosaur.</div>`;
    h += `<div class="list">` + list.map(d => `<button class="li" data-dino="${d.id}">${ic('dino')}<span class="t"><b>${d.name}</b><span>${SPECIES[d.sp].name} - ${pens.get(d.pen) ? pens.get(d.pen).name : ''} - ${dinoStatus(d)}</span></span>${meter(1 - d.hunger)}</button>`).join('') + `</div>`;
    if (pens.size){ h += `<div class="lbl" style="margin:14px 0 6px">Enclosures</div><div class="list">` + [...pens.values()].map(p => `<button class="li" data-pen="${p.id}">${ic('fence')}<span class="t"><b>${p.name}</b><span>${FT[p.tier].name} - ${dinos.filter(d => d.pen === p.id).length} animals${penWeak(p) ? ' - FENCE TOO WEAK' : ''}${penBroken(p) ? ' - BREACHED' : ''}</span></span></button>`).join('') + `</div>`; }
    h += `</div>`;
  }
  else if (k === 'park'){
    const L = G.ledger; const pr = ledgerProfit(L);
    h += header('Park Office', 'park') + `<div class="bd">
      <div class="row"><span class="k">Rating</span><span id="stars" style="display:flex;gap:1px">${starsHtml(G.stars)}</span></div>
      <div class="row"><span class="k">Reputation</span>${meter(G.rep / 100)}</div><div class="row"><span class="k">Safety</span>${meter(G.safety / 100)}</div><div class="row"><span class="k">Guest happiness</span>${meter((G.avgHappy || 50) / 100)}</div>
      <div class="row"><span class="k">Guests today</span><span class="v">${G.stats.guestsToday}</span></div><div class="row"><span class="k">Dinosaur appeal</span><span class="v">${Math.round(appealTotal())}</span></div>
      <div class="lbl" style="margin:12px 0 4px">Ticket price</div><div class="pricectl"><button class="btn" data-act="pdown">${ic('minus')}</button><b>${fmt(G.price)}</b><button class="btn" data-act="pup">${ic('plus')}</button><span class="ds" style="font-size:12px;color:var(--bone2);flex:1">Higher prices mean fewer guests.</span></div>
      <div class="lbl" style="margin:14px 0 4px">Today</div>
      <div class="row"><span class="k">Tickets</span><span class="v">${fmt(L.tickets)}</span></div><div class="row"><span class="k">Shops</span><span class="v">${fmt(L.shops)}</span></div>
      <div class="row"><span class="k">Upkeep and staff</span><span class="v">-${fmt(L.upkeep)}</span></div><div class="row"><span class="k">Feed</span><span class="v">-${fmt(L.feed)}</span></div>
      <div class="row"><span class="k">Construction and hatching</span><span class="v">-${fmt(L.build + L.hatch)}</span></div><div class="row"><span class="k">Fines and emergencies</span><span class="v">-${fmt(L.fines + L.other)}</span></div>
      <div class="row"><span class="k"><b>Profit so far</b></span><span class="v" style="color:${pr < 0 ? '#ff8a6a' : 'var(--ok)'}">${fmt(pr)}</span></div>
      <div class="row"><span class="k">Incidents</span><span class="v">${G.stats.breakouts} breakouts, ${G.stats.deaths + G.stats.fed} guests lost</span></div>
      <div class="btns"><button class="btn" data-act="quality">Graphics: ${['Low', 'Medium', 'High'][QUALITY.level]}</button><button class="btn" data-act="save">${ic('save')}Save</button></div>
      <div class="btns"><button class="btn pri" data-act="tips">How to make money</button><button class="btn" data-act="income">Income</button></div>
      <div class="btns"><button class="btn" data-act="tutorial">Tutorial</button><button class="btn" data-act="newgame">New park</button></div></div>`;
  }
  else if (k === 'guests'){ const N = guestNeeds();
    h += header('Guests', 'guests') + `<div class="bd"><div class="row"><span class="k">In the park</span><span class="v">${N.n}</span></div><div class="row"><span class="k">Average happiness</span>${meter(N.happy / 100)}</div>
      <div class="lbl" style="margin:12px 0 4px">What guests want</div>` + (N.top.length ? N.top.map(o => `<div class="need"><b>${o.pct}% ${o.label}</b><span>${o.tip}</span></div>`).join('') : `<div class="note">${N.n ? 'Nobody is complaining. Keep it up.' : 'No guests yet. They arrive while the park is open.'}</div>`) +
      `<div class="ds" style="margin-top:10px;font-size:12px;color:var(--bone2)">Tap a guest to see what they are thinking.</div></div>`; }
  else if (k === 'guest'){ const g = sel.ref; if (!g || g.gone){ closeSheet(); return; } const th = guestThought(g);
    const doing = g.state === 'leave' ? 'Heading home' : g.state === 'flee' ? 'Running for the exit' : g.linger > 0 && g.goal === 'view' ? 'Watching the dinosaurs' : g.goal === 'food' ? 'Looking for food' : g.goal === 'restroom' ? 'Looking for a restroom' : g.goal === 'view' ? 'Walking to an exhibit' : g.goal === 'gift' ? 'Off to the gift shop' : 'Exploring the park';
    h += header(guestName(g), 'guests') + `<div class="bd"><div class="ds" style="margin:-4px 0 8px;color:var(--bone2);font-size:13px">${doing}. ${fmt(Math.round(g.money))} left to spend.</div>
      ${th ? `<div class="thought">“${THOUGHT_TEXT[th]}”</div>` : `<div class="thought">“Having a nice time.”</div>`}
      <div class="row"><span class="k">Happiness</span>${meter(g.happy / 100)}</div><div class="row"><span class="k">Hunger</span>${meter(clamp(g.hunger, 0, 1), true)}</div><div class="row"><span class="k">Restroom</span>${meter(clamp(g.bladder, 0, 1), true)}</div>
      <div class="row"><span class="k">Boredom</span>${meter(g.bored || 0, true)}</div><div class="row"><span class="k">Exhibits seen</span><span class="v">${g.seen ? g.seen.size : 0} of ${pens.size}</span></div></div>`; }
  else if (k === 'goals'){
    h += header('Goals', 'goals') + `<div class="bd">` + MISSIONS.map(m => `<div class="mis ${G.missions.includes(m.id) ? 'done' : ''}"><span class="ck">${G.missions.includes(m.id) ? ic('check') : ''}</span><div><b>${m.name}</b><span>${m.desc} Reward ${fmt(m.reward)}.</span></div></div>`).join('') +
      `<div class="lbl" style="margin:12px 0 6px">Unlocks</div><div class="note">${SP_KEYS.map(s => `${SPECIES[s].short}: ${SPECIES[s].stars ? SPECIES[s].stars + ' stars' : 'available'}`).join('<br>')}</div></div>`;
  }
  sh.innerHTML = h; updateDockState();
}
function dinoStatus(d){ if (d.state === 'transfer') return 'Being moved'; if (d.state === 'loose') return 'LOOSE'; if (d.state === 'sedated' || d.state === 'airlift') return 'Sedated'; if (d.state === 'holding') return 'In holding'; if (d.eatT > 0) return 'Eating'; if (d.prey) return 'Hunting'; if (d.hunger > 0.7) return 'Hungry'; if (d.stress > 0.6) return 'Agitated'; return 'Calm'; }
$('sheet').addEventListener('pointerdown', () => { sheetHeld = true; }); window.addEventListener('pointerup', () => { setTimeout(() => sheetHeld = false, 50); });
$('sheet').onclick = (e) => {
  const t = e.target.closest('button'); if (!t) return; SFX.unlock(); SFX.click();
  if (t.dataset.tab){ sel.ref = t.dataset.tab; renderSheet(); return; }
  if (t.dataset.fence !== undefined){ const tier = +t.dataset.fence; if (G.stars < FENCE_STARS[tier] && !G.unlockAll){ toast(`${FT[tier].name} unlocks at ${FENCE_STARS[tier]} stars.`, 'bad'); return; } startTool({ kind: 'pen', tier }); return; }
  if (t.dataset.tool){ startTool({ kind: t.dataset.tool }); return; }
  if (t.dataset.bld){ const ty = t.dataset.bld; if (G.stars < BUILD[ty].stars && !G.unlockAll){ toast(`${BUILD[ty].name} unlocks at ${BUILD[ty].stars} stars.`, 'bad'); return; } startTool({ kind: 'bld', type: ty }); return; }
  if (t.dataset.dino){ const d = dinos.find(x => x.id === +t.dataset.dino); if (d){ openSheet('dino', d); focusOn(d.x, d.z, Math.max(30, SPECIES_DATA[d.sp].size * 3)); } return; }
  if (t.dataset.pen){ const p = pens.get(+t.dataset.pen); if (p){ openSheet('pen', p.id); const [cx, cz] = penCenter(p); focusOn(cx, cz, Math.max(50, (p.i1 - p.i0 + 1) * TILE * 1.6)); } return; }
  if (t.dataset.sp){ const pen = pens.get(sel.ref); const s = t.dataset.sp; if (!unlocked(s)){ toast(`${SPECIES[s].name} unlocks at ${SPECIES[s].stars} stars.`, 'bad'); return; }
    const weak = SPECIES[s].str > FT[pen.tier].str - 0.75; if (weak && !t.dataset.confirm){ t.dataset.confirm = '1'; toast(`${FT[pen.tier].name} fencing will not hold a ${SPECIES[s].short}. Tap again to hatch anyway.`, 'bad'); return; }
    if (orderEgg(s, pen)) openSheet('pen', pen.id); return; }
  const act = t.dataset.act; if (!act) return;
  if (act === 'close'){ closeSheet(); return; }
  const pen = sel && sel.kind === 'pen' ? pens.get(sel.ref) : null;
  if (act === 'adddino'){ openSheet('species', pen.id); return; }
  if (act === 'feeder'){ startTool({ kind: 'bld', type: canFeed(pen).length || dinos.some(d => d.pen === pen.id && SPECIES[d.sp].diet === 'meat') ? 'meat' : 'plant', pen: pen.id }); return; }
  if (act === 'upgrade'){ const t2 = pen.tier + 1, cost = pen.segs.length * Math.round(FT[t2].cost - FT[pen.tier].cost * 0.3); if (G.money < cost){ toast('Not enough funds.', 'bad'); return; } spend('build', cost); pen.tier = t2; for (const s of pen.segs){ s.cond = 1; s.broken = false; } releaseHeld(pen); rebuildFences(); refreshVegetation(); SFX.build(); toast(`${pen.name} upgraded to ${FT[t2].name}.`, 'good'); renderSheet(); return; }
  if (act === 'repair'){ const c = repairCost(pen); if (G.money < c){ toast('Not enough funds.', 'bad'); return; } spend('build', c); for (const s of pen.segs){ s.cond = 1; s.broken = false; } releaseHeld(pen); rebuildFences(); SFX.build(); toast(`${pen.name} repaired.`, 'good'); showAlert(); renderSheet(); return; }
  if (act === 'feed'){ if (feedGuest(pen)) closeSheet(); return; }
  if (act === 'feedd'){ const p = pens.get(sel.ref.pen); if (p && feedGuest(p)) closeSheet(); return; }
  if (act === 'demolish'){ if (!t.dataset.confirm){ t.dataset.confirm = '1'; t.innerHTML = 'Tap again to demolish'; return; } const refund = penCost(pen.i0, pen.j0, pen.i1, pen.j1, pen.tier) * 0.5; G.money += refund; removePen(pen); afterStructureChange(); closeSheet(); return; }
  if (act === 'follow'){ cam.follow = cam.follow === sel.ref ? null : sel.ref; renderSheet(); return; }
  if (act === 'openpen'){ openSheet('pen', sel.ref.pen); return; }
  if (act === 'transfer'){ startTransfer(sel.ref); return; }
  if (act === 'sell'){ const d = sel.ref; G.money += SPECIES[d.sp].cost * 0.4; toast(`${d.name} shipped to a mainland zoo.`, ''); removeDino(d); closeSheet(); return; }
  if (act === 'demob'){ const b = buildings.get(sel.ref); G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); closeSheet(); return; }
  if (act === 'pdown' || act === 'pup'){ G.price = clamp(G.price + (act === 'pup' ? 5 : -5), 0, 150); renderSheet(); return; }
  if (act === 'quality'){ setQuality((QUALITY.level + 2) % 3, true); renderSheet(); return; }
  if (act === 'save'){ saveGame(); toast('Park saved.', 'good'); return; }
  if (act === 'tutorial'){ closeSheet(); showTutorial(0); return; }
  if (act === 'tips'){ closeSheet(); showMoneyTips(); return; }
  if (act === 'income'){ closeSheet(); showIncome(); return; }
  if (act === 'newgame'){ if (!t.dataset.confirm){ t.dataset.confirm = '1'; t.textContent = 'Tap again: erase this park'; return; } localStorage.removeItem(SAVE_KEY); location.reload(); return; }
};
$('cGuests').onclick = () => { SFX.unlock(); SFX.click(); if (sel && sel.kind === 'guests') closeSheet(); else { cancelTool(); openSheet('guests'); } };
$('money').onclick = () => { SFX.unlock(); SFX.click(); showIncome(); };
$('speedBtn').onclick = () => { SFX.unlock(); SFX.click(); const i = SPEEDS.indexOf(G.speed); G.speed = SPEEDS[(i + 1) % SPEEDS.length]; updateHUD(); };
$('soundBtn').onclick = () => { SFX.unlock(); SFX.setMuted(!SFX.isMuted()); localStorage.setItem('pp-muted', SFX.isMuted() ? '1' : '0'); updateHUD(); };

/* ---------- day summary / modal ---------- */
function showDaySummary(s){
  const m = $('modal'); const L = s.L;
  const row = (k, v, neg) => `<div class="row"><span class="k">${k}</span><span class="v" ${neg ? 'style="color:#ffb39a"' : ''}>${neg && v ? '-' : ''}${fmt(v)}</span></div>`;
  m.innerHTML = `<div class="box glass"><div class="lbl">End of day ${s.day}</div><h2>Daily Report</h2><div class="sub">${s.guests} guests visited. Rating ${s.stars.toFixed(1)} stars.</div>
    ${row('Ticket sales', L.tickets)}${row('Shops and food', L.shops)}${row('Upkeep and staff', L.upkeep, 1)}${row('Dinosaur feed', L.feed, 1)}${row('Construction', L.build, 1)}${row('Hatching', L.hatch, 1)}${row('Fines, rangers and transfers', L.fines + L.other, 1)}
    <div class="row" style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px"><span class="k"><b>Profit</b></span><span class="v" style="font-family:var(--serif);font-size:20px;color:${s.profit < 0 ? '#ff8a6a' : 'var(--ok)'}">${fmt(s.profit)}</span></div>
    <div class="btns"><button class="btn pri" data-act="ok">Next day</button></div></div>`;
  m.classList.remove('hidden'); m.querySelector('[data-act=ok]').onclick = () => { SFX.click(); m.classList.add('hidden'); };
}

/* ---------- tutorial: short cards with progress dots; action steps stay out of the way and tick off when you do them ---------- */
const tutFlags = { income: false };
const TUT = [
  { t: 'Welcome, Director', b: 'This island is yours to build on. Drag with one finger to move around the map. Use two fingers to twist the view, pinch to zoom, and slide both fingers up or down to tilt. Press and hold a building or an enclosure to move it. On a computer, drag to move, right-drag to rotate and tilt, and scroll to zoom.', modal: true },
  { t: 'How the park makes money', b: `Every guest pays a ticket at the gate ($35 to start). Guests come for dinosaurs they can see from the paths, so more animals bring more guests. Food stands and gift shops earn extra. Upkeep and feed are charged every hour, so earn more than you spend. You start with $300,000.`, modal: true },
  { t: 'Build an enclosure', b: 'Tap Enclosure, keep Wooden, then tap two opposite corners right beside the main path. A 5 x 5 pen costs about $2,700. Guests must be able to see it from a path.', done: () => pens.size > 0 },
  { t: 'Build a Hatchery', b: 'Tap Build and choose Hatchery ($60,000). Tap a spot near a path, then Place. Eggs incubate here.', done: () => hatcheries().length > 0 },
  { t: 'Hatch a herbivore', b: 'Tap your enclosure and choose Add dinosaur. Parasaurolophus costs $14,000 and is happy behind wood. Get two: they like company and draw more guests.', done: () => eggs.length + dinos.length >= 1 },
  { t: 'Add a feeder', b: 'In the enclosure panel tap Add feeder, then tap inside the pen to place a Plant Feeder ($5,000). Hungry animals get stressed and test the fence.', done: () => [...pens.values()].some(p => p.feeders.length > 0) },
  { t: 'Place a food stand', b: 'Tap Build, choose Food Stand ($9,000) and place it touching the main path. Hungry guests pay $14 each.', done: () => [...buildings.values()].some(b => b.type === 'food') },
  { t: 'Check your income', b: 'Under your funds is your net income per minute: money in minus money out. Tap it to see where the money goes.', done: () => tutFlags.income },
  { t: 'Grow the park', b: 'Reinvest: more animals (mix species), paths past every exhibit, a restroom and a gift shop. Try a ticket price around $45 in Park. Stronger animals need stronger fences. Tips are always in Park > How to make money.', modal: true },
];
let tutK = -1, tutDoneT = 0;
function tutDots(k){ return `<div class="dots">${TUT.map((_, i) => `<i class="${i < k ? 'd' : i === k ? 'on' : ''}"></i>`).join('')}</div>`; }
function endTutorial(){ tutK = -1; $('tut').classList.add('hidden'); $('coach').classList.add('hidden'); placeToasts(); G.tutorialDone = true; saveGame(); }
function showTutorial(k){
  const el = $('tut'), co = $('coach'); if (k >= TUT.length){ endTutorial(); return; } tutK = k; tutDoneT = 0; const s = TUT[k];
  if (k === 0) tutFlags.income = false;
  if (s.modal){ co.classList.add('hidden');
    el.innerHTML = `<div class="box glass">${tutDots(k)}<h3>${s.t}</h3><p>${s.b}</p><div class="btns"><button class="btn" data-act="skip">Skip tutorial</button><button class="btn pri" data-act="next">${k === TUT.length - 1 ? 'Start building' : 'Next'}</button></div></div>`;
    el.classList.remove('hidden'); el.querySelector('[data-act=skip]').onclick = () => { SFX.click(); endTutorial(); }; el.querySelector('[data-act=next]').onclick = () => { SFX.unlock(); SFX.click(); showTutorial(k + 1); }; }
  else { el.classList.add('hidden');
    co.innerHTML = `${tutDots(k)}<div class="ct"><b>${s.t}</b><span>${s.b}</span></div><div class="cb"><button class="btn" data-act="skip">Skip tutorial</button><button class="btn" data-act="next">Later</button></div>`;
    co.classList.remove('hidden'); co.querySelector('[data-act=skip]').onclick = () => { SFX.click(); endTutorial(); }; co.querySelector('[data-act=next]').onclick = () => { SFX.click(); showTutorial(k + 1); }; }
  placeToasts(); }
function tutTick(dt){ if (tutK < 0) return; const s = TUT[tutK]; if (!s || s.modal || !s.done) return;
  // while a tool or a panel is open the card shrinks to a one-line, tap-through label so it never swallows map taps
  const co = $('coach'), mini = !!tool || !!sel; if (co.classList.contains('mini') !== mini){ co.classList.toggle('mini', mini); placeToasts(); }
  if (tutDoneT > 0){ tutDoneT -= dt; if (tutDoneT <= 0) showTutorial(tutK + 1); return; }
  if (s.done()){ tutDoneT = 1.1; const co = $('coach'); co.classList.add('ok'); const b = co.querySelector('.ct b'); if (b) b.innerHTML = `${ic('check')} ${s.t}`; SFX.cash && SFX.cash(); setTimeout(() => co.classList.remove('ok'), 1100); } }
function placeToasts(){ const co = $('coach'), t = $('toasts'); if (!co || !t) return; if (co.classList.contains('hidden')){ t.style.top = ''; return; } const r = co.getBoundingClientRect(); t.style.top = (r.bottom + 8) + 'px'; }

/* ---------- income readout: net money per minute (at 1x, one minute = 6 game hours), rolling over the last game day ---------- */
const FLOW_CATS = ['tickets', 'shops', 'upkeep', 'feed', 'fines', 'other'];
function flowState(){ if (!G.flow || !G.flow.acc) G.flow = { acc: {}, hist: [] }; return G.flow; }
function flowAdd(cat, amt){ if (!FLOW_CATS.includes(cat) || !amt) return; const f = flowState(); f.acc[cat] = (f.acc[cat] || 0) + amt; }
function flowHour(){ const f = flowState(); f.hist.push(f.acc); f.acc = {}; while (f.hist.length > DAY_END - DAY_START) f.hist.shift(); }
function flowPerMin(){ const f = flowState(); const n = f.hist.length; if (!n) return null; const sum = {}; for (const h of f.hist) for (const k in h) sum[k] = (sum[k] || 0) + h[k];
  const k = 60 / (n * SEC_PER_HOUR); const r = {}; for (const c of FLOW_CATS) r[c] = (sum[c] || 0) * k; r.in = r.tickets + r.shops; r.out = r.upkeep + r.feed + r.fines + r.other; r.net = r.in - r.out; r.hours = n; return r; }
const fmtRate = v => (v >= 0 ? '+' : '-') + fmt(Math.abs(Math.round(v / 10) * 10)).replace('-', '') + '/min';
function updateIncomeChip(){ const el = $('incomeV'); if (!el) return; const r = flowPerMin(); if (!r){ el.textContent = 'Income: tap for tips'; el.className = 'inc'; return; }
  el.textContent = fmtRate(r.net); el.className = 'inc ' + (r.net >= 0 ? 'pos' : 'neg'); }
// names the single biggest money drain with one concrete fix
function moneyAdvisor(){ const out = []; const perDay = (DAY_END - DAY_START);
  const L = G.prevLedger ? G.prevLedger.L : null, cur = G.ledger; const emerg = Math.max(L ? L.fines + L.other : 0, cur.fines + cur.other);
  // animals: upkeep + about one feeder bill a day
  const bySp = {}; for (const d of dinos){ if (d.state === 'wild') continue; (bySp[d.sp] = bySp[d.sp] || []).push(d); }
  for (const sp in bySp){ const n = bySp[sp].length, S = SPECIES[sp], cost = n * (DINO_UPKEEP + S.feed); const pen = pens.get(bySp[sp][0].pen);
    out.push({ k: 'dino', amt: cost, text: `Your ${n > 1 ? n + ' ' : ''}${S.short}${n > 1 && !/s$/.test(S.short) ? 's' : ''} cost ${fmt(cost)}/day in upkeep and meals. ${S.appeal >= 50 ? 'That pays if guests can see them: ' : 'Make them earn it: '}put a Food Stand and Restrooms on the path beside ${pen ? pen.name : 'their enclosure'}, and keep that path busy.` }); }
  const byB = {}; for (const b of buildings.values()){ const u = bldUpkeep(b); if (!u || b.type === 'gate') continue; const e = byB[b.type] = byB[b.type] || { n: 0, u: 0 }; e.n++; e.u += u; }
  const shopsDay = L ? L.shops : cur.shops;
  for (const t in byB){ const e = byB[t], B = BUILD[t]; let text = null;
    if (t === 'hatchery') text = e.n > 1 ? `${e.n} Hatcheries cost ${fmt(e.u)}/day. One is enough for a small park: demolish the spare or keep both busy.` : (eggs.length ? null : `Your empty Hatchery costs ${fmt(e.u)}/day. Hatch another species to grow the crowd.`);
    else if (t === 'ranger') text = `The Ranger Station costs ${fmt(e.u)}/day. It pays off with raptors or a T. rex; with only gentle herbivores, demolish it.`;
    else if ((t === 'food' || t === 'gift') && e.n > 1) text = `${e.n} ${B.name}s cost ${fmt(e.u)}/day while shops took ${fmt(shopsDay)} yesterday. Keep one per busy path and demolish the quiet ones.`;
    else if (t === 'viewing' && e.n > 1) text = `${e.n} Viewing Platforms cost ${fmt(e.u)}/day. One per star exhibit is plenty.`;
    if (text) out.push({ k: 'bld', amt: e.u, text }); }
  for (const pen of pens.values()){ const fu = pen.segs.length * FT[pen.tier].upkeep; const occ = dinos.filter(d => d.pen === pen.id); const need = occ.reduce((m, d) => Math.max(m, SPECIES[d.sp].str), 0);
    if (!occ.length && fu > 0) out.push({ k: 'fence', amt: fu + 150, text: `${pen.name} is empty but its fence costs ${fmt(fu)}/day. Hatch an animal for it, or move one in.` });
    else if (pen.tier > 0 && need + 0.75 < FT[pen.tier - 1].str) out.push({ k: 'fence', amt: fu, text: `${FT[pen.tier].name} fencing on ${pen.name} costs ${fmt(fu)}/day, more than its animals need. Build a ${FT[pen.tier - 1].name.toLowerCase()} enclosure for them next time.` }); }
  for (const pen of pens.values()) if (penWorn(pen) && !penBroken(pen)){ const d = dinos.filter(x => x.pen === pen.id).sort((a, b) => SPECIES[b.sp].str - SPECIES[a.sp].str)[0];
    out.push({ k: 'worn', amt: dispatchCost() * 0.8, text: `${pen.name}'s fence is worn (${Math.round(penMinCond(pen) * 100)}%). Repair it for ${fmt(repairCost(pen))} in its panel before the ${SPECIES[d.sp].short} pushes through: a breakout costs ${fmt(dispatchCost())} and scares guests away.` }); }
  // breakouts: a fence that is too weak is the most expensive mistake
  const weak = dinos.find(d => { const p = pens.get(d.pen); return p && d.state !== 'wild' && SPECIES[d.sp].str > FT[p.tier].str - 0.75; });
  if (emerg > 0 || looseDinos().length){ const p = weak ? pens.get(weak.pen) : null; const up = p && p.tier < 3 ? FT[p.tier + 1].name : null;
    out.push({ k: 'emerg', amt: Math.max(emerg, dispatchCost()), text: weak && up ? `Breakouts cost ${fmt(Math.max(emerg, dispatchCost()))} a day in ranger calls and fines. ${SPECIES[weak.sp].short} is too strong for ${FT[p.tier].name.toLowerCase()} fencing: upgrade ${p.name} to ${up}.` : `Breakouts and fines cost ${fmt(emerg)} yesterday. Repair fences before they fail and build a Ranger Station near big animals.` }); }
  else if (weak){ const p = pens.get(weak.pen); if (p.tier < 3) out.push({ k: 'emerg', amt: dispatchCost() * 0.5, text: `${SPECIES[weak.sp].short} can break ${FT[p.tier].name.toLowerCase()} fencing. Upgrade ${p.name} to ${FT[p.tier + 1].name} before a breakout (each costs ${fmt(dispatchCost())} plus lost guests).` }); }
  out.sort((a, b) => b.amt - a.amt);
  // income side, when nothing is badly out of line
  const ap = appealTotal(); let income = null;
  if (!dinos.some(d => d.state === 'pen')) income = 'Guests pay for dinosaurs. Hatch your first animal in an enclosure beside a path.';
  else if (G.price > 60 && G.stars < 3) income = `Your ticket price (${fmt(G.price)}) is scaring guests away. Try about $45 in Park.`;
  else if (G.rep < 45) income = 'Reputation is low, so fewer guests come. Put every enclosure beside a path and add a Food Stand and Restrooms where guests walk.';
  return { top: out[0] || null, income, all: out.slice(0, 4) }; }
function expectedGuestsPerDay(){ return guestRatePerHour() * (CLOSE - OPEN); }
function showIncome(){ tutFlags.income = true; const r = flowPerMin(); const m = $('modal');
  const row = (k, v, sign) => `<div class="row"><span class="k">${k}</span><span class="v" style="color:${sign > 0 ? 'var(--ok)' : '#ffb39a'}">${sign > 0 ? '+' : '-'}${fmt(Math.round(Math.abs(v)))}</span></div>`;
  const body = r ? `<div class="sub">Average per minute over the last ${r.hours} game hour${r.hours > 1 ? 's' : ''}, at normal speed. Building and hatching are investments and are not counted.</div>
    <div class="lbl">Money in</div>${row('Tickets', r.tickets, 1)}${row('Shops and food', r.shops, 1)}
    <div class="lbl" style="margin-top:10px">Money out</div>${row('Upkeep and staff', r.upkeep, -1)}${row('Dinosaur feed', r.feed, -1)}${r.fines + r.other > 0 ? row('Fines and emergencies', r.fines + r.other, -1) : ''}
    <div class="row" style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px"><span class="k"><b>Net per minute</b></span><span class="v" style="font-family:var(--serif);font-size:20px;color:${r.net < 0 ? '#ff8a6a' : 'var(--ok)'}">${fmtRate(r.net)}</span></div>`
    : `<div class="sub">Your income shows up after the first game hour.</div>`;
  m.innerHTML = `<div class="box glass"><div class="lbl">Park finances</div><h2>Income</h2>${body}
    <div class="row"><span class="k">Expected guests per day</span><span class="v">${Math.round(expectedGuestsPerDay())}</span></div><div class="row"><span class="k">Daily upkeep</span><span class="v">-${fmt(Math.round(dailyUpkeep()))}</span></div>
    ${(() => { const A = moneyAdvisor(); const t = A.top && (A.top.amt > 600 || !A.income) ? A.top.text : A.income; return t ? `<div class="advisor"><b>Money advisor</b><span>${t}</span></div>` : ''; })()}
    <div class="btns"><button class="btn" data-act="tips">How to make money</button><button class="btn pri" data-act="ok">Close</button></div></div>`;
  m.classList.remove('hidden'); m.onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b) return; SFX.click(); if (b.dataset.act === 'tips') showMoneyTips(); else m.classList.add('hidden'); }; }
function showMoneyTips(){ const m = $('modal'); const best = 48; const sp = SPECIES; const gf = expectedGuestsPerDay() / (24 + appealTotal() * 1.8);
  const li = (h, t) => `<div class="tip"><b>${h}</b><span>${t}</span></div>`;
  m.innerHTML = `<div class="box glass tips"><div class="lbl">Director's guide</div><h2>How to make money</h2>
    ${li('Tickets are most of your income', `Every guest pays the ticket price (now ${fmt(G.price)}) at the gate. With your current rating and reputation, a park with no dinosaurs gets about ${Math.round(24 * gf)} guests a day, and each point of dinosaur appeal adds about ${(1.8 * gf).toFixed(1)} more. Right now you can expect about ${Math.round(expectedGuestsPerDay())} guests a day.`)}
    ${li('Dinosaurs bring the crowds', `Appeal: Parasaurolophus ${sp.para.appeal}, Triceratops ${sp.trike.appeal}, Stegosaurus ${sp.stego.appeal}, Velociraptor ${sp.raptor.appeal}, T. rex ${sp.trex.appeal}. A second animal of the same species counts 75%, so mixing species pays more. Herd animals stay calm with company.`)}
    ${li('Let guests see them', 'Guests get happier while they can see dinosaurs from a path, and bored when they cannot. Happy guests raise your reputation, and reputation brings more guests. Put enclosures right beside paths and add Viewing Platforms.')}
    ${li('Shops add extra', `Hungry guests pay ${fmt(FOOD_PRICE)} at a Food Stand and happy guests spend ${fmt(GIFT_PRICE)} in a Gift Shop. Shops only sell to guests on a path they touch.`)}
    ${li('Ticket price', `Each $6 on the price drives away about 10% of new guests. Around ${fmt(best - 3)} to ${fmt(best + 2)} earns the most per day. Higher only pays once the park is famous.`)}
    ${li('What it costs each day', `Visitor Centre ${fmt(BUILD.visitor.upkeep)}, Hatchery ${fmt(BUILD.hatchery.upkeep)} while incubating (${fmt(BUILD.hatchery.idleUpkeep)} when empty), Food Stand ${fmt(BUILD.food.upkeep)}, Restrooms ${fmt(BUILD.restroom.upkeep)}, each dinosaur ${fmt(DINO_UPKEEP)} plus its meals (Parasaurolophus ${fmt(sp.para.feed / 2)} a meal). Fences cost a little per segment. Only build what earns its keep.`)}
    ${li('Stars and goals', 'Each star brings about 12% more guests and unlocks new species. Completing goals pays investor bonuses, from $20,000 for your first dinosaur.')}
    ${li('Avoid disasters', 'A breakout costs safety and can kill guests. That means lawsuits of $30,000 to $90,000. Use strong enough fences, keep feeders stocked and build a Ranger Station near big animals.')}
    <div class="btns"><button class="btn pri" data-act="ok">Got it</button></div></div>`;
  m.classList.remove('hidden'); m.scrollTop = 0; m.onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b) return; SFX.click(); m.classList.add('hidden'); }; }

/* ---------- title ---------- */
function showTitle(){
  const el = $('title'); const has = !!localStorage.getItem(SAVE_KEY);
  el.innerHTML = `<div class="logo"><div class="k">DINOSAUR PARK TYCOON</div><h1>PRIMEVAL<br>PARK</h1><div class="rule"><i></i>ISLA SOMBRA<i></i></div></div>
    <div class="acts">${has ? `<button class="btn pri" data-act="cont">Continue park</button><button class="btn" data-act="new">New park</button>` : `<button class="btn pri" data-act="new">Open the park</button>`}
    <button class="btn" data-act="snd">${ic(SFX.isMuted() ? 'mute' : 'sound')}Sound ${SFX.isMuted() ? 'off' : 'on'}</button><div class="foot">Build enclosures. Hatch dinosaurs. Try not to get sued.</div></div>`;
  el.classList.remove('hidden');
  el.onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b) return; SFX.unlock(); SFX.click(); const a = b.dataset.act;
    if (a === 'snd'){ SFX.setMuted(!SFX.isMuted()); localStorage.setItem('pp-muted', SFX.isMuted() ? '1' : '0'); showTitle(); return; }
    if (a === 'new' && has && !b.dataset.confirm){ b.dataset.confirm = '1'; b.textContent = 'Tap again to replace your park'; return; }
    if (a === 'new'){ newGame(); } startPlaying(a === 'new'); };
}
function startPlaying(fresh){ $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('dock').classList.remove('hidden'); G.running = true; title.on = false;
  cam.goal.dist = 150; cam.goal.pitch = 0.75; updateHUD(); showAlert(); if (fresh || !G.tutorialDone) setTimeout(() => showTutorial(0), 400); }

/* ================= tools ================= */
const overlayMat = new THREE.MeshBasicMaterial({ color: 0x8fdf6a, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false });
const overlay = new THREE.Mesh(new THREE.BufferGeometry(), overlayMat); overlay.visible = false; overlay.renderOrder = 5; scene.add(overlay);
const outlineMat = new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.95, depthTest: false, fog: false });
const outline = new THREE.Line(new THREE.BufferGeometry(), outlineMat); outline.visible = false; outline.renderOrder = 6; scene.add(outline);
const ghostMat = new THREE.MeshStandardMaterial({ color: 0xb8ffb0, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6 });
let ghost = null;
function setOverlay(i0, j0, i1, j1, ok){
  if (i0 > i1) [i0, i1] = [i1, i0]; if (j0 > j1) [j0, j1] = [j1, j0];
  const x0 = eX(i0), z0 = eX(j0), w = (i1 - i0 + 1) * TILE, d = (j1 - j0 + 1) * TILE; const sx = (i1 - i0 + 1) * 2, sz = (j1 - j0 + 1) * 2;
  const g = new THREE.PlaneGeometry(w, d, sx, sz); g.rotateX(-Math.PI / 2); g.translate(x0 + w / 2, 0, z0 + d / 2); const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, H(p.getX(k), p.getZ(k)) + 0.12);
  overlay.geometry.dispose(); overlay.geometry = g; overlay.visible = true; overlayMat.color.set(ok ? 0x8fdf6a : 0xff5a3a);
  const pts = []; const per = (ax, az, bx, bz) => { for (let k = 0; k <= 8; k++){ const x = lerp(ax, bx, k / 8), z = lerp(az, bz, k / 8); pts.push(new THREE.Vector3(x, H(x, z) + 0.25, z)); } };
  per(x0, z0, x0 + w, z0); per(x0 + w, z0, x0 + w, z0 + d); per(x0 + w, z0 + d, x0, z0 + d); per(x0, z0 + d, x0, z0);
  outline.geometry.dispose(); outline.geometry = new THREE.BufferGeometry().setFromPoints(pts); outline.visible = true; outlineMat.color.set(ok ? 0xfff0b0 : 0xff8a6a);
}
function drawPenMarkersSoon(){ queueMicrotask(drawPenMarkers); }
function hideOverlay(){ clearTransferMarks(); for (const m of penMarkers) scene.remove(m); penMarkers = []; overlay.visible = false; outline.visible = false; if (ghost){ scene.remove(ghost); ghost = null; } clearPending(); }
/* ---- pending path preview (nothing is built until Done) ---- */
const pendMat = new THREE.MeshBasicMaterial({ color: 0xe0a43a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, fog: false });
const pendMesh = new THREE.Mesh(new THREE.BufferGeometry(), pendMat); pendMesh.visible = false; pendMesh.renderOrder = 5; scene.add(pendMesh);
const nodeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.95, depthTest: false, fog: false });
const nodeMatLast = new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.95, depthTest: false, fog: false });
const nodeGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.25, 20);
let nodeMeshes = [];
function clearPending(){ pendMesh.visible = false; for (const m of nodeMeshes) scene.remove(m); nodeMeshes = []; }
function pathRoute(a, b){ const out = []; let [i, j] = a; const [i1, j1] = b; const xFirst = Math.abs(i1 - i) >= Math.abs(j1 - j);
  out.push([i, j]); const stepI = () => { while (i !== i1){ i += Math.sign(i1 - i); out.push([i, j]); } }, stepJ = () => { while (j !== j1){ j += Math.sign(j1 - j); out.push([i, j]); } };
  if (xFirst){ stepI(); stepJ(); } else { stepJ(); stepI(); } return out; }
function pathTileOk(i, j){ if (!inGrid(i, j)) return 'Outside the park'; const t = tileType[idx(i, j)]; if (t === T_EMPTY || t === T_PATH) return ''; return t === T_BLOCK ? 'Ground too rough for a path' : t === T_PEN ? 'Paths cannot cross an enclosure' : 'A building is in the way'; }
function pendingTiles(){ const seen = new Set(), out = []; if (!tool || !tool.nodes) return out;
  const add = ([i, j]) => { const k = idx(i, j); if (seen.has(k)) return; seen.add(k); if (tileType[k] === T_EMPTY) out.push([i, j]); };
  if (tool.nodes.length === 1) add(tool.nodes[0]); for (const s of tool.segs) s.forEach(add); return out; }
function pendingCost(){ return pendingTiles().length * BUILD.path.cost; }
function drawPending(){ clearPending(); if (!tool || tool.kind !== 'path' || !tool.nodes || !tool.nodes.length) return;
  const all = []; const seen = new Set(); const push = ([i, j]) => { const k = idx(i, j); if (!seen.has(k)){ seen.add(k); all.push([i, j]); } }; tool.nodes.forEach(push); tool.segs.forEach(s => s.forEach(push));
  const pos = []; const q = TILE * 0.47;
  for (const [i, j] of all){ const cx = tX(i), cz = tZ(j); const c = [[-q, -q], [q, -q], [q, q], [-q, q]].map(([a, b]) => [cx + a, H(cx + a, cz + b) + 0.16, cz + b]); pos.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pendMesh.geometry.dispose(); pendMesh.geometry = g; pendMesh.visible = true;
  tool.nodes.forEach((n, k) => { const m = new THREE.Mesh(nodeGeo, k === tool.nodes.length - 1 ? nodeMatLast : nodeMat); const x = tX(n[0]), z = tZ(n[1]); m.position.set(x, H(x, z) + 0.4, z); m.renderOrder = 7; scene.add(m); nodeMeshes.push(m); }); }
function startTool(t){ tool = t; closeSheet(); TU.uGrid.value = 1; $('dock').classList.add('hidden');
  if (t.kind === 'path'){ t.nodes = []; t.segs = []; }
  if (t.kind === 'bld'){ ghost = new THREE.Mesh(bldGeo(t.type), ghostMat); ghost.visible = false; scene.add(ghost); t.rot = null; t.hover = null; }
  renderToolbar(); $('toolbar').classList.remove('hidden'); placeUndoBar(); }
function cancelTool(){ if (!tool) return; if (tool.kind === 'penmove' && tool.p) cancelPenMove(); if (tool.move){ const m = tool.move; tool.move = null; const opts = { id: m.id }; if (!BUILD[m.type].inPen) opts.rot = m.rot; placeBuilding(m.type, m.i, m.j, opts); afterStructureChange(); } tool = null; TU.uGrid.value = 0; hideOverlay(); $('toolbar').classList.add('hidden'); if (G.running) $('dock').classList.remove('hidden'); placeUndoBar(); }
function renderToolbar(){
  if (!tool) return; const tb = $('toolbar'); let title = '', hint = '', cost = '', costBad = false, btns = '';
  if (tool.kind === 'path'){ title = 'Footpath'; const n = tool.nodes.length, tiles = pendingTiles().length, c = tiles * BUILD.path.cost;
    hint = !n ? 'Tap where the path starts. Drag to look around.' : n === 1 ? 'Tap the next point to lay a segment.' : `${tool.segs.length} segment${tool.segs.length > 1 ? 's' : ''}, ${tiles} new tile${tiles === 1 ? '' : 's'}. Tap to extend.`;
    cost = n ? fmt(c) : fmt(BUILD.path.cost) + ' / tile'; costBad = n > 0 && G.money < c;
    btns = `<button class="btn" data-t="exit">Cancel</button><button class="btn" data-t="undo" ${n ? '' : 'disabled'}>${ic('undo')}Undo</button><button class="btn pri" data-t="pathdone" ${costBad ? 'disabled' : ''}>${tiles ? 'Done' : 'Close'}</button>`; }
  if (tool.kind === 'bulldoze'){ title = 'Bulldoze'; hint = 'Tap a path tile, building or feeder to remove it (50% refund). Drag to look around.'; btns = `<button class="btn pri" data-t="exit">Done</button>`; }
  if (tool.kind === 'bld'){ const B = BUILD[tool.type]; const mv = !!tool.move; title = (mv ? 'Move ' : '') + B.name; cost = mv ? 'Free' : fmt(B.cost); const hv = tool.hover; const ok = hv && hv[2].ok; const funds = mv || G.money >= B.cost;
    costBad = !funds || (hv && !ok);
    hint = !hv ? (B.inPen ? 'Tap a tile inside an enclosure to preview.' : 'Tap open ground next to a path to preview.') + ' Drag to look around.' : !ok ? hv[2].why : !funds ? 'Not enough funds.' : mv ? 'Drag it or tap a new spot, then Place. Cancel puts it back.' : 'Green means it fits. Drag the preview or tap elsewhere to move it.';
    btns = `<button class="btn" data-t="rotate" ${hv && !B.inPen ? '' : 'disabled'}>${ic('rotate')}Rotate</button><button class="btn" data-t="exit">${hv || mv ? 'Cancel' : 'Close'}</button><button class="btn pri" data-t="place" ${ok && funds ? '' : 'disabled'}>Place</button>`; }
  if (tool.kind === 'transfer'){ const d = tool.d, pk = tool.pick; title = 'Move ' + d.name; cost = fmt(TRANSFER_FEE); costBad = G.money < TRANSFER_FEE;
    hint = pk && !pk.chk.ok ? `${pk.P.name}: ${pk.chk.why}. Tap a green enclosure.` : `Tap a green enclosure. Rangers dart ${d.name} and airlift it there.`;
    btns = `<button class="btn" data-t="exit">Cancel</button>`; }
  if (tool.kind === 'penmove'){ title = 'Move ' + tool.p.name; cost = 'Free'; costBad = !tool.ok;
    hint = tool.ok ? 'Drag it or tap a new spot, then Place. Dinosaurs, feeders and fences move with it. Cancel puts it back.' : tool.why;
    btns = `<button class="btn" data-t="rotate">${ic('rotate')}Rotate</button><button class="btn" data-t="exit">Cancel</button><button class="btn pri" data-t="place" ${tool.ok ? '' : 'disabled'}>Place</button>`; }
  if (tool.kind === 'pen'){ title = 'Enclosure'; const r = tool.rect;
    if (r){ const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); const chk = penCanBuild(i0, j0, i1, j1); const c = penCost(i0, j0, i1, j1, tool.tier);
      hint = tool.pending ? (chk.ok ? `${i1 - i0 + 1} x ${j1 - j0 + 1} tiles (${(i1 - i0 + 1) * TILE} m x ${(j1 - j0 + 1) * TILE} m). Tap or drag a corner to change it, then Build.` : chk.why) : 'Tap the opposite corner, or drag from the marker.'; cost = tool.pending ? fmt(c) : ''; costBad = !chk.ok || G.money < c;
      btns = tool.pending ? `<button class="btn" data-t="exit">Cancel</button><button class="btn" data-t="cancel">Restart</button><button class="btn pri" data-t="confirm" ${costBad ? 'disabled' : ''}>Build</button>` : `<button class="btn" data-t="exit">Cancel</button><button class="btn" data-t="cancel">Restart</button>`; }
    else { hint = 'Tap where one corner goes, then the opposite corner. Drag to look around.'; btns = `<button class="btn" data-t="exit">Cancel</button>`; }
  }
  tb.innerHTML = `<div class="top"><div class="t"><b>${title}</b><span>${hint}</span></div>${cost ? `<div class="cost ${costBad ? 'bad' : ''}">${cost}</div>` : ''}</div>` +
    (tool.kind === 'pen' ? `<div class="tiers">${FT.map((f, t) => `<button class="tab ${t === tool.tier ? 'on' : ''}" data-tier="${t}" ${G.stars < FENCE_STARS[t] && !G.unlockAll ? 'disabled style="opacity:.4"' : ''}><span class="swatch" style="background:${f.color}"></span>${f.name}</button>`).join('')}</div>` : '') +
    `<div class="btns" style="margin-top:0">${btns}</div>`;
  placeUndoBar();
}
$('toolbar').onclick = (e) => { const b = e.target.closest('button'); if (!b || b.disabled || !tool) return; SFX.unlock(); SFX.click();
  if (b.dataset.tier !== undefined){ tool.tier = +b.dataset.tier; if (tool.rect) updatePenPreview(); renderToolbar(); return; }
  const a = b.dataset.t;
  if (a === 'exit'){ const penId = tool.pen; cancelTool(); if (penId && pens.has(penId)) openSheet('pen', penId); return; }
  if (a === 'cancel'){ tool.rect = null; tool.pending = false; tool.a = null; hideOverlay(); renderToolbar(); return; }
  if (a === 'undo' && tool.kind === 'path'){ if (tool.segs.length) tool.segs.pop(); tool.nodes.pop(); drawPending(); renderToolbar(); return; }
  if (a === 'pathdone'){ commitPaths(); return; }
  if (tool.kind === 'penmove'){ if (a === 'rotate') penRotate(); if (a === 'place') commitPenMove(); if (a === 'exit') cancelTool(); return; }
  if (a === 'rotate' && tool.hover){ const [i, j] = tool.hover, [w, h] = footprint(tool.type, 0); const cur = tool.rot ?? faceRot(i, j, w, h); tool.rot = Math.round((cur + Math.PI / 2) / (Math.PI / 2)) % 4 * (Math.PI / 2); setPreview([i + Math.floor((w - 1) / 2), j + Math.floor((h - 1) / 2)]); return; }
  if (a === 'place'){ commitBuilding(); return; }
  if (a === 'confirm'){ const r = tool.rect; const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); const c = penCost(i0, j0, i1, j1, tool.tier);
    if (penCanBuild(i0, j0, i1, j1).ok && G.money >= c){ spend('build', c); const pen = createPen(i0, j0, i1, j1, tool.tier); afterStructureChange(); SFX.build(); dust((eX(i0) + eX(i1 + 1)) / 2, (eX(j0) + eX(j1 + 1)) / 2, 6, 8); cancelTool(); recordUndo({ kind: 'pen', pen, cost: c, label: pen.name }); openSheet('pen', pen.id); toast(`${pen.name} built. Now add a dinosaur and a feeder.`, 'good'); } }
};
function updatePenPreview(){ const r = tool.rect; drawPenMarkersSoon(); const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); setOverlay(i0, j0, i1, j1, !tool.pending || (penCanBuild(i0, j0, i1, j1).ok && G.money >= penCost(i0, j0, i1, j1, tool.tier))); }
let lastPaint = null, paintCount = 0;
function paintTile(i, j, erase){
  if (!inGrid(i, j)) return; const k = idx(i, j);
  if (erase){ if (tileType[k] === T_PATH && !(j === GATE.j && (i === GATE.i || i === GATE.i + 1))){ tileType[k] = T_EMPTY; G.money += BUILD.path.cost * 0.5; paintCount++; } return; }
  if (tileType[k] !== T_EMPTY) return; if (G.money < BUILD.path.cost){ return; } tileType[k] = T_PATH; spend('build', BUILD.path.cost); paintCount++;
}
function paintLine(a, b, erase){ let [x0, y0] = a; const [x1, y1] = b; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy;
  for (let n = 0; n < 200; n++){ paintTile(x0, y0, erase); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy){ err -= dy; x0 += sx; } else if (e2 < dx){ err += dx; y0 += sy; } } }
/* a deliberate tap (no camera drag) is the only thing that edits a preview */
function toolTap(p){ const t = tileAtScreen(p.x, p.y); if (!t){ return; }
  if (tool.kind === 'bld'){ setPreview(t); keepPreviewVisible(); return; }
  if (tool.kind === 'penmove'){ penPreviewCentred(t); keepPenVisible(); return; }
  if (tool.kind === 'transfer'){ transferTap(p); return; }
  if (tool.kind === 'bulldoze'){ bulldozeTap(p); return; }
  if (tool.kind === 'path'){ const N = tool.nodes; const why = pathTileOk(t[0], t[1]); if (why){ toast(why, 'bad'); return; }
    if (!N.length){ N.push(t); drawPending(); renderToolbar(); return; }
    const last = N[N.length - 1]; if (last[0] === t[0] && last[1] === t[1]) return;
    const route = pathRoute(last, t); const bad = route.map(([i, j]) => pathTileOk(i, j)).find(Boolean); if (bad){ toast(bad, 'bad'); return; }
    if (route.length > 120){ toast('Segment too long. Tap a closer point.', 'bad'); return; }
    tool.segs.push(route); N.push(t); SFX.click(); drawPending(); renderToolbar(); return; }
  if (tool.kind === 'pen'){
    if (!tool.a){ tool.a = t; tool.rect = [t[0], t[1], t[0], t[1]]; tool.pending = false; SFX.click(); }
    else { tool.rect = [tool.a[0], tool.a[1], t[0], t[1]]; tool.pending = true; SFX.click(); }
    updatePenPreview(); renderToolbar(); }
}
/* enclosure corners: a marker on each corner; a drag that starts on a marker stretches the rectangle live */
let penMarkers = [];
function drawPenMarkers(){ for (const m of penMarkers) scene.remove(m); penMarkers = []; if (!tool || tool.kind !== 'pen' || !tool.a) return;
  const cs = [tool.a]; if (tool.pending && tool.rect) cs.push([tool.rect[2], tool.rect[3]]);
  cs.forEach((c, k) => { const m = new THREE.Mesh(penMarkerGeo, k === cs.length - 1 ? nodeMatLast : nodeMat); const x = tX(c[0]), z = tZ(c[1]); m.position.set(x, H(x, z) + 0.5, z); m.renderOrder = 7; scene.add(m); penMarkers.push(m); }); }
const penMarkerGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 24);
function penCornerAt(x, y){ if (!tool.a) return null; const t = tileAtScreen(x, y); if (!t) return null; const near = (c) => Math.abs(c[0] - t[0]) <= 1 && Math.abs(c[1] - t[1]) <= 1;
  if (tool.pending && near([tool.rect[2], tool.rect[3]])) return 'b'; if (near(tool.a)) return 'a'; return null; }
function penDragStart(c){ tool.dragFrom = { a: tool.a.slice(), rect: tool.rect && tool.rect.slice(), pending: tool.pending }; if (c === 'a' && tool.pending){ tool.a = [tool.rect[2], tool.rect[3]]; } }
function penDragTo(t){ const r = tool.rect; if (r && r[2] === t[0] && r[3] === t[1] && tool.pending) return; tool.rect = [tool.a[0], tool.a[1], t[0], t[1]]; tool.pending = !(t[0] === tool.a[0] && t[1] === tool.a[1]) || !!tool.dragFrom.pending; tool.dragging = true; updatePenPreview(); renderToolbar(); }
function penDragEnd(tapP){ const d = tool.dragFrom; tool.dragFrom = null; tool.dragging = false;
  if (tapP){ tool.a = d.a; tool.rect = d.rect; tool.pending = d.pending; toolTap(tapP); return; } // a plain tap on a marker is just a tap
  if (tool.rect && tool.rect[0] === tool.rect[2] && tool.rect[1] === tool.rect[3]) tool.pending = false; updatePenPreview(); renderToolbar(); }
function penDragCancel(){ const d = tool && tool.dragFrom; if (!d) return; tool.a = d.a; tool.rect = d.rect; tool.pending = d.pending; tool.dragFrom = null; tool.dragging = false; if (tool.rect) updatePenPreview(); else hideOverlay(); renderToolbar(); }
function setPreview(t){ const ty = tool.type, [w, h] = footprint(ty, 0); const i = t[0] - Math.floor((w - 1) / 2), j = t[1] - Math.floor((h - 1) / 2); const chk = canPlace(ty, i, j); const ok = chk.ok && (tool.move || G.money >= BUILD[ty].cost);
  setOverlay(i, j, i + w - 1, j + h - 1, ok);
  if (ghost){ ghost.visible = true; const cx = tX(i) + (w - 1) * TILE / 2, cz = tZ(j) + (h - 1) * TILE / 2; ghost.position.set(cx, H(cx, cz), cz); ghost.rotation.y = BUILD[ty].inPen ? 0 : (tool.rot ?? faceRot(i, j, w, h)); ghostMat.color.set(ok ? 0x7dff6a : 0xff5a3a); ghostMat.emissive.set(ok ? 0x1f5a14 : 0x6a1408); }
  tool.hover = [i, j, chk]; renderToolbar(); }
const _pvp = new THREE.Vector3();
function keepPreviewVisible(){ if (!ghost || !ghost.visible) return; const tb = $('toolbar').getBoundingClientRect(); _pvp.copy(ghost.position); _pvp.y += 4; _pvp.project(camera);
  const sy = (-_pvp.y * 0.5 + 0.5) * innerHeight; if (sy > tb.top - 40 || sy < 150){ cam.goal.tx = ghost.position.x; cam.goal.tz = ghost.position.z; cam.follow = null; } }
function commitBuilding(){ const hv = tool.hover; if (!hv) return; const [i, j] = hv; const B = BUILD[tool.type]; const chk = canPlace(tool.type, i, j);
  if (!chk.ok){ toast(chk.why, 'bad'); return; }
  if (tool.move){ const m = tool.move; const opts = { id: m.id }; if (!B.inPen) opts.rot = tool.rot ?? faceRot(i, j, m.w, m.h); const b = placeBuilding(m.type, i, j, opts); tool.move = null; SFX.build(); dust(b.x, b.z, 3, 5); afterStructureChange(); cancelTool(); toast(`${B.name} moved.`, 'good'); return; } if (G.money < B.cost){ toast('Not enough funds.', 'bad'); return; }
  spend('build', B.cost); const opts = {}; if (!B.inPen && tool.rot != null) opts.rot = tool.rot; const b = placeBuilding(tool.type, i, j, opts); SFX.build(); dust(b.x, b.z, 4, 6); afterStructureChange();
  recordUndo({ kind: 'bld', b, cost: B.cost, label: B.name });
  if (['food', 'gift', 'restroom'].includes(tool.type)){ const touches = [[0, -1], [-1, 0], [b.w, 0], [0, b.h]].some(([di, dj]) => isPath(i + di, j + dj)); if (!touches) toast('Tip: shops must touch a path to get customers.', ''); }
  if (tool.type === 'hatchery' && !G.tutHatch){ G.tutHatch = true; toast('Hatchery ready. Tap an enclosure and choose Add dinosaur.', 'good'); }
  tool.hover = null; tool.rot = null; overlay.visible = false; outline.visible = false; if (ghost) ghost.visible = false; renderToolbar(); }
function commitPaths(){ const tiles = pendingTiles(), c = tiles.length * BUILD.path.cost;
  if (!tiles.length){ cancelTool(); return; } if (G.money < c){ toast('Not enough funds.', 'bad'); return; }
  for (const [i, j] of tiles) tileType[idx(i, j)] = T_PATH; spend('build', c); afterStructureChange(); SFX.build(); { const cut = tiles.filter(([i, j]) => exitDist[idx(i, j)] >= 1e6).length; if (cut) setTimeout(() => toast(`${cut} of these path tiles do not join the paths from the gate, so guests cannot reach them. Connect them edge to edge.`, 'bad'), 400); }
  cancelTool(); recordUndo({ kind: 'paths', tiles, cost: c, label: `${tiles.length} path tile${tiles.length > 1 ? 's' : ''}` }); }
/* press and hold (~0.5 s, finger still, no tool active) on a building or feeder picks it up to move it */
function buildingAtScreen(x, y){ const t = tileAtScreen(x, y); if (!t) return null; const k = idx(t[0], t[1]);
  if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); return b && !BUILD[b.type].fixed ? b : null; }
  if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen && pen.feeders.find(f => f.i === t[0] && f.j === t[1]); return f ? buildings.get(f.id) : null; }
  return null; }
function pickUp(b, p){ closeSheet(); clearUndo(); const m = { id: b.id, type: b.type, i: b.i, j: b.j, w: b.w, h: b.h, rot: b.rot, pen: b.pen };
  removeBuilding(b); afterStructureChange(); startTool({ kind: 'bld', type: b.type, pen: b.pen >= 0 ? b.pen : undefined }); tool.move = m; tool.rot = BUILD[b.type].inPen ? null : b.rot;
  setPreview([m.i + Math.floor((m.w - 1) / 2), m.j + Math.floor((m.h - 1) / 2)]); if (ghost){ ghost.position.y += 0.8; ghost.scale.setScalar(1.06); }
  try { navigator.vibrate && navigator.vibrate(18); } catch (e) {} SFX.click(); }
function bulldozeTap(p){ const t = tileAtScreen(p.x, p.y); if (!t) return; const k = idx(t[0], t[1]);
  if (tileType[k] === T_PATH){ if (t[1] === GATE.j && (t[0] === GATE.i || t[0] === GATE.i + 1)){ toast('The gate path stays.', ''); return; } tileType[k] = T_EMPTY; G.money += BUILD.path.cost * 0.5; afterStructureChange(); SFX.build(); return; }
  if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); if (b && !BUILD[b.type].fixed){ G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); SFX.build(); } else toast('That cannot be removed.', ''); }
  else if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen.feeders.find(f => f.i === t[0] && f.j === t[1]); if (f){ const b = buildings.get(f.id); G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); } else toast('Open the enclosure to demolish it.', ''); }
}
/* ---- press and hold on an enclosure (fence or floor) picks up the whole pen: fences, feeders and dinosaurs move together ---- */
function penAtScreen(x, y){ const p = groundAtScreen(x, y); if (!p) return null; const m = 1.4;
  for (const pen of pens.values()) if (p.x >= eX(pen.i0) - m && p.x <= eX(pen.i1 + 1) + m && p.z >= eX(pen.j0) - m && p.z <= eX(pen.j1 + 1) + m) return pen; return null; }
function penMoveBlock(pen){
  const bad = dinos.find(d => (d.pen === pen.id || d.transferFrom === pen.id) && d.state !== 'pen' && d.state !== 'holding');
  if (bad) return bad.state === 'transfer' ? `${bad.name} is being moved. Wait until it lands.` : bad.state === 'loose' ? `${bad.name} is loose. Recapture it before moving ${pen.name}.` : `${bad.name} is being recaptured. Wait until it is back before moving ${pen.name}.`;
  if (guests.some(g => !g.gone && g.pen === pen.id && ['lured', 'inpen', 'tossed'].includes(g.state))) return `A guest is inside ${pen.name}. Wait for feeding to finish.`;
  return ''; }
function penSnapshot(pen){ return { i0: pen.i0, j0: pen.j0, i1: pen.i1, j1: pen.j1, geom: pen.geom, segs: pen.segs,
  feeders: pen.feeders.map(f => ({ id: f.id, i: f.i, j: f.j })), dinos: dinos.filter(d => d.pen === pen.id).map(d => ({ d, x: d.x, z: d.z, hd: d.hd })) }; }
// local coords (u, v) in tiles from the pen's top-left edge; r quarter turns: (u, v) -> (h - v, u)
function penXf(o, r){ const W = o.i1 - o.i0 + 1, Hh = o.j1 - o.j0 + 1;
  return { W: r % 2 ? Hh : W, H: r % 2 ? W : Hh, f(u, v){ let h = Hh, w = W; for (let k = 0; k < r; k++){ const nu = h - v, nv = u; u = nu; v = nv; const t = w; w = h; h = t; } return [u, v]; } }; }
function applyPenPose(pen, o, ni0, nj0, r, visual = true){
  const X = penXf(o, r); pen.i0 = ni0; pen.j0 = nj0; pen.i1 = ni0 + X.W - 1; pen.j1 = nj0 + X.H - 1;
  const toW = (u, v) => { const [a, b] = X.f(u, v); return [eX(ni0) + a * TILE, eX(nj0) + b * TILE]; };
  const lu = x => (x - eX(o.i0)) / TILE, lv = z => (z - eX(o.j0)) / TILE;
  // fence segments keep their tier, condition and damage: match each new segment to the old one that lands on it
  const moved = o.geom.map(g => toW(lu((g[0] + g[2]) / 2), lv((g[1] + g[3]) / 2)));
  pen.geom = penSegments(pen); pen.segs = pen.geom.map(g => { const mx = (g[0] + g[2]) / 2, mz = (g[1] + g[3]) / 2; let best = 0, bd = 1e9; moved.forEach(([x, z], k) => { const dd = Math.hypot(x - mx, z - mz); if (dd < bd){ bd = dd; best = k; } }); return o.segs[best]; });
  pen.feeders = o.feeders.map(f => { const [x, z] = toW(f.i - o.i0 + 0.5, f.j - o.j0 + 0.5); const ni = toI(x), nj = toI(z); const b = buildings.get(f.id);
    if (b){ b.i = ni; b.j = nj; b.x = tX(ni); b.z = tZ(nj); if (visual) b.mesh.position.set(b.x, H(b.x, b.z) - 0.05 + (tool && tool.kind === 'penmove' ? 0.8 : 0), b.z); } return { id: f.id, type: b ? b.type : 'plant', i: ni, j: nj }; });
  for (const s of o.dinos){ const d = s.d; const [x, z] = toW(lu(s.x), lv(s.z)); d.x = x; d.z = z; d.tx = x; d.tz = z; d.hd = s.hd - r * Math.PI / 2; d.v = 0; d.prey = null; if (visual){ placeDinoModel(d); if (tool && tool.kind === 'penmove') d.model.root.position.y += 0.8; } }
  if (visual){ drawMask(); rebuildFences(); } }
function pickUpPen(pen, q){ const why = penMoveBlock(pen); if (why){ toast(why, 'bad'); return false; }
  closeSheet(); clearUndo(); const o = penSnapshot(pen);
  for (let j = pen.j0; j <= pen.j1; j++) for (let i = pen.i0; i <= pen.i1; i++){ const k = idx(i, j); tileType[k] = T_EMPTY; tileRef[k] = -1; }
  pen.held = true; startTool({ kind: 'penmove', p: pen, o, r: 0, at: [pen.i0, pen.j0], ok: true, why: '' });
  const t = q && tileAtScreen(q.x, q.y); tool.grab = t ? [t[0] - pen.i0, t[1] - pen.j0] : [0, 0];
  penPreview(pen.i0, pen.j0); try { navigator.vibrate && navigator.vibrate(18); } catch (e) {} SFX.click(); return true; }
function penPreview(i0, j0){ const T = tool, pen = T.p; const X = penXf(T.o, T.r); i0 = clamp(i0, 0, GRID - X.W); j0 = clamp(j0, 0, GRID - X.H); T.at = [i0, j0];
  applyPenPose(pen, T.o, i0, j0, T.r); const chk = penCanBuild(i0, j0, i0 + X.W - 1, j0 + X.H - 1); T.ok = chk.ok; T.why = chk.ok ? '' : chk.why;
  setOverlay(i0, j0, i0 + X.W - 1, j0 + X.H - 1, chk.ok); renderToolbar(); }
function penPreviewCentred(t){ const X = penXf(tool.o, tool.r); penPreview(t[0] - Math.floor((X.W - 1) / 2), t[1] - Math.floor((X.H - 1) / 2)); }
function penRotate(){ const T = tool, X0 = penXf(T.o, T.r); const ci = T.at[0] + (X0.W - 1) / 2, cj = T.at[1] + (X0.H - 1) / 2; T.r = (T.r + 1) % 4; const X = penXf(T.o, T.r);
  penPreview(Math.round(ci - (X.W - 1) / 2), Math.round(cj - (X.H - 1) / 2)); }
function finishPenMove(){ const pen = tool.p, o = tool.o; pen.held = false;
  for (let j = pen.j0; j <= pen.j1; j++) for (let i = pen.i0; i <= pen.i1; i++){ const k = idx(i, j); tileType[k] = T_PEN; tileRef[k] = pen.id; }
  const known = new Set(o.dinos.map(s => s.d)); for (const d of dinos) if (d.pen === pen.id && !known.has(d)){ const [x, z] = randomPenPoint(pen, 3); d.x = x; d.z = z; d.tx = x; d.tz = z; }
  for (const d of dinos) if (d.pen === pen.id) placeDinoModel(d);
  for (const f of pen.feeders){ const b = buildings.get(f.id); if (b) b.mesh.position.y = H(b.x, b.z) - 0.05; }
  afterStructureChange(); }
function commitPenMove(){ const T = tool; if (!T.ok){ toast(T.why || 'That spot does not fit.', 'bad'); return; }
  const pen = T.p; finishPenMove(); tool.p = null; SFX.build(); const [cx, cz] = penCenter(pen); dust(cx, cz, 6, 8); cancelTool(); toast(`${pen.name} moved.`, 'good'); }
function cancelPenMove(){ const T = tool; if (!T.p) return; applyPenPose(T.p, T.o, T.o.i0, T.o.j0, 0); finishPenMove(); T.p = null; }
function keepPenVisible(){ if (!tool || tool.kind !== 'penmove') return; const [cx, cz] = penCenter(tool.p); const tb = $('toolbar').getBoundingClientRect(); _pvp.set(cx, H(cx, cz) + 4, cz).project(camera);
  const sy = (-_pvp.y * 0.5 + 0.5) * innerHeight; if (sy > tb.top - 40 || sy < 150){ cam.goal.tx = cx; cam.goal.tz = cz; cam.follow = null; } }
/* ---- move a dinosaur to another enclosure: dart, airlift, land in the new pen ---- */
const TRANSFER_FEE = 1500;
function transferBlock(d){ const pen = pens.get(d.pen);
  if (d.state === 'loose') return `${d.name} is loose. Recapture it first.`;
  if (d.state === 'sedated' || d.state === 'airlift') return `${d.name} is sedated. Wait until it is back in its enclosure.`;
  if (d.state === 'transfer') return `${d.name} is already being moved.`;
  if (d.state === 'holding') return `${d.name} is in holding. Repair ${pen ? pen.name : 'its enclosure'} first.`;
  if (d.prey || d.biting || (G.feeding && G.feeding.dino === d)) return `${d.name} is hunting. Try again in a moment.`;
  if (pen && pen.held) return 'Finish moving the enclosure first.';
  if (G.money < TRANSFER_FEE) return 'Not enough funds for the ranger team.';
  return ''; }
function transferCheck(d, P){ const S = SPECIES[d.sp];
  if (P.id === d.pen) return { ok: false, why: 'Current home', short: 'HOME' };
  if (penBroken(P)) return { ok: false, why: 'Fence is broken', short: 'BROKEN' };
  if (S.str > FT[P.tier].str - 0.75) return { ok: false, why: `${FT[P.tier].name} fence too weak for a ${S.short}`, short: 'FENCE TOO WEAK' };
  const res = dinos.filter(o => o.pen === P.id && o !== d && o.state !== 'wild');
  if (res.some(o => SPECIES[o.sp].diet !== S.diet)) return S.diet === 'meat' ? { ok: false, why: 'Herbivores live there', short: 'HERBIVORES' } : { ok: false, why: 'A carnivore lives there', short: 'CARNIVORE' };
  if (S.diet === 'meat' && res.some(o => o.sp !== d.sp)) return { ok: false, why: 'Different carnivores fight', short: 'RIVALS' };
  const need = res.reduce((a, o) => a + SPECIES[o.sp].space, 0) + S.space, area = penArea(P);
  if (!res.length && area < S.space) return { ok: false, why: `Too small for a ${S.short} (needs ${S.space} tiles)`, short: 'TOO SMALL' };
  if (need > area) return { ok: false, why: `Full: needs ${need} tiles of space, has ${area}`, short: 'FULL' };
  return { ok: true, why: feederOf(P, S.diet) ? '' : `No ${S.diet === 'meat' ? 'meat' : 'plant'} feeder there yet`, short: 'MOVE HERE' }; }
const labelCache = {};
function labelMat(text, ok){ const key = text + ok; if (labelCache[key]) return labelCache[key]; const c = M.mk(512, 128), g = c.getContext('2d');
  g.font = 'bold 54px system-ui, sans-serif'; const w = Math.min(500, g.measureText(text).width + 56); g.fillStyle = ok ? 'rgba(40,110,30,.92)' : 'rgba(150,40,24,.92)'; const x0 = (512 - w) / 2;
  g.beginPath(); g.roundRect ? g.roundRect(x0, 18, w, 92, 46) : g.rect(x0, 18, w, 92); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  return (labelCache[key] = new THREE.SpriteMaterial({ map: canvasTex(c, true, false), depthTest: false, transparent: true, fog: false })); }
let transferMarks = [];
function clearTransferMarks(){ for (const m of transferMarks){ scene.remove(m); if (m.geometry && m.isMesh) m.geometry.dispose(); } transferMarks = []; }
function drawTransferMarks(){ clearTransferMarks(); if (!tool || tool.kind !== 'transfer') return; const d = tool.d;
  for (const P of pens.values()){ const chk = transferCheck(d, P); const x0 = eX(P.i0), z0 = eX(P.j0), w = (P.i1 - P.i0 + 1) * TILE, dd = (P.j1 - P.j0 + 1) * TILE;
    const g = new THREE.PlaneGeometry(w, dd, (P.i1 - P.i0 + 1) * 2, (P.j1 - P.j0 + 1) * 2); g.rotateX(-Math.PI / 2); g.translate(x0 + w / 2, 0, z0 + dd / 2); const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, H(p.getX(k), p.getZ(k)) + 0.14);
    const col = P.id === d.pen ? 0xd8c890 : chk.ok ? 0x6adf4a : 0xff5a3a; const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })); m.renderOrder = 5; scene.add(m); transferMarks.push(m);
    const s = new THREE.Sprite(labelMat(chk.short, chk.ok)); const [cx, cz] = penCenter(P); s.position.set(cx, H(cx, cz) + 9, cz); const sc = clamp(cam.dist * 0.07, 5, 14); s.scale.set(sc * 4, sc, 1); s.renderOrder = 11; s.userData.label = true; scene.add(s); transferMarks.push(s); } }
function startTransfer(d){ const why = transferBlock(d); if (why){ toast(why, 'bad'); return; }
  startTool({ kind: 'transfer', d, pick: null }); drawTransferMarks();
  const ok = [...pens.values()].filter(P => transferCheck(d, P).ok); if (!ok.length) toast('No enclosure can take this animal right now.', 'bad');
  const all = [...pens.values()]; if (all.length){ let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const P of all){ x0 = Math.min(x0, eX(P.i0)); z0 = Math.min(z0, eX(P.j0)); x1 = Math.max(x1, eX(P.i1 + 1)); z1 = Math.max(z1, eX(P.j1 + 1)); }
    focusOn((x0 + x1) / 2, (z0 + z1) / 2 + 6, clamp(Math.max(x1 - x0, z1 - z0) * 1.9 + 30, 50, 260)); } }
function transferTap(p){ const d = tool.d; const P = penAtScreen(p.x, p.y); if (!P){ return; } const chk = transferCheck(d, P); tool.pick = { P, chk }; renderToolbar();
  if (!chk.ok){ toast(`${P.name}: ${chk.why}.`, 'bad'); return; }
  if (!dinos.includes(d)){ cancelTool(); return; } const why = transferBlock(d); if (why){ toast(why, 'bad'); cancelTool(); return; }
  spend('other', TRANSFER_FEE); const from = pens.get(d.pen); d.pen = P.id; d.state = 'transfer'; d.trT = 0; d.prey = null; d.v = 0; d.transferFrom = from ? from.id : -1;
  d.trDart = dartMesh.clone(); d.trDart.visible = true; scene.add(d.trDart); d.trA = [d.x + 14, H(d.x, d.z) + 7, d.z + 10]; SFX.dart && SFX.dart();
  cancelTool(); if (sel && sel.kind === 'dino') refreshSheet(); toast(`Rangers are moving ${d.name} to ${P.name}. ${fmt(TRANSFER_FEE)}.`, ''); if (chk.why) setTimeout(() => toast(`${P.name}: ${chk.why}.`, ''), 1200); }
// phases: 0-0.35 s dart flies, to 1.6 s the animal sinks asleep, to 3.2 s it is airlifted, then it lands in the new pen
function updateTransfer(d, dt){ d.trT += dt; const SD = SPECIES_DATA[d.sp];
  if (d.trDart){ const k = Math.min(1, d.trT / 0.35); d.trDart.position.set(lerp(d.trA[0], d.x, k), lerp(d.trA[1], H(d.x, d.z) + SD.legs[0].at[1], k), lerp(d.trA[2], d.z, k)); d.trDart.lookAt(d.x, d.trDart.position.y, d.z);
    if (k >= 1){ scene.remove(d.trDart); d.trDart = null; SFX.thud && SFX.thud(0.6, 2); d.model.setAction('roar', 0.6); } }
  d.sleep = damp(d.sleep, d.trT > 0.4 ? 1 : 0, 3, dt); d.model.sleep = d.sleep; d.v = 0; d.model.animate(dt, 0, 0);
  if (d.trT < 1.6){ placeDinoModel(d); return; }
  if (d.trT < 3.2){ if (!d.trLift){ d.trLift = true; dust(d.x, d.z, SD.size * 0.4, 8, 0xb0a890); } placeDinoModel(d); d.model.root.position.y += Math.pow((d.trT - 1.6) / 1.6, 2) * 16; return; }
  const P = pens.get(d.pen); d.trLift = false; d.sleep = 0; d.model.sleep = 0;
  if (!P){ removeDino(d); return; }
  const m = Math.min(1.5 + SD.size * 0.16, (Math.min(P.i1 - P.i0, P.j1 - P.j0) + 1) * TILE / 2 - 0.5); const [x, z] = randomPenPoint(P, Math.max(0.5, m)); d.x = x; d.z = z; d.tx = x; d.tz = z;
  d.transferFrom = -1; d.state = penBroken(P) ? 'holding' : 'pen'; d.model.root.visible = d.state === 'pen'; d.stress = clamp(d.stress + 0.35, 0, 1); d.wait = 2; placeDinoModel(d); dust(x, z, SD.size * 0.4, 10, 0xb0a890);
  computeViewMap(); toast(`${d.name} settled into ${P.name}. A little stressed for now.`, 'good'); if (sel && (sel.kind === 'dino' || sel.kind === 'pen')) refreshSheet(); }
/* ---- safety net: undo the last committed placement for 10 s, full refund ---- */
let undoRec = null, undoTimer = 0;
function recordUndo(r){ undoRec = Object.assign(r, { until: performance.now() + 10000 }); clearTimeout(undoTimer); undoTimer = setTimeout(clearUndo, 10000); renderUndoBar(); }
function clearUndo(){ undoRec = null; clearTimeout(undoTimer); renderUndoBar(); }
function refund(c){ G.money += c; G.ledger.build = (G.ledger.build || 0) - c; }
function undoLast(){ const r = undoRec; if (!r) return; clearUndo();
  if (r.kind === 'bld'){ const b = buildings.get(r.b.id); if (!b){ toast('Already removed.', ''); return; } removeBuilding(b); }
  if (r.kind === 'paths'){ for (const [i, j] of r.tiles){ const k = idx(i, j); if (tileType[k] === T_PATH) tileType[k] = T_EMPTY; } }
  if (r.kind === 'pen'){ if (!pens.has(r.pen.id)) return; if (dinos.some(d => d.pen === r.pen.id)){ toast('A dinosaur already lives there. Demolish it from the enclosure panel instead.', 'bad'); return; } if (sel && sel.kind === 'pen' && sel.ref === r.pen.id) closeSheet(); removePen(r.pen); }
  refund(r.cost); afterStructureChange(); SFX.click(); updateHUD(); toast(`Undone. ${fmt(r.cost)} refunded.`, 'money'); }
function renderUndoBar(){ const el = $('undoBar'); if (!undoRec){ el.classList.add('hidden'); return; }
  el.innerHTML = `<span>Placed ${undoRec.label}</span><button class="btn" data-t="undolast">${ic('undo')}Undo</button>`; el.classList.remove('hidden'); placeUndoBar(); }
function placeUndoBar(){ const el = $('undoBar'); if (!el || el.classList.contains('hidden')) return; const ref = tool ? $('toolbar') : $('dock'); const r = ref.getBoundingClientRect(); el.style.bottom = (r.height > 0 ? innerHeight - r.top + 8 : 90) + 'px'; }
$('undoBar').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; SFX.unlock(); undoLast(); };
function afterStructureChange(){ drawMask(); computeExitField(); rebuildGuestSpots(); rebuildFences(); refreshVegetation(); computeViewMap(); }

/* ================= camera + input ================= */
const cam = { tx: 0, tz: 40, yaw: 0.5, pitch: 0.62, dist: 210, goal: { tx: 0, tz: 40, yaw: 0.5, pitch: 0.62, dist: 210 }, shake: 0, follow: null };
const title = { on: true };
function focusOn(x, z, dist){ cam.goal.tx = x; cam.goal.tz = z; if (dist) cam.goal.dist = clamp(dist, 12, 330); }
function updateCamera(dt){
  const g = cam.goal; if (cam.follow){ if (!dinos.includes(cam.follow) || !cam.follow.model.root.visible) cam.follow = null; else { g.tx = cam.follow.x; g.tz = cam.follow.z; } }
  if (title.on){ g.yaw += dt * 0.04; } else updateFling(dt);
  g.pitch = clamp(g.pitch, 0.1, 1.45); g.dist = clamp(g.dist, 12, 330); g.tx = clamp(g.tx, -HALF - 40, HALF + 40); g.tz = clamp(g.tz, -HALF - 60, HALF + 40);
  const k = 10; cam.tx = damp(cam.tx, g.tx, k, dt); cam.tz = damp(cam.tz, g.tz, k, dt); cam.dist = damp(cam.dist, g.dist, k, dt); cam.pitch = damp(cam.pitch, g.pitch, k, dt);
  let dy = g.yaw - cam.yaw; if (dy > Math.PI || dy < -Math.PI){ dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; g.yaw = cam.yaw + dy; }
  cam.yaw += dy * (1 - Math.exp(-k * dt));
  const ty = Math.max(H(cam.tx, cam.tz), 0) + (cam.follow ? SPECIES_DATA[cam.follow.sp].size * 0.2 : 0.5);
  const cp = Math.cos(cam.pitch); let px = cam.tx + Math.sin(cam.yaw) * cp * cam.dist, pz = cam.tz + Math.cos(cam.yaw) * cp * cam.dist, py = ty + Math.sin(cam.pitch) * cam.dist;
  const floor = Math.max(H(px, pz), 0) + 2.5; if (py < floor){ py = floor; }
  cam.shake = Math.max(0, cam.shake - dt * 1.5); const sh = cam.shake * cam.shake;
  camera.position.set(px + (rnd() - 0.5) * sh, py + (rnd() - 0.5) * sh, pz + (rnd() - 0.5) * sh); camera.lookAt(cam.tx, ty, cam.tz);
}
const raycaster = new THREE.Raycaster(); const _ndc = new THREE.Vector2();
function groundAtScreen(x, y, cm = camera){
  _ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); raycaster.setFromCamera(_ndc, cm); const o = raycaster.ray.origin, d = raycaster.ray.direction;
  let t = 0, prev = 0; for (let n = 0; n < 600; n++){ const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t; const h = Math.max(H(px, pz), -0.2);
    if (py < h){ let a = prev, b = t; for (let k = 0; k < 10; k++){ const m = (a + b) / 2; const mx = o.x + d.x * m, my = o.y + d.y * m, mz = o.z + d.z * m; if (my < Math.max(H(mx, mz), -0.2)) b = m; else a = m; } return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b); }
    prev = t; t += Math.max(0.5, (py - h) * 0.5); if (t > 1500) break; }
  return null;
}
function tileAtScreen(x, y){ const p = groundAtScreen(x, y); if (!p) return null; const i = toI(p.x), j = toI(p.z); return inGrid(i, j) ? [i, j] : null; }
const _sv = new THREE.Vector3();
function pickDino(x, y){ let best = null, bd = 1e9; const f = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360);
  for (const d of dinos){ if (!d.model.root.visible || d.state === 'wild') continue; const S = SPECIES_DATA[d.sp]; _sv.set(d.x, H(d.x, d.z) + S.legs[0].at[1], d.z); const dist = _sv.distanceTo(camera.position); _sv.project(camera); if (_sv.z > 1) continue;
    const sx = (_sv.x * 0.5 + 0.5) * innerWidth, sy = (-_sv.y * 0.5 + 0.5) * innerHeight; const r = Math.max(30, S.size * 0.45 / dist * f); const dd = Math.hypot(sx - x, sy - y); if (dd < r && dd / r < bd){ bd = dd / r; best = d; } }
  return best; }
function tap(x, y){
  if (tool){ return; }
  const d = pickDino(x, y); if (d){ SFX.click(); openSheet('dino', d); return; }
  if (cam.dist < 150){ const gu = pickGuest(x, y); if (gu){ SFX.click(); openSheet('guest', gu); return; } }
  const t = tileAtScreen(x, y); if (!t){ closeSheet(); return; } const k = idx(t[0], t[1]);
  if (tileType[k] === T_BUILD){ SFX.click(); openSheet('building', tileRef[k]); return; }
  if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen.feeders.find(f => f.i === t[0] && f.j === t[1]); SFX.click(); if (f) openSheet('building', f.id); else openSheet('pen', pen.id); return; }
  closeSheet();
}
/* A real fingertip wobbles a few pixels and taps can last a few hundred ms: up to TAP_SLOP px and TAP_MS counts as a tap; the map only starts to pan past the slop. */
const TAP_SLOP = 12, TAP_MS = 500, TAP_MS_TOOL = 2500;
const ptrs = new Map(); let gesture = null;
function pinchInfo(){ const a = [...ptrs.values()]; const cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2; return { cx, cy, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), ang: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) }; }
canvas.addEventListener('pointerdown', (e) => {
  SFX.unlock(); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), ts: e.timeStamp, btn: e.button });
  if (title.on) return;
  stopFling(); if (ptrs.size === 1){ gesture = { kind: e.button === 2 || e.button === 1 ? 'orbit' : 'one', moved: false, ghost: false };
    if (tool && tool.kind === 'pen' && gesture.kind === 'one'){ const c = penCornerAt(e.clientX, e.clientY); if (c){ gesture.penDrag = c; penDragStart(c); } }
    if (!tool && gesture.kind === 'one'){ const gs = gesture, pid = e.pointerId; gs.hold = setTimeout(() => { const q = ptrs.get(pid); if (gesture !== gs || gs.moved || ptrs.size !== 1 || !q || tool) return;
      const b = buildingAtScreen(q.x, q.y); if (b){ gs.held = true; pickUp(b, q); gs.ghost = true; return; }
      const pen = penAtScreen(q.x, q.y); if (pen){ gs.held = true; if (pickUpPen(pen, q)) gs.ghost = true; } }, 500); }
    if (tool && tool.kind === 'penmove' && gesture.kind === 'one'){ const t = tileAtScreen(e.clientX, e.clientY); const p = tool.p; if (t && t[0] >= p.i0 - 1 && t[0] <= p.i1 + 1 && t[1] >= p.j0 - 1 && t[1] <= p.j1 + 1){ gesture.ghost = true; tool.grab = [t[0] - p.i0, t[1] - p.j0]; } }
    if (gesture.kind === 'one' && !gesture.ghost && !gesture.penDrag) startPan(e.clientX, e.clientY);
    // a drag that starts on the building preview moves the preview; any other drag only moves the camera
    if (tool && tool.kind === 'bld' && tool.hover && gesture.kind === 'one'){ const t = tileAtScreen(e.clientX, e.clientY); const [i, j] = tool.hover, [w, h] = footprint(tool.type, 0); if (t && t[0] >= i - 1 && t[0] <= i + w && t[1] >= j - 1 && t[1] <= j + h) gesture.ghost = true; } }
  else if (ptrs.size === 2){ if (gesture && gesture.hold) clearTimeout(gesture.hold); if (gesture && gesture.penDrag) penDragCancel(); const n = pinchInfo(); gesture = { kind: 'two', moved: true, last: n, start: n, mode: null }; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (!gesture || title.on) return;
  if (gesture.penDrag && gesture.kind === 'one'){ const t = tileAtScreen(p.x, p.y); if (t) penDragTo(t); if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_SLOP) gesture.moved = true; return; }
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_SLOP){ gesture.moved = true; if (gesture.hold && !gesture.held){ clearTimeout(gesture.hold); gesture.hold = 0; } }
  if (gesture.kind === 'one'){ if (!gesture.moved) return;
    if (gesture.ghost){ const t = tileAtScreen(p.x, p.y); if (t){ if (tool && tool.kind === 'penmove'){ const at = [t[0] - tool.grab[0], t[1] - tool.grab[1]]; if (at[0] !== tool.at[0] || at[1] !== tool.at[1]) penPreview(at[0], at[1]); } else { setPreview(t); if (gesture.held && ghost){ ghost.position.y += 0.8; } } } return; }
    dragPan(p.x, p.y); }
  else if (gesture.kind === 'orbit'){ cam.goal.yaw -= dx * 0.0065; cam.goal.pitch = clamp(cam.goal.pitch + dy * 0.005, 0.1, 1.45); cam.follow = null; }
  else if (gesture.kind === 'two' && ptrs.size >= 2){ const n = pinchInfo(), g0 = gesture.start;
    // decide once per gesture: both fingers sliding up/down together = tilt; anything else = grab the map (pan, twist, pinch)
    if (!gesture.mode){ const ddx = n.cx - g0.cx, ddy = n.cy - g0.cy, dd = n.d - g0.d; let da = n.ang - g0.ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      const tot = Math.hypot(ddx, ddy) + Math.abs(dd) + Math.abs(da) * 80; if (tot < 12) return;
      gesture.mode = Math.abs(ddy) > 2 * Math.abs(ddx) && Math.abs(dd) < 0.45 * Math.abs(ddy) && Math.abs(da) < 0.12 && g0.d > 60 ? 'tilt' : 'grab'; gesture.last = g0; }
    if (gesture.mode === 'tilt'){ cam.goal.pitch = clamp(cam.goal.pitch + (n.cy - gesture.last.cy) * 0.005, 0.1, 1.45); }
    else grabMap(gesture.last, n);
    gesture.last = n; }
});
/* Two fingers grab the map: the ground point under the pinch centre stays under the fingers while they move,
   spread (zoom in) or twist (map turns the same way as the fingers). Rays use the target camera, not the smoothed one. */
const goalCamera = new THREE.PerspectiveCamera();
function syncGoalCamera(){ const g = cam.goal; goalCamera.fov = camera.fov; goalCamera.aspect = camera.aspect; goalCamera.near = camera.near; goalCamera.far = camera.far; goalCamera.updateProjectionMatrix();
  const pitch = clamp(g.pitch, 0.1, 1.45), dist = clamp(g.dist, 12, 330); const ty = Math.max(H(g.tx, g.tz), 0) + 0.5; const cp = Math.cos(pitch);
  goalCamera.position.set(g.tx + Math.sin(g.yaw) * cp * dist, ty + Math.sin(pitch) * dist, g.tz + Math.cos(g.yaw) * cp * dist); goalCamera.lookAt(g.tx, ty, g.tz); goalCamera.updateMatrixWorld(true); }
function grabMap(l, n){ const g = cam.goal; cam.follow = null; syncGoalCamera(); const A = groundAtScreen(l.cx, l.cy, goalCamera);
  if (l.d > 10 && n.d > 10) g.dist = clamp(g.dist * l.d / n.d, 12, 330);
  let da = n.ang - l.ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; g.yaw += da;
  syncGoalCamera(); const B = groundAtScreen(n.cx, n.cy, goalCamera);
  if (A && B){ g.tx += A.x - B.x; g.tz += A.z - B.z; } else panBy(n.cx - l.cx, n.cy - l.cy); }
/* One finger grabs the map: the ground point under the finger stays under it (ray vs. a flat plane at that point's height,
   so hills do not make it jump). Releasing while moving lets it glide a little; the glide stops at the island edge. */
const panS = { a: null, hist: [] }; const fling = { vx: 0, vz: 0 }; const _ray = new THREE.Raycaster(), _pl = new THREE.Plane(), _hit = new THREE.Vector3();
function planeAtScreen(x, y, cm, h){ _ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); _ray.setFromCamera(_ndc, cm); _pl.set(new THREE.Vector3(0, 1, 0), -h);
  const r = _ray.ray; if (r.direction.y > -0.02) return null; const p = r.intersectPlane(_pl, _hit); if (!p || p.distanceTo(r.origin) > 900) return null; return p.clone(); }
function startPan(x, y){ syncGoalCamera(); const g = groundAtScreen(x, y, goalCamera); panS.a = g ? g.clone() : null; panS.hist = []; }
function dragPan(x, y){ if (!panS.a) return startPan(x, y); const g = cam.goal; cam.follow = null;
  for (let it = 0; it < 2; it++){ syncGoalCamera(); const b = planeAtScreen(x, y, goalCamera, panS.a.y); if (!b) break; g.tx += panS.a.x - b.x; g.tz += panS.a.z - b.z; }
  clampGoal(); const now = performance.now(); panS.hist.push([now, g.tx, g.tz]); while (panS.hist.length > 2 && now - panS.hist[0][0] > 90) panS.hist.shift(); }
function releasePan(){ const h = panS.hist; panS.a = null; if (h.length < 2) return; const [t0, x0, z0] = h[0], [t1, x1, z1] = h[h.length - 1]; const dt = (t1 - t0) / 1000;
  if (dt < 0.016 || performance.now() - t1 > 60) return; let vx = (x1 - x0) / dt, vz = (z1 - z0) / dt; const sp = Math.hypot(vx, vz), cap = cam.goal.dist * 2.5;
  if (sp < cam.goal.dist * 0.25) return; if (sp > cap){ vx *= cap / sp; vz *= cap / sp; } fling.vx = vx; fling.vz = vz; }
function stopFling(){ const was = Math.hypot(fling.vx, fling.vz) > cam.goal.dist * 0.3; fling.vx = fling.vz = 0; return was; }
const GOAL_X = [-HALF - 40, HALF + 40], GOAL_Z = [-HALF - 60, HALF + 40];
function clampGoal(){ const g = cam.goal; g.tx = clamp(g.tx, GOAL_X[0], GOAL_X[1]); g.tz = clamp(g.tz, GOAL_Z[0], GOAL_Z[1]); }
function updateFling(dt){ if (!fling.vx && !fling.vz) return; const g = cam.goal; g.tx += fling.vx * dt; g.tz += fling.vz * dt; cam.follow = null;
  if (g.tx <= GOAL_X[0] || g.tx >= GOAL_X[1]) fling.vx = 0; if (g.tz <= GOAL_Z[0] || g.tz >= GOAL_Z[1]) fling.vz = 0; clampGoal();
  const k = Math.exp(-5.5 * dt); fling.vx *= k; fling.vz *= k; if (Math.hypot(fling.vx, fling.vz) < 0.5){ fling.vx = fling.vz = 0; } }
function panBy(dx, dy){ const s = cam.goal.dist * 0.0018 * (900 / Math.max(innerHeight, 400)); const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); cam.goal.tx += (-dx * cy - dy * sy) * s; cam.goal.tz += (dx * sy - dy * cy) * s; cam.follow = null; }
function endPtr(e){ const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
  if (gesture && gesture.hold) clearTimeout(gesture.hold);
  if (gesture && ptrs.size === 0){ // time the press by the events' own timestamps (when the finger touched and lifted), not by when this handler got to run:
    // a busy frame on the phone must not turn a quick tap into a "long press". While placing something there is no long-press action, so allow slower taps.
    const pressMs = (e.timeStamp && p.ts) ? e.timeStamp - p.ts : performance.now() - p.t;
    const tapped = e.type !== 'pointercancel' && !gesture.moved && !gesture.held && pressMs < (tool ? TAP_MS_TOOL : TAP_MS) && gesture.kind === 'one';
    if (gesture.penDrag){ penDragEnd(gesture.moved || !tapped ? null : p); gesture = null; return; }
    if (gesture.kind === 'one' && gesture.moved && !gesture.ghost) releasePan();
    if (gesture.held && tool && tool.kind === 'penmove') keepPenVisible();
    if (gesture.held){ if (ghost){ ghost.scale.setScalar(1); if (tool && tool.hover && tool.move) setPreview([tool.hover[0] + Math.floor((tool.move.w - 1) / 2), tool.hover[1] + Math.floor((tool.move.h - 1) / 2)]); } keepPreviewVisible(); }
    if (tapped){ if (tool) toolTap(p); else tap(p.x, p.y); }
    gesture = null; }
  else if (ptrs.size === 1 && gesture && gesture.kind === 'two'){ gesture = { kind: 'one', moved: true, ghost: false }; const q = [...ptrs.values()][0]; startPan(q.x, q.y); } }
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.goal.dist = clamp(cam.goal.dist * Math.exp(e.deltaY * 0.0012), 12, 330); }, { passive: false });
const keys = new Set(); window.addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); if (e.key === 'Escape'){ if (tool) cancelTool(); else closeSheet(); } if (e.key === ' ' && G.running){ G.speed = G.speed ? 0 : 1; updateHUD(); e.preventDefault(); } });
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function keyCamera(dt){ if (!keys.size) return; const s = cam.goal.dist * 0.9 * dt; let mx = 0, mz = 0; if (keys.has('w') || keys.has('arrowup')) mz -= 1; if (keys.has('s') || keys.has('arrowdown')) mz += 1; if (keys.has('a') || keys.has('arrowleft')) mx -= 1; if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (mx || mz){ const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); cam.goal.tx += (mx * cy + mz * sy) * s; cam.goal.tz += (-mx * sy + mz * cy) * s; cam.follow = null; }
  if (keys.has('q')) cam.goal.yaw += dt * 1.4; if (keys.has('e')) cam.goal.yaw -= dt * 1.4; if (keys.has('r')) cam.goal.pitch += dt; if (keys.has('f')) cam.goal.pitch -= dt; if (keys.has('=') || keys.has('+')) cam.goal.dist *= 1 - dt; if (keys.has('-')) cam.goal.dist *= 1 + dt; }

/* ================= time of day lighting ================= */
const _cA = new THREE.Color(), _cB = new THREE.Color();
let shadowR = 0;
function applyLighting(){
  const hr = (G && !title.on) ? G.hour : 10.5; const t = clamp((hr - 5.5) / (22.5 - 5.5), 0, 1); const elev = Math.sin(t * Math.PI) * 1.0 + 0.08; const az = lerp(-1.6, 1.4, t) + 0.9;
  SUN_DIR.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)).normalize();
  const warm = sstep(0.55, 0.12, elev);
  sun.color.copy(_cA.setHex(0xfff0d8)).lerp(_cB.setHex(0xffa860), warm); sun.intensity = 3.1 * (0.55 + 0.45 * sstep(0.05, 0.5, elev));
  hemi.intensity = 0.75 + 0.25 * sstep(0.1, 0.6, elev);
  skyU.uSunDir.value.copy(SUN_DIR); skyU.uSunCol.value.copy(sun.color);
  skyU.uTop.value.copy(_cA.setHex(0x4a7cae)).lerp(_cB.setHex(0x5a6a8a), warm * 0.6);
  const hor = _cA.setHex(0xc4d4cc).lerp(_cB.setHex(0xe6b98a), warm * 0.7); skyU.uHor.value.copy(hor); scene.fog.color.copy(hor);
  // shadow frustum follows the camera target
  const R = clamp(cam.dist * 0.8, 45, 170); const ms = sun.shadow.mapSize.x; const texel = 2 * R / ms;
  const cx = Math.round(cam.tx / texel) * texel, cz = Math.round(cam.tz / texel) * texel;
  sun.target.position.set(cx, 0, cz); sun.position.set(cx + SUN_DIR.x * 300, SUN_DIR.y * 300, cz + SUN_DIR.z * 300);
  if (Math.abs(R - shadowR) > 4){ shadowR = R; const c = sun.shadow.camera; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.updateProjectionMatrix(); }
}

/* ================= wild herd (scenery beyond the plot) ================= */
const wild = [];
function spawnWild(){ const spots = [['brachio', -30, -132], ['brachio', 10, -140], ['para', -55, -124], ['para', -48, -130], ['para', -60, -134], ['brachio', -120, -40]];
  for (const [sp, x, z] of spots){ if (H(x, z) < 0.8) continue; const model = new Dino(sp); scene.add(model.root); wild.push({ sp, x, z, hd: rnd() * TAU, v: 0, tx: x, tz: z, wait: rnd() * 5, model, hx: x, hz: z, state: 'wild' }); } }
function updateWild(dt){ for (const d of wild){ d.wait -= dt; if (d.wait < 0 && Math.hypot(d.tx - d.x, d.tz - d.z) < 2){ for (let k = 0; k < 8; k++){ const tx = d.hx + fr(-30, 30), tz = d.hz + fr(-14, 14); if (H(tx, tz) > 0.8 && H(tx, tz) < 16){ d.tx = tx; d.tz = tz; break; } } d.wait = 4 + rnd() * 8; if (rnd() < 0.4) d.model.setAction('eat', 4); }
  d.turn = 0; moveToward(d, d.tx, d.tz, SPECIES[d.sp].walk * 0.7, dt, 0.6); d.model.animate(dt, d.v, d.turn || 0); d.model.root.position.set(d.x, H(d.x, d.z), d.z); d.model.root.rotation.y = d.hd; } }

/* ================= save / load ================= */
function serialize(){
  const hp = tool && tool.kind === 'penmove' && tool.p ? tool : null; if (hp) applyPenPose(hp.p, hp.o, hp.o.i0, hp.o.j0, 0, false);
  try { return serialize0(); } finally { if (hp) applyPenPose(hp.p, hp.o, hp.at[0], hp.at[1], hp.r, false); } }
function serialize0(){
  const paths = []; for (let k = 0; k < tileType.length; k++) if (tileType[k] === T_PATH) paths.push(k);
  const g = {}; for (const k in G) if (!['running', 'feeding', 'headless', 'score', 'avgHappy', 'tick', 'unlockAll', 'spawnAcc'].includes(k)) g[k] = G[k];
  return { v: 1, G: g, paths,
    buildings: [...buildings.values()].map(b => ({ id: b.id, type: b.type, i: b.i, j: b.j, rot: b.rot, pen: b.pen })).concat(tool && tool.move ? [{ id: tool.move.id, type: tool.move.type, i: tool.move.i, j: tool.move.j, rot: tool.move.rot, pen: tool.move.pen }] : []),
    pens: [...pens.values()].map(p => ({ id: p.id, i0: p.i0, j0: p.j0, i1: p.i1, j1: p.j1, tier: p.tier, name: p.name, segs: p.segs.map(s => +s.cond.toFixed(3)), broken: p.segs.map((s, k) => s.broken ? k : -1).filter(k => k >= 0) })),
    dinos: dinos.map(d => ({ id: d.id, sp: d.sp, pen: d.pen, x: +d.x.toFixed(2), z: +d.z.toFixed(2), hunger: +d.hunger.toFixed(3), name: d.name, fedSkip: d.fedSkip, state: d.state === 'pen' || d.state === 'transfer' ? 'pen' : 'holding' })),
    eggs };
}
function saveGame(){ if (!G || G.noSave) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) {} }
function clearWorld(){
  for (const b of buildings.values()) scene.remove(b.mesh); buildings.clear(); pens.clear(); for (const d of dinos) scene.remove(d.model.root); dinos = []; eggs = []; guests = [];
  for (const j of jeeps) scene.remove(j.mesh); jeeps.length = 0; tileRef.fill(-1); computeBuildable(); if (gateMesh){ scene.remove(gateMesh); gateMesh = null; }
}
let gateMesh = null;
function placeGate(){ for (const i of [GATE.i, GATE.i + 1]){ tileType[idx(i, GATE.j)] = T_PATH; } gateMesh = makeBuildingMesh('gate'); const x = eX(GATE.i + 1), z = tZ(GATE.j); gateMesh.position.set(x, H(x, z) - 0.1, z); scene.add(gateMesh); }
function newGame(save = true){
  clearWorld(); G = freshState(); placeGate();
  for (let j = 44; j < GATE.j; j++) for (const i of [GATE.i, GATE.i + 1]) tileType[idx(i, j)] = T_PATH;
  for (let i = 20; i <= 35; i++) tileType[idx(i, 44)] = T_PATH;
  for (const k of [idx(29, 48), idx(30, 48), idx(31, 48), idx(29, 49), idx(30, 49), idx(31, 49), idx(29, 50), idx(30, 50), idx(31, 50)]) tileType[k] = T_EMPTY;
  placeBuilding('visitor', 29, 48, { rot: -Math.PI / 2 });
  afterStructureChange(); cam.goal.tx = 0; cam.goal.tz = 60; if (save) saveGame();
}
function loadGame(){
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; let S; try { S = JSON.parse(raw); } catch (e) { return false; } if (!S || S.v !== 1) return false;
  clearWorld(); G = Object.assign(freshState(), S.G); G.stats = Object.assign(freshState().stats, S.G.stats || {}); G.ledger = Object.assign(freshState().ledger, S.G.ledger || {});
  placeGate(); for (const k of S.paths) tileType[k] = T_PATH;
  for (const p of S.pens) createPen(p.i0, p.j0, p.i1, p.j1, p.tier, { id: p.id, name: p.name, segs: p.segs, broken: p.broken });
  for (const b of S.buildings){ if (BUILD[b.type].inPen && !pens.has(b.pen)) continue; placeBuilding(b.type, b.i, b.j, { id: b.id, rot: b.rot }); }
  for (const d of S.dinos){ const pen = pens.get(d.pen); if (!pen) continue; spawnDino(d.sp, pen, { id: d.id, x: d.x, z: d.z, hunger: d.hunger, name: d.name, fedSkip: d.fedSkip, state: d.state === 'holding' || penBroken(pen) ? 'holding' : 'pen' }); }
  eggs = S.eggs || []; G.hour = Math.max(G.hour, DAY_START); if (!G.econ6){ G.econ6 = true; G.rep = Math.max(G.rep, 55); G.safety = Math.max(G.safety, 70); } afterStructureChange(); return true;
}

/* ================= species thumbnails ================= */
const THUMBS = {};
function makeThumbs(){
  const W = 256, Hh = 150; const rt = new THREE.WebGLRenderTarget(W, Hh, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene(); s.background = new THREE.Color(0x3a4a34); s.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, 1.1)); const l = new THREE.DirectionalLight(0xfff0d8, 2.2); l.position.set(3, 5, 4); s.add(l);
  const fl = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 1 })); s.add(fl);
  const c = new THREE.PerspectiveCamera(30, W / Hh, 0.1, 200); const buf = new Uint8Array(W * Hh * 4); const cv = M.mk(W, Hh), g = cv.getContext('2d'); const img = g.createImageData(W, Hh);
  const prevTM = renderer.toneMapping;
  for (const sp of SP_KEYS){ const d = new Dino(sp, { lod: 'hi' }); d.root.rotation.y = -1.0; s.add(d.root); d.animate(0.01, 0, 0); const SD = SPECIES_DATA[sp]; const L = SD.size, Hgt = sp === 'brachio' ? 12 : SD.legs[0].at[1] * 1.6;
    const dist = Math.max(L * 1.15, Hgt * 2.2); c.position.set(dist * 0.15, Hgt * 0.65 + dist * 0.12, dist); c.lookAt(0, Hgt * 0.5, 0);
    renderer.setRenderTarget(rt); renderer.render(s, c); renderer.readRenderTargetPixels(rt, 0, 0, W, Hh, buf); renderer.setRenderTarget(null);
    for (let y = 0; y < Hh; y++) img.data.set(buf.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4); g.putImageData(img, 0, 0); THUMBS[sp] = cv.toDataURL('image/jpeg', 0.82); s.remove(d.root); }
  renderer.toneMapping = prevTM; rt.dispose();
}

/* ================= quality ================= */
function resize(){ const w = innerWidth, h = innerHeight; renderer.setPixelRatio(Math.min(DPR, QUALITY.pr[QUALITY.level])); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 55 : 45; camera.updateProjectionMatrix(); }
function setQuality(l, manual){ QUALITY.level = l; setDinoQuality(l); if (manual) QUALITY.forced = true; const ms = QUALITY.shadow[l]; sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } shadowR = 0; resize(); refreshVegetation(); }
window.addEventListener('resize', resize);
const PERF = { frames: 0, t0: 0, fps: 0, hist: [], lastStep: 0, ms: 0 };
function perfTick(now, frameMs){ PERF.frames++; PERF.ms += frameMs; if (now - PERF.t0 >= 1000){ PERF.fps = PERF.frames * 1000 / (now - PERF.t0); PERF.cpu = PERF.ms / PERF.frames; PERF.frames = 0; PERF.ms = 0; PERF.t0 = now; PERF.hist.push(PERF.fps); if (PERF.hist.length > 4) PERF.hist.shift();
  if (!QUALITY.forced && QUALITY.level > 0 && PERF.hist.length >= 4 && now - PERF.lastStep > 6000 && !document.hidden){ const avg = PERF.hist.reduce((a, b) => a + b) / PERF.hist.length; if (avg < 45){ setQuality(QUALITY.level - 1); PERF.lastStep = now; PERF.hist = []; } }
  if (fpsEl) fpsEl.textContent = PERF.fps.toFixed(0) + ' fps  q' + QUALITY.level + '  ' + renderer.info.render.calls + ' calls'; } }
let fpsEl = null; if (QS.has('fps')){ fpsEl = document.createElement('div'); fpsEl.style.cssText = 'position:absolute;left:8px;bottom:90px;z-index:50;font:12px monospace;color:#fff;background:rgba(0,0,0,.5);padding:3px 6px;border-radius:4px;pointer-events:none'; document.body.appendChild(fpsEl); }

/* ================= main loop ================= */
let last = performance.now(), hourFloor = -1, sheetT = 0, saveT = 0, viewT = 0, starT = 0;
function simulate(gdt){
  const hourDt = gdt / SEC_PER_HOUR; G.hour += hourDt; G.tick = (G.tick || 0) + 1;
  const hf = Math.floor(G.hour); if (hf !== hourFloor){ if (hourFloor >= 0) hourTick(); hourFloor = hf; }
  if (G.hour >= OPEN && G.hour < CLOSE){ G.spawnAcc = (G.spawnAcc || 0) + guestRatePerHour() * hourDt; while (G.spawnAcc >= 1){ G.spawnAcc--; ferryArrival(); } }
  updateFerries(gdt);
  for (const d of dinos.slice()) updateDino(d, gdt);
  updateGuests(gdt, hourDt); updateEggs(gdt); updateJeeps(gdt); G.feedCooldown = Math.max(0, G.feedCooldown - gdt);
  if (G.hour >= DAY_END) endDay();
}
function frame(now){
  requestAnimationFrame(frame); const t0 = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); last = now; M.WIND.value += dt;
  const modalOpen = !$('modal').classList.contains('hidden') || !$('tut').classList.contains('hidden');
  if (G.running && G.speed > 0 && !modalOpen){ let gdt = dt * G.speed; while (gdt > 0){ const s = Math.min(gdt, 0.05); simulate(s); gdt -= s; } }
  else for (const d of dinos.slice()){ if (d.state === 'transfer') updateTransfer(d, Math.min(dt, 0.05)); else if (d.model.root.visible){ d.model.animate(dt, 0, 0); } }
  tutTick(dt); updateBubbles(dt); updateWild(dt); keyCamera(dt); updateCamera(dt); applyLighting(); updateParticles(dt); updateSmoke(dt);
  if (rebuildFencesSoon){ rebuildFencesSoon = false; rebuildFences(); }
  if (gateMesh && gateMesh.userData.flames) for (const f of gateMesh.userData.flames){ const k = 0.85 + Math.sin(now * 0.017 + f.id) * 0.1 + Math.sin(now * 0.041) * 0.05; f.scale.set(1.6 * k, 2.2 * k, 1); }
  updateWarnMarkers(now / 1000);
  hudT -= dt; if (hudT <= 0 && G.running){ hudT = 0.25; updateHUD(); }
  viewT -= dt; if (viewT <= 0){ viewT = 1; computeViewMap(); SFX.setCrowd(G.running ? clamp(guestsInPark() / 160, 0, 1) * clamp(1.4 - cam.dist / 250, 0.2, 1) : 0); if (rnd() < 0.25) SFX.bird(); }
  starT -= dt; if (starT <= 0 && G.running){ starT = 1; G.stars = computeStars(); checkMissions(); }
  sheetT -= dt; if (sheetT <= 0){ sheetT = 1; if (sel && ['pen', 'dino', 'park', 'dinos', 'guests', 'guest'].includes(sel.kind)) refreshSheet(); }
  saveT -= dt; if (saveT <= 0){ saveT = 20; if (G.running) saveGame(); }
  if (!window.__DP.noRender) renderer.render(scene, camera);
  perfTick(now, performance.now() - t0);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.running) saveGame(); });
window.addEventListener('pagehide', () => { if (G && G.running) saveGame(); });

/* ================= debug / test hook ================= */
window.__DP = {
  get G(){ return G; }, get dinos(){ return dinos; }, get guests(){ return guests.filter(g => !g.gone); }, get pens(){ return [...pens.values()]; }, get buildings(){ return [...buildings.values()]; }, get perf(){ return { blood: bloodIM.count, fps: PERF.fps, cpu: PERF.cpu, q: QUALITY.level, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
  cam, SPECIES, start(fresh = true){ if (fresh) newGame(); G.tutorialDone = true; startPlaying(false); $('tut').classList.add('hidden'); },
  path(i0, j0, i1, j1){ paintLine([i0, j0], [i1, j1], false); afterStructureChange(); },
  pen(i0, j0, i1, j1, tier){ const c = penCanBuild(i0, j0, i1, j1); if (!c.ok) return c.why; spend('build', penCost(i0, j0, i1, j1, tier)); const p = createPen(i0, j0, i1, j1, tier); afterStructureChange(); return p.id; },
  build(type, i, j){ const c = canPlace(type, i, j); if (!c.ok) return c.why; spend('build', BUILD[type].cost); const b = placeBuilding(type, i, j); afterStructureChange(); return b.id; },
  hatch(sp, penId, instant){ const pen = pens.get(penId); G.unlockAll = true; const ok = orderEgg(sp, pen); if (ok && instant){ const e = eggs.pop(); hatchEgg(e); } return ok; },
  spawnGuests(n){ for (let k = 0; k < n; k++){ const g = spawnGuest(); if (!g) break; g.state = 'walk'; const t = [...Array(GRID * GRID).keys()].filter(k => tileType[k] === T_PATH && exitDist[k] < 1e6); const k2 = t[(rnd() * t.length) | 0]; g.ci = k2 % GRID; g.cj = (k2 / GRID) | 0; g.x = tX(g.ci); g.z = tZ(g.cj); g.tx = g.x; g.tz = g.z; G.stats.guestsTotal++; G.stats.guestsToday++; earn('tickets', G.price); } },
  feed(penId){ return feedGuest(pens.get(penId)); }, breakout(dinoId){ const d = dinos.find(x => x.id === dinoId); breakout(d, pens.get(d.pen)); }, dispatch: dispatchRangers,
  repair(penId){ const pen = pens.get(penId); for (const s of pen.segs){ s.cond = 1; s.broken = false; } releaseHeld(pen); rebuildFences(); showAlert(); },
  focus: focusOn, openSheet, closeSheet, setSpeed(s){ G.speed = s; }, setHour(h){ G.hour = h; }, setQuality, sim(sec){ let t = sec; while (t > 0){ const s = Math.min(t, 0.05); simulate(s); updateWild(s); t -= s; this._vt = (this._vt || 0) + s; if (this._vt >= 1){ this._vt = 0; computeViewMap(); } } }, tick(){ updateCamera(0.05); applyLighting(); renderer.render(scene, camera); },
  hourly(){ hourTick(); }, ready: false,
  get tool(){ return tool; }, get camera(){ return camera; }, groundAt(x, y){ return groundAtScreen(x, y); }, get undo(){ return undoRec; }, startTool, undoLast, tutorial(k){ showTutorial(k); }, get penMarkers(){ return penMarkers.length; }, guestNeeds, get bubbles(){ return bubbles.filter(b => b.s.visible).length; }, get penSpots(){ return penSpots; }, get ferry(){ return { pendingIn: FERRY.pendingIn, boats: FERRY.boats.map(b => ({ kind: b.slot.kind, state: b.state, t: +b.t.toFixed(1), x: +b.slot.mesh.position.x.toFixed(1), z: +b.slot.mesh.position.z.toFixed(1) })), waiting: waitingAtDock() }; }, onPier, walkH, advisor(){ return moneyAdvisor(); }, guestSpread(){ const gx = tX(GATE.i) + TILE / 2, gz = tZ(GATE.j); const w = guests.filter(g => !g.gone && g.state === 'walk'); const d = w.map(g => Math.hypot(g.x - gx, g.z - gz)); const f = x => d.length ? +(d.filter(v => v > x).length / d.length).toFixed(2) : 0; return { walking: w.length, over30m: f(30), over60m: f(60), over100m: f(100), maxM: Math.round(Math.max(0, ...d)) }; }, penWarn(id){ const p = pens.get(id); return !!p && (!!penWeak(p) || penBroken(p) || penMinCond(p) < 0.45 || penWorn(p)); }, heightAt(x, z){ return H(x, z); }, dailyUpkeep, guestThought, pickGuest, screenOfXZ(x, y, z){ const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, transferCheck(dId, pId){ return transferCheck(dinos.find(d => d.id === dId), pens.get(pId)); }, startTransfer(dId){ startTransfer(dinos.find(d => d.id === dId)); }, get tutK(){ return tutK; }, flowPerMin(){ return flowPerMin(); }, stars(){ G.stars = computeStars(); checkMissions(); return G.stars; }, get fling(){ return { ...fling }; }, serialize(){ return serialize(); }, load(){ return loadGame(); }, save(){ saveGame(); }, screenOf(i, j){ const v = new THREE.Vector3(tX(i), H(tX(i), tZ(j)), tZ(j)).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, tileType(i, j){ return tileType[idx(i, j)]; },
};

/* ================= init ================= */
function init(){
  const m = localStorage.getItem('pp-muted'); if (m === '1') SFX.setMuted(true);
  computeBuildable(); scatterVegetation(); buildEnv(); buildPier(); prewarm(SP_KEYS);
  if (!loadGame()) newGame(false);
  setQuality(QUALITY.level); buildDock(); makeThumbs(); spawnWild();
  cam.goal.tx = 0; cam.goal.tz = 30; cam.goal.dist = 230; cam.goal.pitch = 0.42; Object.assign(cam, { tx: 0, tz: 30, dist: 230, pitch: 0.42, yaw: 0.5 });
  if (QS.has('play')){ startPlaying(false); $('tut').classList.add('hidden'); } else showTitle();
  const waitTex = () => { if (texPending > 0) return setTimeout(waitTex, 50); $('loading').classList.add('hidden'); window.__DP.ready = true; };
  waitTex(); requestAnimationFrame(frame);
}
init();
