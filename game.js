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
  para:    { name: 'Parasaurolophus', short: 'Parasaurolophus', diet: 'plant', str: 1.0, appeal: 22, cost: 14000, hatch: 25, space: 10, group: [2, 8], stars: 0, walk: 2.2, run: 7, darts: 1, feed: 250, desc: 'Gentle herd animal with a trumpet crest.' },
  trike:   { name: 'Triceratops', short: 'Triceratops', diet: 'plant', str: 3.5, appeal: 36, cost: 32000, hatch: 35, space: 14, group: [1, 4], stars: 0, walk: 2.0, run: 6, darts: 3, feed: 400, desc: 'Three horns, one bad temper. Charges fences.' },
  stego:   { name: 'Stegosaurus', short: 'Stegosaurus', diet: 'plant', str: 2.0, appeal: 30, cost: 24000, hatch: 30, space: 12, group: [1, 5], stars: 1, walk: 1.7, run: 4, darts: 2, feed: 350, desc: 'Plated and slow. A crowd favourite.' },
  dilo:    { name: 'Dilophosaurus', short: 'Dilophosaurus', diet: 'meat', str: 2.5, appeal: 42, cost: 38000, hatch: 35, space: 8, group: [1, 4], stars: 1, walk: 2.4, run: 8, darts: 2, feed: 600, desc: 'Crested hunter. Small, quick and spiteful.' },
  ankylo:  { name: 'Ankylosaurus', short: 'Ankylosaurus', diet: 'plant', str: 2.5, appeal: 32, cost: 30000, hatch: 35, space: 10, group: [1, 3], stars: 2, walk: 1.4, run: 3.5, darts: 2, feed: 380, desc: 'Armoured tank with a bone-club tail.' },
  raptor:  { name: 'Velociraptor', short: 'Velociraptor', diet: 'meat', str: 3.5, appeal: 58, cost: 52000, hatch: 40, space: 6, group: [3, 6], stars: 2, walk: 2.6, run: 12, darts: 2, feed: 700, clever: true, desc: 'Pack hunter. Tests the fences, systematically.' },
  brachio: { name: 'Brachiosaurus', short: 'Brachiosaurus', diet: 'plant', str: 4.0, appeal: 64, cost: 85000, hatch: 50, space: 30, group: [1, 4], stars: 3, walk: 2.2, run: 4, darts: 4, feed: 1200, desc: 'Twelve metres tall. Guests cry. In a good way.' },
  trex:    { name: 'Tyrannosaurus rex', short: 'T. rex', diet: 'meat', str: 6.5, appeal: 110, cost: 150000, hatch: 60, space: 30, group: [1, 1], stars: 3.5, walk: 3.0, run: 8.5, darts: 4, feed: 2000, desc: 'The star attraction. Needs concrete walls.' },
};
const SP_KEYS = ['para', 'trike', 'stego', 'dilo', 'ankylo', 'raptor', 'brachio', 'trex'];
const BUILD = {
  path:     { name: 'Footpath', cost: 150, desc: 'Guests walk on paths. Drag to paint.', stars: 0 },
  hatchery: { name: 'Hatchery', cost: 60000, upkeep: 2200, desc: 'Incubates dinosaur eggs. Two at a time.', stars: 0 },
  ranger:   { name: 'Ranger Station', cost: 40000, upkeep: 2400, desc: 'Maintains nearby fences. Cheaper, faster containment.', stars: 0 },
  food:     { name: 'Food Stand', cost: 9000, upkeep: 500, desc: 'Burgers and drinks. Must face a path.', stars: 0 },
  restroom: { name: 'Restrooms', cost: 6000, upkeep: 300, desc: 'Keeps guests comfortable. Must face a path.', stars: 0 },
  gift:     { name: 'Gift Shop', cost: 14000, upkeep: 600, desc: 'Plush raptors at premium prices.', stars: 0.5 },
  viewing:  { name: 'Viewing Platform', cost: 12000, upkeep: 150, desc: 'Raises the appeal of nearby enclosures.', stars: 1 },
  meat:     { name: 'Meat Feeder', cost: 8000, upkeep: 200, desc: 'Place inside an enclosure. Feeds carnivores.', stars: 0, inPen: true },
  plant:    { name: 'Plant Feeder', cost: 5000, upkeep: 120, desc: 'Place inside an enclosure. Feeds herbivores.', stars: 0, inPen: true },
  visitor:  { name: 'Visitor Centre', cost: 0, upkeep: 800, desc: 'Food, restrooms and souvenirs.', stars: 0, fixed: true },
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
function freshState(){ return { v: 1, money: 300000, day: 1, hour: OPEN - 0.5, price: 35, rep: 55, safety: 85, stars: 0, speed: 1, nextId: 1,
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
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ if (!inGrid(i, j)) return { ok: false, why: 'Outside the park' }; const t = tileType[idx(i, j)]; if (t !== T_EMPTY) return { ok: false, why: t === T_BLOCK ? 'Ground too rough or wet' : 'Area overlaps something' }; }
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
function fenceStrength(pen){ return FT[pen.tier].str * (0.35 + 0.65 * penMinCond(pen)); }
function repairCost(pen){ let c = 0; for (const s of pen.segs) c += s.broken ? FT[pen.tier].cost * 1.2 : (1 - s.cond) * FT[pen.tier].cost * 0.5; return Math.round(c / 10) * 10; }
// warning markers above pens
function warnCanvas(){ const c = M.mk(128, 128), g = c.getContext('2d'); g.fillStyle = '#f2c230'; g.strokeStyle = '#111'; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath(); g.moveTo(64, 12); g.lineTo(120, 112); g.lineTo(8, 112); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#111'; g.fillRect(58, 44, 12, 40); g.fillRect(58, 92, 12, 12); return c; }
const warnMat = new THREE.SpriteMaterial({ map: canvasTex(warnCanvas(), true, false), depthTest: false, transparent: true, fog: false });
const warnSprites = new Map();
function updateWarnMarkers(t){
  for (const pen of pens.values()){ const show = !!penWeak(pen) || penBroken(pen) || penMinCond(pen) < 0.45; let s = warnSprites.get(pen.id);
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
            else { d.tx = fr(x0, Math.max(x0, x1)); d.tz = fr(z0, Math.max(z0, z1)); } d.wait = 1.5 + rnd() * 5; if (rnd() < 0.25 && d.roarCD < 0){ d.model.setAction('roar', 2); d.roarCD = 25 + rnd() * 40; if (S.diet === 'meat' || d.sp === 'trike' || d.sp === 'para') vocal(d); } else if (rnd() < 0.3) d.model.setAction('eat', 3); } }
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
    if (d.roarCD < 0){ d.roarCD = 8 + rnd() * 8; d.model.setAction('roar', 2); vocal(d); }
  }
  // separation inside pens
  if (d.state === 'pen') for (const o of dinos){ if (o === d || o.pen !== d.pen || o.state !== 'pen') continue; const dx = d.x - o.x, dz = d.z - o.z, dd = Math.hypot(dx, dz), r = dinoRadius(d) + dinoRadius(o);
    if (dd < r && dd > 0.01){ const k = (r - dd) * 0.5 * Math.min(1, dt * 4); d.x += dx / dd * k; d.z += dz / dd * k; } }
  d.model.animate(dt, d.v, d.turn || 0); placeDinoModel(d);
  // footsteps for big animals
  if (SD.size >= 8 && d.v > 0.5){ const ph = Math.floor(d.model.phase / Math.PI); if (ph !== d.lastStep){ d.lastStep = ph; const vol = camVol(d.x, d.z) * (SD.size / 12); if (vol > 0.08) SFX.thud(vol, SD.size / 6); if (d.sp === 'trex' && vol > 0.25) cam.shake = Math.max(cam.shake, vol * 0.25); } }
}
function wanderLoose(d, dt, v, tr){ d.wait -= dt; const dist = Math.hypot(d.tx - d.x, d.tz - d.z); if (dist < 3 || d.wait < 0){ d.tx = clamp(d.x + fr(-40, 40), -HALF + 10, HALF - 10); d.tz = clamp(d.z + fr(-40, 40), -HALF + 10, HALF - 10); d.wait = 6 + rnd() * 6; } moveToward(d, d.tx, d.tz, v, dt, tr); }
function vocal(d){ const vol = camVol(d.x, d.z); const SD = SPECIES_DATA[d.sp]; if (d.sp === 'raptor' || d.sp === 'dilo') SFX.screech(vol); else SFX.roar(SD.size / 5, vol); }
function camVol(x, z){ const d = Math.hypot(camera.position.x - x, camera.position.z - z, camera.position.y - H(x, z)); return clamp(1.3 - d / 160, 0, 1); }
function dinoHourly(d){
  const S = SPECIES[d.sp], pen = pens.get(d.pen); if (d.state === 'holding' || !pen) return;
  d.hunger = clamp(d.hunger + (S.diet === 'meat' ? 0.075 : 0.09) * (d.state === 'loose' ? 1.5 : 1), 0, 1);
  const c = dinoComfort(d); const target = clamp(Math.max(0, d.hunger - 0.6) * 1.8 + (1 - c.space) * 0.6 + (1 - c.social) * 0.4 + (c.mixed ? 0.4 : 0) + (S.clever ? 0.15 : 0), 0, 1);
  d.stress = lerp(d.stress, target, 0.35);
  if (d.state !== 'pen') return;
  // breakout check: strength vs fence
  const fence = fenceStrength(pen), eff = S.str * (1 + 0.5 * d.stress); let p = 0;
  if (penBroken(pen)) p = 0.3;
  else if (eff > fence) p = Math.min(0.35, 0.06 + 0.12 * (eff - fence));
  else if (eff > fence - 0.75) p = 0.002 + (d.stress > 0.7 ? 0.004 : 0);
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
  viewMap.fill(0); const plats = [...buildings.values()].filter(b => b.type === 'viewing');
  for (const pen of pens.values()){ const ds = dinos.filter(d => d.pen === pen.id && (d.state === 'pen')); if (!ds.length) continue;
    const counts = {}; let ap = 0; for (const d of ds){ counts[d.sp] = (counts[d.sp] || 0) + 1; ap += SPECIES[d.sp].appeal * Math.pow(0.6, counts[d.sp] - 1) * (0.7 + 0.3 * (1 - d.stress)); }
    const vis = pen.tier === 3 ? 0.4 : 1;
    for (let j = pen.j0 - 5; j <= pen.j1 + 5; j++) for (let i = pen.i0 - 5; i <= pen.i1 + 5; i++){ if (!isPath(i, j)) continue; const dd = Math.max(pen.i0 - i, 0, i - pen.i1, pen.j0 - j, 0, j - pen.j1);
      let v = ap * (1 - dd / 6) * vis; for (const p of plats){ if (Math.abs(p.i - i) <= 2 && Math.abs(p.j - j) <= 2 && Math.max(pen.i0 - p.i, 0, p.i - pen.i1, pen.j0 - p.j, 0, p.j - pen.j1) <= 3){ v *= pen.tier === 3 ? 2.6 : 1.6; break; } }
      viewMap[idx(i, j)] += v; } }
}
const GATE_OUT = () => [tX(GATE.i) + TILE / 2, tZ(GATE.j) + 14];
function spawnGuest(){
  if (guests.length >= QUALITY.guests[QUALITY.level] || G.money < -1e9) return null;
  const [ox, oz] = GATE_OUT(); const g = { id: G.nextId++, x: ox + fr(-3, 3), z: oz + fr(0, 6), hd: Math.PI, state: 'enter', ci: GATE.i + (rnd() < 0.5 ? 0 : 1), cj: GATE.j, pi: -1, pj: -1, ni: -1, nj: -1,
    off: fr(-1.2, 1.2), speed: fr(1.1, 1.5), money: fr(60, 220), happy: fr(55, 75), hunger: fr(0, 0.4), bladder: fr(0, 0.4), stay: fr(2.5, 5), phase: rnd() * TAU, shirt: SHIRTS[(rnd() * SHIRTS.length) | 0], visited: new Set(), moving: 1, gone: false, panicT: 0 };
  g.tx = tX(g.ci) + g.off * 0.5; g.tz = tZ(g.cj);
  guests.push(g); return g;
}
function nextTile(g){
  const opts = []; const leaving = g.state === 'leave' || g.state === 'flee';
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = g.ci + di, jj = g.cj + dj; if (!isPath(ii, jj)) continue; opts.push([ii, jj]); }
  if (!opts.length) return null;
  if (leaving){ let best = null, bd = exitDist[idx(g.ci, g.cj)]; for (const [ii, jj] of opts){ const dd = exitDist[idx(ii, jj)]; if (dd < bd){ bd = dd; best = [ii, jj]; } } return best; }
  let tot = 0; const w = opts.map(([ii, jj]) => { const k = idx(ii, jj); let v = 1 + Math.min(viewMap[k], 200) * 0.03 + (g.visited.has(k) ? 0 : 2); if (ii === g.pi && jj === g.pj) v *= opts.length > 1 ? 0.08 : 1; if (jj === GATE.j && g.state === 'walk') v *= 0.05; tot += v; return v; });
  let r = rnd() * tot; for (let k = 0; k < opts.length; k++){ r -= w[k]; if (r <= 0) return opts[k]; } return opts[opts.length - 1];
}
function shopsNear(i, j){ const out = new Set(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) continue; const k = idx(ii, jj); if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); if (b) out.add(b.type); } } return out; }
function guestArrive(g){
  const k = idx(g.ci, g.cj); g.visited.add(k);
  if (g.state === 'walk'){ const s = shopsNear(g.ci, g.cj);
    if ((s.has('food') || s.has('visitor')) && g.hunger > 0.4 && g.money > 12){ g.money -= 11; g.hunger = 0; g.happy += 4; earn('shops', 11); }
    if ((s.has('restroom') || s.has('visitor')) && g.bladder > 0.45){ g.bladder = 0; g.happy += 4; }
    if ((s.has('gift') || s.has('visitor')) && g.happy > 62 && g.money > 30 && rnd() < (s.has('gift') ? 0.35 : 0.12)){ g.money -= 24; earn('shops', 24); }
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
      g.stay -= hourDt; g.hunger += hourDt * 0.16; g.bladder += hourDt * 0.2; const v = viewMap[idx(clamp(g.ci, 0, GRID - 1), clamp(g.cj, 0, GRID - 1))];
      g.happy += hourDt * ((v > 0 ? Math.min(14, v * 0.12) : -5) - (g.hunger > 0.75 ? 6 : 0) - (g.bladder > 0.85 ? 8 : 0)); g.happy = clamp(g.happy, 0, 100);
      if (g.state === 'walk' && (g.stay <= 0 || g.happy < 18 || G.hour >= CLOSE)) g.state = 'leave';
      const dx = g.tx - g.x, dz = g.tz - g.z, dd = Math.hypot(dx, dz); const sp = g.speed * (g.state === 'flee' ? 1 : 1);
      if (dd < 0.3){
        if (g.state === 'enter'){ g.state = 'walk'; G.stats.guestsTotal++; G.stats.guestsToday++; if (g.money >= G.price){ g.money -= G.price; earn('tickets', G.price); } }
        if (g.exiting){ removeGuest(g); onGuestLeft(g); continue; }
        if ((g.state === 'leave' || g.state === 'flee') && g.cj === GATE.j && (g.ci === GATE.i || g.ci === GATE.i + 1)){ const [ox, oz] = GATE_OUT(); g.tx = ox + fr(-3, 3); g.tz = oz + 10; g.exiting = true; continue; }
        guestArrive(g);
        const nt = nextTile(g); if (!nt){ if (g.state !== 'walk'){ g.stuck = (g.stuck || 0) + dt; if (g.stuck > 4){ removeGuest(g); onGuestLeft(g); } } g.tx = tX(g.ci) + fr(-1.5, 1.5); g.tz = tZ(g.cj) + fr(-1.5, 1.5); }
        else { g.pi = g.ci; g.pj = g.cj; g.ci = nt[0]; g.cj = nt[1]; const di = g.ci - g.pi, dj = g.cj - g.pj; g.tx = tX(g.ci) - dj * g.off; g.tz = tZ(g.cj) + di * g.off; }
      } else { const s = Math.min(dd, sp * dt); g.x += dx / dd * s; g.z += dz / dd * s; g.hd = Math.atan2(dx, dz); }
      g.moving = 1;
    }
    else if (g.state === 'lured'){ const dx = g.tx - g.x, dz = g.tz - g.z, dd = Math.hypot(dx, dz); if (dd < 0.4){ startToss(g); } else { const s = Math.min(dd, 3.4 * dt); g.x += dx / dd * s; g.z += dz / dd * s; g.hd = Math.atan2(dx, dz); } g.moving = 1.4; }
    else if (g.state === 'tossed'){ g.tt += dt / g.tDur; const k = Math.min(1, g.tt); g.x = lerp(g.ax, g.bx, k); g.z = lerp(g.az, g.bz, k); g.yOff = Math.sin(k * Math.PI) * g.arc; g.spin = k * 5; g.moving = 1.5;
      if (k >= 1){ g.state = 'inpen'; g.yOff = 0; g.spin = 0; dust(g.x, g.z, 1.5, 3); } }
    else if (g.state === 'inpen'){ const pen = pens.get(g.pen); const d = g.hunter; g.moving = 1.6;
      if (pen){ const [x0, z0, x1, z1] = penRect(pen, 1.2); let ax = g.x - (d ? d.x : g.x), az = g.z - (d ? d.z : g.z); const al = Math.hypot(ax, az) || 1; ax /= al; az /= al; ax += Math.sin(G.tick * 0.07 + g.id) * 0.6;
        g.tired = (g.tired || 0) + dt; const gs = Math.max(1.2, 3.8 - g.tired * 0.25); g.x = clamp(g.x + ax * gs * dt, x0, x1); g.z = clamp(g.z + az * gs * dt, z0, z1); g.hd = Math.atan2(ax, az); } }
    // write instance
    const y = H(g.x, g.z) + (g.yOff || 0); _gq.setFromAxisAngle(_up, g.hd); if (g.spin){ const t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), g.spin); _gq.multiply(t); }
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
function dispatchCost(){ return [...buildings.values()].some(b => b.type === 'ranger') ? 4000 : 15000; }
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
function earn(cat, amt){ G.money += amt; G.ledger[cat] = (G.ledger[cat] || 0) + amt; }
function spend(cat, amt){ G.money -= amt; G.ledger[cat] = (G.ledger[cat] || 0) + amt; }
const INCOME = ['tickets', 'shops'];
function ledgerProfit(L){ let p = 0; for (const k in L) p += INCOME.includes(k) ? L[k] : -L[k]; return p; }
function appealTotal(){ const seen = {}; let a = 0; for (const d of dinos){ if (d.state === 'holding' || d.state === 'wild') continue; seen[d.sp] = (seen[d.sp] || 0) + 1; a += SPECIES[d.sp].appeal * Math.pow(0.75, seen[d.sp] - 1); } return a; }
function dailyUpkeep(){ let u = 0; for (const b of buildings.values()) u += BUILD[b.type].upkeep || 0; for (const pen of pens.values()) u += pen.segs.length * FT[pen.tier].upkeep; u += dinos.filter(d => d.state !== 'wild').length * 450; return u; }
function guestRatePerHour(){ const ap = appealTotal(); const priceF = clamp(1.6 - G.price / 60, 0.12, 1.5), repF = 0.4 + G.rep / 100, starF = 0.8 + G.stars * 0.12;
  return (22 + ap * 1.7) * priceF * repF * starF * (1 + G.thrill * 0.55) / (CLOSE - OPEN); }
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
  spend('upkeep', dailyUpkeep() / (DAY_END - DAY_START));
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
  G.day++; G.hour = DAY_START; G.stats.guestsToday = 0; for (const g of guests) g.gone = true; guests = [];
  const st = [...buildings.values()].filter(b => b.type === 'ranger').length; G.safety = clamp(G.safety + 4 + st * 3, 0, 100); G.thrill *= 0.5;
  checkMissions(); saveGame(); if (!G.headless) showDaySummary(summary);
}

/* ================= UI ================= */
const IC = {
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
  $('dock').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; SFX.unlock(); SFX.click(); const k = b.dataset.dock; if (sel && sel.kind === k){ closeSheet(); return; } cancelTool();
    if (k === 'pen') openSheet('build', 'pens'); else if (k === 'build') openSheet('build', 'facilities'); else openSheet(k); };
}
function updateDockState(){ for (const b of $('dock').children){ const k = b.dataset.dock; b.classList.toggle('on', !!sel && (sel.kind === k || (k === 'pen' && sel.kind === 'build' && sel.ref === 'pens') || (k === 'build' && sel.kind === 'build' && sel.ref !== 'pens'))); } }
let hudT = 0;
function updateHUD(){
  const mv = $('moneyV'); mv.textContent = fmt(G.money); mv.classList.toggle('neg', G.money < 0);
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
  const cnt = {}; for (const d of loose) cnt[SPECIES[d.sp].short] = (cnt[SPECIES[d.sp].short] || 0) + 1; const names = Object.entries(cnt).map(([n, c]) => c > 1 ? `${c} ${n}s` : n).join(', ');
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
    if (tab === 'pens'){ h += `<div class="note">Pick a fence, then drag a rectangle on open ground. Stronger fences cost more but hold bigger animals. Cheap fences mean breakouts.</div><div class="cards">`;
      FT.forEach((f, t) => { const lock = G.stars < FENCE_STARS[t] && !G.unlockAll; const holds = SP_KEYS.filter(s => SPECIES[s].str <= f.str - 0.75).map(s => SPECIES[s].short);
        h += `<button class="card ${lock ? 'lock' : ''}" data-fence="${t}">${lock ? `<span class="tag">${FENCE_STARS[t]} STARS</span>` : ''}<span class="nm"><span class="swatch" style="background:${f.color}"></span>${f.name}</span><span class="ds">${f.desc}</span><span class="ds">Holds: ${holds.length ? holds.join(', ') : 'nothing dangerous'}</span><span class="pr">${fmt(f.cost)} <small style="font-size:11px;color:var(--bone2)">per tile edge</small></span></button>`; });
      h += `</div>`; }
    else if (tab === 'paths'){ h += `<div class="cards"><button class="card" data-tool="path"><span class="nm">${ic('path')}Footpath</span><span class="ds">Drag to paint gravel paths. Guests only walk on paths connected to the gate.</span><span class="pr">${fmt(BUILD.path.cost)} / tile</span></button>
      <button class="card" data-tool="bulldoze"><span class="nm">${ic('bulldoze')}Bulldoze</span><span class="ds">Drag over paths, or tap a building or enclosure to remove it. Half refund.</span><span class="pr">Refunds 50%</span></button></div>`; }
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
    h += `<div class="btns"><button class="btn" data-act="sell">Sell to a zoo <small>${fmtK(S.cost * 0.4)}</small></button></div></div>`;
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
    if (B.upkeep) h += `<div class="row"><span class="k">Upkeep</span><span class="v">${fmt(B.upkeep)} / day</span></div>`;
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
      <div class="btns"><button class="btn" data-act="tutorial">Tutorial</button><button class="btn" data-act="newgame">New park</button></div></div>`;
  }
  else if (k === 'goals'){
    h += header('Goals', 'goals') + `<div class="bd">` + MISSIONS.map(m => `<div class="mis ${G.missions.includes(m.id) ? 'done' : ''}"><span class="ck">${G.missions.includes(m.id) ? ic('check') : ''}</span><div><b>${m.name}</b><span>${m.desc} Reward ${fmt(m.reward)}.</span></div></div>`).join('') +
      `<div class="lbl" style="margin:12px 0 6px">Unlocks</div><div class="note">${SP_KEYS.map(s => `${SPECIES[s].short}: ${SPECIES[s].stars ? SPECIES[s].stars + ' stars' : 'available'}`).join('<br>')}</div></div>`;
  }
  sh.innerHTML = h; updateDockState();
}
function dinoStatus(d){ if (d.state === 'loose') return 'LOOSE'; if (d.state === 'sedated' || d.state === 'airlift') return 'Sedated'; if (d.state === 'holding') return 'In holding'; if (d.eatT > 0) return 'Eating'; if (d.prey) return 'Hunting'; if (d.hunger > 0.7) return 'Hungry'; if (d.stress > 0.6) return 'Agitated'; return 'Calm'; }
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
  if (act === 'sell'){ const d = sel.ref; G.money += SPECIES[d.sp].cost * 0.4; toast(`${d.name} shipped to a mainland zoo.`, ''); removeDino(d); closeSheet(); return; }
  if (act === 'demob'){ const b = buildings.get(sel.ref); G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); closeSheet(); return; }
  if (act === 'pdown' || act === 'pup'){ G.price = clamp(G.price + (act === 'pup' ? 5 : -5), 0, 150); renderSheet(); return; }
  if (act === 'quality'){ setQuality((QUALITY.level + 2) % 3, true); renderSheet(); return; }
  if (act === 'save'){ saveGame(); toast('Park saved.', 'good'); return; }
  if (act === 'tutorial'){ closeSheet(); showTutorial(0); return; }
  if (act === 'newgame'){ if (!t.dataset.confirm){ t.dataset.confirm = '1'; t.textContent = 'Tap again: erase this park'; return; } localStorage.removeItem(SAVE_KEY); location.reload(); return; }
};
$('speedBtn').onclick = () => { SFX.unlock(); SFX.click(); const i = SPEEDS.indexOf(G.speed); G.speed = SPEEDS[(i + 1) % SPEEDS.length]; updateHUD(); };
$('soundBtn').onclick = () => { SFX.unlock(); SFX.setMuted(!SFX.isMuted()); localStorage.setItem('pp-muted', SFX.isMuted() ? '1' : '0'); updateHUD(); };

/* ---------- day summary / modal ---------- */
function showDaySummary(s){
  const m = $('modal'); const L = s.L;
  const row = (k, v, neg) => `<div class="row"><span class="k">${k}</span><span class="v" ${neg ? 'style="color:#ffb39a"' : ''}>${neg && v ? '-' : ''}${fmt(v)}</span></div>`;
  m.innerHTML = `<div class="box glass"><div class="lbl">End of day ${s.day}</div><h2>Daily Report</h2><div class="sub">${s.guests} guests visited. Rating ${s.stars.toFixed(1)} stars.</div>
    ${row('Ticket sales', L.tickets)}${row('Shops and food', L.shops)}${row('Upkeep and staff', L.upkeep, 1)}${row('Dinosaur feed', L.feed, 1)}${row('Construction', L.build, 1)}${row('Hatching', L.hatch, 1)}${row('Fines and emergencies', L.fines + L.other, 1)}
    <div class="row" style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px"><span class="k"><b>Profit</b></span><span class="v" style="font-family:var(--serif);font-size:20px;color:${s.profit < 0 ? '#ff8a6a' : 'var(--ok)'}">${fmt(s.profit)}</span></div>
    <div class="btns"><button class="btn pri" data-act="ok">Next day</button></div></div>`;
  m.classList.remove('hidden'); m.querySelector('[data-act=ok]').onclick = () => { SFX.click(); m.classList.add('hidden'); };
}

/* ---------- tutorial ---------- */
const TUT = [
  ['Welcome, Director', 'This island is yours to build on. Drag with one finger to orbit the camera, pinch to zoom, and drag with two fingers to pan. On a computer, drag to orbit, right-drag to pan and scroll to zoom.'],
  ['Build an enclosure', 'Tap Enclosure, choose a fence and drag a rectangle beside the main path. Wooden fences are cheap but only hold Parasaurolophus. Bigger animals need stronger fences.'],
  ['Hatch a dinosaur', 'Build a Hatchery from Build. Then tap your enclosure, choose Add dinosaur, and add a feeder that matches its diet. Hungry, crowded or lonely animals get stressed and test their fences.'],
  ['Guests pay the bills', 'Guests arrive at the gate and walk the paths. Dinosaurs they can see near the paths keep them happy. Food stands, restrooms and gift shops earn extra. Watch the safety rating.'],
  ['Your call', 'Carnivore enclosures have a Feed a guest button. It sells a lot of tickets. It also costs reputation and safety, and invites lawsuits. Breakouts happen when you cheap out on fences, so keep rangers nearby.'],
];
function showTutorial(k){
  const el = $('tut'); if (k >= TUT.length){ el.classList.add('hidden'); G.tutorialDone = true; saveGame(); return; }
  el.innerHTML = `<div class="box glass"><div class="step">${k + 1} OF ${TUT.length}</div><h3>${TUT[k][0]}</h3><p>${TUT[k][1]}</p><div class="btns"><button class="btn" data-act="skip">Skip</button><button class="btn pri" data-act="next">${k === TUT.length - 1 ? 'Start building' : 'Next'}</button></div></div>`;
  el.classList.remove('hidden'); el.querySelector('[data-act=skip]').onclick = () => { SFX.click(); showTutorial(99); }; el.querySelector('[data-act=next]').onclick = () => { SFX.unlock(); SFX.click(); showTutorial(k + 1); };
}

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
function hideOverlay(){ overlay.visible = false; outline.visible = false; if (ghost){ scene.remove(ghost); ghost = null; } }
function startTool(t){ tool = t; closeSheet(); TU.uGrid.value = 1; $('dock').classList.add('hidden'); renderToolbar(); $('toolbar').classList.remove('hidden');
  if (t.kind === 'bld'){ ghost = new THREE.Mesh(bldGeo(t.type), ghostMat); ghost.visible = false; scene.add(ghost); } }
function cancelTool(){ if (!tool) return; tool = null; TU.uGrid.value = 0; hideOverlay(); $('toolbar').classList.add('hidden'); if (G.running) $('dock').classList.remove('hidden'); }
function renderToolbar(){
  if (!tool) return; const tb = $('toolbar'); let title = '', hint = '', cost = '', costBad = false, btns = '';
  if (tool.kind === 'path'){ title = 'Footpath'; hint = 'Drag across the ground to paint a path.'; cost = fmt(BUILD.path.cost) + ' / tile'; btns = `<button class="btn pri" data-t="done">Done</button>`; }
  if (tool.kind === 'bulldoze'){ title = 'Bulldoze'; hint = 'Drag over paths. Tap a building or feeder to remove it.'; btns = `<button class="btn pri" data-t="done">Done</button>`; }
  if (tool.kind === 'bld'){ const B = BUILD[tool.type]; title = B.name; hint = B.inPen ? 'Tap a tile inside an enclosure.' : 'Tap open ground next to a path.'; cost = fmt(B.cost); costBad = G.money < B.cost; btns = `<button class="btn pri" data-t="done">Done</button>`; }
  if (tool.kind === 'pen'){ title = 'Enclosure'; const r = tool.rect;
    if (r){ const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); const chk = penCanBuild(i0, j0, i1, j1); const c = penCost(i0, j0, i1, j1, tool.tier);
      hint = chk.ok ? `${i1 - i0 + 1} x ${j1 - j0 + 1} tiles (${(i1 - i0 + 1) * TILE} m x ${(j1 - j0 + 1) * TILE} m)` : chk.why; cost = fmt(c); costBad = !chk.ok || G.money < c;
      btns = tool.pending ? `<button class="btn" data-t="cancel">Cancel</button><button class="btn pri" data-t="confirm" ${costBad ? 'disabled' : ''}>Build</button>` : `<button class="btn" data-t="done">Cancel</button>`; }
    else { hint = 'Drag a rectangle on open ground.'; btns = `<button class="btn" data-t="done">Cancel</button>`; }
  }
  tb.innerHTML = `<div class="top"><div class="t"><b>${title}</b><span>${hint}</span></div>${cost ? `<div class="cost ${costBad ? 'bad' : ''}">${cost}</div>` : ''}</div>` +
    (tool.kind === 'pen' ? `<div class="tiers">${FT.map((f, t) => `<button class="tab ${t === tool.tier ? 'on' : ''}" data-tier="${t}" ${G.stars < FENCE_STARS[t] && !G.unlockAll ? 'disabled style="opacity:.4"' : ''}><span class="swatch" style="background:${f.color}"></span>${f.name}</button>`).join('')}</div>` : '') +
    `<div class="btns" style="margin-top:0">${btns}</div>`;
}
$('toolbar').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; SFX.unlock(); SFX.click();
  if (b.dataset.tier !== undefined){ tool.tier = +b.dataset.tier; if (tool.rect) updatePenPreview(); renderToolbar(); return; }
  const a = b.dataset.t; if (a === 'done'){ const back = tool.kind === 'pen' ? 'pens' : tool.kind === 'bld' && BUILD[tool.type].inPen ? 'care' : tool.kind === 'bld' ? 'facilities' : 'paths'; const penId = tool.pen; cancelTool(); if (penId && pens.has(penId)) openSheet('pen', penId); else if (back === 'paths') {} }
  if (a === 'cancel'){ tool.rect = null; tool.pending = false; hideOverlay(); renderToolbar(); }
  if (a === 'confirm'){ const r = tool.rect; const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); const c = penCost(i0, j0, i1, j1, tool.tier);
    if (penCanBuild(i0, j0, i1, j1).ok && G.money >= c){ spend('build', c); const pen = createPen(i0, j0, i1, j1, tool.tier); afterStructureChange(); SFX.build(); dust((eX(i0) + eX(i1 + 1)) / 2, (eX(j0) + eX(j1 + 1)) / 2, 6, 8); cancelTool(); openSheet('pen', pen.id); toast(`${pen.name} built. Now add a dinosaur and a feeder.`, 'good'); } }
};
function updatePenPreview(){ const r = tool.rect; const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); setOverlay(i0, j0, i1, j1, penCanBuild(i0, j0, i1, j1).ok && G.money >= penCost(i0, j0, i1, j1, tool.tier)); }
let lastPaint = null, paintCount = 0;
function paintTile(i, j, erase){
  if (!inGrid(i, j)) return; const k = idx(i, j);
  if (erase){ if (tileType[k] === T_PATH && !(j === GATE.j && (i === GATE.i || i === GATE.i + 1))){ tileType[k] = T_EMPTY; G.money += BUILD.path.cost * 0.5; paintCount++; } return; }
  if (tileType[k] !== T_EMPTY) return; if (G.money < BUILD.path.cost){ return; } tileType[k] = T_PATH; spend('build', BUILD.path.cost); paintCount++;
}
function paintLine(a, b, erase){ let [x0, y0] = a; const [x1, y1] = b; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy;
  for (let n = 0; n < 200; n++){ paintTile(x0, y0, erase); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy){ err -= dy; x0 += sx; } else if (e2 < dx){ err += dx; y0 += sy; } } }
function toolDown(p){ const t = tileAtScreen(p.x, p.y); if (!t) return;
  if (tool.kind === 'path' || tool.kind === 'bulldoze'){ paintCount = 0; lastPaint = t; paintLine(t, t, tool.kind === 'bulldoze'); drawMask(); }
  if (tool.kind === 'pen'){ tool.rect = [t[0], t[1], t[0], t[1]]; tool.pending = false; updatePenPreview(); renderToolbar(); }
  if (tool.kind === 'bld') toolHover(t);
}
function toolMove(p){ const t = tileAtScreen(p.x, p.y); if (!t) return;
  if ((tool.kind === 'path' || tool.kind === 'bulldoze') && lastPaint && (t[0] !== lastPaint[0] || t[1] !== lastPaint[1])){ paintLine(lastPaint, t, tool.kind === 'bulldoze'); lastPaint = t; drawMask(); }
  if (tool.kind === 'pen' && tool.rect){ tool.rect[2] = t[0]; tool.rect[3] = t[1]; updatePenPreview(); renderToolbar(); }
  if (tool.kind === 'bld') toolHover(t);
}
function toolUp(p, tapped){
  if (tool.kind === 'path' || tool.kind === 'bulldoze'){ if (paintCount){ afterStructureChange(); SFX.build(); } else if (tapped && tool.kind === 'bulldoze') bulldozeTap(p); lastPaint = null; }
  if (tool.kind === 'pen' && tool.rect){ tool.pending = true; renderToolbar(); }
  if (tool.kind === 'bld' && tapped){ const t = tileAtScreen(p.x, p.y); if (t) tryPlace(t); }
}
function toolHover(t){ const ty = tool.type, [w, h] = footprint(ty, 0); const i = t[0] - Math.floor((w - 1) / 2), j = t[1] - Math.floor((h - 1) / 2); const chk = canPlace(ty, i, j); setOverlay(i, j, i + w - 1, j + h - 1, chk.ok && G.money >= BUILD[ty].cost);
  if (ghost){ ghost.visible = true; const cx = tX(i) + (w - 1) * TILE / 2, cz = tZ(j) + (h - 1) * TILE / 2; ghost.position.set(cx, H(cx, cz), cz); ghost.rotation.y = BUILD[ty].inPen ? 0 : faceRot(i, j, w, h); ghostMat.color.set(chk.ok ? 0xb8ffb0 : 0xff8a6a); } tool.hover = [i, j, chk]; }
function tryPlace(t){ toolHover(t); const [i, j, chk] = tool.hover; const B = BUILD[tool.type];
  if (!chk.ok){ toast(chk.why, 'bad'); return; } if (G.money < B.cost){ toast('Not enough funds.', 'bad'); return; }
  spend('build', B.cost); const b = placeBuilding(tool.type, i, j); SFX.build(); dust(b.x, b.z, 4, 6); afterStructureChange();
  if (['food', 'gift', 'restroom', 'hatchery', 'ranger'].includes(tool.type) && !b.rot && !isPath(i, j + b.h)) { const any = faceRot(i, j, b.w, b.h) !== 0 || [[0, -1], [-1, 0], [b.w, 0]].some(([di, dj]) => isPath(i + di, j + dj)); if (!any && tool.type !== 'hatchery' && tool.type !== 'ranger') toast('Tip: shops must touch a path to get customers.', ''); }
  if (tool.type === 'hatchery' && !G.tutHatch){ G.tutHatch = true; toast('Hatchery ready. Tap an enclosure and choose Add dinosaur.', 'good'); }
}
function bulldozeTap(p){ const t = tileAtScreen(p.x, p.y); if (!t) return; const k = idx(t[0], t[1]);
  if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); if (b && !BUILD[b.type].fixed){ G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); SFX.build(); } else toast('That cannot be removed.', ''); }
  else if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen.feeders.find(f => f.i === t[0] && f.j === t[1]); if (f){ const b = buildings.get(f.id); G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); } else toast('Open the enclosure to demolish it.', ''); }
}
function afterStructureChange(){ drawMask(); computeExitField(); rebuildFences(); refreshVegetation(); computeViewMap(); }

/* ================= camera + input ================= */
const cam = { tx: 0, tz: 40, yaw: 0.5, pitch: 0.62, dist: 210, goal: { tx: 0, tz: 40, yaw: 0.5, pitch: 0.62, dist: 210 }, shake: 0, follow: null };
const title = { on: true };
function focusOn(x, z, dist){ cam.goal.tx = x; cam.goal.tz = z; if (dist) cam.goal.dist = clamp(dist, 12, 330); }
function updateCamera(dt){
  const g = cam.goal; if (cam.follow){ if (!dinos.includes(cam.follow) || !cam.follow.model.root.visible) cam.follow = null; else { g.tx = cam.follow.x; g.tz = cam.follow.z; } }
  if (title.on){ g.yaw += dt * 0.04; }
  g.pitch = clamp(g.pitch, 0.1, 1.45); g.dist = clamp(g.dist, 12, 330); g.tx = clamp(g.tx, -HALF - 40, HALF + 40); g.tz = clamp(g.tz, -HALF - 60, HALF + 40);
  const k = 10; cam.tx = damp(cam.tx, g.tx, k, dt); cam.tz = damp(cam.tz, g.tz, k, dt); cam.dist = damp(cam.dist, g.dist, k, dt); cam.pitch = damp(cam.pitch, g.pitch, k, dt);
  let dy = g.yaw - cam.yaw; cam.yaw += dy * (1 - Math.exp(-k * dt));
  const ty = Math.max(H(cam.tx, cam.tz), 0) + (cam.follow ? SPECIES_DATA[cam.follow.sp].size * 0.2 : 0.5);
  const cp = Math.cos(cam.pitch); let px = cam.tx + Math.sin(cam.yaw) * cp * cam.dist, pz = cam.tz + Math.cos(cam.yaw) * cp * cam.dist, py = ty + Math.sin(cam.pitch) * cam.dist;
  const floor = Math.max(H(px, pz), 0) + 2.5; if (py < floor){ py = floor; }
  cam.shake = Math.max(0, cam.shake - dt * 1.5); const sh = cam.shake * cam.shake;
  camera.position.set(px + (rnd() - 0.5) * sh, py + (rnd() - 0.5) * sh, pz + (rnd() - 0.5) * sh); camera.lookAt(cam.tx, ty, cam.tz);
}
const raycaster = new THREE.Raycaster(); const _ndc = new THREE.Vector2();
function groundAtScreen(x, y){
  _ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); raycaster.setFromCamera(_ndc, camera); const o = raycaster.ray.origin, d = raycaster.ray.direction;
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
  const t = tileAtScreen(x, y); if (!t){ closeSheet(); return; } const k = idx(t[0], t[1]);
  if (tileType[k] === T_BUILD){ SFX.click(); openSheet('building', tileRef[k]); return; }
  if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen.feeders.find(f => f.i === t[0] && f.j === t[1]); SFX.click(); if (f) openSheet('building', f.id); else openSheet('pen', pen.id); return; }
  closeSheet();
}
const ptrs = new Map(); let gesture = null;
function pinchInfo(){ const a = [...ptrs.values()]; const cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2; return { cx, cy, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), ang: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) }; }
canvas.addEventListener('pointerdown', (e) => {
  SFX.unlock(); canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), btn: e.button });
  if (title.on) return;
  if (ptrs.size === 1){ gesture = { kind: e.button === 2 || e.button === 1 ? 'pan' : 'one', moved: false, tool: false };
    if (tool && gesture.kind === 'one' && tool.kind !== 'bld'){ gesture.tool = true; toolDown(ptrs.get(e.pointerId)); } }
  else if (ptrs.size === 2){ if (gesture && gesture.tool && tool && tool.kind === 'pen' && !tool.pending){ tool.rect = null; hideOverlay(); renderToolbar(); } if (gesture && gesture.tool && tool && (tool.kind === 'path' || tool.kind === 'bulldoze') && paintCount) afterStructureChange(); gesture = { kind: 'two', moved: true, last: pinchInfo() }; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p){ if (tool && tool.kind === 'bld' && e.pointerType === 'mouse'){ const t = tileAtScreen(e.clientX, e.clientY); if (t) toolHover(t); } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (!gesture || title.on) return;
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > 7) gesture.moved = true;
  if (gesture.kind === 'one'){ if (gesture.tool){ toolMove(p); return; } if (!gesture.moved) return; if (tool && tool.kind === 'bld'){ toolHover(tileAtScreen(p.x, p.y) || [0, 0]); }
    cam.goal.yaw += dx * 0.0065; cam.goal.pitch = clamp(cam.goal.pitch + dy * 0.005, 0.1, 1.45); cam.follow = null; }
  else if (gesture.kind === 'pan'){ panBy(dx, dy); }
  else if (gesture.kind === 'two' && ptrs.size >= 2){ const n = pinchInfo(), l = gesture.last; panBy(n.cx - l.cx, n.cy - l.cy); if (l.d > 10) cam.goal.dist = clamp(cam.goal.dist * l.d / n.d, 12, 330); let da = n.ang - l.ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; cam.goal.yaw -= da; gesture.last = n; }
});
function panBy(dx, dy){ const s = cam.goal.dist * 0.0018 * (900 / Math.max(innerHeight, 400)); const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); cam.goal.tx += (-dx * cy - dy * sy) * s; cam.goal.tz += (dx * sy - dy * cy) * s; cam.follow = null; }
function endPtr(e){ const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
  if (gesture && ptrs.size === 0){ const tapped = !gesture.moved && performance.now() - p.t < 450 && gesture.kind === 'one';
    if (tool){ if (gesture.tool || tool.kind === 'bld') toolUp(p, tapped); }
    else if (tapped) tap(p.x, p.y);
    gesture = null; }
  else if (ptrs.size === 1 && gesture && gesture.kind === 'two'){ gesture = { kind: 'one', moved: true, tool: false }; } }
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
  const paths = []; for (let k = 0; k < tileType.length; k++) if (tileType[k] === T_PATH) paths.push(k);
  const g = {}; for (const k in G) if (!['running', 'feeding', 'headless', 'score', 'avgHappy', 'tick', 'unlockAll', 'spawnAcc'].includes(k)) g[k] = G[k];
  return { v: 1, G: g, paths,
    buildings: [...buildings.values()].map(b => ({ id: b.id, type: b.type, i: b.i, j: b.j, rot: b.rot, pen: b.pen })),
    pens: [...pens.values()].map(p => ({ id: p.id, i0: p.i0, j0: p.j0, i1: p.i1, j1: p.j1, tier: p.tier, name: p.name, segs: p.segs.map(s => +s.cond.toFixed(3)), broken: p.segs.map((s, k) => s.broken ? k : -1).filter(k => k >= 0) })),
    dinos: dinos.map(d => ({ id: d.id, sp: d.sp, pen: d.pen, x: +d.x.toFixed(2), z: +d.z.toFixed(2), hunger: +d.hunger.toFixed(3), name: d.name, fedSkip: d.fedSkip, state: d.state === 'pen' ? 'pen' : 'holding' })),
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
  eggs = S.eggs || []; G.hour = Math.max(G.hour, DAY_START); afterStructureChange(); return true;
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
  if (G.hour >= OPEN && G.hour < CLOSE){ G.spawnAcc = (G.spawnAcc || 0) + guestRatePerHour() * hourDt; while (G.spawnAcc >= 1){ G.spawnAcc--; spawnGuest(); } }
  for (const d of dinos.slice()) updateDino(d, gdt);
  updateGuests(gdt, hourDt); updateEggs(gdt); updateJeeps(gdt); G.feedCooldown = Math.max(0, G.feedCooldown - gdt);
  if (G.hour >= DAY_END) endDay();
}
function frame(now){
  requestAnimationFrame(frame); const t0 = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); last = now; M.WIND.value += dt;
  const modalOpen = !$('modal').classList.contains('hidden') || !$('tut').classList.contains('hidden');
  if (G.running && G.speed > 0 && !modalOpen){ let gdt = dt * G.speed; while (gdt > 0){ const s = Math.min(gdt, 0.05); simulate(s); gdt -= s; } }
  else for (const d of dinos){ if (d.model.root.visible){ d.model.animate(dt, 0, 0); } }
  updateWild(dt); keyCamera(dt); updateCamera(dt); applyLighting(); updateParticles(dt); updateSmoke(dt);
  if (rebuildFencesSoon){ rebuildFencesSoon = false; rebuildFences(); }
  if (gateMesh && gateMesh.userData.flames) for (const f of gateMesh.userData.flames){ const k = 0.85 + Math.sin(now * 0.017 + f.id) * 0.1 + Math.sin(now * 0.041) * 0.05; f.scale.set(1.6 * k, 2.2 * k, 1); }
  updateWarnMarkers(now / 1000);
  hudT -= dt; if (hudT <= 0 && G.running){ hudT = 0.25; updateHUD(); }
  viewT -= dt; if (viewT <= 0){ viewT = 1; computeViewMap(); SFX.setCrowd(G.running ? clamp(guestsInPark() / 160, 0, 1) * clamp(1.4 - cam.dist / 250, 0.2, 1) : 0); if (rnd() < 0.25) SFX.bird(); }
  starT -= dt; if (starT <= 0 && G.running){ starT = 1; G.stars = computeStars(); checkMissions(); }
  sheetT -= dt; if (sheetT <= 0){ sheetT = 1; if (sel && ['pen', 'dino', 'park', 'dinos'].includes(sel.kind)) refreshSheet(); }
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
  focus: focusOn, openSheet, closeSheet, setSpeed(s){ G.speed = s; }, setHour(h){ G.hour = h; }, setQuality, sim(sec){ let t = sec; while (t > 0){ const s = Math.min(t, 0.05); simulate(s); updateWild(s); t -= s; } }, tick(){ updateCamera(0.05); applyLighting(); renderer.render(scene, camera); },
  hourly(){ hourTick(); }, ready: false,
};

/* ================= init ================= */
function init(){
  const m = localStorage.getItem('pp-muted'); if (m === '1') SFX.setMuted(true);
  computeBuildable(); scatterVegetation(); buildEnv(); prewarm(SP_KEYS);
  if (!loadGame()) newGame(false);
  setQuality(QUALITY.level); buildDock(); makeThumbs(); spawnWild();
  cam.goal.tx = 0; cam.goal.tz = 30; cam.goal.dist = 230; cam.goal.pitch = 0.42; Object.assign(cam, { tx: 0, tz: 30, dist: 230, pitch: 0.42, yaw: 0.5 });
  if (QS.has('play')){ startPlaying(false); $('tut').classList.add('hidden'); } else showTitle();
  const waitTex = () => { if (texPending > 0) return setTimeout(waitTex, 50); $('loading').classList.add('hidden'); window.__DP.ready = true; };
  waitTex(); requestAnimationFrame(frame);
}
init();
