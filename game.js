/* Primeval Park v1 - a dinosaur park tycoon. Three.js r160 (vendored), no build step. */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { Dino, SPECIES_DATA, prewarm, setDinoCamera, setDinoQuality, SCHEMES, PATTERNS } from './dino.js';
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
// v9 bigger island: the build grid grows OFF tiles on every side (negative tile indices), so v8 tile coordinates, saves and the gate stay valid
const OFF = 80, GN = GRID + 2 * OFF, LO = -OFF, HI = GRID + OFF, WHALF = GN * TILE / 2; // v11: a much larger island; i,j of the original park are unchanged
const inGrid = (i, j) => i >= LO && j >= LO && i < HI && j < HI;
const kI = k => k % GN - OFF, kJ = k => ((k / GN) | 0) - OFF;
const EXPAND_COST = 150000;
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
Object.assign(SPECIES, { // v9 species. hab: where it lives (default: land or lake enclosures)
  galli:   { name: 'Gallimimus', short: 'Gallimimus', diet: 'plant', str: 1.2, appeal: 30, cost: 18000, hatch: 25, space: 8, group: [4, 10], stars: 0.5, walk: 3.0, run: 14, darts: 1, feed: 220, desc: 'Ostrich-like sprinter. Flocks bolt as one.' },
  pachy:   { name: 'Pachycephalosaurus', short: 'Pachycephalosaurus', diet: 'plant', str: 2.2, appeal: 30, cost: 22000, hatch: 30, space: 8, group: [2, 6], stars: 1, walk: 2.2, run: 7, darts: 2, feed: 300, desc: 'Dome-headed. Settles arguments by head-butt.' },
  theri:   { name: 'Therizinosaurus', short: 'Therizinosaurus', diet: 'plant', str: 3.6, appeal: 62, cost: 66000, hatch: 45, space: 16, group: [1, 3], stars: 2, walk: 1.8, run: 5, darts: 3, feed: 900, desc: 'Pot-bellied plant eater with metre-long claws.' },
  carno:   { name: 'Carnotaurus', short: 'Carnotaurus', diet: 'meat', str: 4.1, appeal: 66, cost: 70000, hatch: 45, space: 16, group: [1, 2], stars: 2.5, walk: 2.8, run: 11, darts: 3, feed: 1100, desc: 'Horned sprinter with tiny arms. Built for speed.' },
  allo:    { name: 'Allosaurus', short: 'Allosaurus', diet: 'meat', str: 4.6, appeal: 72, cost: 78000, hatch: 50, space: 20, group: [1, 3], stars: 2.5, walk: 2.8, run: 9, darts: 3, feed: 1300, desc: 'Jurassic apex hunter. Hunts in small groups.' },
  diplo:   { name: 'Diplodocus', short: 'Diplodocus', diet: 'plant', str: 4.2, appeal: 70, cost: 95000, hatch: 55, space: 34, group: [1, 4], stars: 3, walk: 2.0, run: 4, darts: 4, feed: 1300, desc: 'Twenty-four metres of neck and whip tail.' },
  ptera:   { name: 'Pteranodon', short: 'Pteranodon', diet: 'meat', hab: 'aviary', str: 1.6, appeal: 48, cost: 42000, hatch: 35, space: 6, group: [2, 8], stars: 1.5, walk: 1.2, run: 3, fly: 9, darts: 1, feed: 350, desc: 'Seven-metre wings, toothless beak. Needs an aviary of chain-link or better.' },
  dimor:   { name: 'Dimorphodon', short: 'Dimorphodon', diet: 'meat', hab: 'aviary', str: 1.0, appeal: 26, cost: 16000, hatch: 25, space: 3, group: [3, 10], stars: 1, walk: 1.0, run: 3, fly: 7, darts: 1, feed: 120, desc: 'Small big-headed flier with sharp teeth. Lives in an aviary.' },
  sarco:   { name: 'Sarcosuchus', short: 'Sarcosuchus', diet: 'meat', hab: 'lake', str: 4.0, appeal: 60, cost: 72000, hatch: 45, space: 16, group: [1, 2], stars: 2.5, walk: 1.2, run: 5, swim: 4, darts: 3, feed: 900, desc: 'The SuperCroc. Twelve metres, ambushes from the water. Needs a lake enclosure.' },
  spino:   { name: 'Spinosaurus', short: 'Spinosaurus', diet: 'meat', hab: 'lake', str: 5.5, appeal: 100, cost: 140000, hatch: 60, space: 30, group: [1, 1], stars: 3.5, walk: 2.4, run: 6, swim: 4, darts: 4, feed: 1800, desc: 'Sail-backed river giant. Wades and fishes. Needs a lake enclosure.' },
  elasmo:  { name: 'Elasmosaurus', short: 'Elasmosaurus', diet: 'meat', hab: 'lagoon', str: 3.0, appeal: 80, cost: 110000, hatch: 50, space: 40, group: [1, 3], stars: 3, walk: 0, run: 0, swim: 4.5, darts: 3, feed: 1200, desc: 'Plesiosaur with a seven-metre neck. Lives in an ocean lagoon.' },
  mosa:    { name: 'Mosasaurus', short: 'Mosasaurus', diet: 'meat', hab: 'lagoon', str: 6.5, appeal: 115, cost: 160000, hatch: 60, space: 60, group: [1, 1], stars: 3.5, walk: 0, run: 0, swim: 7, darts: 4, feed: 2200, desc: 'Thirteen-metre sea monster. Lives in an ocean lagoon. Feeding time draws crowds.' },
});
const SP_KEYS = ['para', 'galli', 'trike', 'stego', 'pachy', 'dilo', 'ankylo', 'raptor', 'theri', 'brachio', 'carno', 'allo', 'diplo', 'trex', 'dimor', 'ptera', 'sarco', 'spino', 'elasmo', 'mosa'];
const SP_V8 = ['para', 'trike', 'stego', 'dilo', 'ankylo', 'raptor', 'brachio', 'trex'];
// v9 food: each species eats these feeder types, best first (first = preferred)
const FOODS = { para: ['plant', 'browse'], trike: ['plant'], stego: ['plant'], dilo: ['insect', 'meat', 'fish'], ankylo: ['plant'], raptor: ['goat', 'meat', 'insect'], brachio: ['browse', 'plant'], trex: ['goat', 'meat'],
  galli: ['plant', 'insect'], pachy: ['plant'], theri: ['browse', 'plant'], carno: ['goat', 'meat'], allo: ['goat', 'meat'], diplo: ['browse', 'plant'], ptera: ['fish'], dimor: ['insect', 'fish'], sarco: ['fish', 'meat', 'goat'], spino: ['fish', 'meat'], elasmo: ['fish'], mosa: ['fish', 'meat'] };
const FEEDER_TYPES = ['plant', 'browse', 'meat', 'goat', 'fish', 'insect'];
const FEED_MULT = { plant: 1, browse: 1.2, meat: 1, goat: 1.3, fish: 1.1, insect: 0.8 };
// v9 predation: rough body mass (t), how hard each animal fights back, and how much a pack adds per extra hunter
const WT = { para: 3, trike: 9, stego: 5, dilo: 0.4, ankylo: 6, raptor: 0.3, brachio: 40, trex: 8, galli: 0.45, pachy: 0.45, theri: 5, carno: 1.5, allo: 2.3, diplo: 15, ptera: 0.03, dimor: 0.005, sarco: 8, spino: 7, elasmo: 3, mosa: 15 };
const DEFENSE = { ankylo: 0.6, trike: 0.55, stego: 0.45, brachio: 0.5, diplo: 0.5, theri: 0.45, pachy: 0.25, para: 0.1, galli: 0.05, sarco: 0.35, spino: 0.3, allo: 0.2, carno: 0.2, raptor: 0.15, dilo: 0.1, elasmo: 0.1, trex: 0.3 };
const PACK = { raptor: 1.5, dilo: 0.8, allo: 0.6, carno: 0.3 };
const PEN_KINDS = { land: { name: 'Standard', desc: 'Open ground for land animals.' }, aviary: { name: 'Aviary', desc: 'Netted dome for pterosaurs. A cheap or damaged aviary lets them out to swoop at guests.' },
  lake: { name: 'Lake', desc: 'Fenced ground around a freshwater lake. For Spinosaurus and Sarcosuchus; land animals can share it. Needs 5 x 5 or more, and can only be built in the River Valley.' },
  lagoon: { name: 'Ocean Lagoon', desc: 'Sea nets on open water of the Beach Coast, away from the ferry lane. For Mosasaurus and Elasmosaurus. Only on the Beach Coast.' } };
const habOf = sp => SPECIES[sp].hab || 'land';
function habOk(sp, pen){ if (!pen) return false; const h = habOf(sp), k = pen.kind || 'land'; return h === 'land' ? (k === 'land' || k === 'lake') : h === k; }
const HAB_NAME = { land: 'a standard or lake enclosure', aviary: 'an aviary', lake: 'a lake enclosure', lagoon: 'an ocean lagoon' };
const BUILD = {
  path:     { name: 'Footpath', cost: 150, desc: 'Guests walk on paths. Tap point to point.', stars: 0 },
  hatchery: { name: 'Hatchery', cost: 60000, upkeep: 900, idleUpkeep: 200, desc: 'Incubates dinosaur eggs. Two at a time. Costs little while empty.', stars: 0 },
  ranger:   { name: 'Ranger Station', cost: 40000, upkeep: 1200, desc: 'Maintains nearby fences. Cheaper, faster containment.', stars: 0 },
  food:     { name: 'Food Stand', cost: 9000, upkeep: 300, desc: 'Burgers for hungry guests ($14). Must face a path.', stars: 0 },
  pizza:    { name: 'Pizza Stand', cost: 11000, upkeep: 340, desc: 'Big slices for hungry guests ($16). Must face a path.', stars: 0 },
  drinks:   { name: 'Cold Drinks', cost: 4500, upkeep: 140, desc: 'Soda and water for thirsty guests ($5). Must face a path.', stars: 0 },
  coffee:   { name: 'Coffee Kiosk', cost: 5000, upkeep: 150, desc: 'Coffee and iced tea for thirsty guests ($6). Must face a path.', stars: 0 },
  icecream: { name: 'Ice Cream Cart', cost: 6000, upkeep: 180, desc: 'Cools thirsty guests and cheers them up ($8). Must face a path.', stars: 0 },
  restaurant: { name: 'Fossil Grill', cost: 42000, upkeep: 900, desc: 'Sit-down restaurant, 2 x 2: food and drink in one ($28). Guests leave very happy.', stars: 1.5 },
  stand:    { name: 'Lagoon Grandstand', cost: 30000, upkeep: 250, desc: 'Seating beside an ocean lagoon or lake enclosure. Greatly raises its appeal.', stars: 2 },
  restroom: { name: 'Restrooms', cost: 6000, upkeep: 200, desc: 'Keeps guests comfortable. Must face a path.', stars: 0 },
  gift:     { name: 'Gift Shop', cost: 14000, upkeep: 400, desc: 'Plush raptors at premium prices.', stars: 0.5 },
  viewing:  { name: 'Viewing Platform', cost: 12000, upkeep: 150, desc: 'Raises the appeal of nearby enclosures.', stars: 1 },
  meat:     { name: 'Meat Feeder', cost: 8000, upkeep: 200, desc: 'Place inside an enclosure. Feeds carnivores.', stars: 0, inPen: true },
  plant:    { name: 'Plant Feeder', cost: 5000, upkeep: 120, desc: 'Place inside an enclosure. Feeds herbivores.', stars: 0, inPen: true },
  water:    { name: 'Water Hole', cost: 3000, upkeep: 40, desc: 'Place inside an enclosure. Every land animal and pterosaur needs to drink. Lakes and lagoons have their own water.', stars: 0, inPen: true },
  browse:   { name: 'Browse Tower', cost: 12000, upkeep: 220, desc: 'Inside an enclosure. Fresh treetop leaves: sauropods and Therizinosaurus prefer it.', stars: 0, inPen: true },
  goat:     { name: 'Live Goat Corral', cost: 14000, upkeep: 350, desc: 'Inside an enclosure. Big carnivores prefer the hunt.', stars: 1, inPen: true },
  fish:     { name: 'Fish Chute', cost: 9000, upkeep: 220, desc: 'Inside an enclosure or lagoon. For Spinosaurus, Sarcosuchus, marine reptiles and pterosaurs.', stars: 0, inPen: true },
  insect:   { name: 'Insect Box', cost: 4000, upkeep: 90, desc: 'Inside an enclosure. Grubs for small quick species: Dilophosaurus, Dimorphodon, Gallimimus.', stars: 0, inPen: true },
  station:  { name: 'Monorail Station', cost: 24000, upkeep: 350, desc: 'Elevated platform, 2 x 2, must touch a path. Link two stations with Monorail track to carry guests over the ridge.', stars: 0, noMove: true },
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
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 5000); setDinoCamera(camera);
const FOG_COL = new THREE.Color(0xbfd0c8);
scene.fog = new THREE.FogExp2(FOG_COL.clone(), 0.00115);
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
// v9: the island reaches ~95 m further east, west and north (never south, so the pier and ferry lanes stay open water)
function coastR9(x, z){ const r = Math.hypot(x, z) || 1; return coastR(x, z) + 95 * sstep(0.3, -0.15, z / r); }
const LAKES = []; // v9 lake enclosures carve a basin into the terrain: { x0, z0, x1, z1, wl (water level), depth, shore }
function H(x, z){ let h = Hgen(x, z, true); for (let n = 0; n < LAKES.length; n++){ const L = LAKES[n]; if (x <= L.x0 || x >= L.x1 || z <= L.z0 || z >= L.z1) continue;
  const e = Math.min(x - L.x0, L.x1 - x, z - L.z0, L.z1 - z) * clamp(0.3 + fbm(x * 0.05 + 7, z * 0.05 + 3) * 1.4, 0.25, 1.8); h = lerp(h, Math.min(h, L.wl - L.depth), sstep(0, L.shore, e)); }
  for (let n = 0; n < PADS.length; n++){ const P = PADS[n]; if (x <= P.x0 - P.sk || x >= P.x1 + P.sk || z <= P.z0 - P.sk || z >= P.z1 + P.sk) continue; const dx = Math.max(P.x0 - x, 0, x - P.x1), dz = Math.max(P.z0 - z, 0, z - P.z1); h = lerp(P.h, h, sstep(0, P.sk, Math.hypot(dx, dz))); }
  return h; }
const PADS = []; // v10: graded building pads on rough expansion ground { x0, z0, x1, z1, h, sk }
const H0 = (x, z) => Hgen(x, z, false); // H0: the v8 island, used to tell old land from new
function Hgen(x, z, nw){
  const d = Math.hypot(x, z * 0.96), R = nw ? coastR9(x, z) : coastR(x, z);
  const land = sstep(R + 18, R - 16, d);
  let h = lerp(-7, 1.7, land) + (fbm(x * 0.017 + 3, z * 0.017 + 7) - 0.5) * 2.4 * land;
  // gate plaza flattening near the south entrance
  const pd = Math.hypot(x - 0, z - 100); if (pd < 40) h = lerp(h, Math.max(h, 1.1), sstep(40, 14, pd));
  const vd = Math.hypot(x - VOLC.x, z - VOLC.z);
  if (nw){ h += roughAdd(x, z, land); h -= sstep(R + 30, R + 110, d) * 14; } // v10: the expansion is rough country; the seabed shelves away offshore
  if (vd < VOLC.r){ const k = 1 - vd / VOLC.r; let c = VOLC.h * Math.pow(k, 1.7) * (0.82 + 0.36 * fbm(x * 0.03, z * 0.03)); if (vd < 13) c -= (13 - vd) * 1.6; h = Math.max(h, c - 1.5 + land * 0); }
  // ridges on west/east rims beyond the plot
  if (!nw){ const rim = Math.max(Math.abs(x) - 118, 0); if (rim > 0) h += rim * 0.25 * fbm(x * 0.05, z * 0.05) * land; }
  if (nw) h = addV11Land(h, x, z);
  return h;
}
// v10: a rocky ridge rings the original park (paths cannot cross it, only the monorail), then broken hills, terraced cliffs and ravines out to the new coast
let _rb = 0, _ri = 0, OLDD = null;
// distance (m) from every grid cell centre to the nearest original-park tile, so the ridge hugs the old land exactly
function oldDistField(){ const N = 104, O = 24, D = new Float32Array(N * N).fill(1e4); const q = [];
  for (let j = 0; j < 56; j++) for (let i = 0; i < 56; i++){ const x0 = i * 4 - 112, z0 = j * 4 - 112; let mn = 1e9, mx = -1e9; for (const [a, b] of [[0, 0], [4, 0], [0, 4], [4, 4], [2, 2]]){ const h = Hgen(x0 + a, z0 + b, false); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    if (!(mn < 0.55 || mx > 7 || mx - mn > 1.9)){ const k = (j + O) * N + i + O; D[k] = 0; q.push(k); } }
  const st = [[1, 0, 4], [-1, 0, 4], [0, 1, 4], [0, -1, 4], [1, 1, 5.657], [-1, 1, 5.657], [1, -1, 5.657], [-1, -1, 5.657]];
  for (let h = 0; h < q.length; h++){ const k = q[h], i = k % N, j = (k / N) | 0; for (const [di, dj, c] of st){ const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const kk = jj * N + ii; if (D[kk] > D[k] + c + 0.01){ D[kk] = D[k] + c; q.push(kk); } } }
  return D; }
function oldDist(x, z){ if (!OLDD) OLDD = oldDistField(); const fx = (x + 208) / 4 - 0.5, fz = (z + 208) / 4 - 0.5; const cx = clamp(fx, 0, 103), cz = clamp(fz, 0, 103), ex = Math.hypot(fx - cx, fz - cz) * 4;
  const i = Math.min(102, Math.floor(cx)), j = Math.min(102, Math.floor(cz)), u = cx - i, v = cz - j, D = OLDD;
  return lerp(lerp(D[j * 104 + i], D[j * 104 + i + 1], u), lerp(D[(j + 1) * 104 + i], D[(j + 1) * 104 + i + 1], u), v) + ex; }
function roughInfo(x, z){ const r = Math.hypot(x, z) || 1, s = z / r; const q = oldDist(x, z) - 2; // metres outside the original park
  _rb = sstep(1.5, 9, q) * sstep(34, 20, q) * sstep(0.45, 0.05, s); _ri = sstep(12, 28, q) * sstep(0.3, -0.15, s); }
function roughAdd(x, z, land){ roughInfo(x, z); let a = 0;
  if (_rb > 0) a += _rb * land * (10 + 10 * fbm(x * 0.04 + 21, z * 0.04 + 3) + 4 * noise2(x * 0.15, z * 0.15));
  if (_ri > 0){ let b = 3 + 13 * fbm(x * 0.011 + 31, z * 0.011 + 11); const rd = 1 - Math.abs(2 * noise2(x * 0.028 + 5, z * 0.028 + 2) - 1); b += rd * rd * 7;
    const t = b / 3.4, f = t - Math.floor(t), tr = (Math.floor(t) + sstep(0.3, 0.7, f)) * 3.4; b = lerp(b, tr, sstep(0.4, 0.6, fbm(x * 0.02 + 2, z * 0.02 + 8))); // terraces: cliff bands
    const rv = Math.abs(fbm(x * 0.008 + 5, z * 0.008 + 9) - 0.5); b -= sstep(0.045, 0, rv) * (b + 4); // ravines
    a += _ri * land * b; }
  return a; }

/* ---------- v11: distant landmasses beyond the v10 coast, joined by forested isthmuses.
   Existing park and highland heights are left alone (blend starts past coastR9). ---------- */
const VOLC2 = { x: 40, z: -400, r: 190, h: 200 };
function lobeN(x, z, cx, cz, rx, rz){ return 1 - Math.hypot((x - cx) / rx, (z - cz) / rz); }
function distSeg(x, z, ax, az, bx, bz){ const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
function riverDist(x, z){ let d = 1e9; const pts = [[-250, -20], [-300, 0], [-360, -40], [-390, -100], [-370, -160], [-400, -200]];
  for (let i = 0; i < pts.length - 1; i++){ const w = 10 * Math.sin(x * 0.04 + i); d = Math.min(d, distSeg(x, z, pts[i][0], pts[i][1] + w, pts[i + 1][0], pts[i + 1][1])); } return d; }
const APPR_SEGS = [
  [-100, 78, -160, 86], [-160, 86, -260, 78], [-260, 78, -330, 10], [-330, 10, -350, -30],
  [130, -90, 230, -90], [230, -90, 260, -180], [260, -180, 300, -240],
  [230, -180, 180, -260], [180, -260, 80, -280], [80, -280, 50, -340],
  [120, 82, 240, 60], [240, 60, 300, 40]
];
function apprDist(x, z){ let d = 1e9; for (const S of APPR_SEGS) d = Math.min(d, distSeg(x, z, S[0], S[1], S[2], S[3])); return d; }
let USE_APPR = true;
function addV11Land(h, x, z){
  const d0 = Math.hypot(x, z * 0.96), R = coastR9(x, z); let add = -99;
  const b = lobeN(x, z, 350, 40, 175, 155); if (b > 0) add = Math.max(add, (1.3 + 2 * fbm(x * 0.02, z * 0.02) + 1.4 * b) * sstep(0, 0.22, b));
  const ithB = distSeg(x, z, 200, 30, 290, 40); if (ithB < 34) add = Math.max(add, lerp(2.5, -0.4, ithB / 34) + 0.3 * fbm(x * 0.04, z * 0.04));
  const v = lobeN(x, z, -350, -30, 180, 190);
  if (v > 0){ let vh = (3.2 + 4 * fbm(x * 0.015, z * 0.015) + 2 * v) * sstep(0, 0.2, v); const rd = riverDist(x, z); if (rd < 18) vh = lerp(vh, -1.6 - 0.4 * (1 - rd / 18), sstep(18, 5, rd)); add = Math.max(add, vh); }
  const ithV = distSeg(x, z, -210, -5, -290, -20); if (ithV < 36) add = Math.max(add, lerp(3.2, -0.4, ithV / 36));
  const jn = lobeN(x, z, 300, -260, 165, 155);
  if (jn > 0){ let jh = (2.6 + 3 * fbm(x * 0.02, z * 0.02)) * sstep(0, 0.2, jn); const sw = fbm(x * 0.03 + 9, z * 0.03 + 2); if (sw < 0.34 && jn > 0.12) jh -= (0.34 - sw) * 7; add = Math.max(add, jh); }
  const ithJ = distSeg(x, z, 165, -80, 250, -200); if (ithJ < 34) add = Math.max(add, lerp(3.2, -0.4, ithJ / 34));
  const va = lobeN(x, z, 40, -380, 200, 170); if (va > 0) add = Math.max(add, (4 + 6 * fbm(x * 0.015, z * 0.015)) * sstep(0, 0.2, va));
  const vd2 = Math.hypot(x - VOLC2.x, z - VOLC2.z);
  if (vd2 < VOLC2.r){ const k = 1 - vd2 / VOLC2.r; let c = VOLC2.h * Math.pow(k, 1.55) * (0.85 + 0.3 * fbm(x * 0.025, z * 0.025)); if (vd2 < 20) c -= (20 - vd2) * 2.4; add = Math.max(add, c); }
  const ithU = distSeg(x, z, 80, -240, 50, -330); if (ithU < 44) add = Math.max(add, lerp(8, -0.4, ithU / 44) + 3 * fbm(x * 0.02, z * 0.02));
  // far scenic ranges (visual only, mostly past the build grid) so the horizon never looks empty
  const far = sstep(480, 700, d0) * (8 + 28 * fbm(x * 0.006 + 4, z * 0.006 + 2)); if (far > 0 && z < -200) add = Math.max(add, far);
  if (add > -90){ const target = Math.max(h, add), core = sstep(R + 8, R + 60, d0), cor = (ithB < 42 || ithV < 44 || ithJ < 42 || ithU < 54) ? 1 : core;
    h = lerp(h, target, Math.max(core, cor * 0.9)); }
  if (USE_APPR){ const ad = apprDist(x, z); if (ad < 22 && h < 0.5) h = Math.max(h, lerp(1.5, 0.15, ad / 22)); }
  return h;
}
function regionAt(x, z){
  const d = Math.hypot(x, z * 0.96), R9 = coastR9(x, z);
  if (d < R9 + 8){
    if (H0(x, z) >= 0.55 && d < coastR(x, z) + 8) return 'plains';
    if (Hgen(x, z, true) > 0.4) return 'highland';
  }
  if (lobeN(x, z, 40, -380, 200, 170) > 0 || distSeg(x, z, 80, -240, 50, -330) < 44 || Math.hypot(x - VOLC2.x, z - VOLC2.z) < VOLC2.r + 10) return 'volcano';
  if (lobeN(x, z, 350, 40, 175, 155) > 0 || distSeg(x, z, 200, 30, 290, 40) < 36) return 'beach';
  if (lobeN(x, z, -350, -30, 180, 190) > 0 || distSeg(x, z, -210, -5, -290, -20) < 38) return 'valley';
  if (lobeN(x, z, 300, -260, 165, 155) > 0 || distSeg(x, z, 165, -80, 250, -200) < 36) return 'jungle';
  return 'sea';
}
const TERR = { cx: 0, cz: -70, size: 560, seg: 220 };
const terrGeo = new THREE.PlaneGeometry(TERR.size, TERR.size, TERR.seg, TERR.seg); terrGeo.rotateX(-Math.PI / 2); terrGeo.translate(TERR.cx, 0, TERR.cz);
{
  const p = terrGeo.attributes.position, n = p.count, splat = new Float32Array(n * 4), uv = terrGeo.attributes.uv;
  for (let i = 0; i < n; i++){ const x = p.getX(i), z = p.getZ(i); const h = H(x, z); p.setY(i, h); uv.setXY(i, x / 7, z / 7); }
  terrGeo.computeVertexNormals(); const nr = terrGeo.attributes.normal;
  for (let i = 0; i < n; i++) splatAt(i, p, nr, splat); terrGeo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
}
function splatAt(i, p, nr, splat){ { const x = p.getX(i), z = p.getZ(i), h = p.getY(i), ny = nr.getY(i);
    const biome = regionAt(x, z);
    let sand = sstep(0.95, 0.3, h); const rock0 = clamp(sstep(0.86, 0.7, ny) + sstep(26, 40, h) * 0.8, 0, 1);
    let rock = rock0; if (biome === 'beach') sand = clamp(sand + sstep(4, 0.4, h) * 0.75, 0, 1); if (biome === 'volcano') rock = clamp(rock + 0.55 + sstep(40, 80, h) * 0.4, 0, 1);
    if (biome === 'jungle') sand *= 0.3;
    const dirt = clamp((fbm(x * 0.05 + 11, z * 0.05 + 3) - 0.56) * 4, 0, 0.8) * (1 - sand) * (1 - rock) + sstep(14, 22, h) * 0.5 * (1 - rock) + (biome === 'jungle' ? 0.15 : 0) + (biome === 'valley' && riverDist(x, z) < 22 ? 0.2 : 0);
    let grass = Math.max(0, 1 - sand - rock - dirt);
    const s = grass + dirt + sand + rock || 1; splat[i*4] = grass / s; splat[i*4+1] = dirt / s; splat[i*4+2] = sand / s; splat[i*4+3] = rock / s; } }
// v9: re-shape the terrain under a lake basin (dug or filled back in)
function retopoMesh(mesh, x0, z0, x1, z1){ const p = mesh.geometry.attributes.position, sp = mesh.geometry.attributes.splat; if (!p) return; let any = false;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i); if (x < x0 - 4 || x > x1 + 4 || z < z0 - 4 || z > z1 + 4) continue; p.setY(i, H(x, z)); any = true; }
  if (!any) return; mesh.geometry.computeVertexNormals(); const nr = mesh.geometry.attributes.normal;
  if (sp) for (let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i); if (x < x0 - 4 || x > x1 + 4 || z < z0 - 4 || z > z1 + 4) continue; splatAt(i, p, nr, sp.array); sp.needsUpdate = true; }
  p.needsUpdate = true; mesh.geometry.attributes.normal.needsUpdate = true; }
function retopo(x0, z0, x1, z1){ retopoMesh(terrain, x0, z0, x1, z1); if (typeof terrFar !== 'undefined' && terrFar) retopoMesh(terrFar, x0, z0, x1, z1); for (const m of terrPatches) retopoMesh(m, x0, z0, x1, z1); }
// path / pen mask (canvas covering the build grid)
const MASK_N = 1024; const maskCanvas = M.mk(MASK_N, MASK_N); const maskCtx = maskCanvas.getContext('2d');
const maskTex = new THREE.CanvasTexture(maskCanvas); maskTex.colorSpace = THREE.NoColorSpace; maskTex.flipY = false; maskTex.minFilter = THREE.LinearMipmapLinearFilter; maskTex.magFilter = THREE.LinearFilter;
const TU = { tGrass: { value: TEX.grass }, tDirt: { value: TEX.dirt }, tSand: { value: TEX.sand }, tRock: { value: TEX.rock }, tGravel: { value: TEX.gravel }, tMask: { value: maskTex },
  uMask: { value: new THREE.Vector4(-WHALF, -WHALF, 1 / (GN * TILE), 0) }, uGrid: { value: 0 } };
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
    col = mix(col, mix(col, di * 0.78, 0.55), mk.b * (1.0 - smoothstep(0.25, 0.65, mk.r)));
    col = mix(col, gv, smoothstep(0.25, 0.65, mk.r));
    col *= mix(0.4, 1.0, smoothstep(-3.0, 0.2, vWP.y)) * mix(0.9, 1.0, smoothstep(-16.0, -6.0, vWP.y)); // v10: deep seabed fades out so the terrain square does not show from far away
    if (uGrid > 0.5 && mk.a >= 0.0){ vec2 g = abs(fract((vWP.xz - uMask.xy) / ${TILE.toFixed(1)}) - 0.5); float l = smoothstep(0.47, 0.495, max(g.x, g.y)); if (muv.x > 0.0 && muv.y > 0.0 && muv.x < 1.0 && muv.y < 1.0) col = mix(col, vec3(0.95, 0.85, 0.55), l * 0.35); }
    diffuseColor.rgb *= col;`);
};
terrMat.customProgramCacheKey = () => 'terrain7';
const terrain = new THREE.Mesh(terrGeo, terrMat); terrain.receiveShadow = true; scene.add(terrain);
const terrPatches = [];
function fillTerrGeo(geo){ const p = geo.attributes.position, n = p.count, splat = new Float32Array(n * 4), uv = geo.attributes.uv;
  for (let i = 0; i < n; i++){ const x = p.getX(i), z = p.getZ(i); p.setY(i, H(x, z)); uv.setXY(i, x / 7, z / 7); }
  geo.computeVertexNormals(); const nr = geo.attributes.normal; for (let i = 0; i < n; i++) splatAt(i, p, nr, splat); geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4)); return geo; }
const terrFarMat = terrMat.clone();
terrFarMat.onBeforeCompile = (sh) => {
  terrMat.onBeforeCompile(sh);
  const coreR = 'length(vWP.xz - vec2(' + TERR.cx.toFixed(1) + ', ' + TERR.cz.toFixed(1) + '))';
  const fadeCode = '  float core = ' + coreR + '; if (core < 255.0) discard; float fade = smoothstep(255.0, 290.0, core); gl_FragColor.a *= fade;\n  ';
  sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', fadeCode + '#include <dithering_fragment>');
};
terrFarMat.customProgramCacheKey = () => 'terrain7far';
terrFarMat.transparent = true;
const TERR_FAR = { cx: 0, cz: -180, size: 1800, seg: 72 };
const terrFarGeo = fillTerrGeo(new THREE.PlaneGeometry(TERR_FAR.size, TERR_FAR.size, TERR_FAR.seg, TERR_FAR.seg).rotateX(-Math.PI / 2).translate(TERR_FAR.cx, 0, TERR_FAR.cz));
const terrFar = new THREE.Mesh(terrFarGeo, terrFarMat); terrFar.receiveShadow = false; terrFar.castShadow = false; terrFar.renderOrder = -1; scene.add(terrFar);
function makeTerrPatch(x0, z0, x1, z1, step = 4){ const w = x1 - x0, d = z1 - z0, sx = Math.max(8, Math.round(w / step)), sz = Math.max(8, Math.round(d / step));
  const g = fillTerrGeo(new THREE.PlaneGeometry(w, d, sx, sz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
  const m = new THREE.Mesh(g, terrMat); m.receiveShadow = true; m.userData.patch = true; scene.add(m); terrPatches.push(m); return m; }

/* ================= water ================= */
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b4a4a, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.84, normalMap: TEX.water, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.1 });
const seabed = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 })); seabed.position.y = -21.6; scene.add(seabed); // v10: open-sea floor level with the shelved terrain edge, so the terrain square never shows
const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), waterMat); water.position.y = 0.0; water.receiveShadow = true; water.renderOrder = 2; scene.add(water);
// surf ring: a soft light band at the shoreline drawn on the water
// volcano smoke
const smokeMat = new THREE.SpriteMaterial({ map: TEX.soft, color: 0xb8b4ac, transparent: true, opacity: 0.35, depthWrite: false, fog: true });
const smoke = []; for (let i = 0; i < 14; i++){ const s = new THREE.Sprite(smokeMat.clone()); s.userData.t = i / 14; scene.add(s); smoke.push(s); }
function updateSmoke(dt){ const top = H(VOLC2.x, VOLC2.z) + 10, top0 = H(VOLC.x, VOLC.z) + 8;
  for (let i = 0; i < smoke.length; i++){ const s = smoke[i]; s.userData.t = (s.userData.t + dt * (i < 4 ? 0.015 : 0.02)) % 1; const t = s.userData.t;
    if (i < 4){ s.position.set(VOLC.x + t * 28 + Math.sin(t * 6 + i) * 3, top0 + t * 50, VOLC.z + t * 12); const sc = 10 + t * 40; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(t * Math.PI) * 0.22; s.material.color.setHex(0xb8b4ac); }
    else { s.position.set(VOLC2.x + t * 50 + Math.sin(t * 5 + i) * 6, top + t * 90, VOLC2.z + t * 20); const sc = 18 + t * 80; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(t * Math.PI) * 0.38; s.material.color.setHex(0xc8b4a0); } } }
const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a18, fog: true, transparent: true, opacity: 0.85 });
{ const lava = new THREE.Mesh(new THREE.CircleGeometry(16, 20).rotateX(-Math.PI / 2), lavaMat); lava.position.set(VOLC2.x, 0, VOLC2.z); lava.userData.lava = true; scene.add(lava);
  const glow = new THREE.PointLight(0xff5510, 4, 180, 1.6); glow.position.set(VOLC2.x, 40, VOLC2.z); scene.add(glow);
  const _lv = lava; (function placeLava(){ _lv.position.y = H(VOLC2.x, VOLC2.z) + 1.2; })(); }

/* ================= vegetation ================= */
const leafMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: 0xb8c890 }), 0.018, 6);
const frondMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.frond, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.8, color: 0xc0cc98 }), 0.03, 8);
const fernMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.fern, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: 0xb0c088 }), 0.05, 0.2);
const cycFrondMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.fern, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, color: 0xa8bc80 }), 0.03, 2);
const bushMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, color: 0x9cae78 }), 0.04, 0.3);
const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }); barkMat.onBeforeCompile = (sh) => M.nearFadePatch(sh); barkMat.customProgramCacheKey = () => 'bark7f';
const grassMat = M.windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 }), 0.14, 0.05);
const shrubMat = M.windify(new THREE.MeshStandardMaterial({ map: TEX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.88, color: 0xa8bc84 }), 0.035, 0.3);
const VEG_HI = new Set(['grass', 'flower', 'shrub', 'log', 'stump']); // v7 ground cover: off at the low setting
const VEG_SMALL = new Set(['grass', 'flower']); // also the near-camera kinds
const NEARV = { t: 0, x: 1e9, z: 1e9, d: -1 };
function nearVeg(force){ // fill the grass/flower instances with pool items around the camera target; none when zoomed out
  const on = QUALITY.level > 0 && !title.on && cam.dist < 120, R = 34 + cam.dist * 0.55;
  if (!force && Math.hypot(cam.tx - NEARV.x, cam.tz - NEARV.z) < 6 && Math.abs(cam.dist - NEARV.d) < 8) return; NEARV.x = cam.tx; NEARV.z = cam.tz; NEARV.d = cam.dist;
  for (const kind of VEG_SMALL){ const V = VEG[kind]; if (!V) continue; let n = 0; const cap = V.ims[0].instanceMatrix.count;
    if (on && V.cand) for (const it of V.cand){ const dx = it.x - cam.tx, dz = it.z - cam.tz; if (dx * dx + dz * dz > R * R) continue; for (const im of V.ims) im.setMatrixAt(n, it.m); if (++n >= cap) break; }
    for (const im of V.ims){ im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } } }
function nearVegTick(dt){ NEARV.t -= dt; if (NEARV.t > 0) return; NEARV.t = 0.3; nearVeg(false); }
const VEG = {}; // kind -> {parts:[InstancedMesh], items:[{m:Matrix4, i, j, x, z, r}]}
function vegKind(name, parts, cap, itemCap){ const ims = parts.map(([geo, mat, cast]) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.castShadow = !!cast; im.receiveShadow = true; im.count = 0; scene.add(im); return im; }); VEG[name] = { ims, items: [], itemCap: itemCap || cap }; }
{
  const palm = M.palmGeos(), cyc = M.cycadGeos(), bl1 = M.broadleafGeos(1), bl2 = M.broadleafGeos(2);
  vegKind('broad1', [[bl1.trunk, barkMat, true], [bl1.canopy, leafMat, true]], 420);
  vegKind('broad2', [[bl2.trunk, barkMat, true], [bl2.canopy, leafMat, true]], 420);
  vegKind('palm', [[palm.trunk, barkMat, true], [palm.crown, frondMat, true]], 320);
  vegKind('cycad', [[cyc.trunk, barkMat, true], [cyc.crown, cycFrondMat, true]], 320);
  vegKind('bush', [[M.bushGeo(), bushMat, false]], 1600);
  vegKind('fern', [[M.fernGeo(), fernMat, false]], 1400);
  vegKind('rock', [[M.rockGeo(5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: TEX.rock }), true]], 200);
  vegKind('shrub', [[M.shrubGeo(3), shrubMat, false]], 500);
  vegKind('grass', [[M.grassGeo(), grassMat, false]], 1400, 16000); // near-camera only: drawn from a dense pool around the view target
  vegKind('flower', [[M.flowerGeo(), grassMat, false]], 360, 4000);
  vegKind('log', [[M.logGeo(), barkMat, true]], 60);
  vegKind('stump', [[M.stumpGeo(), barkMat, false]], 60);
}
function scatterVegetation(){
  const r = mulberry(1234); const _m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const tries = { broad1: 2600, broad2: 2600, palm: 1800, cycad: 1600, bush: 6000, fern: 5000, rock: 900, shrub: 2400, grass: 60000, flower: 16000, log: 700, stump: 700 };
  for (const kind in tries){ const V = VEG[kind], cap = V.itemCap;
    for (let t = 0; t < tries[kind] && V.items.length < cap; t++){
      const x = TERR.cx + (r() - 0.5) * TERR.size * 0.92, z = TERR.cz + (r() - 0.5) * TERR.size * 0.92; const h = H(x, z);
      if (h < (kind === 'palm' ? 0.6 : 1.0) || h > (kind === 'rock' ? 50 : 34)) continue;
      const nl = H0(x, z) < 0.6; if (nl) roughInfo(x, z); const rgh = nl ? Math.max(_rb, _ri) : 0;
      const slope = Math.abs(H(x + 2, z) - h) + Math.abs(H(x, z + 2) - h); if (slope > (kind === 'rock' ? 3 + rgh * 4 : 1.6)) continue;
      const i = toI(x), j = toI(z), inside = Math.abs(x) < HALF - 6 && Math.abs(z) < HALF - 6;
      // density: jungle thick at the plot border, sparse clearing inside
      const edge = inside ? sstep(HALF - 40, HALF - 4, Math.max(Math.abs(x), Math.abs(z))) : 1;
      const clump = fbm(x * 0.03 + 50, z * 0.03 + 20);
      let dens = kind === 'palm' ? 0.25 + sstep(2.6, 0.9, h) * 0.75 : kind === 'rock' ? 0.35 : 0.2 + clump * 0.9;
      if (VEG_SMALL.has(kind)) dens = (inside ? 0.55 + edge * 0.3 : 0.35) * (0.5 + clump * 0.7) * (kind === 'flower' ? 0.6 : 1);
      else if (inside) dens *= kind === 'bush' || kind === 'fern' || kind === 'shrub' ? 0.35 + edge * 0.65 : kind === 'rock' ? 0.4 : kind === 'log' || kind === 'stump' ? 0.12 + edge * 0.88 : 0.08 + edge * 0.92;
      if (Math.hypot(x, z - 96) < 30) dens = 0; // keep the gate plaza clear
      if (nl) dens *= kind === 'rock' ? 0.5 + rgh * 2.4 : (kind.startsWith('broad') || kind === 'cycad' ? 0.2 + _ri * 0.75 : 0.16 + _ri * 0.45) * (1 - 0.75 * _rb); // v10 new land: rocky ridge, jungle in the hollows (triangle budget near v9)
      if (r() > dens) continue;
      const sc = kind === 'rock' ? 0.6 + r() * 2.2 : kind.startsWith('broad') ? 0.75 + r() * 0.5 : kind === 'palm' ? 0.8 + r() * 0.45 : kind === 'cycad' ? 0.8 + r() * 0.7 : VEG_SMALL.has(kind) ? 0.75 + r() * 0.6 : kind === 'log' || kind === 'stump' ? 0.8 + r() * 0.4 : 0.7 + r() * 0.8;
      e.set(kind === 'rock' ? r() * 0.4 : (r() - 0.5) * 0.08, r() * TAU, kind === 'rock' ? r() * 0.4 : (r() - 0.5) * 0.08); q.setFromEuler(e); s.set(sc, sc * (kind.startsWith('broad') ? 0.85 + r() * 0.35 : 1), sc); p.set(x, h - (kind === 'rock' ? 0.4 * sc : VEG_SMALL.has(kind) ? 0.04 : kind === 'log' ? 0.1 : 0.15), z);
      V.items.push({ m: new THREE.Matrix4().compose(p, q, s), i, j, x, z, r: kind.startsWith('broad') ? 2.2 * sc : kind === 'palm' ? 1.4 : kind === 'log' ? 2.2 * sc : VEG_SMALL.has(kind) ? 0.4 * sc : 1.2 * sc, sc, small: VEG_SMALL.has(kind), hidden: false });
    }
  }
}
const monoClearT = new Uint8Array(GN * GN); // v10: jungle cleared along monorail track and around stations
function monoClearMask(){ monoClearT.fill(0); const mark = (x, z, r) => { const ci = Math.floor((x + HALF) / TILE), cj = Math.floor((z + HALF) / TILE); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (inGrid(ci + di, cj + dj)) monoClearT[idx(ci + di, cj + dj)] = 1; };
  try { for (const L of MONO.lines) for (const p of L.path.pts) mark(p.x, p.z, 1); for (const b of buildings.values()) if (b.type === 'station') mark(b.x, b.z, 2); } catch (e) { /* called before the monorail module is set up */ } }
function vegBlocked(it){ // trees cleared by paths, buildings and fence lines
  for (const L of LAKES) if (it.x > L.x0 - it.r - 1 && it.x < L.x1 + it.r + 1 && it.z > L.z0 - it.r - 1 && it.z < L.z1 + it.r + 1) return true;
  if (!inGrid(it.i, it.j)) return false;
  const k = idx(it.i, it.j), ty = tileType[k];
  if (ty === T_PATH || ty === T_BUILD) return true;
  if (monoClearT[k] && !it.small) return true;
  if (it.small && ty === T_PEN) return true;
  if (ty === T_PEN || tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); if (pen){ const x0 = eX(pen.i0), x1 = eX(pen.i1 + 1), z0 = eX(pen.j0), z1 = eX(pen.j1 + 1);
    const d = Math.min(it.x - x0, x1 - it.x, it.z - z0, z1 - it.z); if (d < it.r + 0.8) return true; if (pen.feeders.some(f => Math.hypot(tX(f.i) - it.x, tZ(f.j) - it.z) < 4)) return true; } }
  // near fences of a neighbouring pen
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){ const ii = it.i + di, jj = it.j + dj; if (!inGrid(ii, jj)) continue; const kk = idx(ii, jj); if (tileType[kk] === T_PEN && tileRef[kk] !== (ty === T_PEN ? tileRef[k] : -1)){ const pen = pens.get(tileRef[kk]);
    if (pen){ const x0 = eX(pen.i0), x1 = eX(pen.i1 + 1), z0 = eX(pen.j0), z1 = eX(pen.j1 + 1); const dx = Math.max(x0 - it.x, 0, it.x - x1), dz = Math.max(z0 - it.z, 0, it.z - z1); if (Math.hypot(dx, dz) < it.r + 0.8) return true; } } }
  return false;
}
let camObsDirty = true; // camera-obstacle boxes need a rebuild
function refreshVegetation(){
  monoClearMask();
  const lvl = QUALITY.veg[QUALITY.level];
  for (const kind in VEG){ const V = VEG[kind]; let n = 0; const lim = VEG_HI.has(kind) && QUALITY.level === 0 ? 0 : Math.floor(V.items.length * lvl);
    if (VEG_SMALL.has(kind)){ V.cand = []; for (let a = 0; a < lim; a++){ const it = V.items[a]; if (!vegBlocked(it)) V.cand.push(it); } continue; }
    for (let a = 0; a < V.items.length && a < lim; a++){ const it = V.items[a]; if (vegBlocked(it)) continue; for (const im of V.ims) im.setMatrixAt(n, it.m); n++; }
    for (const im of V.ims){ im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } }
  try { nearVeg(true); } catch (e) { /* camera not created yet during boot */ }
}

/* ================= world state ================= */
const T_LOCK = -2, T_BLOCK = -1, T_EMPTY = 0, T_PATH = 1, T_BUILD = 2, T_PEN = 3; // T_LOCK: new land, buildable after the expansion permit
const ridgeMask = new Uint8Array(GN * GN); // v10: tiles on the border ridge / ring
const tileGrade = new Float32Array(GN * GN); // v10: metres of relief across each new-land tile (grading cost)
const tileType = new Int8Array(GN * GN), tileRef = new Int32Array(GN * GN).fill(-1), tileH = new Float32Array(GN * GN), tileBase = new Int8Array(GN * GN);
const buildings = new Map(), pens = new Map();
let dinos = [], eggs = [];
let G = null;
function freshState(){ return { v: 1, econ6: true, money: 300000, day: 1, hour: OPEN - 0.5, price: 35, rep: 55, safety: 85, stars: 0, speed: 1, nextId: 1,
  ledger: { tickets: 0, shops: 0, upkeep: 0, feed: 0, build: 0, hatch: 0, fines: 0, other: 0 }, prevLedger: null,
  stats: { guestsTotal: 0, guestsToday: 0, deaths: 0, fed: 0, breakouts: 0, hatched: 0, carnHatched: 0, bestProfit: -1e9, trex: 0 },
  missions: [], thrill: 0, tutorialDone: false, feedCooldown: 0, v9: true, v10: true, v11: true, bldPal: 'classic', spScheme: {}, mono: { lines: [] }, regions: { plains: true, beach: false, valley: false, highland: false, jungle: false, volcano: false } }; }
const GATE = { i: 27, j: 53 };
const LOCK_WHY = 'New land: buy the Expansion permit in Park first';
let buildableCache = null;
function computeBuildable(){
  if (buildableCache){ tileType.set(buildableCache); return; }
  const test = (i, j, h, maxH) => { const x0 = eX(i), z0 = eX(j), hs = [h(x0, z0), h(x0 + TILE, z0), h(x0, z0 + TILE), h(x0 + TILE, z0 + TILE), h(x0 + 2, z0 + 2)];
    const mn = Math.min(...hs), mx = Math.max(...hs); return { ok: !(mn < 0.55 || mx > maxH || mx - mn > 1.9), c: hs[4], mn, mx }; };
  tileGrade.fill(0); tileReg.fill(0); tileLand.fill(0);
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++){ const k = idx(i, j);
    const x = tX(i), z = tZ(j), reg = regionAt(x, z); tileReg[k] = REG_CODE[reg] || 0;
    const old = i >= 0 && j >= 0 && i < GRID && j < GRID && test(i, j, H0, 7).ok; const n = test(i, j, H, 40); tileH[k] = n.c; let t = old ? T_EMPTY : T_BLOCK;
    if (old) tileReg[k] = 1;
    else if (i >= V10_LO && j >= V10_LO && i < V10_HI && j < V10_HI && j < GRID){
      // T_LOCK is the v10 highland only, using heights without the v11 approach spits so landCounts stay stable
      const prev = USE_APPR; USE_APPR = false; const n0 = test(i, j, H, 40); USE_APPR = prev;
      if (n0.mn >= 0.55 && n0.mx <= 40 && n0.mx - n0.mn <= 6){ roughInfo(eX(i) + 2, eX(j) + 2); if (_rb <= 0.12){ t = T_LOCK; tileGrade[k] = n0.mx - n0.mn; tileReg[k] = 2; } }
    }
    if (t !== T_LOCK && t !== T_EMPTY && (reg === 'beach' || reg === 'valley' || reg === 'jungle' || reg === 'volcano') && n.mn >= 0.4 && n.mx <= 90){ tileLand[k] = 1; if (!tileGrade[k]) tileGrade[k] = n.mx - n.mn; }
    tileType[k] = t; }
  // the old park and the highland never touch: a ring of rough ground always separates them, so footpaths cannot cross (the monorail can)
  const ring = []; for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++){ const k = idx(i, j); if (tileType[k] !== T_LOCK) continue;
    let adj = false; for (let dj = -1; dj <= 1 && !adj; dj++) for (let di = -1; di <= 1; di++){ if (inGrid(i + di, j + dj) && tileType[idx(i + di, j + dj)] === T_EMPTY){ adj = true; break; } } if (adj) ring.push(k); }
  ridgeMask.fill(0); for (const k of ring){ tileType[k] = T_BLOCK; tileGrade[k] = 0; ridgeMask[k] = 1; }
  for (let j = LO; j < GRID; j++) for (let i = LO; i < HI; i++){ const k = idx(i, j); if (tileType[k] !== T_BLOCK || ridgeMask[k]) continue; roughInfo(eX(i) + 2, eX(j) + 2); if (_rb > 0.12 && tileH[k] > 0.55) ridgeMask[k] = 1; }
  markForestAndOpenings();
  buildableCache = tileType.slice(); tileBase.set(buildableCache);
}
// the expansion permit opens every T_LOCK tile; old parks keep their layout and gain the new land
function applyExpansion(){ if (!G || !G.expand) return; for (let k = 0; k < tileType.length; k++) if (tileType[k] === T_LOCK) tileType[k] = T_EMPTY; if (!G.regions) G.regions = emptyRegions(); G.regions.highland = true; }
function landCounts(){ let open = 0, locked = 0, old = 0; for (let k = 0; k < tileBase.length; k++){ if (tileBase[k] === T_EMPTY) old++; if (tileBase[k] === T_LOCK) locked++; } return { old, locked, total: old + locked }; }
// v10 grading: levelling rough expansion ground costs extra, per metre of relief on each tile
const GRADE = { path: 60, bld: 1400, pen: 90 };
const isExpK = k => tileBase[k] === T_LOCK;
/* ---------- v11 regions: unlockable land beyond a forest wall ---------- */
const V10_LO = -24, V10_HI = 80;
const REG_CODE = { sea: 0, plains: 1, highland: 2, beach: 3, valley: 4, jungle: 5, volcano: 6 };
const REG_NAME = ['sea', 'plains', 'highland', 'beach', 'valley', 'jungle', 'volcano'];
const REG_IDS = ['plains', 'beach', 'valley', 'highland', 'jungle', 'volcano'];
const REGIONS = {
  plains:   { id: 'plains', name: 'Main Plains', cost: 0, stars: 0, special: 'Your starting park: open grassland around the gate and pier.', mark: [0, 20], bb: [-140, -140, 140, 160] },
  beach:    { id: 'beach', name: 'Beach Coast', cost: 80000, stars: 1, special: 'Sand, shallows and coves. Ocean lagoons and beach stands can only be built here. A ferry dock welcomes guests.', mark: [350, 40], bb: [180, -140, 540, 220] },
  valley:   { id: 'valley', name: 'River Valley', cost: 120000, stars: 2, special: 'A winding river and lakes. Freshwater lake enclosures can only be built here (or along the river).', mark: [-350, -30], bb: [-540, -240, -160, 180] },
  highland: { id: 'highland', name: 'Highland Ridge', cost: EXPAND_COST, stars: 2, special: 'Rough hills beyond a rocky ridge. Guests need the monorail to reach exhibits here.', mark: [0, -160], bb: [-220, -220, 220, 80], mono: true },
  jungle:   { id: 'jungle', name: 'Deep Jungle', cost: 220000, stars: 3, special: 'Dense forest and swamp. Raptors and Dilophosaurus thrive here.', mark: [300, -260], bb: [140, -430, 500, -80] },
  volcano:  { id: 'volcano', name: 'The Volcano', cost: 400000, stars: 3.5, special: 'A smoking peak of dark rock and safe lava glow. Exhibits here have the highest appeal.', mark: [40, -400], bb: [-180, -540, 260, -220] }
};
const tileReg = new Uint8Array(GN * GN);
const tileLand = new Uint8Array(GN * GN); // 1 = region land, 2 = forest wall, 3 = cleared opening
const REGOPEN = { paths: {}, dock: null };
const emptyRegions = () => ({ plains: true, beach: false, valley: false, highland: false, jungle: false, volcano: false });
function regionOpen(id){ if (id === 'plains' || id === 'sea') return true; return !!(G && G.regions && G.regions[id]); }
function regNameAt(i, j){ return inGrid(i, j) ? (REG_NAME[tileReg[idx(i, j)]] || 'sea') : 'sea'; }
function regionCore(id, x, z){
  if (id === 'beach') return lobeN(x, z, 350, 40, 175, 155) > 0.08;
  if (id === 'valley') return lobeN(x, z, -350, -30, 180, 190) > 0.08;
  if (id === 'jungle') return lobeN(x, z, 300, -260, 165, 155) > 0.08;
  if (id === 'volcano') return lobeN(x, z, 40, -380, 200, 170) > 0.05 || Math.hypot(x - VOLC2.x, z - VOLC2.z) < VOLC2.r + 8;
  if (id === 'highland') return regionAt(x, z) === 'highland';
  if (id === 'plains') return regionAt(x, z) === 'plains';
  return false;
}
function lockWhyAt(i, j){
  if (!inGrid(i, j)) return 'Outside the park';
  const k = idx(i, j), t = tileType[k], r = REG_NAME[tileReg[k]];
  if (t === T_LOCK) return LOCK_WHY;
  if (tileLand[k] === 2 && !regionOpen(r === 'plains' || r === 'highland' || r === 'sea' ? nearestLocked(i, j) : r)) return 'Thick forest. Unlock a neighbouring region in Park to clear a path.';
  if (r && r !== 'plains' && r !== 'sea' && r !== 'highland' && !regionOpen(r)) return `${REGIONS[r].name} is locked. Buy the land permit in Park.`;
  if (r === 'highland' && !regionOpen('highland')) return LOCK_WHY;
  return t === T_BLOCK ? 'Ground too rough' : 'Tile is occupied';
}
function nearestLocked(i, j){
  let best = 'beach', bd = 1e9;
  for (const id of ['beach', 'valley', 'jungle', 'volcano']){ if (regionOpen(id)) continue; const m = REGIONS[id].mark; const d = Math.hypot(tX(i) - m[0], tZ(j) - m[1]); if (d < bd){ bd = d; best = id; } }
  return best;
}
function walkOpen(i, j){
  if (!inGrid(i, j)) return false;
  const t = tileType[idx(i, j)];
  if (t === T_LOCK || t === T_EMPTY) return false;
  const h = H(tX(i), tZ(j));
  return h > 0.35 && h < 80;
}
function findOpening(reg){
  const starts = [], goalSet = new Set();
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++){
    const k = idx(i, j);
    if (tileType[k] === T_EMPTY && tileReg[k] === 1){
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
        const ii = i + di, jj = j + dj; if (!walkOpen(ii, jj)) continue;
        let nearLock = false;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (inGrid(ii + a, jj + b) && tileType[idx(ii + a, jj + b)] === T_LOCK) nearLock = true;
        if (!nearLock) starts.push([ii, jj]);
      }
    }
    if (tileReg[k] === REG_CODE[reg] && walkOpen(i, j)) goalSet.add(k);
  }
  const seen = new Int32Array(GN * GN).fill(-1), q = [];
  for (const [i, j] of starts){ const k = idx(i, j); if (seen[k] !== -1) continue; seen[k] = -2; q.push(k); }
  let hit = -1;
  for (let h = 0; h < q.length; h++){
    const k = q[h]; if (goalSet.has(k)){ hit = k; break; }
    const i = kI(k), j = kJ(k);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const ii = i + di, jj = j + dj; if (!walkOpen(ii, jj)) continue;
      const kk = idx(ii, jj); if (seen[kk] !== -1) continue; seen[kk] = k; q.push(kk);
    }
  }
  if (hit < 0) return [];
  const path = [];
  for (let k = hit; k !== -2; k = seen[k]){ path.push([kI(k), kJ(k)]); if (seen[k] < 0) break; }
  path.reverse();
  return path;
}
function markForestAndOpenings(){
  REGOPEN.paths = {};
  for (const id of ['beach', 'valley', 'jungle', 'volcano']) REGOPEN.paths[id] = findOpening(id);
  // forest wall: approaches, opening corridors, and a ring just outside the plains
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++){
    const k = idx(i, j); if (tileType[k] === T_EMPTY || tileType[k] === T_LOCK) continue;
    const x = tX(i), z = tZ(j); if (H(x, z) < 0.4) continue;
    if (apprDist(x, z) < 36) tileLand[k] = Math.max(tileLand[k], 2);
    let nearP = false;
    for (let dj = -2; dj <= 2 && !nearP; dj++) for (let di = -2; di <= 2; di++) if (inGrid(i + di, j + dj) && tileType[idx(i + di, j + dj)] === T_EMPTY && tileReg[idx(i + di, j + dj)] === 1) nearP = true;
    if (nearP) tileLand[k] = 2;
  }
  for (const id of Object.keys(REGOPEN.paths)) for (const [i, j] of REGOPEN.paths[id]){
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (inGrid(i + di, j + dj)){
      const k = idx(i + di, j + dj);
      if (tileType[k] !== T_LOCK && tileType[k] !== T_EMPTY && H(tX(i + di), tZ(j + dj)) > 0.35) tileLand[k] = Math.max(tileLand[k], 2);
    }
  }
}
function applyOpening(id){
  if (id === 'highland' || id === 'plains') return;
  const path = REGOPEN.paths[id] || (REGOPEN.paths[id] = findOpening(id));
  for (const [i, j] of path){
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){
      const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) continue;
      const k = idx(ii, jj);
      if (tileType[k] === T_LOCK || tileBase[k] === T_LOCK) continue;
      if (tileType[k] === T_BLOCK || tileType[k] === T_EMPTY){ tileType[k] = (di === 0 && dj === 0) ? T_PATH : T_EMPTY; tileLand[k] = 3; }
    }
  }
  // paint a 1-tile path down the centre so guests can walk in
  for (const [i, j] of path){ const k = idx(i, j); if (tileType[k] === T_EMPTY || tileType[k] === T_PATH){ tileType[k] = T_PATH; tileLand[k] = 3; } }
  if (path.length){ linkOpeningToPark(path[0][0], path[0][1]);
    const R = REGIONS[id], end = path[path.length - 1];
    if (R && R.mark) extendPathToward(end[0], end[1], R.mark[0], R.mark[1], 40); }
}
function extendPathToward(i, j, x1, z1, maxN){
  let ci = i, cj = j;
  for (let n = 0; n < maxN; n++){
    const tx = tX(ci), tz = tZ(cj);
    let best = null, bd = Math.hypot(tx - x1, tz - z1);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]){
      const ii = ci + di, jj = cj + dj; if (!inGrid(ii, jj)) continue;
      const k = idx(ii, jj); if (tileBase[k] === T_LOCK || ridgeMask[k]) continue;
      const t = tileType[k]; if (t !== T_EMPTY && t !== T_PATH) continue;
      const d = Math.hypot(tX(ii) - x1, tZ(jj) - z1); if (d < bd - 0.2){ bd = d; best = [ii, jj]; }
    }
    if (!best) break;
    ci = best[0]; cj = best[1];
    if (tileType[idx(ci, cj)] === T_EMPTY) tileType[idx(ci, cj)] = T_PATH;
    if (bd < 8) break;
  }
}
function linkOpeningToPark(i, j){
  const start = idx(i, j);
  // stay on the rim of the original park so the path does not cut through the starting exhibits
  const costAt = (ii, jj) => (ii >= 2 && ii <= 53 && jj >= 2 && jj <= 42) ? 80 : 1;
  const dist = new Int32Array(GN * GN).fill(1e9), seen = new Int32Array(GN * GN).fill(-1);
  const q = [start]; dist[start] = 0; seen[start] = -2;
  let hit = -1, hitD = 1e9;
  for (let h = 0; h < q.length; h++){
    const k = q[h], ci = kI(k), cj = kJ(k);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const ii = ci + di, jj = cj + dj; if (!inGrid(ii, jj)) continue;
      const kk = idx(ii, jj); if (tileBase[kk] === T_LOCK || ridgeMask[kk]) continue;
      const t = tileType[kk]; if (t !== T_EMPTY && t !== T_PATH) continue;
      const nd = dist[k] + (t === T_PATH ? 0 : costAt(ii, jj));
      if (nd >= dist[kk]) continue;
      dist[kk] = nd; seen[kk] = k; q.push(kk);
      if (t === T_PATH && (Math.abs(ii - i) + Math.abs(jj - j) > 8) && nd < hitD){ hit = kk; hitD = nd; }
    }
  }
  if (hit < 0) return false;
  for (let k = hit; k !== -2; k = seen[k]){ if (tileType[k] === T_EMPTY) tileType[k] = T_PATH; if (seen[k] < 0) break; }
  return true;
}
function applyRegionLand(id){
  if (id === 'highland'){ applyExpansion(); return; }
  if (id === 'plains') return;
  const code = REG_CODE[id];
  for (let k = 0; k < tileType.length; k++){
    if (tileReg[k] !== code) continue;
    if (tileLand[k] === 1 && (tileType[k] === T_BLOCK || tileType[k] === T_EMPTY) && tileBase[k] !== T_LOCK) tileType[k] = T_EMPTY;
  }
  applyOpening(id);
  const R = REGIONS[id];
  if (R && R.bb && !R.patch){ const b = R.bb; R.patch = makeTerrPatch(b[0], b[1], b[2], b[3], 6); }
  if (id === 'beach') placeBeachDock();
}
function applyRegion(id, free){
  if (id === 'plains' || !REGIONS[id]) return false;
  if (regionOpen(id) && !free) return false;
  if (!G.regions) G.regions = emptyRegions();
  G.regions[id] = true;
  if (id === 'highland') G.expand = true;
  applyRegionLand(id);
  refreshForestWall(); updateLockMarks();
  return true;
}
function buyRegion(id){
  ensureTestUnlock();
  const R = REGIONS[id]; if (!R || id === 'plains') return false;
  if (regionOpen(id)){ toast(`${R.name} is already open.`, 'bad'); return false; }
  if (G.stars < R.stars && !G.unlockAll){ toast(`${R.name} unlocks at ${R.stars} star${R.stars === 1 ? '' : 's'}.`, 'bad'); return false; }
  if (id === 'highland') return buyExpansion();
  if (G.money < R.cost){ toast(`Not enough funds for the ${R.name} permit.`, 'bad'); return false; }
  spend('build', R.cost); applyRegion(id, true); afterStructureChange(); SFX.build();
  toast(`${R.name} permit granted. A path has been cleared through the forest.${id === 'beach' ? ' A beach dock now welcomes guests.' : ''}`, 'good');
  return true;
}
function ensureTestUnlock(){
  if (!G || !G.unlockAll) return;
  if (!G.regions) G.regions = emptyRegions();
  let any = false;
  for (const id of ['beach', 'valley', 'highland', 'jungle', 'volcano']) if (!regionOpen(id)){ applyRegion(id, true); any = true; }
  if (any) afterStructureChange();
}
function placeBeachDock(){
  if (REGOPEN.dock) return;
  let best = null, bs = 1e9;
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++){
    if (tileReg[idx(i, j)] !== 3) continue;
    const x = tX(i), z = tZ(j), h = H(x, z);
    if (h < 0.4 || h > 3.5) continue;
    if (H(x, z + 8) > 0.2) continue; // open water to the south
    const s = Math.hypot(x - 350, z - 90); if (s < bs && tileType[idx(i, j)] === T_EMPTY){ bs = s; best = [i, j, x, z]; }
  }
  if (!best) return;
  const [i, j, x, z] = best;
  for (let d = 0; d <= 3; d++){ const jj = j + d; if (!inGrid(i, jj)) break; const k = idx(i, jj); if (tileType[k] === T_BLOCK || tileType[k] === T_EMPTY) tileType[k] = T_PATH; }
  REGOPEN.dock = { i, j, x, z };
  const bp = REGOPEN.paths.beach;
  if (bp && bp.length) extendPathToward(i, j, tX(bp[bp.length - 1][0]), tZ(bp[bp.length - 1][1]), 90);
  else linkOpeningToPark(i, j);
}
function unlockedBounds(){
  let x0 = -140, z0 = -140, x1 = 140, z1 = 160;
  for (const id of REG_IDS) if (regionOpen(id) && REGIONS[id].bb){ const b = REGIONS[id].bb; x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]); }
  return [x0 - 80, z0 - 80, x1 + 80, z1 + 80];
}
function maxCamDist(){ const b = unlockedBounds(); return clamp(Math.hypot(b[2] - b[0], b[3] - b[1]) * 1.05, 560, 1100); }
function lakeRegionOk(i0, j0, i1, j1){
  let n = 0, ok = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ n++; const x = tX(i), z = tZ(j); if (regNameAt(i, j) === 'valley' || regionAt(x, z) === 'valley' || riverDist(x, z) < 22) ok++; }
  return ok * 2 >= n;
}
function lagoonRegionOk(i0, j0, i1, j1){
  const cx = tX((i0 + i1) / 2), cz = tZ((j0 + j1) / 2);
  if (regionAt(cx, cz) === 'beach' || lobeN(cx, cz, 350, 40, 200, 180) > 0) return true;
  for (let j = j0 - 3; j <= j1 + 3; j++) for (let i = i0 - 3; i <= i1 + 3; i++) if (inGrid(i, j) && (regNameAt(i, j) === 'beach' || regionAt(tX(i), tZ(j)) === 'beach')) return true;
  return false;
}
function regionOfPen(pen){ return regionAt((eX(pen.i0) + eX(pen.i1 + 1)) / 2, (eX(pen.j0) + eX(pen.j1 + 1)) / 2); }
function migrateV11(){
  if (!G.regions) G.regions = emptyRegions();
  if (G.expand) G.regions.highland = true;
  if (G.v11){ for (const id of REG_IDS) if (regionOpen(id)) applyRegionLand(id); updateLockMarks(); refreshForestWall(); return; }
  G.v11 = true;
  const mark = (x, z) => { const r = regionAt(x, z); if (r && r !== 'plains' && r !== 'sea' && REGIONS[r]) G.regions[r] = true; };
  for (const p of pens.values()) mark((eX(p.i0) + eX(p.i1 + 1)) / 2, (eX(p.j0) + eX(p.j1 + 1)) / 2);
  for (const b of buildings.values()) mark(tX(b.i), tZ(b.j));
  if (G.expand) G.regions.highland = true;
  for (const id of REG_IDS) if (regionOpen(id)) applyRegionLand(id);
  updateLockMarks(); refreshForestWall();
}
const FOREST = { items: [], ims: [], built: false };
function buildForestWall(){
  if (FOREST.built) return;
  const r = mulberry(77), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const geos = [M.broadleafGeos(1), M.broadleafGeos(2), M.palmGeos()];
  const kinds = [];
  for (let j = LO; j < HI; j += 1) for (let i = LO; i < HI; i += 1){
    const k = idx(i, j); if (tileLand[k] < 2 && !(tileLand[k] === 1 && !regionOpen(REG_NAME[tileReg[k]]))) continue;
    if (tileType[k] === T_EMPTY || tileType[k] === T_LOCK || tileType[k] === T_PATH) continue;
    const x = tX(i) + (r() - 0.5) * 3, z = tZ(j) + (r() - 0.5) * 3, h = H(x, z);
    if (h < 0.5 || h > 40) continue;
    const dense = tileLand[k] === 2;
    if (r() > (dense ? 0.55 : 0.12)) continue;
    if (FOREST.items.length >= 900) break;
    const kind = dense ? (Math.abs(x) > 200 && z > 0 ? 2 : (r() < 0.5 ? 0 : 1)) : (r() < 0.7 ? 0 : 1);
    const sc = 0.9 + r() * 0.7;
    e.set((r() - 0.5) * 0.06, r() * TAU, (r() - 0.5) * 0.06); q.setFromEuler(e); s.set(sc, sc, sc); p.set(x, h - 0.15, z);
    FOREST.items.push({ m: new THREE.Matrix4().compose(p, q, s), i, j, x, z, kind, k });
  }
  const caps = [500, 500, 280];
  const mats = [
    [barkMat, leafMat],
    [barkMat, leafMat],
    [barkMat, frondMat]
  ];
  FOREST.ims = geos.map((G, ki) => {
    const parts = ki === 2 ? [[G.trunk, mats[ki][0]], [G.crown, mats[ki][1]]] : [[G.trunk, mats[ki][0]], [G.canopy, mats[ki][1]]];
    return parts.map(([geo, mat]) => { const im = new THREE.InstancedMesh(geo, mat, caps[ki]); im.castShadow = QUALITY.level >= 1; im.receiveShadow = true; im.frustumCulled = true; im.count = 0; scene.add(im); return im; });
  });
  FOREST.built = true;
  refreshForestWall();
}
function refreshForestWall(){
  if (!FOREST.built) return;
  const lvl = QUALITY.level === 0 ? 0.45 : QUALITY.level === 1 ? 0.75 : 1;
  const counts = [0, 0, 0];
  for (const it of FOREST.items){
    const k = inGrid(it.i, it.j) ? idx(it.i, it.j) : -1;
    if (k >= 0 && (tileType[k] === T_PATH || tileType[k] === T_BUILD || tileType[k] === T_PEN || tileLand[k] === 3 || (tileType[k] === T_EMPTY && tileLand[k] !== 2))) continue;
    if (k >= 0 && tileLand[k] === 1 && regionOpen(REG_NAME[tileReg[k]])) continue;
    const ims = FOREST.ims[it.kind]; if (!ims || counts[it.kind] >= ims[0].instanceMatrix.count * lvl) continue;
    for (const im of ims) im.setMatrixAt(counts[it.kind], it.m);
    counts[it.kind]++;
  }
  FOREST.ims.forEach((ims, ki) => { for (const im of ims){ im.count = counts[ki]; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } });
}
function lockCanvas(){ const c = M.mk(128, 128), g = c.getContext('2d');
  g.fillStyle = 'rgba(16,14,10,0.55)'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
  g.fillStyle = '#f2c230'; g.strokeStyle = '#1b1408'; g.lineWidth = 5; g.beginPath(); g.roundRect(34, 58, 60, 44, 8); g.fill(); g.stroke();
  g.beginPath(); g.arc(64, 58, 20, Math.PI, 0, true); g.lineWidth = 10; g.strokeStyle = '#f2c230'; g.stroke();
  g.fillStyle = '#1b1408'; g.beginPath(); g.arc(64, 78, 6, 0, TAU); g.fill(); g.fillRect(61, 78, 6, 14);
  return c; }
const lockMat = new THREE.SpriteMaterial({ map: canvasTex(lockCanvas(), true, false), depthTest: false, transparent: true, fog: false });
const lockMarks = {};
function updateLockMarks(){
  for (const id of ['beach', 'valley', 'highland', 'jungle', 'volcano']){
    const open = regionOpen(id); let s = lockMarks[id];
    if (open){ if (s) s.visible = false; continue; }
    if (!s){ s = new THREE.Sprite(lockMat); s.renderOrder = 12; scene.add(s); lockMarks[id] = s; }
    const [x, z] = REGIONS[id].mark; s.position.set(x, H(x, z) + 22, z); const sc = clamp(cam.dist * 0.06, 8, 22); s.scale.set(sc, sc, 1); s.visible = true;
  }
}
function pickLock(sx, sy){
  let best = null, bd = 48;
  for (const id of Object.keys(lockMarks)){ const s = lockMarks[id]; if (!s || !s.visible) continue;
    const v = s.position.clone().project(camera); if (v.z > 1) continue;
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; const d = Math.hypot(x - sx, y - sy);
    if (d < bd){ bd = d; best = id; } }
  return best;
}
function regionSheetHtml(){
  ensureTestUnlock();
  const card = (id) => {
    const R = REGIONS[id], open = regionOpen(id), need = R.stars > 0 && G.stars < R.stars && !G.unlockAll && !open;
    const can = !open && !need && (id === 'highland' ? G.money >= EXPAND_COST : G.money >= R.cost || id === 'plains');
    return `<div class="reg ${open ? 'open' : 'lock'}">
      <div class="row"><span class="k">${open ? 'Open' : 'Locked'} — ${R.name}</span><span class="v">${id === 'plains' ? 'Home' : open ? 'Permit owned' : fmtK(R.cost)}</span></div>
      <div class="meta">${R.stars ? R.stars + ' star' + (R.stars === 1 ? '' : 's') + ' required. ' : ''}${R.special}</div>
      ${open || id === 'plains' ? '' : `<div class="btns"><button class="btn ${can ? 'pri' : ''}" data-act="region" data-reg="${id}" ${need || (G.money < R.cost && !G.unlockAll) ? 'disabled' : ''}>${need ? 'Needs ' + R.stars + ' stars' : 'Buy land permit <small>' + fmtK(R.cost) + '</small>'}</button></div>`}
    </div>`;
  };
  const ma = monoAdvice(), ml = MONO.lines.filter(L => L.ok);
  return `<div class="lbl" style="margin:14px 0 4px">Island regions</div>
    <div class="note">The main plains are yours. Thick forest rings the park: buy a land permit to clear a path into a new region. Far regions also need a star rating. Highland Ridge still needs the monorail.</div>
    ${card('plains')}${card('beach')}${card('valley')}${card('highland')}${card('jungle')}${card('volcano')}
    ${G.regions && G.regions.highland ? `<div class="note">${ml.length ? `Monorail: ${ml.length} line${ml.length > 1 ? 's' : ''} running, ${G.stats.monoRides || 0} rides so far.` : 'No footpath crosses the Highland ridge: build a Monorail (Build > Paths) to bring guests out there.'}${G.monoCredit ? ` Free starter line: ${fmt(G.monoCredit)} of track credit.` : ''}</div>${ma ? `<div class="note warn">${ma}</div>` : ''}` : ''}`;
}

function gradeCost(i0, j0, i1, j1, rate){ let s = 0; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ if (!inGrid(i, j)) continue; const k = idx(i, j); if (tileBase[k] === T_LOCK) s += Math.max(0, tileGrade[k] - 0.4); } return Math.round(s * rate / 10) * 10; }
function bldCost(type, i, j){ const B = BUILD[type]; if (B.inPen) return B.cost; const [w, h] = footprint(type, 0); return B.cost + gradeCost(i, j, i + w - 1, j + h - 1, GRADE.bld); }
function pathTilesCost(tiles){ let c = 0; for (const [i, j] of tiles) c += BUILD.path.cost + gradeCost(i, j, i, j, GRADE.path); return c; }
function buyExpansion(){ if (G.expand) return false; if (G.money < EXPAND_COST){ toast('Not enough funds for the expansion permit.', 'bad'); return false; }
  spend('build', EXPAND_COST); G.expand = true; applyExpansion(); afterStructureChange(); SFX.build(); toast('Expansion permit granted. The new land is rough country beyond a rocky ridge: no footpath crosses it. Build a Monorail Station in the park and one out there, then link them with Monorail track (Build > Paths).', 'good'); return true; }
const idx = (i, j) => (j + OFF) * GN + (i + OFF);
const isPath = (i, j) => inGrid(i, j) && tileType[idx(i, j)] === T_PATH;

/* ---------- mask (paths + pen floors painted into the terrain) ---------- */
function drawMask(){
  const g = maskCtx, s = MASK_N / (GN * TILE), tp = TILE * s, O = OFF;
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, MASK_N, MASK_N); g.globalCompositeOperation = 'lighter';
  const r = mulberry(99);
  for (const pen of pens.values()){ if (pen.kind === 'lagoon') continue; g.fillStyle = 'rgb(0,120,0)'; g.fillRect((pen.i0 + O) * tp + 1, (pen.j0 + O) * tp + 1, (pen.i1 - pen.i0 + 1) * tp - 2, (pen.j1 - pen.j0 + 1) * tp - 2);
    for (let k = 0; k < (pen.i1 - pen.i0 + 1) * (pen.j1 - pen.j0 + 1) * 6; k++){ g.fillStyle = `rgba(0,${60 + r() * 120 | 0},0,0.6)`; const x = (pen.i0 + O + r() * (pen.i1 - pen.i0 + 1)) * tp, y = (pen.j0 + O + r() * (pen.j1 - pen.j0 + 1)) * tp; g.beginPath(); g.arc(x, y, 1 + r() * 4, 0, TAU); g.fill(); } }
  g.fillStyle = 'rgb(255,0,0)';
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++) if (tileType[idx(i, j)] === T_PATH){ const pi = i + O, pj = j + O;
    const L = isPath(i - 1, j), R = isPath(i + 1, j), U = isPath(i, j - 1), D = isPath(i, j + 1); const ins = tp * 0.14;
    g.fillRect(pi * tp + (L ? 0 : ins), pj * tp + (U ? 0 : ins), tp - (L ? 0 : ins) - (R ? 0 : ins), tp - (U ? 0 : ins) - (D ? 0 : ins)); }
  // v7 path edging: a worn soil band just outside the gravel (blue channel), plus stone curbs at the detailed settings
  g.fillStyle = 'rgb(0,0,255)'; const bw = tp * 0.1;
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++) if (tileType[idx(i, j)] === T_PATH){ const pi = i + O, pj = j + O;
    const L = isPath(i - 1, j), R = isPath(i + 1, j), U = isPath(i, j - 1), D = isPath(i, j + 1); const ins = tp * 0.14;
    if (!L) g.fillRect(pi * tp + ins - bw, pj * tp, bw, tp); if (!R) g.fillRect((pi + 1) * tp - ins, pj * tp, bw, tp);
    if (!U) g.fillRect(pi * tp, pj * tp + ins - bw, tp, bw); if (!D) g.fillRect(pi * tp, (pj + 1) * tp - ins, tp, bw); }
  g.fillStyle = 'rgb(255,0,0)';
  // gate apron
  g.fillRect((GATE.i + O) * tp, (GATE.j + O) * tp, tp * 2, tp * 3); rebuildCurbs();
  maskTex.needsUpdate = true;
}

const _yAxis = new THREE.Vector3(0, 1, 0);
const curbIM = new THREE.InstancedMesh(M.curbGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 2600); curbIM.count = 0; curbIM.receiveShadow = true; curbIM.castShadow = false; scene.add(curbIM);
function rebuildCurbs(){ const _m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), ins = TILE * 0.14; let n = 0;
  const put = (x, z, len, alongZ) => { if (n >= curbIM.instanceMatrix.count || len < 0.3) return; q.setFromAxisAngle(_yAxis, alongZ ? Math.PI / 2 : 0); s.set(len, 1, 1); p.set(x, H(x, z) - 0.02, z); _m.compose(p, q, s); curbIM.setMatrixAt(n++, _m); };
  for (let j = LO; j < HI; j++) for (let i = LO; i < HI; i++) if (tileType[idx(i, j)] === T_PATH && j < GATE.j){
    const L = isPath(i - 1, j), R = isPath(i + 1, j), U = isPath(i, j - 1), D = isPath(i, j + 1); const x0 = eX(i), z0 = eX(j);
    const za = z0 + (U ? 0 : ins), zb = z0 + TILE - (D ? 0 : ins), xa = x0 + (L ? 0 : ins), xb = x0 + TILE - (R ? 0 : ins);
    if (!L) put(x0 + ins - 0.06, (za + zb) / 2, zb - za, true); if (!R) put(x0 + TILE - ins + 0.06, (za + zb) / 2, zb - za, true);
    if (!U) put((xa + xb) / 2, z0 + ins - 0.06, xb - xa, false); if (!D) put((xa + xb) / 2, z0 + TILE - ins + 0.06, xb - xa, false); }
  curbIM.count = n; curbIM.instanceMatrix.needsUpdate = true; curbIM.computeBoundingSphere(); curbIM.visible = detailHi(); }

/* ---------- buildings ---------- */
const bldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
const bldGeoCache = {};
const detailHi = () => QUALITY.level >= 1; // v7: detailed buildings, fences, guests, curbs and ground cover above the low setting
function bldGeo(type, hi = detailHi()){ const k = type + (hi ? ':h' : ':l'); return bldGeoCache[k] || (bldGeoCache[k] = M.buildingGeo(type, hi)); }
bldMat.map = canvasTex(M.signAtlasCanvas(), true, false); // v7: building signs live in the building geometry (one draw call per building); bodies sample the atlas' white row
const bldMats = {};
function bldMatFor(id){ if (!id || id === 'classic') return bldMat; if (bldMats[id]) return bldMats[id]; const P = M.BLD_PALETTES.find(p => p.id === id); if (!P || !P.cols) return bldMat;
  const m = bldMat.clone(); m.map = bldMat.map; const cols = P.cols.map(h => new THREE.Color(h));
  m.onBeforeCompile = sh => { sh.uniforms.uPal = { value: cols };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aPal; uniform vec3 uPal[3];')
      .replace('#include <color_vertex>', '#include <color_vertex>\n  if (aPal.x > 0.5){ vec3 pc = aPal.x < 1.5 ? uPal[0] : aPal.x < 2.5 ? uPal[1] : uPal[2]; vColor.rgb = pc * aPal.y; }'); };
  m.customProgramCacheKey = () => 'bldpal'; return (bldMats[id] = m); }
function palOf(b){ return (b && b.pal) || (G && G.bldPal) || 'classic'; }
function setBldPal(g, id){ if (g && g.userData.body) g.userData.body.material = bldMatFor(id); }
function applyPalettes(){ for (const b of buildings.values()) if (b.mesh) setBldPal(b.mesh, palOf(b)); if (gateMesh) setBldPal(gateMesh, palOf(null)); }
function setBldDetail(g, hi){ const u = g.userData; if (!u.btype) return; u.body.geometry = bldGeo(u.btype, hi); }
function applyBuildingDetail(){ const hi = detailHi(); for (const b of buildings.values()) if (b.mesh) setBldDetail(b.mesh, hi); if (gateMesh) setBldDetail(gateMesh, hi); }
const signTex = canvasTex(M.signCanvas('PRIMEVAL PARK', 'ISLA SOMBRA  -  EST. 2026'), true, false);
function makeBuildingMesh(type){
  const g = new THREE.Group(); const m = new THREE.Mesh(bldGeo(type), bldMat); m.castShadow = true; m.receiveShadow = true; g.add(m); g.userData.btype = type; g.userData.body = m;
  if (type === 'gate'){ const s = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 2.4), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 })); s.position.set(0, 9.2, 0.6); g.add(s);
    const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.6; g.add(s2);
    for (const sd of [-1, 1]){ const f = new THREE.PointLight(0xff9a40, 0, 18, 2); f.position.set(sd * 5.2, 13.2, 0); g.add(f); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.set(1.6, 2.2, 1); fl.position.set(sd * 5.2, 13.3, 0); g.add(fl); g.userData.flames = (g.userData.flames || []).concat(fl); } }
  return g;
}
function footprint(type, rot){ const f = M.FOOT[type] || [1, 1]; return (Math.abs(Math.sin(rot)) > 0.5) ? [f[1], f[0]] : [f[0], f[1]]; }
function canPlace(type, i, j){
  ensureTestUnlock();
  const B = BUILD[type]; const [w, h] = footprint(type, 0);
  if (B.inPen){ if (!inGrid(i, j)) return { ok: false, why: 'Outside the park' }; const k = idx(i, j); if (tileType[k] !== T_PEN) return { ok: false, why: 'Feeders go inside an enclosure' };
    const pen = pens.get(tileRef[k]); if (pen.feeders.some(f => f.i === i && f.j === j)) return { ok: false, why: 'Tile already has a feeder' };
    if (type === 'water' && (pen.kind === 'lake' || pen.kind === 'lagoon')) return { ok: false, why: 'This enclosure already has water' };
    if (pen.kind === 'lagoon' && type !== 'fish') return { ok: false, why: 'Only a Fish Chute works in a lagoon' };
    if (type !== 'fish' && lakeAt(tX(i), tZ(j)) && H(tX(i), tZ(j)) < lakeAt(tX(i), tZ(j)).wl + 0.2) return { ok: false, why: 'Put it on dry ground, not in the lake' };
    return { ok: true, pen }; }
  for (let dj = 0; dj < h; dj++) for (let di = 0; di < w; di++){ const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) return { ok: false, why: 'Outside the park' }; const t = tileType[idx(ii, jj)]; if (type === 'stand' && t === T_BLOCK && tileBase[idx(ii, jj)] === T_BLOCK && Math.abs(H(tX(ii), tZ(jj))) < 2.5) continue; if (t !== T_EMPTY) return { ok: false, why: lockWhyAt(ii, jj) }; }
  return { ok: true };
}
function faceRot(i, j, w, h){
  const sides = [[0, 0, h, 1, 0], [Math.PI / 2, w, 0, 0, 1], [Math.PI, 0, -1, 1, 0], [-Math.PI / 2, -1, 0, 0, 1]];
  for (const [rot, ox, oz, sx, sz] of sides){ const n = sx ? w : h; for (let k = 0; k < n; k++){ const ii = i + ox + sx * k, jj = j + oz + sz * k; if (isPath(ii, jj)) return rot; } }
  return 0;
}
function placeBuilding(type, i, j, opts = {}){
  const B = BUILD[type]; const [w, h] = footprint(type, 0); const id = opts.id || G.nextId++;
  const b = { id, type, i, j, w, h, rot: 0, pen: -1, pal: opts.pal || null };
  if (B.inPen){ const pen = pens.get(tileRef[idx(i, j)]); b.pen = pen.id; pen.feeders.push({ id, type, i, j }); }
  else for (let dj = 0; dj < h; dj++) for (let di = 0; di < w; di++){ const k = idx(i + di, j + dj); tileType[k] = T_BUILD; tileRef[k] = id; }
  b.rot = opts.rot !== undefined ? opts.rot : (B.inPen ? 0 : faceRot(i, j, w, h));
  const cx = tX(i) + (w - 1) * TILE / 2, cz = tZ(j) + (h - 1) * TILE / 2; let mn = 99; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) mn = Math.min(mn, H(cx + dx * w * TILE * 0.45, cz + dz * h * TILE * 0.45));
  if (!B.inPen && type !== 'stand'){ let ex = false, gr = 0; for (let dj = 0; dj < h; dj++) for (let di = 0; di < w; di++){ const k = idx(i + di, j + dj); if (tileBase[k] === T_LOCK || tileGrade[k] > 0){ ex = true; gr = Math.max(gr, tileGrade[k]); } }
    if (ex && gr > 0.5){ let s2 = 0; const S = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]; for (const [dx, dz] of S) s2 += H(cx + dx * w * TILE * 0.45, cz + dz * h * TILE * 0.45); // v10: level a pad on rough ground
      const pad = { x0: eX(i) + 0.4, z0: eX(j) + 0.4, x1: eX(i + w) - 0.4, z1: eX(j + h) - 0.4, h: s2 / S.length, sk: 3.5 }; PADS.push(pad); b.pad = pad; retopo(pad.x0 - 4, pad.z0 - 4, pad.x1 + 4, pad.z1 + 4); mn = pad.h; } }
  if (b.pen >= 0){ const pp = pens.get(b.pen); const L = lakeAt(cx, cz); if (pp && pp.kind === 'lagoon') mn = 0.15; else if (L && mn < L.wl) mn = L.wl + 0.05; }
  if (type === 'stand') mn = Math.max(mn, 0.25);
  const mesh = makeBuildingMesh(type); mesh.position.set(cx, mn - 0.05, cz); setBldPal(mesh, palOf(b)); mesh.rotation.y = b.rot; scene.add(mesh); b.mesh = mesh; b.x = cx; b.z = cz;
  buildings.set(id, b); camObsDirty = true; return b;
}
function removeBuilding(b){
  scene.remove(b.mesh); buildings.delete(b.id); camObsDirty = true;
  if (b.pad){ const n = PADS.indexOf(b.pad); if (n >= 0) PADS.splice(n, 1); retopo(b.pad.x0 - 4, b.pad.z0 - 4, b.pad.x1 + 4, b.pad.z1 + 4); b.pad = null; }
  if (b.type === 'station') monoStationGone(b);
  if (b.pen >= 0){ const pen = pens.get(b.pen); if (pen) pen.feeders = pen.feeders.filter(f => f.id !== b.id); }
  else for (let dj = 0; dj < b.h; dj++) for (let di = 0; di < b.w; di++){ const k = idx(b.i + di, b.j + dj); tileType[k] = tileBase[k] === T_BLOCK ? T_BLOCK : T_EMPTY; tileRef[k] = -1; }
}

/* ---------- pens + fences ---------- */
const fenceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 });
const chainMat = new THREE.MeshStandardMaterial({ map: TEX.chain, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6, color: 0xbfc4c2 });
const FENCE_GEO = FT.map((_, t) => [M.fenceGeos(t, false), M.fenceGeos(t, true)]);
function applyFenceDetail(){ const hi = detailHi() ? 1 : 0; FENCE_IM.forEach((F, t) => { const g = FENCE_GEO[t][hi]; F.post.geometry = g.post; F.panel.geometry = g.panel; }); }
const FENCE_IM = FT.map((_, t) => { const g = FENCE_GEO[t][1]; const mk = (geo, mat, cast) => { const im = new THREE.InstancedMesh(geo, mat, 1400); im.count = 0; im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
  return { post: mk(g.post, fenceMat, true), panel: mk(g.panel, fenceMat, true), mesh: g.mesh ? mk(g.mesh, chainMat, false) : null }; });
const BUOY = { count0: 900, im: new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 6), new THREE.MeshStandardMaterial({ roughness: 0.5 }), 900), rope: new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: 0x2a2a24, roughness: 0.8 }), 900) };
for (const im of [BUOY.im, BUOY.rope]){ im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; scene.add(im); } BUOY.im.setColorAt(0, new THREE.Color(1, 1, 1));
/* v9 enclosure dressing: aviary net dome, lake water */
const netTex = TEX.chain.clone(); netTex.needsUpdate = true; netTex.repeat.set(1, 1);
const netMat = new THREE.MeshStandardMaterial({ map: netTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.55, color: 0xb8bcb8 });
const archMat = new THREE.MeshStandardMaterial({ color: 0x5a605c, roughness: 0.5, metalness: 0.6 });
const lakeMat = waterMat.clone(); lakeMat.color.set(0x2a5648); lakeMat.opacity = 0.8;
function aviaryGeo(w, d, Hd){ const g = new THREE.PlaneGeometry(1, 1, 22, 22); const p = g.attributes.position, uv = g.attributes.uv;
  for (let k = 0; k < p.count; k++){ const U = p.getX(k) * 2, V = p.getY(k) * 2; const r = Math.max(Math.abs(U), Math.abs(V)); const y = Hd * Math.sqrt(Math.max(0, 1 - Math.pow(r, 7)));
    const x = U * w / 2, z = V * d / 2; p.setXYZ(k, x, y, z); uv.setXY(k, (x + z * 0.2) / 2.2, (z * 0.8 + y) / 2.2); }
  g.computeVertexNormals();
  const arch = []; for (const ax of [0, 1]) for (const t of [-0.5, 0, 0.5]){ const pts = []; for (let n = 0; n <= 16; n++){ const a = -1 + n / 8; const U = ax ? t : a, V = ax ? a : t; const r = Math.max(Math.abs(U), Math.abs(V)); pts.push(new THREE.Vector3(U * w / 2, Hd * Math.sqrt(Math.max(0, 1 - Math.pow(r, 7))) + 0.05, V * d / 2)); }
    arch.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 5, false)); }
  return { net: g, arch: mergeGeometries(arch.map(a => a.toNonIndexed ? a.toNonIndexed() : a), false) }; }
function clearDeco(pen){ if (pen.deco){ for (const m of pen.deco){ scene.remove(m); m.geometry.dispose(); } } pen.deco = null; }
function penDeco(pen){ clearDeco(pen); const x0 = eX(pen.i0), x1 = eX(pen.i1 + 1), z0 = eX(pen.j0), z1 = eX(pen.j1 + 1), w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (pen.kind === 'aviary'){ const Hd = clamp(Math.min(w, d) * 0.55, 12, 22); pen.domeH = Hd; let base = 1e9; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [cx, cz]]) base = Math.min(base, H(x, z));
    const G2 = aviaryGeo(w, d, Hd); const net = new THREE.Mesh(G2.net, netMat), arch = new THREE.Mesh(G2.arch, archMat); for (const m of [net, arch]){ m.position.set(cx, base + FENCE_H[pen.tier] * 0.6, cz); m.castShadow = m === arch; m.receiveShadow = false; scene.add(m); } pen.deco = [net, arch]; }
  if (pen.kind === 'lake' && pen.lake){ const L = pen.lake; const m = new THREE.Mesh(new THREE.PlaneGeometry(L.x1 - L.x0, L.z1 - L.z0).rotateX(-Math.PI / 2), lakeMat); m.position.set((L.x0 + L.x1) / 2, L.wl, (L.z0 + L.z1) / 2); m.renderOrder = 2; m.receiveShadow = true; scene.add(m); pen.deco = [m]; } }
function digLake(pen){ const L = { x0: eX(pen.i0) + TILE * 0.75, x1: eX(pen.i1 + 1) - TILE * 0.75, z0: eX(pen.j0) + TILE * 0.75, z1: eX(pen.j1 + 1) - TILE * 0.75, depth: 2.8, shore: 9 };
  let s = 0, n = 0; for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++){ s += Hgen(lerp(L.x0, L.x1, a / 4), lerp(L.z0, L.z1, b / 4), true); n++; } L.wl = s / n - 0.75; pen.lake = L; LAKES.push(L); retopo(L.x0, L.z0, L.x1, L.z1); }
function fillLake(pen){ const L = pen.lake; if (!L) return; const k = LAKES.indexOf(L); if (k >= 0) LAKES.splice(k, 1); retopo(L.x0, L.z0, L.x1, L.z1); pen.lake = null; }
// lagoons: open water at least 2 m deep and well clear of the pier and both ferry lanes
function lagoonClear(x, z){ const dseg = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  for (const R of [PIER, DOCKH]){ const dx = Math.max(R.x0 - x, 0, x - R.x1), dz = Math.max(R.z0 - z, 0, z - R.z1); if (Math.hypot(dx, dz) < 24) return false; }
  for (const RT of [ROUTE_IN, ROUTE_OUT]) for (let k = 0; k + 1 < RT.length; k++) if (dseg(RT[k][0], RT[k][1], RT[k + 1][0], RT[k + 1][1]) < 24) return false; return true; }
function penSegments(pen){
  const segs = []; const { i0, i1, j0, j1 } = pen;
  for (let i = i0; i <= i1; i++) segs.push([eX(i), eX(j0), eX(i + 1), eX(j0), 0, -1]);
  for (let i = i0; i <= i1; i++) segs.push([eX(i), eX(j1 + 1), eX(i + 1), eX(j1 + 1), 0, 1]);
  for (let j = j0; j <= j1; j++) segs.push([eX(i0), eX(j), eX(i0), eX(j + 1), -1, 0]);
  for (let j = j0; j <= j1; j++) segs.push([eX(i1 + 1), eX(j), eX(i1 + 1), eX(j + 1), 1, 0]);
  return segs;
}
function rebuildFences(){ camObsDirty = true;
  const _m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(); const counts = FT.map(() => [0, 0, 0]);
  let nb = 0, nr = 0; const BC = [new THREE.Color(0xd8402a), new THREE.Color(0xf2efe6)];
  for (const pen of pens.values()){
    if (pen.kind === 'lagoon'){ // sea nets: a buoy line on the surface, coloured by strength
      pen.geom.forEach((sg, k) => { const [ax, az, bx, bz] = sg; const st = pen.segs[k]; const T = performance.now();
        for (const [x, z, f] of [[ax, az, 0], [(ax + bx) / 2, (az + bz) / 2, 1]]){ if (nb >= BUOY.count0) break; _m.compose(p.set(x, 0.12, z), q.identity(), s.setScalar(f ? 0.8 : 1.15 - pen.tier * 0.0)); BUOY.im.setMatrixAt(nb, _m); BUOY.im.setColorAt(nb, BC[(k + f) % 2]); nb++; }
        if (!st.broken && nr < BUOY.count0){ e.set(0, ax === bx ? Math.PI / 2 : 0, 0); q.setFromEuler(e); _m.compose(p.set((ax + bx) / 2, 0.06, (az + bz) / 2), q, s.set(1, 1 + pen.tier * 0.6, 1)); BUOY.rope.setMatrixAt(nr++, _m); } });
      continue; }
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
  BUOY.im.count = nb; BUOY.rope.count = nr; BUOY.im.visible = nb > 0; BUOY.rope.visible = nr > 0; BUOY.im.instanceMatrix.needsUpdate = true; if (BUOY.im.instanceColor) BUOY.im.instanceColor.needsUpdate = true; BUOY.rope.instanceMatrix.needsUpdate = true;
  FENCE_IM.forEach((F, t) => { F.post.count = counts[t][0]; F.panel.count = counts[t][1]; F.post.instanceMatrix.needsUpdate = true; F.panel.instanceMatrix.needsUpdate = true; if (F.mesh){ F.mesh.count = counts[t][2]; F.mesh.instanceMatrix.needsUpdate = true; } });
}
function penCanBuild(i0, j0, i1, j1, kind = 'land'){
  ensureTestUnlock();
  if (i1 - i0 < 2 || j1 - j0 < 2) return { ok: false, why: 'Enclosures must be at least 3 x 3 tiles' };
  if (i1 - i0 > 15 || j1 - j0 > 15) return { ok: false, why: 'Maximum size is 16 x 16 tiles' };
  if (kind === 'lake' && (i1 - i0 < 4 || j1 - j0 < 4)) return { ok: false, why: 'A lake enclosure needs at least 5 x 5 tiles' };
  if (kind === 'lake' && !lakeRegionOk(i0, j0, i1, j1)) return { ok: false, why: 'Lake enclosures can only be built in the River Valley (unlock it in Park).' };
  if (kind === 'lagoon'){ if (i1 - i0 < 3 || j1 - j0 < 3) return { ok: false, why: 'A lagoon needs at least 4 x 4 tiles' };
    if (!lagoonRegionOk(i0, j0, i1, j1)) return { ok: false, why: 'Ocean lagoons can only be built on the Beach Coast (unlock it in Park).' };
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ if (!inGrid(i, j)) return { ok: false, why: 'Outside the park' }; const k = idx(i, j);
      if (tileType[k] !== T_BLOCK || tileBase[k] !== T_BLOCK || H(tX(i), tZ(j)) > -1.6) return { ok: false, why: tileType[k] === T_PEN ? 'Overlaps another enclosure' : 'Lagoons go on open sea at least 2 m deep' };
      if (!lagoonClear(tX(i), tZ(j))) return { ok: false, why: 'Too close to the pier or the ferry lane (keep 24 m clear)' }; }
    return { ok: true }; }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ if (!inGrid(i, j)) return { ok: false, why: 'Outside the park' }; const t = tileType[idx(i, j)]; if (t !== T_EMPTY) return { ok: false, why: lockWhyAt(i, j) }; }
  return { ok: true };
}
function penCost(i0, j0, i1, j1, tier, kind = 'land'){ const per = 2 * (i1 - i0 + 1) + 2 * (j1 - j0 + 1), area = (i1 - i0 + 1) * (j1 - j0 + 1);
  return per * FT[tier].cost * (kind === 'lagoon' ? 1.3 : 1) + area * 60 + (kind === 'aviary' ? area * 700 : kind === 'lake' ? area * 450 : kind === 'lagoon' ? area * 150 : 0) + gradeCost(i0, j0, i1, j1, GRADE.pen); }
function createPen(i0, j0, i1, j1, tier, opts = {}){
  const kind = opts.kind || 'land'; const id = opts.id || G.nextId++; const pen = { id, i0, j0, i1, j1, tier, kind, feeders: [], name: opts.name || ((kind === 'aviary' ? 'Aviary ' : kind === 'lagoon' ? 'Lagoon ' : kind === 'lake' ? 'Lake ' : 'Enclosure ') + (pens.size + 1)) };
  pen.geom = penSegments(pen); pen.segs = pen.geom.map((_, k) => ({ cond: opts.segs ? opts.segs[k] : 1, broken: opts.broken ? opts.broken.includes(k) : false }));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const k = idx(i, j); tileType[k] = T_PEN; tileRef[k] = id; }
  pens.set(id, pen); if (kind === 'lake') digLake(pen); penDeco(pen); return pen;
}
function removePen(pen){
  for (const f of pen.feeders.slice()){ const b = buildings.get(f.id); if (b) removeBuilding(b); }
  for (const d of dinos.filter(d => d.pen === pen.id)) removeDino(d);
  for (let j = pen.j0; j <= pen.j1; j++) for (let i = pen.i0; i <= pen.i1; i++){ const k = idx(i, j); tileType[k] = pen.kind === 'lagoon' ? T_BLOCK : T_EMPTY; tileRef[k] = -1; }
  clearDeco(pen); fillLake(pen); pens.delete(pen.id);
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
function splash(x, y, z, n = 40, flash = true){ SFX.chomp(1); for (let k = 0; k < n && blood.length < 120; k++){ const a = rnd() * TAU, u = rnd(); blood.push({ x, y, z, vx: Math.cos(a) * u * 4, vy: 2 + rnd() * 4.5, vz: Math.sin(a) * u * 4, life: 0.6 + rnd() * 0.7, s: 0.6 + rnd() * 1.2 }); }
  if (flash){ $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 140); } }
function dust(x, z, size = 3, n = 6, col, y){ for (let k = 0; k < n; k++){ let s = dusts.find(d => !d.alive); if (!s){ if (dusts.length > 40) return; s = { sp: new THREE.Sprite(dustMat.clone()) }; scene.add(s.sp); dusts.push(s); }
  s.alive = true; s.t = 0; s.life = 1.2 + rnd() * 0.8; s.size = size * (0.6 + rnd() * 0.6); const a = rnd() * TAU; s.vx = Math.cos(a) * size * 0.5; s.vz = Math.sin(a) * size * 0.5; s.sp.position.set(x + Math.cos(a) * size * 0.3, (y ?? H(x, z)) + size * 0.25, z + Math.sin(a) * size * 0.3); s.sp.material.color.set(col || 0x9a8a6a); s.sp.visible = true; } }
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
  const used = new Set(dinos.map(d => d.name)); const name = cleanName(opts.name) || NAMES.find(n => !used.has(n)) || NAMES[(rnd() * NAMES.length) | 0];
  const d = { id: opts.id || G.nextId++, sp, pen: pen.id, x, z, hd: rnd() * TAU, v: 0, tx: x, tz: z, wait: 1 + rnd() * 3, state: opts.state || 'pen', hunger: opts.hunger ?? 0.25, thirst: opts.thirst ?? 0.2, stress: 0, alt: 0, huntCD: 4 + rnd() * 6, injT: 0, name, model, darts: 0, sleep: 0, sedT: 0, eatT: 0, roarCD: 5 + rnd() * 20, killCD: 0, fedSkip: opts.fedSkip || 0, lastStep: 0, visible: true };
  if (d.state === 'holding'){ model.root.visible = false; }
  const sc = opts.sc ?? (G.spScheme && G.spScheme[sp] ? G.spScheme[sp].sc : null), pt = opts.pt ?? (G.spScheme && G.spScheme[sp] ? G.spScheme[sp].pt : -1);
  if (sc && sc !== 'natural' || pt >= 0){ model.setScheme(sc || 'natural', pt); d.sc = sc || 'natural'; d.pt = pt; }
  dinos.push(d); placeDinoModel(d, 0); return d;
}
function removeDino(d){ scene.remove(d.model.root); dinos = dinos.filter(x => x !== d); for (const o of dinos){ if (o.hunt === d) endHunt(o); if (o.carc === d) o.carc = null; if (o.fleeFrom === d) o.fleeFrom = null; } if (sel && sel.kind === 'dino' && sel.ref === d) closeSheet(); }
function placeDinoModel(d, turn){ d.model.root.position.set(d.x, dinoY(d), d.z); d.model.root.rotation.y = d.hd; }
// v9 heights: swimmers ride just under the sea surface, fliers carry an altitude, waders sink to a lake's waterline
function dinoY(d){ const SD = SPECIES_DATA[d.sp], h = H(d.x, d.z);
  if (SD.mode === 'swim') return (d.state === 'carcass' ? -SD.size * 0.05 - (d.carcT || 0) * 0.04 : -SD.size * 0.035) + (d.breachY || 0);
  if (SD.mode === 'fly') return h + (d.alt || 0);
  const L = lakeAt(d.x, d.z); if (L && h < L.wl - 0.05) return SD.wader ? Math.max(h, L.wl - SD.hipH * 0.72) : Math.max(h, L.wl - SD.hipH * 0.25);
  return h; }
// v9: feederOf takes a species key (old callers passing 'meat'/'plant' still work); the preferred food wins
function feederOf(pen, sp){ const foods = FOODS[sp] || (sp === 'meat' ? ['meat'] : ['plant']); for (const t of foods){ const f = pen.feeders.find(f => f.type === t); if (f) return f; } return null; }
function foodScore(pen, sp){ const f = feederOf(pen, sp); if (!f) return 0.2; return (FOODS[sp] || [])[0] === f.type ? 1 : 0.8; }
function hasWater(pen){ return !!pen && (pen.kind === 'lake' || pen.kind === 'lagoon' || pen.feeders.some(f => f.type === 'water')); }
const needsWater = sp => habOf(sp) !== 'lagoon';
function waterFeeder(pen){ return pen.feeders.find(f => f.type === 'water'); }
function dinoComfort(d){
  const S = SPECIES[d.sp], pen = pens.get(d.pen); if (!pen) return { space: 1, social: 1, food: 1, mixed: false, total: 1 };
  const mates = dinos.filter(o => o.pen === pen.id && o.state !== 'holding' && o.state !== 'carcass'); const need = mates.reduce((a, o) => a + SPECIES[o.sp].space, 0);
  const space = clamp(penArea(pen) / Math.max(1, need), 0, 1); const same = mates.filter(o => o.sp === d.sp).length;
  const social = same < S.group[0] ? same / S.group[0] : same > S.group[1] ? S.group[1] / same : 1;
  const food = foodScore(pen, d.sp); const mixed = mates.some(o => SPECIES[o.sp].diet !== S.diet || (S.diet === 'meat' && o.sp !== d.sp));
  const water = !needsWater(d.sp) || hasWater(pen) ? 1 : 0;
  let total = clamp(space * 0.3 + social * 0.2 + food * 0.25 + water * 0.15 + (mixed ? 0 : 0.1), 0, 1);
  if ((d.sp === 'raptor' || d.sp === 'dilo') && regionOfPen(pen) === 'jungle') total = clamp(total + 0.15, 0, 1);
  return { space, social, food, water, mixed, total };
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
  if (d.state === 'carcass'){ updateCarcass(d, dt); return; }
  if (d.state === 'escaping'){ updateSwimmer(d, dt, pen, S, SD, turnRate); return; }
  if (d.state === 'sedated' || d.state === 'airlift'){
    d.sleep = damp(d.sleep, 1, 2, dt); d.v = damp(d.v, 0, 4, dt); d.sedT += dt; if (d.alt > 0){ d.alt = Math.max(0, d.alt - dt * 7); d.model.air = 0; }
    if (d.state === 'sedated' && d.sedT > 5){ d.state = 'airlift'; d.sedT = 0; dust(d.x, d.z, SD.size * 0.4, 8, 0xb0a890); }
    if (d.state === 'airlift'){ const k = d.sedT / 1.6; d.model.root.position.y += dt * 6 * k; if (k >= 1) returnDino(d); }
    d.model.sleep = d.sleep; d.model.animate(dt, 0, 0); if (d.state !== 'airlift') placeDinoModel(d); return;
  }
  d.sleep = damp(d.sleep, 0, 2, dt); d.model.sleep = d.sleep;
  if (SD.mode === 'swim'){ updateSwimmer(d, dt, pen, S, SD, turnRate); return; }
  if (SD.mode === 'fly'){ updateFlyer(d, dt, pen, S, SD); return; }
  if (d.injT > 0) d.injT -= dt;
  if (d.drinkT > 0){ d.drinkT -= dt; d.v = damp(d.v, 0, 5, dt); if (d.drinkT <= 0) d.thirst = 0; }
  else if (d.eatT > 0){ d.eatT -= dt; d.v = damp(d.v, 0, 5, dt); if (d.eatT <= 0){ d.hunger = 0; if (d.fedSkip > 0) d.fedSkip--; else spend('feed', S.feed / 2 * (FEED_MULT[d.eatType] || 1)); } }
  else if (d.state === 'pen' && pen){
    const m = Math.min(1.5 + SD.size * 0.16, (Math.min(pen.i1 - pen.i0, pen.j1 - pen.j0) + 1) * TILE / 2 - 0.5); const [x0, z0, x1, z1] = penRect(pen, m);
    if (d.prey && !d.prey.gone && d.prey.state === 'inpen'){
      speedMax = S.run; const g = d.prey; const dist = moveToward(d, g.x, g.z, speedMax, dt, turnRate * 2.6, true);
      if (dist < SD.size * 0.36 + 1.6 && !d.biting){ d.biting = true; d.model.setAction('bite', 0.7); setTimeout(() => { if (!g.gone){ eatGuest(d, g, true); } d.biting = false; d.prey = null; setTimeout(() => d.model.setAction('roar', 2.2), 900); if (d.sp === 'trex') setTimeout(() => SFX.roar(2.2, camVol(d.x, d.z)), 1000); }, 300); }
    } else if (huntTick(d, dt, pen, S.walk, S.run, turnRate, [x0, z0, x1, z1])){ /* stalking, chasing, fleeing or feeding on a kill */ }
    else {
      d.prey = null; const feeder = feederOf(pen, d.sp); const wt = d.thirst > 0.5 && needsWater(d.sp) ? waterSpot(d, pen) : null;
      if (d.hunger > 0.55 && feeder && !(wt && d.thirst > d.hunger)){ const fx = tX(feeder.i), fz = tZ(feeder.j); const reach = 2.2 + SD.size * 0.3; d.tx = fx; d.tz = fz;
        const dist = moveToward(d, fx, fz, speedMax, dt, turnRate); if (dist < reach){ d.eatT = 5; d.eatType = feeder.type; d.model.setAction('eat', 5); } }
      else if (wt){ const dist = moveToward(d, wt[0], wt[1], speedMax, dt, turnRate); if (dist < wt[2]){ d.drinkT = 4; d.model.setAction('drink', 4); } }
      else { d.wait -= dt; const dist = Math.hypot(d.tx - d.x, d.tz - d.z);
        if (dist < 1.2 || d.wait < -12){ if (d.wait <= 0){ if (d.stress > 0.55 && rnd() < 0.6){ // pace along the fence
              const side = (rnd() * 4) | 0; d.tx = side === 0 ? x0 : side === 1 ? x1 : fr(x0, x1); d.tz = side === 2 ? z0 : side === 3 ? z1 : fr(z0, z1); }
            else { const q = wanderPoint(d, pen, x0, z0, x1, z1); d.tx = q[0]; d.tz = q[1]; } d.wait = 1.5 + rnd() * 5; if (rnd() < 0.25 && d.roarCD < 0){ d.model.setAction('roar', 2); d.roarCD = 20 + rnd() * 40; if (S.diet === 'meat' || d.sp === 'trike' || d.sp === 'para') ambientCall(d); } else if (rnd() < 0.3) d.model.setAction('eat', 3); } }
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
    d.x = clamp(d.x, -WHALF + 6, WHALF - 6); d.z = clamp(d.z, -WHALF + 6, HALF - 4);
    if (H(d.x, d.z) < 0.4){ d.hd += Math.PI * dt; }
    if (d.roarCD < 0){ d.roarCD = 20 + rnd() * 20; d.model.setAction('roar', 2); ambientCall(d); }
  }
  // separation inside pens (a predator closing on its prey is allowed to touch it)
  if (d.state === 'pen') for (const o of dinos){ if (o === d || o.pen !== d.pen || o.state !== 'pen' || d.hunt === o || o.hunt === d) continue; const dx = d.x - o.x, dz = d.z - o.z, dd = Math.hypot(dx, dz), r = dinoRadius(d) + dinoRadius(o);
    if (dd < r && dd > 0.01){ const k = (r - dd) * 0.5 * Math.min(1, dt * 4); d.x += dx / dd * k; d.z += dz / dd * k; } }
  d.model.animate(dt, d.v, d.turn || 0); placeDinoModel(d);
}
function wanderLoose(d, dt, v, tr){ d.wait -= dt; const dist = Math.hypot(d.tx - d.x, d.tz - d.z); if (dist < 3 || d.wait < 0){ d.tx = clamp(d.x + fr(-40, 40), -WHALF + 10, WHALF - 10); d.tz = clamp(d.z + fr(-40, 40), -WHALF + 10, HALF - 10); d.wait = 6 + rnd() * 6; } moveToward(d, d.tx, d.tz, v, dt, tr); }
/* ---------- v9 water: water holes, lakes ---------- */
function lakeAt(x, z){ for (const L of LAKES) if (x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1) return L; return null; }
// where this animal should go to drink: [x, z, reach] or null when there is no water
function waterSpot(d, pen){ if (pen.kind === 'lake' && pen.lake){ const L = pen.lake; const x = clamp(d.x, L.x0 + 3.5, L.x1 - 3.5), z = clamp(d.z, L.z0 + 3.5, L.z1 - 3.5);
    const e = [[L.x0 + 3.5, z], [L.x1 - 3.5, z], [x, L.z0 + 3.5], [x, L.z1 - 3.5]].sort((a, b) => Math.hypot(a[0] - d.x, a[1] - d.z) - Math.hypot(b[0] - d.x, b[1] - d.z))[0]; return [e[0], e[1], 1.5 + SPECIES_DATA[d.sp].size * 0.25]; }
  const w = waterFeeder(pen); return w ? [tX(w.i), tZ(w.j), 2.2 + SPECIES_DATA[d.sp].size * 0.3] : null; }
// wander targets: land animals keep to the shore of a lake enclosure; waders (Spinosaurus, Sarcosuchus) spend most of their time in the water
function wanderPoint(d, pen, x0, z0, x1, z1){ const L = pen.kind === 'lake' ? pen.lake : null; const pt = () => [fr(x0, Math.max(x0, x1)), fr(z0, Math.max(z0, z1))];
  if (!L) return pt(); const wader = !!SPECIES_DATA[d.sp].wader;
  if (wader && rnd() < 0.7) return [fr(L.x0 + 4, L.x1 - 4), fr(L.z0 + 4, L.z1 - 4)];
  for (let n = 0; n < 12; n++){ const q = pt(); if (!lakeAt(q[0], q[1]) || wader) return q; } return pt(); }

/* ---------- v9 predation: carnivores sharing an enclosure stalk, chase and eat what they can overpower ---------- */
const absHour = () => G.day * 24 + G.hour;
function predationOn(){ return !G.predAt || absHour() >= G.predAt; }
function predPower(d){ const n = dinos.filter(o => o.pen === d.pen && o.sp === d.sp && o.state === 'pen').length; const pk = PACK[d.sp] || 0; return WT[d.sp] * Math.min(1 + pk * (n - 1), 1 + pk * 5); }
function canHunt(d, o){ if (o === d || o.sp === d.sp || o.state !== 'pen' || o.pen !== d.pen) return false; const S = SPECIES[d.sp], P = SPECIES[o.sp];
  if (S.diet !== 'meat' || habOf(d.sp) === 'aviary' || habOf(o.sp) === 'aviary') return false;
  if ((SPECIES_DATA[d.sp].mode === 'swim') !== (SPECIES_DATA[o.sp].mode === 'swim')) return false;
  const pw = predPower(d); return P.diet === 'meat' ? WT[o.sp] < pw * 0.6 : WT[o.sp] <= pw * 1.6; }
// who in this pen would hunt whom (for warnings): [{pred, prey}] by species
function huntPairs(pen, extraSp){ const sps = [...new Set(dinos.filter(o => o.pen === pen.id && o.state !== 'carcass' && o.state !== 'escaping').map(o => o.sp))]; if (extraSp && !sps.includes(extraSp)) sps.push(extraSp); const out = [];
  for (const a of sps) for (const b of sps){ if (a === b || SPECIES[a].diet !== 'meat' || habOf(a) === 'aviary' || habOf(b) === 'aviary') continue; if ((SPECIES_DATA[a].mode === 'swim') !== (SPECIES_DATA[b].mode === 'swim')) continue;
    const n = Math.max(1, dinos.filter(o => o.pen === pen.id && o.sp === a).length + (a === extraSp ? 1 : 0)); const pw = WT[a] * Math.min(1 + (PACK[a] || 0) * (n - 1), 1 + (PACK[a] || 0) * 5);
    if (SPECIES[b].diet === 'meat' ? WT[b] < pw * 0.6 : WT[b] <= pw * 1.6) out.push({ pred: a, prey: b }); } return out; }
function endHunt(d){ const o = d.hunt; if (o && o.fleeFrom === d) o.fleeFrom = null; d.hunt = null; d.huntT = 0; d.biteT = 0; }
// returns true when it took over this animal's movement for the frame
function huntTick(d, dt, pen, walk, run, turnRate, rect){ const SD = SPECIES_DATA[d.sp];
  if (d.carc){ const c = d.carc; if (!dinos.includes(c) || c.state !== 'carcass'){ d.carc = null; return false; }
    const reach = 1.2 + SD.size * 0.35 + SPECIES_DATA[c.sp].size * 0.25; const dist = moveToward(d, c.x, c.z, walk, dt, turnRate);
    if (dist < reach){ d.v = damp(d.v, 0, 6, dt); if (!d.model.action) d.model.setAction('eat', 3); d.carcEat = (d.carcEat || 0) + dt; d.hunger = Math.max(0, d.hunger - dt * 0.05); if (d.carcEat > 14){ d.hunger = 0; d.fedSkip = Math.max(d.fedSkip, 2); d.carc = null; c.carcT = Math.max(c.carcT, 40); } }
    return true; }
  if (d.fleeFrom){ const p = d.fleeFrom; if (!dinos.includes(p) || p.hunt !== d || p.state !== 'pen'){ d.fleeFrom = null; return false; }
    const dx = d.x - p.x, dz = d.z - p.z, dl = Math.hypot(dx, dz) || 1; const [x0, z0, x1, z1] = rect; let tx = d.x + dx / dl * 14, tz = d.z + dz / dl * 14;
    if (tx < x0 + 1 || tx > x1 - 1 || tz < z0 + 1 || tz > z1 - 1){ tx = d.x - dz / dl * 14 * (d.id % 2 ? 1 : -1); tz = d.z + dx / dl * 14 * (d.id % 2 ? 1 : -1); } // cornered: break sideways
    moveToward(d, clamp(tx, x0, x1), clamp(tz, z0, z1), run, dt, turnRate * 1.8, true); d.stress = clamp(d.stress + dt * 0.01, 0, 1); return true; }
  if (d.hunt){ const o = d.hunt; if (!dinos.includes(o) || o.state !== 'pen' || o.pen !== d.pen){ endHunt(d); return false; }
    d.huntT += dt; const dist = Math.hypot(o.x - d.x, o.z - d.z); const reach = SD.size * 0.36 + SPECIES_DATA[o.sp].size * 0.22 + 1.2;
    const stalk = d.huntT < 5 && dist > 14; moveToward(d, o.x, o.z, stalk ? walk * 0.8 : run, dt, turnRate * (stalk ? 1 : 2.4), !stalk);
    if (!stalk || dist < 16) o.fleeFrom = d;
    if (d.biteT > 0){ d.biteT -= dt; if (d.biteT <= 0) resolveAttack(d, o); }
    else if (dist < reach){ d.biteT = 0.35; d.model.setAction('bite', 0.7); }
    if (d.huntT > 30){ endHunt(d); d.huntCD = 40 + rnd() * 20; o.stress = clamp(o.stress + 0.2, 0, 1); }
    return true; }
  d.huntCD = (d.huntCD ?? 3) - dt;
  if (d.huntCD <= 0){ d.huntCD = 2 + rnd() * 2;
    if (SPECIES[d.sp].diet === 'meat' && d.hunger > 0.4 && (d.injT || 0) <= 0 && predationOn()){ const fd = feederOf(pen, d.sp);
      if (!fd || d.hunger > 0.75 || rnd() < 0.3){ let best = null, bd = 1e9; for (const o of dinos){ if (!canHunt(d, o) || (o.fleeFrom && o.fleeFrom !== d)) continue; const dd = Math.hypot(o.x - d.x, o.z - d.z); if (dd < bd){ bd = dd; best = o; } }
        if (best){ d.hunt = best; d.huntT = 0; d.biteT = 0; } } } }
  return false; }
function resolveAttack(d, o){ const pen = pens.get(d.pen); if (!pen || o.state !== 'pen') { endHunt(d); return; }
  const pw = predPower(d); const D = (DEFENSE[o.sp] || 0.08) * clamp(WT[o.sp] / pw, 0.4, 1.5); const r = rnd(); const S = SPECIES[d.sp], P = SPECIES[o.sp];
  if (r < D){ endHunt(d); o.fleeFrom = null; o.model.setAction('roar', 1.4); dust(o.x, o.z, 3, 6);
    if (r < D * 0.18 && WT[o.sp] >= pw * 0.6){ killDino(d, o, `${P.short} "${o.name}" fought back and killed ${S.short} "${d.name}" in ${pen.name}. ${fmt(S.cost)} animal lost.`); o.stress = 1; return; }
    d.injT = 60; d.huntCD = 45 + rnd() * 30; d.stress = clamp(d.stress + 0.3, 0, 1); o.stress = clamp(o.stress + 0.4, 0, 1); d.model.setAction('roar', 1); G.stats.fights = (G.stats.fights || 0) + 1;
    toast(`${P.short} "${o.name}" fought off ${S.short} "${d.name}". ${d.name} is injured and backs off.`, 'bad'); return; }
  d.hunt = null; d.huntT = 0; d.carc = o; d.carcEat = 0; d.hunger = Math.max(0, d.hunger - 0.3); setTimeout(() => { if (dinos.includes(d)){ d.model.setAction('roar', 2); vocal(d); } }, 900);
  killDino(o, d, `${S.short} "${d.name}" killed ${P.short} "${o.name}" in ${pen.name} and is eating it. ${fmt(P.cost)} animal lost.`); }
// the victim becomes a carcass (still visible, lying down) until it has been eaten
function killDino(o, killer, msg){ const SD = SPECIES_DATA[o.sp]; for (const x of dinos){ if (x.hunt === o) endHunt(x); if (x.fleeFrom === o) x.fleeFrom = null; } endHunt(o); o.fleeFrom = null; o.carc = null;
  o.state = 'carcass'; o.carcT = 0; o.v = 0; o.prey = null; o.alt = 0; if (o.model.air !== undefined) o.model.air = 0;
  const y = dinoY(o) + SD.hipH * 0.6; splash(o.x, y, o.z, 30, camVol(o.x, o.z) > 0.15); dust(o.x, o.z, SD.size * 0.3, 8, 0x8a5a4a);
  G.stats.kills = (G.stats.kills || 0) + 1; G.stats.lostValue = (G.stats.lostValue || 0) + SPECIES[o.sp].cost; G.thrill = Math.min(3, G.thrill + 0.6);
  for (const g of guests){ if (g.gone || (g.state !== 'walk' && g.state !== 'leave')) continue; const dd = Math.hypot(g.x - o.x, g.z - o.z); if (dd > 50) continue; if (rnd() < 0.3) panicGuest(g, 6); else { g.happy = Math.min(100, g.happy + 7); g.thrilled = 1; } }
  toast(msg, 'bad'); if (sel && sel.kind === 'dino' && sel.ref === o) closeSheet(); refreshSheet(); }
function updateCarcass(d, dt){ d.carcT += dt; d.sleep = damp(d.sleep, 1, 3, dt); d.model.sleep = 1; d.v = 0; if (d.model.near !== false || (G.tick | 0) % 4 === 0) d.model.animate(dt, 0, 0); placeDinoModel(d);
  const eaten = !dinos.some(x => x.carc === d); if (d.carcT > (eaten ? 45 : 120)){ dust(d.x, d.z, SPECIES_DATA[d.sp].size * 0.3, 6); removeDino(d); } }

/* ---------- v9 swimmers: lagoon (marine reptiles) ---------- */
function updateSwimmer(d, dt, pen, S, SD, turnRate){ const sp = S.swim || 4;
  if (d.breachT > 0){ d.breachT -= dt; const k = 1 - d.breachT / 1.3; d.breachY = Math.sin(clamp(k, 0, 1) * Math.PI) * SD.size * 0.16; d.model.pitch = Math.cos(clamp(k, 0, 1) * Math.PI) * 0.55; if (d.breachT <= 0){ d.breachY = 0; d.model.pitch = 0; } }
  if (d.state === 'escaping'){ d.lostT += dt; const a = Math.atan2(d.x, d.z); moveToward(d, d.x + Math.sin(a) * 80, d.z + Math.cos(a) * 80, sp, dt, turnRate);
    d.model.animate(dt, d.v, d.turn || 0); placeDinoModel(d); d.model.root.position.y -= d.lostT * 0.08; if (d.lostT > 22) removeDino(d); return; }
  if (d.state !== 'pen' || !pen){ d.v = 0; d.model.animate(dt, 0, 0); placeDinoModel(d); return; }
  const m = Math.min(2 + SD.size * 0.2, (Math.min(pen.i1 - pen.i0, pen.j1 - pen.j0) + 1) * TILE / 2 - 0.5); const rect = penRect(pen, m); const [x0, z0, x1, z1] = rect;
  if (d.prey && !d.prey.gone && d.prey.state === 'inpen'){ const g = d.prey; const dist = moveToward(d, g.x, g.z, sp * 1.3, dt, turnRate * 2.2, true);
    if (dist < SD.size * 0.3 + 1.5 && !d.biting){ d.biting = true; d.breachT = 1.3; d.model.setAction('bite', 0.9); dust(g.x, g.z, 4, 10, 0xe8f2f2, 0.2);
      setTimeout(() => { if (!g.gone) eatGuest(d, g, true); d.biting = false; d.prey = null; dust(d.x, d.z, 6, 12, 0xe8f2f2, 0.2); }, 650); } }
  else if (huntTick(d, dt, pen, sp * 0.6, sp * 1.25, turnRate * 1.3, rect)){ /* hunting another swimmer */ }
  else { const feeder = feederOf(pen, d.sp);
    if (d.eatT > 0){ d.eatT -= dt; moveToward(d, d.tx, d.tz, sp * 0.3, dt, turnRate); if (d.eatT <= 0){ d.hunger = 0; if (d.fedSkip > 0) d.fedSkip--; else spend('feed', S.feed / 2 * (FEED_MULT[d.eatType] || 1)); } }
    else if (d.hunger > 0.55 && feeder){ const fx = tX(feeder.i), fz = tZ(feeder.j); const dist = moveToward(d, fx, fz, sp * 0.7, dt, turnRate); d.tx = fx; d.tz = fz; if (dist < 2 + SD.size * 0.3){ d.eatT = 4; d.eatType = feeder.type; d.model.setAction('bite', 0.8); dust(fx, fz, 3, 6, 0xe8f2f2, 0.2); } }
    else { const dist = Math.hypot(d.tx - d.x, d.tz - d.z); if (dist < 3 || (d.wait -= dt) < -20){ d.tx = fr(x0, Math.max(x0, x1)); d.tz = fr(z0, Math.max(z0, z1)); d.wait = 0; }
      moveToward(d, d.tx, d.tz, sp * (0.35 + 0.25 * d.stress), dt, turnRate * 0.8); d.v = Math.max(d.v, sp * 0.18); } }
  d.x = clamp(d.x, x0, Math.max(x0, x1)); d.z = clamp(d.z, z0, Math.max(z0, z1));
  if (d.roarCD < 0 && rnd() < dt * 0.05){ d.roarCD = 30 + rnd() * 40; d.breachT = d.breachT > 0 ? d.breachT : 1.3; dust(d.x, d.z, 5, 8, 0xe8f2f2, 0.2); } // an occasional show breach
  d.model.animate(dt, d.v, d.turn || 0); placeDinoModel(d); }

/* ---------- v9 fliers: aviary pterosaurs perch, take off, soar under the net; loose ones swoop at guests ---------- */
function updateFlyer(d, dt, pen, S, SD){ const fl = d.fl || (d.fl = { mode: rnd() < 0.5 ? 'fly' : 'perch', t: 4 + rnd() * 12, alt: 8, tx: d.x, tz: d.z }); const loose = d.state === 'loose';
  let x0, z0, x1, z1, ceil;
  if (!loose && pen){ [x0, z0, x1, z1] = penRect(pen, 3); ceil = (pen.domeH || 14) - 3.5; } else { x0 = -WHALF + 10; z0 = -WHALF + 10; x1 = WHALF - 10; z1 = HALF; ceil = 24; }
  const tr = 1.7; fl.t -= dt; const gy = H(d.x, d.z);
  if (!loose && pen && fl.mode === 'perch' && d.alt < 0.1){ // on the ground: feed, drink, waddle
    const feeder = feederOf(pen, d.sp), wt = d.thirst > 0.5 ? waterSpot(d, pen) : null;
    if (d.eatT > 0){ d.eatT -= dt; d.v = damp(d.v, 0, 5, dt); if (d.eatT <= 0){ d.hunger = 0; if (d.fedSkip > 0) d.fedSkip--; else spend('feed', S.feed / 2 * (FEED_MULT[d.eatType] || 1)); } }
    else if (d.drinkT > 0){ d.drinkT -= dt; d.v = damp(d.v, 0, 5, dt); if (d.drinkT <= 0) d.thirst = 0; }
    else if (d.hunger > 0.55 && feeder){ const dist = moveToward(d, tX(feeder.i), tZ(feeder.j), S.walk, dt, 3); fl.t = Math.max(fl.t, 2); if (dist < 2 + SD.size * 0.2){ d.eatT = 4; d.eatType = feeder.type; d.model.setAction('eat', 4); } }
    else if (wt){ const dist = moveToward(d, wt[0], wt[1], S.walk, dt, 3); fl.t = Math.max(fl.t, 2); if (dist < wt[2]){ d.drinkT = 3; d.model.setAction('drink', 3); } }
    else { if (Math.hypot(d.tx - d.x, d.tz - d.z) < 1 || (d.wait -= dt) < -8){ d.tx = clamp(d.x + fr(-6, 6), x0, x1); d.tz = clamp(d.z + fr(-6, 6), z0, z1); d.wait = 2 + rnd() * 4; } if (d.wait > 0){ d.wait -= dt; d.v = damp(d.v, 0, 4, dt); } else moveToward(d, d.tx, d.tz, S.walk * 0.6, dt, 3); }
    if (fl.t <= 0 && d.eatT <= 0 && d.drinkT <= 0){ fl.mode = 'fly'; fl.t = 15 + rnd() * 25; fl.alt = fr(5, Math.max(6, ceil)); fl.tx = fr(x0, x1); fl.tz = fr(z0, z1); d.model.setAction('roar', 0.6); }
    d.model.air = 0; d.model.flap = 1; d.alt = 0; }
  else { // airborne (or landing)
    if (loose){ d.swCD = (d.swCD ?? 8) - dt;
      if (!fl.sw && d.swCD <= 0){ const g = nearestGuest(d.x, d.z, 70, g => g.state === 'walk' || g.state === 'leave'); if (g){ fl.sw = g; } else d.swCD = 4; }
      if (fl.sw){ const g = fl.sw; if (g.gone){ fl.sw = null; } else { fl.tx = g.x; fl.tz = g.z; const dd = Math.hypot(g.x - d.x, g.z - d.z); fl.alt = dd < 18 ? 1.4 : 9;
        if (dd < 2.6 && d.alt < 3.2){ panicGuest(g, 14); fl.sw = null; d.swCD = 12 + rnd() * 10; fl.alt = 14; vocal(d); G.safety = clamp(G.safety - 1, 0, 100); if (rnd() < 0.15) lawsuit(0.4, 4000, 15000);
          if (performance.now() - (G._swoopT || 0) > 30000){ G._swoopT = performance.now(); toast(`${S.short} "${d.name}" is swooping at guests. Send the rangers.`, 'bad'); } } } }
      else if (Math.hypot(fl.tx - d.x, fl.tz - d.z) < 6){ fl.tx = clamp(d.x + fr(-60, 60), x0, x1); fl.tz = clamp(d.z + fr(-60, 60), z0, z1); fl.alt = fr(8, 18); } }
    else { if (Math.hypot(fl.tx - d.x, fl.tz - d.z) < 4){ fl.tx = fr(x0, x1); fl.tz = fr(z0, z1); fl.alt = fr(5, Math.max(6, ceil)); }
      if (fl.mode === 'fly' && fl.t <= 0){ fl.mode = 'perch'; fl.t = 8 + rnd() * 18; fl.tx = fr(x0, x1); fl.tz = fr(z0, z1); fl.alt = 0; } }
    const landing = fl.mode === 'perch'; const fs = S.fly || 8; const dist = Math.hypot(fl.tx - d.x, fl.tz - d.z);
    moveToward(d, fl.tx, fl.tz, landing && dist < 6 ? fs * 0.35 : fs, dt, tr * (fl.sw ? 1.6 : 1)); d.v = Math.max(d.v, landing && dist < 3 ? 0 : fs * 0.45);
    const want = landing ? (dist < 5 ? 0 : 3) : fl.alt; const prev = d.alt; d.alt = damp(d.alt, clamp(want, 0, ceil), landing ? 1.6 : 0.9, dt); if (landing && dist < 5 && d.alt < 0.25) d.alt = 0;
    const climb = (d.alt - prev) / Math.max(dt, 1e-3); d.model.pitch = clamp(-climb * 0.09, -0.55, 0.45); d.model.air = d.alt > 0.5 || !landing ? 1 : 0; d.model.flap = climb > 0.3 || d.alt < 3 ? 1 : 0.25 + 0.25 * Math.sin(d.id + G.tick * 0.003);
    if (!loose) d.alt = Math.min(d.alt, ceil); }
  d.x = clamp(d.x, x0, x1); d.z = clamp(d.z, z0, z1); if (d.alt === 0 && H(d.x, d.z) < 0.3 && loose){ d.alt = 2; }
  d.model.animate(dt, d.v, d.turn || 0); placeDinoModel(d); }
/* occasional calls only: each animal waits 20-60 s (roarCD), only nearby on-screen animals are heard, and the park plays at most one ambient call every ~8 s */
let lastAmbientCall = -1e9; const _vc = new THREE.Vector3();
function ambientCall(d){ const now = performance.now(); if (now - lastAmbientCall < 8000) return; const vol = camVol(d.x, d.z); if (vol < 0.2) return;
  _vc.set(d.x, H(d.x, d.z) + 2, d.z).project(camera); if (_vc.z > 1 || Math.abs(_vc.x) > 1.1 || Math.abs(_vc.y) > 1.1) return; lastAmbientCall = now; vocal(d); }
function vocal(d){ const vol = camVol(d.x, d.z); const SD = SPECIES_DATA[d.sp]; if (['raptor', 'dilo', 'ptera', 'dimor', 'galli'].includes(d.sp)) SFX.screech(vol * (SD.mode === 'fly' ? 0.6 : 1)); else SFX.roar(Math.min(4, SD.size / 5), vol); }
function camVol(x, z){ const d = Math.hypot(camera.position.x - x, camera.position.z - z, camera.position.y - H(x, z)); return clamp(1.3 - d / 160, 0, 1); }
function dinoHourly(d){
  const S = SPECIES[d.sp], pen = pens.get(d.pen); if (d.state === 'holding' || d.state === 'carcass' || d.state === 'escaping' || !pen || pen.held) return;
  d.hunger = clamp(d.hunger + (S.diet === 'meat' ? 0.075 : 0.09) * (d.state === 'loose' ? 1.5 : 1), 0, 1);
  if (needsWater(d.sp)) d.thirst = clamp((d.thirst || 0) + 0.085, 0, 1); else d.thirst = 0;
  const c = dinoComfort(d); const target = clamp(Math.max(0, d.hunger - 0.6) * 1.8 + Math.max(0, d.thirst - 0.65) * 1.5 + (1 - c.space) * 0.6 + (1 - c.social) * 0.4 + (c.mixed ? 0.4 : 0) + (S.clever ? 0.15 : 0) + (c.food < 1 && c.food > 0.5 ? 0.05 : 0), 0, 1);
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
  const mx = (g[0] + g[2]) / 2, mz = (g[1] + g[3]) / 2; endHunt(d); d.fleeFrom = null; d.carc = null; const SDm = SPECIES_DATA[d.sp].mode;
  if (SDm === 'swim'){ d.state = 'escaping'; d.lostT = 0; d.prey = null; d.x = mx + g[4] * 2; d.z = mz + g[5] * 2; dust(mx, mz, 6, 10, 0xe8f2f2, 0.3); SFX.siren(); G.safety = clamp(G.safety - 5, 0, 100); G.stats.breakouts++;
    toast(`${SPECIES[d.sp].short} "${d.name}" broke the sea net and is heading for open water. ${fmt(SPECIES[d.sp].cost)} animal lost.`, 'bad'); refreshSheet(); return; }
  d.state = 'loose'; d.exitP = SDm === 'fly' ? null : [mx + g[4] * 10, mz + g[5] * 10]; d.prey = null; d.darts = 0; if (SDm === 'fly'){ d.fl = { mode: 'fly', t: 1e9, alt: 12, tx: mx + g[4] * 40, tz: mz + g[5] * 40 }; d.swCD = 6; }
  // squeeze through the gap: start at the breach
  d.x = mx - g[4] * 2; d.z = mz - g[5] * 2;
  dust(mx, mz, 5, 10); SFX.siren(); vocal(d); d.model.setAction('roar', 2.2);
  G.safety = clamp(G.safety - 10, 0, 100); G.stats.breakouts++;
  toast(`Containment breach: ${SPECIES[d.sp].short} "${d.name}" broke through the ${FT[pen.tier].name.toLowerCase()} fence.`, 'bad');
  showAlert(); refreshSheet();
}
function returnDino(d){
  const pen = pens.get(d.pen); d.darts = 0; d.sleep = 0; d.model.sleep = 0; d.prey = null; d.exitP = null; d.alt = 0; d.fl = null; d.model.air = 0;
  if (!pen){ removeDino(d); return; }
  if (penBroken(pen)){ d.state = 'holding'; d.model.root.visible = false; toast(`${d.name} is sedated in holding. Repair ${pen.name} to release.`, ''); }
  else { d.state = 'pen'; d.model.root.visible = true; const [x, z] = randomPenPoint(pen, 3); d.x = x; d.z = z; dust(x, z, 4, 8); toast(`${d.name} is back in ${pen.name}.`, 'good'); }
  showAlert(); refreshSheet();
}
function releaseHeld(pen){ for (const d of dinos) if (d.pen === pen.id && d.state === 'holding'){ d.state = 'pen'; d.model.root.visible = true; const [x, z] = randomPenPoint(pen, 3); d.x = x; d.z = z; dust(x, z, 4, 8); } }

/* ================= guests ================= */
const GCAP = 300;
// v7: one merged guest mesh (one draw call); aLook picks pants/skin/hair/hat/backpack/shorts per guest in the shader. q0 swaps to the simple v6 shape.
const GGEO = [M.guestGeos(false), M.guestGeos(true)];
const walkAttr = new THREE.InstancedBufferAttribute(new Float32Array(GCAP * 2), 2); walkAttr.setUsage(THREE.DynamicDrawUsage);
const lookAttr = new THREE.InstancedBufferAttribute(new Float32Array(GCAP * 4), 4); lookAttr.setUsage(THREE.DynamicDrawUsage);
for (const g of GGEO){ g.setAttribute('aWalk', walkAttr); g.setAttribute('aLook', lookAttr); }
const glslPal = (name, arr) => `const vec3 ${name}[${arr.length}] = vec3[${arr.length}](${arr.map(h => { const c = new THREE.Color(h); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; }).join(',')});`;
const GP = M.GUEST_PAL;
const GUEST_VS_HEAD = `uniform float uTime; attribute float aLeg; attribute float aPart; attribute vec2 aWalk; attribute vec4 aLook;\n`;
const GUEST_VS_BEGIN = `#include <begin_vertex>
  int gPart = int(aPart + 0.5); int gF = int(aLook.w + 0.5); int gHat = gF % 3; int gPack = (gF / 3) % 2;
  if ((gPart == 5 && gHat != 1) || (gPart == 6 && gHat != 2) || (gPart == 7 && gPack == 0)) transformed = vec3(0.0, 1.3, 0.0);
  if (aLeg != 0.0){ bool arm = abs(aLeg) > 1.5; float sw = arm ? -sign(aLeg) * 0.42 : aLeg * 0.5; float a = sin(uTime * 9.0 + aWalk.x) * sw * aWalk.y; float py = arm ? 1.5 : 0.92;
    float yy = transformed.y - py; float zz = transformed.z; transformed.y = py + yy * cos(a) - zz * sin(a); transformed.z = yy * sin(a) + zz * cos(a); }`;
function guestPatch(sh, colour){ sh.uniforms.uTime = M.WIND;
  sh.vertexShader = GUEST_VS_HEAD + (colour ? [glslPal('GP_PANTS', GP.pants), glslPal('GP_SKIN', GP.skin), glslPal('GP_HAIR', GP.hair), glslPal('GP_HAT', GP.hat), glslPal('GP_PACK', GP.pack)].join('\n') + '\n' : '') + sh.vertexShader.replace('#include <begin_vertex>', GUEST_VS_BEGIN);
  if (colour) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
  { int pi = int(aLook.x + 0.5), si = int(aLook.y + 0.5), hi = int(aLook.z + 0.5); int cPart = int(aPart + 0.5); bool shorts = int(aLook.w + 0.5) >= 6;
    if (cPart == 0) vColor.xyz = color.xyz; else if (cPart == 2) vColor.xyz = GP_PANTS[pi]; else if (cPart == 3) vColor.xyz = GP_SKIN[si]; else if (cPart == 4) vColor.xyz = GP_HAIR[hi];
    else if (cPart == 5) vColor.xyz = GP_HAT[(pi + hi * 3) % 8]; else if (cPart == 6) vColor.xyz = GP_HAT[2 + (hi % 2)] * (0.9 + 0.1 * float(si % 2)); else if (cPart == 7) vColor.xyz = GP_PACK[(si + pi) % 6];
    else if (cPart == 8) vColor.xyz = shorts ? GP_SKIN[si] : GP_PANTS[pi]; }`); }
const guestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }); guestMat.onBeforeCompile = (sh) => guestPatch(sh, true); guestMat.customProgramCacheKey = () => 'guest7';
const guestDepthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); guestDepthMat.onBeforeCompile = (sh) => guestPatch(sh, false); guestDepthMat.customProgramCacheKey = () => 'guest7d';
const guestIM = new THREE.InstancedMesh(GGEO[1], guestMat, GCAP); guestIM.customDepthMaterial = guestDepthMat;
guestIM.count = 0; guestIM.castShadow = true; guestIM.receiveShadow = false; guestIM.frustumCulled = false; guestIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(guestIM);
guestIM.setColorAt(0, new THREE.Color(1, 1, 1));
function applyGuestDetail(){ guestIM.geometry = GGEO[detailHi() ? 1 : 0]; }
function guestLook(id){ let h = Math.imul(id + 0x9e37, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  const pants = h % 8, skin = (h >>> 3) % 6, hair = (h >>> 6) % 6, hat = ((h >>> 9) % 10) < 3 ? 0 : ((h >>> 9) % 10) < 7 ? 1 : 2, pack = ((h >>> 13) % 10) < 3 ? 1 : 0, shorts = ((h >>> 17) % 10) < 4 ? 1 : 0;
  const kid = ((h >>> 21) % 100) < 14; return { pants, skin, hair, flags: hat + pack * 3 + shorts * 6, scale: kid ? 0.68 : 0.94 + ((h >>> 24) % 13) / 100 }; }
const _looks = new Map(); function lookOf(g){ let l = _looks.get(g.id); if (!l){ l = guestLook(g.id); _looks.set(g.id, l); if (_looks.size > 4000) _looks.clear(); } return l; }
const SHIRTS = [0xd8cfb8, 0x2f4a6a, 0x7a2e24, 0x3c5a34, 0xc9a038, 0x4a4a48, 0xe8e4da, 0x6a4a7a, 0x2a6a6a, 0xb86a3a, 0x8a8a5a, 0x1e2a3a];
let guests = [];
const exitDist = new Int32Array(GN * GN); const viewMap = new Float32Array(GN * GN);
const farPathK = [];
function computeExitField(){ exitDist.fill(1e6); const q = []; for (const i of [GATE.i, GATE.i + 1]){ const k = idx(i, GATE.j); exitDist[k] = 0; q.push(k); }
  while (q.length){ const k = q.shift(); const i = kI(k), j = kJ(k); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!isPath(ii, jj)) continue; const kk = idx(ii, jj); if (exitDist[kk] > exitDist[k] + 1){ exitDist[kk] = exitDist[k] + 1; q.push(kk); } } }
  farPathK.length = 0; for (let k = 0; k < tileType.length; k++) if (tileType[k] === T_PATH && exitDist[k] < 1e6 && tileReg[k] > 2) farPathK.push(k); }
function computeViewMap(){
  viewMap.fill(0); const plats = [...buildings.values()].filter(b => b.type === 'viewing' || b.type === 'stand'); penSpots = [];
  for (const pen of pens.values()){ const ds = dinos.filter(d => d.pen === pen.id && (d.state === 'pen')); if (!ds.length) continue; let spot = -1, sv = 0;
    const counts = {}; let ap = 0; for (const d of ds){ counts[d.sp] = (counts[d.sp] || 0) + 1; ap += SPECIES[d.sp].appeal * Math.pow(0.6, counts[d.sp] - 1) * (0.7 + 0.3 * (1 - d.stress)); }
    const vis = pen.tier === 3 && pen.kind !== 'lagoon' ? 0.4 : 1; const wet = pen.kind === 'lagoon' || pen.kind === 'lake';
    for (let j = pen.j0 - 5; j <= pen.j1 + 5; j++) for (let i = pen.i0 - 5; i <= pen.i1 + 5; i++){ if (!isPath(i, j)) continue; const dd = Math.max(pen.i0 - i, 0, i - pen.i1, pen.j0 - j, 0, j - pen.j1);
      let v = ap * (1 - dd / 6) * vis; for (const p of plats){ if (Math.abs(p.i - i) <= 2 && Math.abs(p.j - j) <= 2 && Math.max(pen.i0 - p.i, 0, p.i - pen.i1, pen.j0 - p.j, 0, p.j - pen.j1) <= 3){ v *= p.type === 'stand' ? (wet ? 2.6 : 1.3) : pen.tier === 3 && !wet ? 2.6 : 1.6; break; } }
      viewMap[idx(i, j)] += v; if (v > sv && reachK(idx(i, j))){ sv = v; spot = idx(i, j); } }
    if (spot >= 0) penSpots.push({ pen: pen.id, k: spot, ap }); }
}
/* ---- guest destinations: walk the connected path network to a chosen spot (an unseen exhibit, a shop when needed, or a far corner), linger, pick the next ---- */
const pathFields = new Map(); let penSpots = [], shopSpots = [], explorable = [];
function pathField(k){ let f = pathFields.get(k); if (f) return f; if (pathFields.size > 96) pathFields.clear();
  f = new Int16Array(GN * GN).fill(-1); f[k] = 0; const q = [k]; let h = 0;
  while (h < q.length){ const c = q[h++]; const i = kI(c), j = kJ(c); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!isPath(ii, jj)) continue; const kk = idx(ii, jj); if (f[kk] < 0){ f[kk] = f[c] + 1; q.push(kk); } } }
  pathFields.set(k, f); return f; }
function rebuildGuestSpots(){ pathFields.clear(); shopSpots = []; explorable = [];
  for (let k = 0; k < GN * GN; k++) if (tileType[k] === T_PATH && reachK(k) && kJ(k) < GATE.j) explorable.push(k);
  for (const b of buildings.values()){ if (!SHOP_T.includes(b.type)) continue; const seen = new Set();
    for (let dj = -1; dj <= b.h; dj++) for (let di = -1; di <= b.w; di++){ if ((di === -1 || di === b.w) === (dj === -1 || dj === b.h)) continue; const i = b.i + di, j = b.j + dj; if (!isPath(i, j)) continue; const k = idx(i, j); if (!reachK(k) || seen.has(k)) continue; seen.add(k); shopSpots.push({ k, type: b.type, i, j }); } } }
function pickDest(g){ const here = idx(g.ci, g.cj); const pick = (arr) => { let tot = 0; for (const o of arr) tot += o.w; let r = rnd() * tot; for (const o of arr){ r -= o.w; if (r <= 0) return o; } return arr[arr.length - 1]; };
  const near = (types, goal) => { const c = shopSpots.filter(s => types.includes(s.type) && s.k !== here); if (!c.length) return null; const f = pathField(here);
    const o = c.map(s => ({ k: s.k, d: f[s.k] < 0 ? 1e4 : f[s.k] })).filter(o => o.d < 1e4).sort((a, b) => a.d - b.d); return o.length ? { k: o[Math.min(o.length - 1, (rnd() * 2) | 0)].k, goal } : null; };
  let d = null;
  if (g.bladder > 0.6) d = near(['restroom', 'visitor'], 'restroom');
  if (!d && g.hunger > 0.55 && g.money > 15) d = near(FOOD_T, 'food');
  if (!d && (g.thirst || 0) > 0.6 && g.money > 6) d = near(DRINK_T, 'drink');
  if (!d){ const opts = [];
    const myc = pcomp[here];
    for (const s of penSpots){ if (s.k === here || pcomp[s.k] !== myc) continue; opts.push({ k: s.k, goal: 'view', pen: s.pen, w: (8 + s.ap) * (g.seen.has(s.pen) ? 0.15 : 1.6) }); }
    if (MONO.lines.length && g.money >= MONO_FARE) for (const o of monoOptions(g, here)) if (o.k >= 0) opts.push(o);
    if (explorable.length){ let best = -1, bd = -1; for (let n = 0; n < 8; n++){ const k = explorable[(rnd() * explorable.length) | 0]; if (pcomp[k] !== myc) continue; const dd = Math.abs(kI(k) - g.ci) + Math.abs(kJ(k) - g.cj); if (dd > bd){ bd = dd; best = k; } } if (best >= 0 && best !== here) opts.push({ k: best, goal: 'explore', w: 14 }); }
    const gift = shopSpots.filter(s => s.type === 'gift' && pcomp[s.k] === myc); if (gift.length && g.happy > 62 && g.money > 30 && !g.boughtGift) opts.push({ k: gift[(rnd() * gift.length) | 0].k, goal: 'gift', w: 12 });
    if (opts.length) d = pick(opts); }
  if (d){ g.dest = d.k; g.goal = d.goal; g.goalPen = d.pen ?? -1; if (d.goal === 'mono'){ g.mBid = d.bid; g.mTo = d.to; g.mLine = d.line; } } else { g.dest = -1; g.goal = 'wander'; } }
function stepToward(g){ const f = pathField(g.dest); const here = f[idx(g.ci, g.cj)]; if (here < 0) return null; let best = null, bd = here;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = g.ci + di, jj = g.cj + dj; if (!isPath(ii, jj)) continue; const v = f[idx(ii, jj)]; if (v >= 0 && (v < bd || (v === bd && best && rnd() < 0.5))){ bd = v; best = [ii, jj]; } }
  return bd < here ? best : null; }
/* ---- what guests want ---- */
const GNAMES = ['Ava', 'Ben', 'Chloe', 'Dev', 'Ella', 'Finn', 'Grace', 'Hugo', 'Isla', 'Jack', 'Kai', 'Lena', 'Max', 'Nora', 'Omar', 'Pia', 'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Vic', 'Wes', 'Yara', 'Zoe', 'Leo', 'Mia', 'Noah', 'Ivy', 'Eli'];
const GLAST = 'ABCDEFGHJKLMNPRSTVW';
const NAME_MAX = 16;
function cleanName(v){ return String(v || '').normalize('NFC').replace(/[^\p{L}\p{N}\p{M} '\-.!?&]/gu, '').replace(/&/g, '+').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim(); }
const escH = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function renameDino(d, v){ const n = cleanName(v); if (!d || !n) return false; if (n === d.name) return true; const old = d.name; d.name = n; toast(`${old} is now called ${n}.`, 'good'); return true; }
function guestFavDino(g){ if (!g.seen || !g.seen.size) return null; let best = null, bs = -1; for (const d of dinos){ if (!g.seen.has(d.pen) || d.state === 'carcass') continue; const sc = SPECIES[d.sp].appeal + ((d.id * 7 + g.id * 13) % 11); if (sc > bs){ bs = sc; best = d; } } return best; }
function guestName(g){ return g.name || (g.name = GNAMES[g.id % GNAMES.length] + ' ' + GLAST[(g.id * 7) % GLAST.length] + '.'); }
function guestThought(g){ if (g.gone) return null;
  if (g.state === 'flee' || g.state === 'lured' || g.state === 'tossed' || g.state === 'inpen') return 'scared';
  if (g.state !== 'walk' && g.state !== 'leave') return null;
  if (g.bladder > 0.75) return 'restroom'; if (g.hunger > 0.7) return 'food'; if ((g.thirst || 0) > 0.7) return 'thirst';
  if ((g.bored || 0) > 0.6 && g.state === 'walk') return 'dinos'; if (g.state === 'leave' && g.stay <= 0.3) return 'tired'; if (g.happy > 84) return 'happy'; return null; }
const THOUGHT_TEXT = { thirst: 'I am so thirsty. Is there a drinks stand?', food: 'I am hungry. Where can I eat?', restroom: 'I really need a restroom.', dinos: 'I want to see more dinosaurs.', scared: 'Get me out of here!', tired: 'What a day. Time to head home.', happy: 'This park is amazing!' };
function bubbleTex(kind){ const c = M.mk(128, 128), g = c.getContext('2d');
  g.fillStyle = 'rgba(255,250,238,.96)'; g.strokeStyle = 'rgba(40,30,20,.5)'; g.lineWidth = 4; g.beginPath(); g.arc(64, 56, 46, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(40, 108, 9, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(28, 122, 5, 0, TAU); g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'food'){ g.fillStyle = '#d99a3a'; g.beginPath(); g.ellipse(64, 46, 30, 16, 0, Math.PI, 0); g.fill(); g.fillStyle = '#6a3a1c'; g.fillRect(34, 50, 60, 9); g.fillStyle = '#5aa83a'; g.fillRect(36, 59, 56, 5); g.fillStyle = '#d99a3a'; g.beginPath(); g.roundRect ? g.roundRect(34, 64, 60, 12, 6) : g.rect(34, 64, 60, 12); g.fill(); }
  else if (kind === 'thirst'){ g.fillStyle = '#e8e4da'; g.strokeStyle = '#3a6a9a'; g.lineWidth = 5; g.beginPath(); g.moveTo(44, 30); g.lineTo(84, 30); g.lineTo(78, 86); g.lineTo(50, 86); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#4a9ad0'; g.beginPath(); g.moveTo(47, 52); g.lineTo(81, 52); g.lineTo(78, 84); g.lineTo(50, 84); g.closePath(); g.fill(); g.strokeStyle = '#c84a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(70, 40); g.lineTo(80, 14); g.stroke(); }
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
  const n = inPark.length; const tally = { food: [], thirst: [], restroom: [], dinos: [], scared: [] }; let hp = 0;
  for (const g of inPark){ hp += g.happy; if (g.hunger > 0.6) tally.food.push(g); if ((g.thirst || 0) > 0.6) tally.thirst.push(g); if (g.bladder > 0.65) tally.restroom.push(g); if ((g.bored || 0) > 0.5 && g.state === 'walk') tally.dinos.push(g); if (g.state === 'flee') tally.scared.push(g); }
  const where = (arr) => { if (!arr.length) return 'busiest'; let x = 0, z = 0; for (const g of arr){ x += g.x; z += g.z; } x /= arr.length; z /= arr.length; const cx = tX(GATE.i), cz = 0;
    const dx = x - cx, dz = z - cz; if (Math.hypot(dx, dz) < 25) return 'central'; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north'); };
  const has = t => [...buildings.values()].some(b => b.type === t);
  const tip = { food: (a) => has('food') ? `Add another Food Stand by the ${where(a)} path, or bring paths past the one you have.` : `Build a Food Stand touching the ${where(a)} path. Each meal pays ${fmt(FOOD_PRICE)}.`,
    thirst: (a) => DRINK_T.some(has) ? `Add a Cold Drinks stand or Coffee Kiosk by the ${where(a)} path.` : `Build a Cold Drinks stand touching the ${where(a)} path. Drinks are cheap to run and sell all day.`,
    restroom: (a) => has('restroom') ? `Add Restrooms near the ${where(a)} path.` : `Build Restrooms touching the ${where(a)} path. Unhappy bladders mean unhappy guests.`,
    dinos: (a) => (monoAdvice() || `Guests on the ${where(a)} paths see no dinosaurs. Put an enclosure beside that path, or add animals.`),
    scared: () => 'Recapture loose animals and use stronger fences.' };
  const label = { thirst: 'thirsty', food: 'hungry', restroom: 'need a restroom', dinos: 'want to see more dinosaurs', scared: 'are scared' };
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
function walkH(x, z){ if (onPier(x, z)) return deckY(z); const h = H(x, z); if (h > 0.5) return h; const L = lakeAt(x, z), w = L ? L.wl : 0; return h < w - 0.9 ? w - 0.9 : h; }
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
  const dock = REGOPEN.dock && regionOpen('beach') && isPath(REGOPEN.dock.i, REGOPEN.dock.j) && exitDist[idx(REGOPEN.dock.i, REGOPEN.dock.j)] < 1e6;
  const far = farPathK;
  if (dock && rnd() < 0.28){ const g = { id: G.nextId++, x: REGOPEN.dock.x + fr(-1.2, 1.2), z: REGOPEN.dock.z + fr(-1, 1), hd: Math.PI, state: 'walk', wp: null, ci: REGOPEN.dock.i, cj: REGOPEN.dock.j, pi: -1, pj: -1, ni: -1, nj: -1,
    off: fr(-1.2, 1.2), speed: fr(2.8, 3.6), money: fr(60, 220), happy: fr(55, 75), hunger: fr(0, 0.4), thirst: fr(0, 0.4), bladder: fr(0, 0.4), stay: fr(5, 9), dest: -1, goal: '', linger: 0, seen: new Set(), bored: 0, phase: rnd() * TAU, shirt: SHIRTS[(rnd() * SHIRTS.length) | 0], visited: new Set(), moving: 1, gone: false, panicT: 0 };
    g.tx = g.x; g.tz = g.z; if (g.money >= G.price){ g.money -= G.price; earn('tickets', G.price); } G.stats.guestsTotal++; G.stats.guestsToday++; guests.push(g); return g; }
  if (far.length && rnd() < 0.12){ const k2 = far[(rnd() * far.length) | 0]; const g = { id: G.nextId++, x: tX(kI(k2)), z: tZ(kJ(k2)), hd: rnd() * TAU, state: 'walk', wp: null, ci: kI(k2), cj: kJ(k2), pi: -1, pj: -1, ni: -1, nj: -1,
    off: fr(-1.2, 1.2), speed: fr(2.8, 3.6), money: fr(60, 220), happy: fr(55, 75), hunger: fr(0, 0.4), thirst: fr(0, 0.4), bladder: fr(0, 0.4), stay: fr(5, 9), dest: -1, goal: '', linger: 0, seen: new Set(), bored: 0, phase: rnd() * TAU, shirt: SHIRTS[(rnd() * SHIRTS.length) | 0], visited: new Set(), moving: 1, gone: false, panicT: 0 };
    g.tx = g.x; g.tz = g.z; if (g.money >= G.price){ g.money -= G.price; earn('tickets', G.price); } G.stats.guestsTotal++; G.stats.guestsToday++; guests.push(g); return g; }
  const g = { id: G.nextId++, x: GANG[0] + fr(-1.2, 1.2), z: GANG[1] - fr(0, 0.6), hd: Math.PI, state: 'enter', wp: [[fr(-1.3, 1.3), DOCKH.z0 - 0.5], [fr(-1.3, 1.3), PIER.z0 + 1.5]], ci: GATE.i + (rnd() < 0.5 ? 0 : 1), cj: GATE.j, pi: -1, pj: -1, ni: -1, nj: -1,
    off: fr(-1.2, 1.2), speed: fr(2.8, 3.6), money: fr(60, 220), happy: fr(55, 75), hunger: fr(0, 0.4), thirst: fr(0, 0.4), bladder: fr(0, 0.4), stay: fr(5, 9), dest: -1, goal: '', linger: 0, seen: new Set(), bored: 0, phase: rnd() * TAU, shirt: SHIRTS[(rnd() * SHIRTS.length) | 0], visited: new Set(), moving: 1, gone: false, panicT: 0 };
  g.tx = g.wp[0][0]; g.tz = g.wp[0][1];
  guests.push(g); return g;
}
function nextTile(g){
  if (g.state === 'queue') return null;
  const opts = []; const leaving = g.state === 'leave' || g.state === 'flee';
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = g.ci + di, jj = g.cj + dj; if (!isPath(ii, jj)) continue; opts.push([ii, jj]); }
  if (!opts.length) return null;
  if (leaving && exitDist[idx(g.ci, g.cj)] >= 1e6){ const here = idx(g.ci, g.cj), hv = homeVia.get(pcomp[here]); if (!hv) return null; // v10: out on the monorail
    if (hv.spot === here){ startQueue(g, hv.from, hv.to, hv.line, true); return null; } g.dest = hv.spot; return stepToward(g); }
  if (leaving){ let best = null, bd = exitDist[idx(g.ci, g.cj)]; for (const [ii, jj] of opts){ const dd = exitDist[idx(ii, jj)]; if (dd < bd){ bd = dd; best = [ii, jj]; } } return best; }
  if (g.state === 'walk'){ if (g.dest < 0 || g.dest === idx(g.ci, g.cj)) pickDest(g); if (g.goal === 'mono' && g.dest === idx(g.ci, g.cj)){ startQueue(g, g.mBid, g.mTo, g.mLine, false); return null; } if (g.dest >= 0){ const st = stepToward(g); if (st) return st; g.dest = -1; } }
  let tot = 0; const w = opts.map(([ii, jj]) => { const k = idx(ii, jj); let v = 1 + Math.min(viewMap[k], 200) * 0.03 + (g.visited.has(k) ? 0 : 2); if (ii === g.pi && jj === g.pj) v *= opts.length > 1 ? 0.08 : 1; if (jj === GATE.j && g.state === 'walk') v *= 0.05; tot += v; return v; });
  let r = rnd() * tot; for (let k = 0; k < opts.length; k++){ r -= w[k]; if (r <= 0) return opts[k]; } return opts[opts.length - 1];
}
function shopsNear(i, j){ const out = new Set(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) continue; const k = idx(ii, jj); if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); if (b) out.add(b.type); } } return out; }
const FOOD_PRICE = 14, GIFT_PRICE = 24, DRINK_PRICE = 5;
// v9 guest stands: price, how much hunger / thirst they fix, and a happiness bump
const SHOP = { food: { p: 14, hun: 1 }, pizza: { p: 16, hun: 1 }, restaurant: { p: 28, hun: 1, thi: 1, hap: 8 }, icecream: { p: 8, thi: 0.6, hap: 4 }, coffee: { p: 6, thi: 1 }, drinks: { p: 5, thi: 1 } };
const FOOD_T = ['restaurant', 'pizza', 'food', 'visitor'], DRINK_T = ['icecream', 'coffee', 'drinks', 'restaurant', 'visitor'], SHOP_T = ['food', 'pizza', 'restaurant', 'icecream', 'coffee', 'drinks', 'gift', 'restroom', 'visitor'];
function guestBuy(g, t, want){ const S = t === 'visitor' ? (want === 'hun' ? { p: FOOD_PRICE, hun: 1 } : { p: DRINK_PRICE, thi: 1 }) : SHOP[t]; if (g.money < S.p) return false;
  g.money -= S.p; earn('shops', S.p); if (S.hun) g.hunger = Math.max(0, g.hunger - S.hun); if (S.thi) g.thirst = Math.max(0, (g.thirst || 0) - S.thi); g.happy += 3 + (S.hap || 0);
  g.ate = g.ate || new Set(); if (!g.ate.has(t)){ g.ate.add(t); if (g.ate.size > 1) g.happy += 2; } // variety keeps guests happy
  G.stats.shopSales = (G.stats.shopSales || 0) + 1; return true; }
function guestArrive(g){
  const k = idx(g.ci, g.cj); if (g.lastArr === k) return; g.lastArr = k; g.visited.add(k);
  if (g.state === 'walk' && g.dest === k && g.goal === 'mono'){ g.dest = -1; startQueue(g, g.mBid, g.mTo, g.mLine, false); return; }
  if (g.state === 'walk' && g.dest === k){ g.dest = -1; if (g.goal === 'view'){ g.linger = fr(3, 7); if (g.goalPen >= 0 && !g.seen.has(g.goalPen)){ g.seen.add(g.goalPen); g.happy = Math.min(100, g.happy + 5); } } else if (g.goal !== 'explore') g.linger = fr(0.8, 1.6); else g.linger = fr(0, 1); }
  if (g.state === 'walk') for (const s of penSpots) if (s.k === k && !g.seen.has(s.pen)){ g.seen.add(s.pen); g.happy = Math.min(100, g.happy + 5); g.goalPen = s.pen; g.linger = Math.max(g.linger, fr(3, 6)); } // passing an exhibit's best spot counts as seeing it
  if (g.state === 'walk'){ const s = shopsNear(g.ci, g.cj);
    if (g.hunger > 0.4){ for (const t of FOOD_T) if (s.has(t) && guestBuy(g, t, 'hun')) break; }
    if ((g.thirst || 0) > 0.4){ for (const t of DRINK_T) if (s.has(t) && guestBuy(g, t, 'thi')) break; }
    if ((s.has('restroom') || s.has('visitor')) && g.bladder > 0.45){ g.bladder = 0; g.happy += 4; }
    if ((s.has('gift') || s.has('visitor')) && g.happy > 62 && g.money > 30 && rnd() < (s.has('gift') ? 0.35 : 0.12)){ g.boughtGift = true; g.money -= GIFT_PRICE; earn('shops', GIFT_PRICE); }
  }
}
function panicGuest(g, hit){ if (g.state === 'flee') return; g.state = 'flee'; g.happy -= hit; g.speed = fr(3.2, 4.2); g.panicT = 0; }
function leaveGuest(g){ if (g.state === 'walk') g.state = 'leave'; }
function removeGuest(g){ g.gone = true; }
function eatGuest(d, g, fedOnPurpose){
  const y = walkH(g.x, g.z) + 1.2; splash(g.x, y, g.z, 46); SFX.scream(0.6); dust(g.x, g.z, 2.5, 4, 0x8a5a4a); removeGuest(g);
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
      if (g.state !== 'enter') g.stay -= hourDt; g.hunger += hourDt * 0.1; g.thirst = (g.thirst || 0) + hourDt * 0.12; g.bladder += hourDt * 0.11; const v = viewMap[idx(clamp(g.ci, LO, HI - 1), clamp(g.cj, LO, HI - 1))];
      g.bored = clamp((g.bored || 0) + hourDt * (v > 0 ? -1.2 : 0.22), 0, 1);
      if (g.state !== 'leave') g.happy += hourDt * ((v > 0 ? Math.min(14, v * 0.12) : (g.linger > 0 ? 0 : -1.2)) - (g.hunger > 0.75 ? 6 : 0) - (g.thirst > 0.75 ? 6 : 0) - (g.bladder > 0.85 ? 8 : 0)); g.happy = clamp(g.happy, 0, 100);
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
        else { const nt = nextTile(g); if (!nt){ if (g.state !== 'queue'){ if (g.state !== 'walk'){ g.stuck = (g.stuck || 0) + dt; if (g.stuck > 4){ removeGuest(g); onGuestLeft(g); } } g.tx = tX(g.ci) + fr(-1.5, 1.5); g.tz = tZ(g.cj) + fr(-1.5, 1.5); } }
        else { g.pi = g.ci; g.pj = g.cj; g.ci = nt[0]; g.cj = nt[1]; const di = g.ci - g.pi, dj = g.cj - g.pj; g.tx = tX(g.ci) - dj * g.off; g.tz = tZ(g.cj) + di * g.off; } }
      } else { const s = Math.min(dd, sp * dt); g.x += dx / dd * s; g.z += dz / dd * s; g.hd = Math.atan2(dx, dz); }
      if (!(g.linger > 0 && g.state === 'walk') && !(g.exiting && !g.boarding && g.wp && !g.wp.length && Math.hypot(g.tx - g.x, g.tz - g.z) < 0.3)) g.moving = 1;
    }
    else if (g.state === 'ride') continue; // inside a monorail car
    else if (g.state === 'queue'){ const dx = g.tx - g.x, dz = g.tz - g.z, dd = Math.hypot(dx, dz); g.qT += dt; g.stay -= hourDt * 0.5;
      if (dd > 0.2){ const s2 = Math.min(dd, g.speed * dt); g.x += dx / dd * s2; g.z += dz / dd * s2; g.hd = Math.atan2(dx, dz); g.moving = 1; } else { g.moving = 0; const b = buildings.get(g.qBid); if (b) g.hd = Math.atan2(b.x - g.x, b.z - g.z); }
      const L = MONO.lines.find(l => l.def.id === g.qLine); if (!L || !L.ok){ if (g.homeward){ removeGuest(g); onGuestLeft(g); continue; } unqueue(g); } else if (!g.homeward && (g.qT > 150 || G.hour >= CLOSE)){ g.happy -= 4; unqueue(g); } }
    else if (g.state === 'lured'){ const dx = g.tx - g.x, dz = g.tz - g.z, dd = Math.hypot(dx, dz); if (dd < 0.4){ startToss(g); } else { const s = Math.min(dd, 3.4 * dt); g.x += dx / dd * s; g.z += dz / dd * s; g.hd = Math.atan2(dx, dz); } g.moving = 1.4; }
    else if (g.state === 'tossed'){ g.tt += dt / g.tDur; const k = Math.min(1, g.tt); g.x = lerp(g.ax, g.bx, k); g.z = lerp(g.az, g.bz, k); g.yOff = Math.sin(k * Math.PI) * g.arc; g.spin = k * 5; g.moving = 1.5;
      if (k >= 1){ g.state = 'inpen'; g.yOff = 0; g.spin = 0; if (walkH(g.x, g.z) > H(g.x, g.z) + 0.3) dust(g.x, g.z, 2.5, 8, 0xe8f0f0, walkH(g.x, g.z)); else dust(g.x, g.z, 1.5, 3); } }
    else if (g.state === 'inpen'){ const pen = pens.get(g.pen); const d = g.hunter; g.moving = 1.6;
      if (pen){ const [x0, z0, x1, z1] = penRect(pen, 1.2); let ax = g.x - (d ? d.x : g.x), az = g.z - (d ? d.z : g.z); const al = Math.hypot(ax, az) || 1; ax /= al; az /= al; ax += Math.sin(G.tick * 0.07 + g.id) * 0.6;
        g.tired = (g.tired || 0) + dt; const gs = Math.max(1.2, 3.8 - g.tired * 0.25); g.x = clamp(g.x + ax * gs * dt, x0, x1); g.z = clamp(g.z + az * gs * dt, z0, z1); g.hd = Math.atan2(ax, az); } }
    // write instance
    const y = walkH(g.x, g.z) + (g.yOff || 0); _gq.setFromAxisAngle(_up, g.hd); if (g.spin){ const t = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), g.spin); _gq.multiply(t); }
    const lk = lookOf(g); _gs.setScalar(lk.scale); _gp.set(g.x, y, g.z); _gm.compose(_gp, _gq, _gs); guestIM.setMatrixAt(n, _gm); lookAttr.setXYZW(n, lk.pants, lk.skin, lk.hair, lk.flags);
    guestIM.setColorAt(n, _gc.setHex(g.shirt)); walkAttr.setXY(n, g.phase, g.moving * (g.state === 'flee' || g.state === 'inpen' ? 1.4 : 1) * (lk.scale < 0.8 ? 1.25 : 1)); n++;
  }
  guestIM.count = n; guestIM.instanceMatrix.needsUpdate = true; if (guestIM.instanceColor) guestIM.instanceColor.needsUpdate = true; walkAttr.needsUpdate = true; lookAttr.needsUpdate = true;
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
  if (pen.kind === 'lagoon'){ let best = null, bd = 1e9; for (let k = 0; k < tileType.length; k++){ if (tileType[k] !== T_PATH) continue; const x = tX(kI(k)), z = tZ(kJ(k)); const dd = Math.hypot(x - cx, z - cz); if (dd < bd){ bd = dd; best = [x, z]; } }
    if (!best || bd > 70){ toast('No path close enough to the lagoon. Lay a path along the shore first.', 'bad'); return false; } ox = best[0]; oz = best[1]; }
  g.state = 'lured'; g.tx = ox; g.tz = oz; g.pen = pen.id; g.speed = 3.4; const hunter = carns.sort((a, b) => SPECIES[b.sp].appeal - SPECIES[a.sp].appeal)[0]; g.hunter = hunter;
  G.feedCooldown = 20; G.feeding = { pen: pen.id, guest: g, dino: hunter, t: 0 };
  focusOn(cx, cz, Math.max(45, (pen.i1 - pen.i0 + 1) * TILE * 1.5));
  toast(`Security escorts a guest toward ${pen.name}...`, ''); return true;
}
function startToss(g){
  const pen = pens.get(g.pen); if (!pen){ g.state = 'leave'; return; } const [cx, cz] = penCenter(pen);
  g.state = 'tossed'; g.tt = 0; g.tDur = 1.3; g.ax = g.x; g.az = g.z; const dx = cx - g.x, dz = cz - g.z, dl = Math.hypot(dx, dz); const inside = Math.min(dl * 0.55, 7 + rnd() * 3);
  g.bx = g.x + dx / dl * inside; g.bz = g.z + dz / dl * inside; g.arc = (pen.tier === 3 ? 8 : pen.tier === 2 ? 6.5 : 4.5);
  if (pen.kind === 'lagoon'){ const [x0, z0, x1, z1] = penRect(pen, 3); g.bx = clamp(g.x + dx / dl * (dl - 4), x0, x1); g.bz = clamp(g.z + dz / dl * (dl - 4), z0, z1); g.tDur = clamp(Math.hypot(g.bx - g.x, g.bz - g.z) / 14, 1.3, 3.2); g.arc = 6 + g.tDur * 4; }
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
      const stopAt = j.state === 'return' ? 1 : 17; const ahead = H(j.x + Math.sin(j.hd) * 4, j.z + Math.cos(j.hd) * 4); const want = dd > stopAt && (ahead > 0.35 || j.state === 'return') ? vmax : 0; /* v10: rangers stop at the shore and fire from there */ j.v = damp(j.v, want, 2, dt); j.x += Math.sin(j.hd) * j.v * dt; j.z += Math.cos(j.hd) * j.v * dt;
      if (j.state === 'drive' && targ && dd < (SPECIES_DATA[targ.sp].mode === 'fly' || SPECIES_DATA[targ.sp].mode === 'swim' ? 34 : 24)){ j.fire -= dt; if (j.fire <= 0){ j.fire = 1.1; fireDart(j, targ); } }
      if (j.state === 'return' && dd < 2){ scene.remove(j.mesh); jeeps.splice(jeeps.indexOf(j), 1); showAlert(); continue; } }
    const y = H(j.x, j.z); j.mesh.position.set(j.x, y, j.z); j.mesh.rotation.set(0, j.hd, 0); if (j.v > 2 && rnd() < dt * 6) dust(j.x - Math.sin(j.hd) * 2, j.z - Math.cos(j.hd) * 2, 1.6, 1);
  }
  for (const a of darts.slice()){ a.t += dt / 0.28; const k = Math.min(1, a.t); a.m.position.set(lerp(a.ax, a.d.x, k), lerp(a.ay, dartY(a.d), k), lerp(a.az, a.d.z, k)); a.m.lookAt(a.d.x, a.m.position.y, a.d.z);
    if (k >= 1){ scene.remove(a.m); darts.splice(darts.indexOf(a), 1); hitDart(a.d); } }
}
function dartY(d){ const SD = SPECIES_DATA[d.sp]; return dinoY(d) + (SD.mode === 'swim' ? 0.4 : SD.mode === 'fly' ? SD.hipH * 0.5 : SD.hipH); }
function fireDart(j, d){ SFX.dart(); const m = dartMesh.clone(); m.visible = true; scene.add(m); darts.push({ m, d, t: 0, ax: j.x, ay: H(j.x, j.z) + 2.2, az: j.z }); }
function hitDart(d){ if (d.state !== 'loose') return; d.darts++; const need = SPECIES[d.sp].darts; d.model.setAction('roar', 0.8);
  if (d.darts >= need){ d.state = 'sedated'; d.sedT = 0; d.v = 0; toast(`${d.name} is down. Airlifting back to the enclosure.`, 'good'); SFX.thud(0.9, 3); dust(d.x, d.z, 4, 8); showAlert(); } }

/* ================= v10 monorail: the only way over the ridge into the expansion ================= */
const MONO_DECK = 7.2, MONO_CLEAR = 6.5, MONO_COST_M = 160, MONO_FARE = 4, MONO_CAP = 36, MONO_DWELL = 3.5, MONO_VMAX = 26, MONO_ACC = 6, CAR_GAP = 7.4; // speeds in game seconds (10 s = one park hour)
const monoMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 });
const monoPrevMat = new THREE.MeshStandardMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.6, emissive: 0x1a4a6a });
const trainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
const TRAIN_GEO = { nose: M.trainCarGeo(true), mid: M.trainCarGeo(false) };
const MONO = { lines: [] }; // runtime lines: { def, path, mesh, ok, train }
const pcomp = new Int32Array(GN * GN).fill(-1); let mainComp = -1; const compReach = new Set(); const homeVia = new Map();
let monoPrev = null;
function monoDefs(){ if (!G.mono) G.mono = { lines: [] }; return G.mono.lines; }
function stationAtTile(i, j){ if (!inGrid(i, j)) return null; const k = idx(i, j); if (tileType[k] !== T_BUILD) return null; const b = buildings.get(tileRef[k]); return b && b.type === 'station' ? b : null; }
function stationSpots(b){ const out = []; for (let dj = -1; dj <= b.h; dj++) for (let di = -1; di <= b.w; di++){ if ((di === -1 || di === b.w) === (dj === -1 || dj === b.h)) continue; if (isPath(b.i + di, b.j + dj)) out.push(idx(b.i + di, b.j + dj)); } return out; }
/* path components: guests can only walk inside one; monorail lines join them */
function computeComps(){ pcomp.fill(-1); let c = 0; const q = [];
  for (let k = 0; k < pcomp.length; k++){ if (tileType[k] !== T_PATH || pcomp[k] >= 0) continue; pcomp[k] = c; q.length = 0; q.push(k);
    for (let h = 0; h < q.length; h++){ const cur = q[h], i = kI(cur), j = kJ(cur); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = i + di, jj = j + dj; if (!isPath(ii, jj)) continue; const kk = idx(ii, jj); if (pcomp[kk] < 0){ pcomp[kk] = c; q.push(kk); } } } c++; }
  mainComp = pcomp[idx(GATE.i, GATE.j)]; }
function monoRefresh(){ computeComps(); compReach.clear(); homeVia.clear(); if (mainComp >= 0) compReach.add(mainComp);
  for (const b of buildings.values()) if (b.type === 'station'){ b.spots = stationSpots(b); b.comp = b.spots.length ? pcomp[b.spots.find(k => pcomp[k] === mainComp) ?? b.spots[0]] : -1; b.spot = b.spots.find(k => pcomp[k] === b.comp) ?? -1; }
  for (const L of MONO.lines){ const sts = L.def.st.map(id => buildings.get(id)).filter(b => b && b.comp >= 0); L.sts = [...new Set(sts)]; L.ok = L.sts.length >= 2; }
  let grew = true; while (grew){ grew = false; for (const L of MONO.lines){ if (!L.ok) continue; const from = L.sts.find(b => compReach.has(b.comp)); if (!from) continue;
    for (const b of L.sts) if (!compReach.has(b.comp)){ compReach.add(b.comp); homeVia.set(b.comp, { line: L.def.id, from: b.id, to: from.id, spot: b.spot }); grew = true; } } } }
const reachK = k => pcomp[k] >= 0 && compReach.has(pcomp[k]);
function monoOperational(){ return MONO.lines.some(L => L.ok); }
function expansionExhibits(){ return [...pens.values()].filter(p => { const k = idx((p.i0 + p.i1) >> 1, (p.j0 + p.j1) >> 1); return (isExpK(k) || ridgeMask[k]) && dinos.some(d => d.pen === p.id); }); } /* ridgeMask: enclosures an older save built where the ridge now stands */
function expansionCut(){ return expansionExhibits().filter(p => !penSpots.some(s => s.pen === p.id)); }
/* track geometry: a smooth curve through the tapped points, held ~7 m above the ground and level with each station deck */
function monoPath(def){
  let nodes = def.nodes.map(n => n.slice()); const st = def.st.slice();
  if (!def.loop && nodes.length >= 2){ const ext = (a, b) => { const dx = a[0] - b[0], dz = a[1] - b[1], l = Math.hypot(dx, dz) || 1; return [a[0] + dx / l * 13, a[1] + dz / l * 13]; };
    nodes = [ext(nodes[0], nodes[1]), ...nodes, ext(nodes[nodes.length - 1], nodes[nodes.length - 2])]; st.unshift(0); st.push(0); } // buffer stubs so the whole train fits at an end station
  const curve = new THREE.CatmullRomCurve3(nodes.map(n => new THREE.Vector3(n[0], 0, n[1])), !!def.loop, 'centripetal', 0.5);
  const len = curve.getLength(), N = Math.max(4, Math.ceil(len / 2)), pts = curve.getSpacedPoints(N);
  const gr = pts.map(p => Math.max(H(p.x, p.z), H(p.x + 1.6, p.z), H(p.x - 1.6, p.z), H(p.x, p.z + 1.6), H(p.x, p.z - 1.6), -1));
  const wrap = i => def.loop ? (i % N + N) % N : clamp(i, 0, N);
  let ys = gr.map(g => g + MONO_CLEAR); { const m = ys.map((_, i) => { let v = -1e9; for (let o = -5; o <= 5; o++) v = Math.max(v, ys[wrap(i + o)]); return v; }); ys = m; }
  for (let pass = 0; pass < 3; pass++){ ys = ys.map((_, i) => { let s = 0; for (let o = -4; o <= 4; o++) s += ys[wrap(i + o)]; return s / 9; }); }
  for (let i = 0; i <= N; i++) ys[i] = Math.max(ys[i], gr[i] + 4.2);
  const stops = [];
  nodes.forEach((n, k) => { if (!st[k]) return; const b = buildings.get(st[k]); if (!b || stops.some(s => s.bid === b.id)) return; let bi = 0, bd = 1e9;
    for (let i = 0; i <= N; i++){ const d = (pts[i].x - n[0]) ** 2 + (pts[i].z - n[1]) ** 2; if (d < bd){ bd = d; bi = i; } } stops.push({ bid: b.id, i: bi, s: bi / N * len, y: b.mesh.position.y + 0.05 + MONO_DECK }); });
  for (const sp of stops) for (let i = 0; i <= N; i++){ let di = Math.abs(i - sp.i); if (def.loop) di = Math.min(di, N - di); const ds = di * len / N; if (ds < 24) ys[i] = lerp(sp.y, ys[i], sstep(5, 24, ds)); }
  if (def.loop) ys[N] = ys[0];
  stops.sort((a, b) => a.s - b.s); return { pts, ys, gr, len, N, loop: !!def.loop, stops }; }
function monoAt(P, s, out){ if (P.loop) s = ((s % P.len) + P.len) % P.len; else s = clamp(s, 0, P.len); const f = s / P.len * P.N, i = Math.min(P.N - 1, Math.floor(f)), t = f - i, a = P.pts[i], b = P.pts[i + 1];
  out.set(lerp(a.x, b.x, t), lerp(P.ys[i], P.ys[i + 1], t), lerp(a.z, b.z, t)); return out; }
function monoTrackGeo(P){ const parts = []; const e = new THREE.Euler(0, 0, 0, 'YXZ'), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const beam = new THREE.BoxGeometry(1, 1, 1), cap = new THREE.BoxGeometry(0.62, 0.1, 1), pil = new THREE.CylinderGeometry(0.42, 0.62, 1, 10), head = new THREE.BoxGeometry(1.7, 0.6, 1.3);
  const nearStop = i => P.stops.some(sp => { let di = Math.abs(i - sp.i); if (P.loop) di = Math.min(di, P.N - di); return di * P.len / P.N < 5.5; });
  for (let i = 0; i < P.N; i++){ const a = P.pts[i], b = P.pts[i + 1], ya = P.ys[i], yb = P.ys[i + 1]; const dx = b.x - a.x, dz = b.z - a.z, dy = yb - ya, hl = Math.hypot(dx, dz), L = Math.hypot(hl, dy) + 0.06;
    e.set(-Math.atan2(dy, hl), Math.atan2(dx, dz), 0); q.setFromEuler(e);
    v.set((a.x + b.x) / 2, (ya + yb) / 2 - 0.5, (a.z + b.z) / 2); parts.push([beam, 0xbdb8ac, new THREE.Matrix4().compose(v, q, sc.set(1.0, 1.0, L))]);
    v.y += 0.55; parts.push([cap, 0x5a6266, new THREE.Matrix4().compose(v.clone(), q, sc.set(1, 1, L))]); }
  const every = 5; for (let i = (P.loop ? 0 : 6); i <= P.N - (P.loop ? 1 : 6); i += every){ if (nearStop(i)) continue; const p = P.pts[i], top = P.ys[i] - 1.0, g = H(p.x, p.z) - 0.6, hgt = top - g; if (hgt < 0.8) continue;
    parts.push([pil, 0xb0aba0, new THREE.Matrix4().compose(v.set(p.x, g + hgt / 2, p.z), q.identity(), sc.set(1, hgt, 1))]);
    const t = P.pts[Math.min(P.N, i + 1)], o = P.pts[Math.max(0, i - 1)]; e.set(0, Math.atan2(t.x - o.x, t.z - o.z), 0); q.setFromEuler(e); parts.push([head, 0xa8a398, new THREE.Matrix4().compose(v.set(p.x, top - 0.1, p.z), q, sc.set(1, 1, 1))]); }
  if (!P.loop) for (const i of [0, P.N]){ const p = P.pts[i]; parts.push([new THREE.BoxGeometry(1.6, 1.4, 0.8), 0xc8a030, new THREE.Matrix4().compose(v.set(p.x, P.ys[i] + 0.4, p.z), q.identity(), sc.set(1, 1, 1))]); }
  return M.mergeColored(parts); }
function monoBuildLine(def){ const P = monoPath(def); const mesh = new THREE.Mesh(monoTrackGeo(P), monoMat); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  const cars = [TRAIN_GEO.nose, TRAIN_GEO.mid, TRAIN_GEO.nose].map((g, k) => { const m = new THREE.Mesh(g, trainMat); m.castShadow = true; if (k === 2) m.userData.back = true; scene.add(m); return m; });
  const L = { def, path: P, mesh, ok: false, sts: [], train: { cars, s: P.stops.length ? P.stops[0].s : P.len / 2, dir: 1, v: 0, dwell: 2, k: 0, riders: [] } };
  for (const sp of P.stops){ const b = buildings.get(sp.bid); if (!b) continue; const a = P.pts[Math.max(0, sp.i - 2)], c = P.pts[Math.min(P.N, sp.i + 2)]; b.rot = Math.atan2(c.x - a.x, c.z - a.z); b.mesh.rotation.y = b.rot; }
  MONO.lines.push(L); placeTrain(L); return L; }
function monoClearRuntime(){ for (const L of MONO.lines){ scene.remove(L.mesh); L.mesh.geometry.dispose(); for (const c of L.train.cars) scene.remove(c); } MONO.lines.length = 0; }
function monoRebuildAll(){ monoClearRuntime(); for (const d of monoDefs()) monoBuildLine(d); }
function monoRemoveLine(id, refundPct = 0){ const defs = monoDefs(); const n = defs.findIndex(d => d.id === id); if (n < 0) return 0; const def = defs[n]; defs.splice(n, 1);
  const L = MONO.lines.find(l => l.def === def); if (L){ scene.remove(L.mesh); L.mesh.geometry.dispose(); for (const c of L.train.cars) scene.remove(c); MONO.lines.splice(MONO.lines.indexOf(L), 1);
    for (const g of L.train.riders) if (!g.gone){ removeGuest(g); onGuestLeft(g); } }
  for (const g of guests) if (!g.gone && g.state === 'queue' && g.qLine === id) unqueue(g);
  const c = Math.round((def.cost || 0) * refundPct); if (c) refund(c); return c; }
function monoStationGone(b){ for (const d of monoDefs().slice()) if (d.st.includes(b.id)){ const c = monoRemoveLine(d.id, 0.5); toast(`Monorail line removed with the station${c ? ` (${fmt(c)} refunded for the track)` : ''}.`, ''); } }
const _tp = new THREE.Vector3(), _tq = new THREE.Vector3();
function placeTrain(L){ const T = L.train, P = L.path;
  T.cars.forEach((m, k) => { const s = T.s + (1 - k) * CAR_GAP * T.dir; monoAt(P, s + 2.5, _tp); monoAt(P, s - 2.5, _tq); m.position.set((_tp.x + _tq.x) / 2, (_tp.y + _tq.y) / 2, (_tp.z + _tq.z) / 2);
    const yaw = Math.atan2(_tp.x - _tq.x, _tp.z - _tq.z) + (T.dir < 0 ? Math.PI : 0) + (m.userData.back ? Math.PI : 0); m.rotation.set(0, yaw, 0, 'YXZ'); m.rotation.x = Math.atan2(_tp.y - _tq.y, 5) * (T.dir < 0 !== !!m.userData.back ? 1 : -1); }); }
function updateMono(dt){
  for (const L of MONO.lines){ const T = L.train, P = L.path, S = P.stops; if (S.length < 1){ placeTrain(L); continue; }
    if (T.dwell > 0){ T.dwell -= dt; if (T.dwell <= 0){ if (S.length < 2){ T.dwell = MONO_DWELL; continue; }
        if (P.loop) T.k = (T.k + 1) % S.length; else { if (T.k + T.dir < 0 || T.k + T.dir >= S.length) T.dir = -T.dir; T.k += T.dir; } } }
    else { const sT = S[T.k].s; const dist = P.loop ? ((sT - T.s) % P.len + P.len) % P.len : Math.abs(sT - T.s);
      const vt = Math.min(MONO_VMAX, Math.sqrt(2 * MONO_ACC * dist) + 0.3); T.v = Math.min(vt, T.v + MONO_ACC * dt); const step = Math.min(dist, T.v * dt);
      T.s += (P.loop ? 1 : Math.sign(sT - T.s) || 1) * step; if (P.loop) T.s %= P.len; if (!P.loop) T.dir = sT >= T.s ? (T.dir) : T.dir;
      if (dist - step < 0.02){ T.s = sT; T.v = 0; T.dwell = MONO_DWELL; monoArrive(L, S[T.k]); } }
    placeTrain(L); T.ds = (T.ds || 0) + T.v * dt;
    const mc = T.cars[1].position; for (const g of T.riders){ g.x = mc.x; g.z = mc.z; } } }
function monoArrive(L, sp){ const b = buildings.get(sp.bid); if (!b) return; const T = L.train;
  for (const g of T.riders){ if (g.gone || g.toBid !== b.id) continue; // get off
    const k = b.spot; if (k < 0){ removeGuest(g); onGuestLeft(g); continue; }
    g.state = g.homeward ? 'leave' : 'walk'; g.ci = kI(k); g.cj = kJ(k); g.pi = g.pj = -1; g.x = b.x + fr(-1.5, 1.5); g.z = b.z + fr(-1.5, 1.5); g.tx = tX(g.ci) + fr(-1, 1); g.tz = tZ(g.cj) + fr(-1, 1);
    g.dest = -1; g.goal = ''; g.lastArr = -1; g.stuck = 0; g.happy = Math.min(100, g.happy + 4); g.linger = 0; g.moving = 1; }
  T.riders = T.riders.filter(g => g.state === 'ride' && !g.gone);
  for (const g of guests){ if (T.riders.length >= MONO_CAP) break; if (g.gone || g.state !== 'queue' || g.qBid !== b.id || g.qLine !== L.def.id) continue;
    g.state = 'ride'; T.riders.push(g); G.stats.monoRides = (G.stats.monoRides || 0) + 1; if (g.money >= MONO_FARE){ g.money -= MONO_FARE; earn('tickets', MONO_FARE); G.stats.monoFares = (G.stats.monoFares || 0) + MONO_FARE; } } }
function startQueue(g, bid, toBid, line, homeward){ const b = buildings.get(bid); if (!b) return false; g.state = 'queue'; g.qBid = bid; g.toBid = toBid; g.qLine = line; g.homeward = !!homeward; g.qT = 0; g.dest = -1;
  const a = fr(0, TAU), r = fr(0.6, 2.4); g.tx = tX(g.ci) + Math.cos(a) * r * 0.6; g.tz = tZ(g.cj) + Math.sin(a) * r * 0.6; return true; }
function unqueue(g){ g.state = g.homeward ? 'leave' : 'walk'; g.dest = -1; g.goal = ''; g.lastArr = -1; }
/* guests choosing a ride: from a station in their own path network to another network that has something to see */
function monoOptions(g, here){ const out = []; const myc = pcomp[here]; if (myc < 0) return out;
  for (const L of MONO.lines){ if (!L.ok) continue; const mine = L.sts.find(b => b.comp === myc); if (!mine) continue;
    for (const b2 of L.sts){ if (b2.comp === myc || !compReach.has(b2.comp)) continue; let w = 5;
      for (const s of penSpots) if (pcomp[s.k] === b2.comp) w += (8 + s.ap) * (g.seen.has(s.pen) ? 0.12 : 1.5);
      out.push({ k: mine.spot, goal: 'mono', bid: mine.id, to: b2.id, line: L.def.id, w: w * 0.9 }); } }
  return out; }
/* ---- monorail track tool ---- */
function monoToolLen(){ const N = tool.nodes; let l = 0; for (let k = 1; k < N.length; k++) l += Math.hypot(N[k][0] - N[k - 1][0], N[k][1] - N[k - 1][1]); return l; }
function monoToolCost(){ return Math.round(monoToolLen() * MONO_COST_M / 100) * 100; }
function monoToolDue(){ const c = monoToolCost(); return Math.max(0, c - (G.monoCredit || 0)); }
function monoToolReady(){ const st = tool.st.filter(Boolean); return tool.nodes.length >= 2 && !!tool.st[tool.st.length - 1] && new Set(st).size >= 2; }
function monoTap(t){ const N = tool.nodes; const b = stationAtTile(t[0], t[1]);
  if (!N.length){ if (!b){ toast('Start the track at a Monorail Station. Build one first (Build > Paths).', 'bad'); return; } N.push([b.x, b.z]); tool.st.push(b.id); SFX.click(); drawMonoPreview(); renderToolbar(); return; }
  if (tool.loop){ toast('The loop is closed. Press Done, or Undo.', ''); return; }
  const p = b ? [b.x, b.z] : [tX(t[0]), tZ(t[1])], last = N[N.length - 1], l = Math.hypot(p[0] - last[0], p[1] - last[1]); if (l < 6) return;
  if (l > 170){ toast('Track segment too long. Tap a closer point.', 'bad'); return; }
  if (b && tool.st.includes(b.id) && !(b.id === tool.st[0] && N.length >= 3)){ toast('The track already stops at that station.', 'bad'); return; }
  if (N.length >= 2){ const a = N[N.length - 2]; const ux = last[0] - a[0], uz = last[1] - a[1], vx = p[0] - last[0], vz = p[1] - last[1]; const cos = (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1); if (cos < -0.45){ toast('Turn too sharp for a monorail. Add a point to round the corner.', 'bad'); return; } }
  if (b && b.id === tool.st[0]){ tool.loop = true; } else { N.push(p); tool.st.push(b ? b.id : 0); }
  SFX.click(); drawMonoPreview(); renderToolbar(); }
function toolDef(){ return { nodes: tool.nodes, st: tool.st, loop: !!tool.loop }; }
function drawMonoPreview(){ clearPending(); if (!tool || tool.kind !== 'mono') return;
  if (tool.nodes.length >= 2){ const P = monoPath(toolDef()); if (!monoPrev){ monoPrev = new THREE.Mesh(new THREE.BufferGeometry(), monoPrevMat); monoPrev.renderOrder = 6; scene.add(monoPrev); } monoPrev.geometry.dispose(); monoPrev.geometry = monoTrackGeo(P); monoPrev.visible = true; }
  tool.nodes.forEach((n, k) => { const m = new THREE.Mesh(nodeGeo, k === tool.nodes.length - 1 ? nodeMatLast : nodeMat); m.scale.setScalar(tool.st[k] ? 2.2 : 1.3); m.position.set(n[0], H(n[0], n[1]) + 0.5, n[1]); m.renderOrder = 7; scene.add(m); nodeMeshes.push(m); }); }
function commitMono(){ if (!monoToolReady()){ toast(tool.nodes.length < 2 ? 'Tap points across the ridge, ending at another station.' : 'End the track at a Monorail Station.', 'bad'); return; }
  const cost = monoToolCost(), due = monoToolDue(); if (G.money < due){ toast('Not enough funds.', 'bad'); return; }
  const used = cost - due; if (used) G.monoCredit = Math.max(0, (G.monoCredit || 0) - used); spend('build', due);
  const def = { id: G.nextId++, nodes: tool.nodes.map(n => [+n[0].toFixed(2), +n[1].toFixed(2)]), st: tool.st.slice(), loop: !!tool.loop, cost }; monoDefs().push(def); monoBuildLine(def);
  afterStructureChange(); SFX.build(); cancelTool(); recordUndo({ kind: 'mono', id: def.id, cost: due, label: 'Monorail line' });
  const L = MONO.lines.find(l => l.def === def); setTimeout(() => toast(L && L.ok ? `Monorail open: ${L.sts.length} stations, ${Math.round(L.path.len)} m of track. Guests ride for ${fmt(MONO_FARE)}.` : 'Track built. Each station must touch a path that guests can reach before trains carry anyone.', L && L.ok ? 'good' : 'bad'), 300); }

/* ================= economy ================= */
function earn(cat, amt){ G.money += amt; G.ledger[cat] = (G.ledger[cat] || 0) + amt; flowAdd(cat === 'other' ? 'none' : cat, amt); }
function spend(cat, amt){ G.money -= amt; G.ledger[cat] = (G.ledger[cat] || 0) + amt; flowAdd(cat, amt); }
const INCOME = ['tickets', 'shops'];
function ledgerProfit(L){ let p = 0; for (const k in L) p += INCOME.includes(k) ? L[k] : -L[k]; return p; }
function appealTotal(){ const seen = {}; let a = MONO.lines.filter(L => L.ok).reduce((s, L, n) => s + (n ? 10 : 30), 0); /* v10: the monorail is a ride in its own right */ for (const d of dinos){ if (d.state === 'holding' || d.state === 'wild' || d.state === 'carcass' || d.state === 'escaping') continue; seen[d.sp] = (seen[d.sp] || 0) + 1; const pen = pens.get(d.pen); const volc = pen && regionOfPen(pen) === 'volcano'; a += SPECIES[d.sp].appeal * Math.pow(0.75, seen[d.sp] - 1) * (volc ? 1.4 : 1); } return a; }
const DINO_UPKEEP = 400;
// a hatchery with no egg in it only needs a caretaker; the full bill applies while it incubates
function bldUpkeep(b){ const B = BUILD[b.type]; if (b.type === 'hatchery'){ const hs = hatcheries(), k = hs.indexOf(b); return k >= 0 && eggs.length > k * 2 ? B.upkeep : B.idleUpkeep; } return B.upkeep || 0; }
function dailyUpkeep(){ let u = 0; for (const b of buildings.values()) u += bldUpkeep(b); for (const pen of pens.values()) u += pen.segs.length * FT[pen.tier].upkeep; u += dinos.filter(d => d.state !== 'wild' && d.state !== 'carcass').length * DINO_UPKEEP; u += MONO.lines.length * 500; return u; }
function unseenGuest(){ G.stats.guestsTotal++; G.stats.guestsToday++; const money = fr(60, 220); if (money < G.price) return; earn('tickets', G.price);
  const shops = new Set([...buildings.values()].map(b => b.type)); const ft = FOOD_T.find(t => shops.has(t)), dt2 = DRINK_T.find(t => shops.has(t));
  if (ft && rnd() < 0.6) earn('shops', ft === 'visitor' ? FOOD_PRICE : SHOP[ft].p); if (dt2 && rnd() < 0.55) earn('shops', dt2 === 'visitor' ? DRINK_PRICE : SHOP[dt2].p); if (shops.has('gift') && rnd() < 0.2) earn('shops', GIFT_PRICE);
  G.rep = clamp(G.rep + ((G.avgHappy || G.rep) - G.rep) * 0.025, 0, 100); }
function guestRatePerHour(){ const ap = appealTotal(); const priceF = clamp(1.6 - G.price / 60, 0.12, 1.5), repF = 0.4 + G.rep / 100, starF = 0.8 + G.stars * 0.12;
  return (24 + ap * 1.8) * priceF * repF * starF * (1 + G.thrill * 0.55) / (CLOSE - OPEN); }
function computeStars(){
  const ap = appealTotal(); const species = new Set(dinos.filter(d => d.state !== 'wild' && d.state !== 'carcass').map(d => d.sp)).size;
  const amen = [...buildings.values()].filter(b => SHOP_T.includes(b.type) && b.type !== 'visitor' || b.type === 'viewing' || b.type === 'stand').length + Math.max(0, Math.min(3, new Set([...buildings.values()].filter(b => SHOP[b.type]).map(b => b.type)).size - 1));
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
  { id: 'menu', name: 'Something for Everyone', desc: 'Open three different kinds of food or drink stand.', reward: 20000, check: () => new Set([...buildings.values()].filter(b => SHOP[b.type]).map(b => b.type)).size >= 3 },
  { id: 'expand', name: 'Room to Roam', desc: 'Buy the Highland Ridge permit to open the rough country.', reward: 30000, check: () => !!G.expand },
  { id: 'beach', name: 'Down to the Sea', desc: 'Buy the Beach Coast permit.', reward: 25000, check: () => !!(G.regions && G.regions.beach) },
  { id: 'aviary', name: 'Look, Up There', desc: 'Hatch a pterosaur in an aviary.', reward: 30000, check: () => dinos.some(d => habOf(d.sp) === 'aviary') },
  { id: 'lake', name: 'River Monster', desc: 'Keep a Spinosaurus in a lake enclosure.', reward: 90000, check: () => dinos.some(d => d.sp === 'spino' && d.state !== 'carcass') },
  { id: 'deep', name: 'Something in the Water', desc: 'Keep a Mosasaurus in an ocean lagoon.', reward: 100000, check: () => dinos.some(d => d.sp === 'mosa' && d.state !== 'carcass') },
  { id: 'five', name: 'Welcome to the Park', desc: 'Exhibit 5 species and reach 3.5 stars.', reward: 120000, check: () => G.stars >= 3.5 && new Set(dinos.filter(d => d.state !== 'wild' && d.state !== 'carcass').map(d => d.sp)).size >= 5 },
];
function checkMissions(){ for (const m of MISSIONS){ if (G.missions.includes(m.id)) continue; if (m.check()){ G.missions.push(m.id); earn('other', 0); G.money += m.reward; toast(`Goal complete: ${m.name}. Investors send ${fmt(m.reward)}.`, 'money'); SFX.cash(); } } }
function hatcheries(){ return [...buildings.values()].filter(b => b.type === 'hatchery'); }
function unlocked(sp){ return G.stars >= SPECIES[sp].stars || G.unlockAll; }
function orderEgg(sp, pen){
  const S = SPECIES[sp]; if (!hatcheries().length){ toast('Build a Hatchery first.', 'bad'); return false; }
  if (!unlocked(sp)){ toast(`${S.name} unlocks at ${S.stars} stars.`, 'bad'); return false; }
  if (!habOk(sp, pen)){ toast(`${S.short} needs ${HAB_NAME[habOf(sp)]}.`, 'bad'); return false; }
  if (G.money < S.cost){ toast('Not enough funds.', 'bad'); return false; }
  spend('hatch', S.cost); eggs.push({ sp, pen: pen.id, t: S.hatch, total: S.hatch }); SFX.click(); toast(`${S.name} egg incubating for ${pen.name}.`, ''); return true;
}
function updateEggs(gdt){ const cap = hatcheries().length * 2; for (let k = 0; k < eggs.length && k < cap; k++){ const e = eggs[k]; e.t -= gdt; if (e.t <= 0){ eggs.splice(k, 1); k--; hatchEgg(e); } } }
function hatchEgg(e){
  const pen = pens.get(e.pen); if (!pen){ toast(`A ${SPECIES[e.sp].short} hatched with nowhere to go. Refunded half.`, ''); G.money += SPECIES[e.sp].cost / 2; return; }
  const d = spawnDino(e.sp, pen, { state: penBroken(pen) ? 'holding' : 'pen', hunger: 0.3 }); dust(d.x, d.z, SPECIES_DATA[e.sp].size * 0.35, 10, 0xb0a07a); d.model.setAction('roar', 2); vocal(d);
  G.stats.hatched++; if (SPECIES[e.sp].diet === 'meat') G.stats.carnHatched++; if (e.sp === 'trex') G.stats.trex++;
  toast(`${SPECIES[e.sp].name} "${d.name}" released into ${pen.name}.`, 'good');
  { const hp = huntPairs(pen).filter(x => x.prey === e.sp || x.pred === e.sp); if (hp.length) setTimeout(() => toast(hp.some(x => x.prey === e.sp) ? `Carnivore will hunt this animal: ${SPECIES[hp.find(x => x.prey === e.sp).pred].short} shares ${pen.name}.` : `${d.name} will hunt the other animals in ${pen.name}.`, 'bad'), 900); }
  const weak = SPECIES[e.sp].str > FT[pen.tier].str - 0.75; if (weak) setTimeout(() => toast(`Warning: ${FT[pen.tier].name} fencing is too weak for a ${SPECIES[e.sp].short}.`, 'bad'), 1500);
  refreshSheet();
}
function hourTick(){
  monoAdvisorTick();
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
  pizza: '<path d="M4 6c5-3 11-3 16 0L12 21z"/><circle cx="10" cy="9" r="1"/><circle cx="14" cy="12" r="1"/><circle cx="11" cy="14" r="1"/>',
  drinks: '<path d="M7 7h10l-1.5 14h-7zM9 7l1-4h5M7.5 12h9"/>',
  coffee: '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>',
  icecream: '<path d="M8 11l4 10 4-10M7 11a5 5 0 0 1 10 0z"/>',
  restaurant: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11"/>',
  stand: '<path d="M3 21h18M5 21v-4h14v4M7 17v-4h10v4M9 13V9h6v4"/>',
  water: '<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z"/>',
  browse: '<path d="M12 21V10M8 21h8M12 10c-4 0-6-3-5-6 3 0 5 2 5 6zm0 0c4 0 6-3 5-6-3 0-5 2-5 6"/>',
  goat: '<path d="M6 8c-2-2-2-4 0-5M18 8c2-2 2-4 0-5M7 8h10l-1 5h-8zM8 13v7M16 13v7M10 13l2 3 2-3"/>',
  fish: '<path d="M3 12c4-5 10-5 14 0-4 5-10 5-14 0zM17 12l4-3v6z"/><circle cx="8" cy="11" r="1"/>',
  insect: '<ellipse cx="12" cy="13" rx="4" ry="6"/><path d="M8 10L4 7M16 10l4-3M8 14H3M16 14h5M8 17l-3 3M16 17l3 3M12 7V4"/>',
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
  if (!loose.length && !sed.length){ if (!el.classList.contains('hidden')){ el.classList.add('hidden'); placeToasts(); } return; }
  const responding = jeeps.some(j => j.state !== 'return');
  const cnt = {}; for (const d of loose) cnt[SPECIES[d.sp].short] = (cnt[SPECIES[d.sp].short] || 0) + 1; const names = Object.entries(cnt).map(([n, c]) => c > 1 ? `${c} ${/(s|us)$/.test(n) || n === 'T. rex' ? n : n + 's'}` : n).join(', ');
  el.innerHTML = `<div class="stripe"></div><div class="body"><div class="txt"><b>Containment breach</b><span>${loose.length ? `${names} loose in the park.` : 'Target sedated. Recovering.'} ${responding ? 'Rangers responding.' : ''}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px">${!responding && loose.length ? `<button class="btn hz" data-act="dispatch">${ic('ranger')}Rangers <small>${fmtK(dispatchCost())}</small></button>` : ''}${loose.length ? `<button class="btn" data-act="locate">${ic('target')}Locate</button>` : ''}</div></div><div class="stripe"></div>`;
  el.classList.remove('hidden'); placeToasts();
}
$('alert').onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b) return; SFX.click(); if (b.dataset.act === 'dispatch') dispatchRangers(); if (b.dataset.act === 'locate'){ const d = looseDinos()[0]; if (d){ focusOn(d.x, d.z, 60); cam.follow = d; } } showAlert(); };
function closeSheet(){ sel = null; $('sheet').classList.add('hidden'); updateDockState(); cam.follow = null; }
function openSheet(kind, ref){ sel = { kind, ref }; renderSheet(); $('sheet').classList.remove('hidden'); $('sheet').querySelector('.bd') && ($('sheet').querySelector('.bd').scrollTop = 0); updateDockState(); }
function refreshSheet(){ if (sel && sel.renaming) return; if (sel && !sheetHeld) { const bd = $('sheet').querySelector('.bd'); const st = bd ? bd.scrollTop : 0; renderSheet(); const bd2 = $('sheet').querySelector('.bd'); if (bd2) bd2.scrollTop = st; } }
const meter = (v, inv) => { const cls = inv ? (v > 0.66 ? 'bad' : v > 0.4 ? 'warn' : '') : (v < 0.34 ? 'bad' : v < 0.6 ? 'warn' : ''); return `<span class="meter ${cls}"><u style="width:${clamp(v, 0, 1) * 100}%"></u></span>`; };
function header(title, icon){ return `<div class="hd">${icon ? ic(icon) : ''}<h2>${title}</h2><button class="hb" data-act="close" aria-label="Close">${ic('close')}</button></div>`; }
function renderSheet(){
  const sh = $('sheet'); if (!sel){ sh.classList.add('hidden'); return; } let h = '';
  const k = sel.kind;
  if (k === 'build'){
    const tab = sel.ref || 'facilities';
    h += header(tab === 'pens' ? 'Build an Enclosure' : 'Build', tab === 'pens' ? 'fence' : 'build');
    h += `<div class="tabs">${[['facilities', 'Facilities'], ['pens', 'Enclosures'], ['care', 'Dino Care'], ['paths', 'Paths']].map(([t, l]) => `<button class="tab ${t === tab ? 'on' : ''}" data-tab="${t}">${l}</button>`).join('')}</div><div class="bd">`;
    if (tab === 'pens'){ const pk = penKindSel;
      h += `<div class="tabs" style="margin:0 0 8px">${Object.keys(PEN_KINDS).map(k2 => `<button class="tab ${k2 === pk ? 'on' : ''}" data-pk="${k2}">${PEN_KINDS[k2].name}</button>`).join('')}</div>`;
      h += `<div class="note">${PEN_KINDS[pk].desc} ${pk === 'land' ? 'Pick a fence, then tap two opposite corners on open ground and press Build. Stronger fences cost more but hold bigger animals. Cheap fences mean breakouts.' : pk === 'lagoon' ? 'Pick net strength, then tap two corners out on the water.' : 'Pick the fence strength, then tap two opposite corners.'}</div><div class="cards">`;
      FT.forEach((f, t) => { const lock = G.stars < FENCE_STARS[t] && !G.unlockAll; const holds = SP_KEYS.filter(s => SPECIES[s].str <= f.str - 0.75 && (pk === 'lake' ? habOf(s) !== 'aviary' && habOf(s) !== 'lagoon' : habOf(s) === pk)).map(s => SPECIES[s].short);
        h += `<button class="card ${lock ? 'lock' : ''}" data-fence="${t}">${lock ? `<span class="tag">${FENCE_STARS[t]} STARS</span>` : ''}<span class="nm"><span class="swatch" style="background:${f.color}"></span>${f.name}</span><span class="ds">${f.desc}</span><span class="ds">Holds: ${holds.length ? holds.join(', ') : 'nothing dangerous'}</span><span class="pr">${fmt(f.cost * (pk === 'lagoon' ? 1.3 : 1))} <small style="font-size:11px;color:var(--bone2)">per tile edge${pk === 'aviary' ? ' + dome' : pk === 'lake' ? ' + digging' : ''}</small></span></button>`; });
      h += `</div>`; }
    else if (tab === 'paths'){ h += `<div class="cards"><button class="card" data-tool="path"><span class="nm">${ic('path')}Footpath</span><span class="ds">Tap point to point to lay gravel paths, then Done. Guests only walk on paths connected to the gate.</span><span class="pr">${fmt(BUILD.path.cost)} / tile</span></button>
      <button class="card ${G.expand ? '' : 'lock'}" data-bld="station"><span class="nm">${ic('build')}Monorail Station</span><span class="ds">${BUILD.station.desc}</span><span class="pr">${fmt(BUILD.station.cost)} <small style="font-size:11px;color:var(--bone2)">+ grading on rough ground</small></span>${G.expand ? '' : '<span class="tag">PERMIT</span>'}</button>
      <button class="card ${G.expand ? '' : 'lock'}" data-tool="mono"><span class="nm">${ic('path')}Monorail Track</span><span class="ds">Start at a station, tap points over the ridge, end at another station, then Done. Pillars follow the ground.${G.monoCredit ? ` <b>Free starter line: ${fmt(G.monoCredit)} of track credit.</b>` : ''}</span><span class="pr">${fmt(MONO_COST_M)} / m</span>${G.expand ? '' : '<span class="tag">PERMIT</span>'}</button>
      <button class="card" data-tool="bulldoze"><span class="nm">${ic('bulldoze')}Bulldoze</span><span class="ds">Tap a path tile, building or feeder to remove it. Half refund.</span><span class="pr">Refunds 50%</span></button></div>`; }
    else { const list = tab === 'care' ? ['hatchery', 'water', 'plant', 'browse', 'meat', 'goat', 'fish', 'insect', 'ranger'] : ['hatchery', 'food', 'pizza', 'restaurant', 'drinks', 'coffee', 'icecream', 'restroom', 'gift', 'viewing', 'stand', 'ranger'];
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
    if (pen.kind && pen.kind !== 'land') h += `<div class="note">${PEN_KINDS[pen.kind].desc}</div>`;
    { const hp = huntPairs(pen); if (hp.length) h += `<div class="note bad">${ic('warn')} Carnivore will hunt: ${hp.map(x => `${SPECIES[x.pred].short} hunts ${SPECIES[x.prey].short}`).join(', ')}.${predationOn() ? '' : ` Hunting starts ${fmtHourIn(G.predAt)} unless you move them apart.`}</div>`; }
    { const thirsty = ds.filter(d => needsWater(d.sp)); if (thirsty.length && !hasWater(pen)) h += `<div class="note warn">No water hole. ${thirsty.length > 1 ? 'These animals get' : 'This animal gets'} thirsty and stressed. <button class="btn" data-act="water" style="margin-top:6px">Add Water Hole <small>${fmtK(BUILD.water.cost)}</small></button></div>`; }
    { const unfed = ds.filter(d => d.state !== 'carcass' && !feederOf(pen, d.sp)).map(d => d.sp); if (unfed.length) h += `<div class="note warn">Nothing here suits the ${[...new Set(unfed)].map(s => SPECIES[s].short).join(', ')}. Try: ${[...new Set(unfed.map(s => BUILD[FOODS[s][0]].name))].join(', ')}.</div>`; }
    h += `<div class="row"><span class="k">${pen.kind === 'lagoon' ? 'Sea nets' : 'Fence'}</span><span class="v">${FT[pen.tier].name}</span></div><div class="row"><span class="k">Condition</span>${meter(cond)}</div>
      <div class="row"><span class="k">Space used</span><span class="v">${need} / ${penArea(pen)} tiles</span></div>
      <div class="row"><span class="k">Feeders</span><span class="v">${pen.feeders.length ? pen.feeders.map(f => BUILD[f.type].name).join(', ') : 'None'}</span></div>`;
    ds.splice(0, ds.length, ...ds.filter(d => d.state !== 'carcass'));
    if (ds.length){ h += `<div class="list" style="margin-top:8px">` + ds.map(d => `<button class="li" data-dino="${d.id}">${ic('dino')}<span class="t"><b>${escH(d.name)}</b><span>${SPECIES[d.sp].name} - ${dinoStatus(d)}</span></span>${meter(1 - d.hunger)}</button>`).join('') + `</div>`; }
    else h += `<div class="note">Empty. Add a dinosaur from the Hatchery and a feeder that matches its diet.</div>`;
    h += `<div class="btns"><button class="btn pri" data-act="adddino">${ic('egg')}Add dinosaur</button><button class="btn" data-act="feeder">${ic('plant')}Add feeder</button></div><div class="btns"><button class="btn" data-act="feeders">${ic('meat')}Other food and water</button></div><div class="btns">`;
    if (pen.tier < FT.length - 1){ const t2 = pen.tier + 1, cost = pen.segs.length * Math.round(FT[t2].cost - FT[pen.tier].cost * 0.3); h += `<button class="btn" data-act="upgrade" ${G.stars < FENCE_STARS[t2] && !G.unlockAll ? 'disabled' : ''}>${ic('up')}${FT[t2].name} <small>${fmtK(cost)}</small></button>`; }
    if (rc > 0) h += `<button class="btn ${broken ? 'hz' : ''}" data-act="repair">${ic('wrench')}Repair <small>${fmtK(rc)}</small></button>`;
    h += `</div>`;
    if (carn.length) h += `<div class="btns"><button class="btn dng" data-act="feed" ${G.feedCooldown > 0 ? 'disabled' : ''}>${ic('skull')}Feed a guest to ${carn[0].name}</button></div><div class="ds" style="font-size:11px;color:var(--bone2);margin-top:6px;line-height:1.35">Thrill-seekers flock in and the carnivore skips a feeding. Reputation and safety drop, nearby guests panic, and lawyers circle.</div>`;
    h += `<div class="btns"><button class="btn" data-act="demolish">${ic('bulldoze')}Demolish</button></div></div>`;
  }
  else if (k === 'dino'){
    const d = sel.ref; if (!dinos.includes(d)){ closeSheet(); return; } const S = SPECIES[d.sp], c = dinoComfort(d), pen = pens.get(d.pen);
    h += header(escH(d.name), 'dino') + `<div class="bd">${sel.renaming ? `<div class="rename"><input id="dinoName" type="text" maxlength="${NAME_MAX}" value="${escH(d.name)}" placeholder="New name" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-label="Dinosaur name"><button class="btn pri" data-act="renameok">Save</button><button class="btn" data-act="renamecancel">Cancel</button></div><div class="ds" style="font-size:11px;color:var(--bone2);margin:-2px 0 8px">Up to ${NAME_MAX} letters, numbers or spaces.</div>` : ''}<div class="ds" style="margin:-4px 0 6px;color:var(--bone2);font-size:13px">${S.name} - ${S.diet === 'meat' ? 'Carnivore' : 'Herbivore'} - ${dinoStatus(d)}</div>
      <div class="row"><span class="k">Fed</span>${meter(1 - d.hunger)}</div>${needsWater(d.sp) ? `<div class="row"><span class="k">Water</span>${meter(1 - clamp(d.thirst || 0, 0, 1))}</div>` : ''}<div class="row"><span class="k">Space</span>${meter(c.space)}</div><div class="row"><span class="k">Social group</span>${meter(c.social)}</div>
      <div class="row"><span class="k">Stress</span>${meter(d.stress, true)}</div><div class="row"><span class="k">Fence needed</span><span class="v">${FT[tierNeeded(S.str)].name}</span></div><div class="row"><span class="k">Appeal</span><span class="v">${S.appeal}</span></div>`;
    if (!feederOf(pen || { feeders: [] }, d.sp)) h += `<div class="note warn">No suitable feeder in this enclosure. ${S.short} eats: ${FOODS[d.sp].map(t => BUILD[t].name).join(', ')}.</div>`;
    if (pen && needsWater(d.sp) && !hasWater(pen)) h += `<div class="note warn">No water here. Add a Water Hole or it will get thirsty and stressed.</div>`;
    if (pen){ const hp = huntPairs(pen).filter(x => x.pred === d.sp || x.prey === d.sp); const by = hp.filter(x => x.prey === d.sp).map(x => SPECIES[x.pred].short), of = hp.filter(x => x.pred === d.sp).map(x => SPECIES[x.prey].short);
      if (by.length) h += `<div class="note bad">${ic('warn')} Carnivore will hunt this animal: ${[...new Set(by)].join(', ')}${predationOn() ? '' : ' (from ' + fmtHourIn(G.predAt) + ')'}.</div>`;
      if (of.length) h += `<div class="note warn">Hunts the ${[...new Set(of)].join(', ')} in this enclosure when hungry.</div>`; }
    if ((d.injT || 0) > 0) h += `<div class="note warn">Injured in a fight. Recovering.</div>`;
    if (c.mixed) h += `<div class="note warn">Stressed by the other species sharing the enclosure.</div>`;
    h += `<div class="row"><span class="k">Favourite food</span><span class="v">${FOODS[d.sp].map(t => BUILD[t].name).join(' > ')}</span></div>`;
    if (d.state !== 'carcass'){ const cur = d.sc || 'natural', pt = d.pt ?? -1;
      h += `<div class="lbl" style="margin:12px 0 4px">Colours</div><div class="chips">${SCHEMES.map(x => `<button class="chip ${x.id === cur ? 'on' : ''}" data-scheme="${x.id}"><span class="sw" style="background:${x.top !== undefined ? '#' + x.top.toString(16).padStart(6, '0') : 'linear-gradient(135deg,#6a7a4a,#c8b888)'}"></span>${x.name}${x.bold ? '*' : ''}</button>`).join('')}</div>
        <div class="chips" style="margin-top:6px">${PATTERNS.map(x => `<button class="chip ${x.id === pt ? 'on' : ''}" data-pattern="${x.id}">${x.name}</button>`).join('')}</div>
        <div class="btns"><button class="btn" data-act="schemeall">Use on every ${S.short}</button></div>`; }
    h += `<div class="btns"><button class="btn" data-act="rename">Rename</button><button class="btn" data-act="follow">${ic('follow')}${cam.follow === d ? 'Stop following' : 'Follow'}</button>${pen ? `<button class="btn" data-act="openpen">${ic('fence')}${pen.name}</button>` : ''}</div>`;
    if (S.diet === 'meat' && pen && d.state === 'pen') h += `<div class="btns"><button class="btn dng" data-act="feedd" ${G.feedCooldown > 0 ? 'disabled' : ''}>${ic('skull')}Feed a guest</button></div>`;
    h += `<div class="btns"><button class="btn" data-act="transfer" ${d.state === 'pen' ? '' : 'disabled'}>${ic('fence')}Move <small>${fmtK(TRANSFER_FEE)}</small></button><button class="btn" data-act="sell">Sell to a zoo <small>${fmtK(S.cost * 0.4)}</small></button></div></div>`;
  }
  else if (k === 'species'){
    const pen = pens.get(sel.ref); if (!pen){ closeSheet(); return; }
    h += header('Hatch for ' + pen.name, 'egg') + `<div class="bd">`;
    if (!hatcheries().length) h += `<div class="note bad">You need a Hatchery first. Build one from Build, Facilities.</div>`;
    h += `<div class="note">${PEN_KINDS[pen.kind || 'land'].name} enclosure. ${pen.kind === 'aviary' ? 'Only pterosaurs live in an aviary.' : pen.kind === 'lagoon' ? 'Only marine reptiles live in a lagoon.' : pen.kind === 'lake' ? 'Lake species and land animals can live here.' : 'Land animals only. Pterosaurs, lake and sea species need their own enclosure type.'}</div>`;
    const order = SP_KEYS.slice().sort((a, b) => (habOk(b, pen) ? 1 : 0) - (habOk(a, pen) ? 1 : 0));
    h += `<div class="cards">` + order.map(s => { const S = SPECIES[s]; const lock = !unlocked(s); const weak = S.str > FT[pen.tier].str - 0.75; const hab = habOk(s, pen); const hp = hab ? huntPairs(pen, s) : [];
      const hunted = hp.some(x => x.prey === s), hunts = hp.some(x => x.pred === s);
      const tag = lock ? `<span class="tag">${S.stars} STARS</span>` : !hab ? `<span class="tag red">NEEDS ${PEN_KINDS[habOf(s)].name.toUpperCase()}</span>` : weak ? `<span class="tag red">FENCE TOO WEAK</span>` : hunted ? `<span class="tag red">WILL BE HUNTED</span>` : hunts ? `<span class="tag red">WILL HUNT</span>` : '';
      return `<button class="card ${lock || !hab ? 'lock' : ''}" data-sp="${s}" data-hunt="${hunted ? 'prey' : hunts ? 'pred' : ''}">${tag}<img src="${THUMBS[s] || ''}" alt=""><span class="nm">${S.short}</span><span class="ds">${S.desc}</span><span class="ds">${S.diet === 'meat' ? 'Carnivore' : 'Herbivore'} - ${habOf(s) !== 'land' ? PEN_KINDS[habOf(s)].name + ' - ' : ''}needs ${FT[tierNeeded(S.str)].name} - group ${S.group[0]}-${S.group[1]}</span><span class="pr">${fmt(S.cost)}</span></button>`; }).join('') + `</div></div>`;
  }
  else if (k === 'feeders'){
    const pen = pens.get(sel.ref); if (!pen){ closeSheet(); return; } const res = [...new Set(dinos.filter(d => d.pen === pen.id && d.state !== 'carcass').map(d => d.sp))];
    h += header('Food and water for ' + pen.name, 'plant') + `<div class="bd"><div class="note">Each species has favourite foods. The first choice fills them fastest; anything on their list will do.</div><div class="cards">`;
    for (const ty of ['water', ...FEEDER_TYPES]){ const B = BUILD[ty]; const lock = G.stars < B.stars && !G.unlockAll; const fans = SP_KEYS.filter(sp => FOODS[sp].includes(ty)); const here = res.filter(sp => ty === 'water' ? needsWater(sp) : FOODS[sp].includes(ty));
      const has = pen.feeders.some(f => f.type === ty);
      h += `<button class="card ${lock ? 'lock' : ''}" data-feed="${ty}">${lock ? `<span class="tag">${B.stars} STARS</span>` : has ? '<span class="tag">BUILT</span>' : here.length ? '<span class="tag">SUITS THIS PEN</span>' : ''}<span class="nm">${ic(ty)}${B.name}</span><span class="ds">${B.desc}</span>
        <span class="ds">${ty === 'water' ? 'All land animals and pterosaurs' : 'Eaten by: ' + fans.map(sp => SPECIES[sp].short + (FOODS[sp][0] === ty ? ' (favourite)' : '')).join(', ')}</span><span class="pr">${fmt(B.cost)} <small style="font-size:11px;color:var(--bone2)">+${fmtK(B.upkeep)}/day</small></span></button>`; }
    h += `</div></div>`;
  }
  else if (k === 'building'){
    const b = buildings.get(sel.ref); if (!b){ closeSheet(); return; } const B = BUILD[b.type];
    h += header(B.name, b.type === 'visitor' || b.type === 'gate' ? 'build' : b.type) + `<div class="bd"><div class="note">${B.desc}</div>`;
    if (B.upkeep) h += `<div class="row"><span class="k">Upkeep</span><span class="v">${fmt(B.upkeep)} / day${B.idleUpkeep ? ` (${fmt(B.idleUpkeep)} when empty)` : ''}</span></div>`;
    if (b.type === 'hatchery'){ h += `<div class="row"><span class="k">Incubating</span><span class="v">${eggs.length ? eggs.map(e => SPECIES[e.sp].short).join(', ') : 'Nothing'}</span></div><div class="note">To hatch, tap an enclosure and choose Add dinosaur.</div>`; }
    if (!B.inPen && !['visitor', 'food', 'gift', 'restroom', 'viewing', 'hatchery', 'ranger'].includes(b.type)) {}
    if (SHOP_T.includes(b.type) && b.type !== 'visitor' && ![[0, -1], [-1, 0], [b.w, 0], [0, b.h]].some(([di, dj]) => isPath(b.i + di, b.j + dj))) h += `<div class="note warn">Not next to a path. Guests cannot use it.</div>`;
    if (SHOP[b.type]) h += `<div class="row"><span class="k">Price</span><span class="v">${fmt(SHOP[b.type].p)}${SHOP[b.type].hun ? ' - fixes hunger' : ''}${SHOP[b.type].thi ? ' - fixes thirst' : ''}</span></div>`;
    if (!B.inPen){ const cur = b.pal || 'park'; h += `<div class="lbl" style="margin:12px 0 4px">Colour scheme</div><div class="chips"><button class="chip ${cur === 'park' ? 'on' : ''}" data-bpal="park">Park default</button>${M.BLD_PALETTES.map(P => `<button class="chip ${P.id === cur ? 'on' : ''}" data-bpal="${P.id}">${P.cols ? `<span class="sw" style="background:linear-gradient(90deg,${P.cols.map(c => '#' + c.toString(16).padStart(6, '0')).join(',')})"></span>` : ''}${P.name}</button>`).join('')}</div>`; }
    if (!B.fixed) h += `<div class="btns"><button class="btn" data-act="demob">${ic('bulldoze')}Demolish <small>refund ${fmtK(B.cost * 0.5)}</small></button></div>`;
    h += `</div>`;
  }
  else if (k === 'dinos'){
    const list = dinos.filter(d => d.state !== 'wild' && d.state !== 'carcass');
    h += header('Dinosaurs', 'dino') + `<div class="bd">`;
    if (!list.length) h += `<div class="note">No dinosaurs yet. Build an enclosure and a Hatchery, then tap the enclosure and choose Add dinosaur.</div>`;
    h += `<div class="list">` + list.map(d => `<button class="li" data-dino="${d.id}">${ic('dino')}<span class="t"><b>${escH(d.name)}</b><span>${SPECIES[d.sp].name} - ${pens.get(d.pen) ? pens.get(d.pen).name : ''} - ${dinoStatus(d)}</span></span>${meter(1 - d.hunger)}</button>`).join('') + `</div>`;
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
      ${regionSheetHtml()}
      <div class="lbl" style="margin:12px 0 4px">Building colours (park-wide)</div><div class="chips">${M.BLD_PALETTES.map(P => `<button class="chip ${P.id === (G.bldPal || 'classic') ? 'on' : ''}" data-bpal="${P.id}">${P.cols ? `<span class="sw" style="background:linear-gradient(90deg,${P.cols.map(c => '#' + c.toString(16).padStart(6, '0')).join(',')})"></span>` : ''}${P.name}</button>`).join('')}</div>
      <div class="btns"><button class="btn" data-act="quality">Graphics: ${['Low', 'Medium', 'High'][QUALITY.level]}</button><button class="btn" data-act="save">${ic('save')}Save</button></div>
      <div class="btns"><button class="btn pri" data-act="tips">How to make money</button><button class="btn" data-act="income">Income</button></div>
      <div class="btns"><button class="btn" data-act="tutorial">Tutorial</button><button class="btn" data-act="newgame">New park</button></div></div>`;
  }
  else if (k === 'guests'){ const N = guestNeeds();
    h += header('Guests', 'guests') + `<div class="bd"><div class="row"><span class="k">In the park</span><span class="v">${N.n}</span></div><div class="row"><span class="k">Average happiness</span>${meter(N.happy / 100)}</div>
      <div class="lbl" style="margin:12px 0 4px">What guests want</div>` + (N.top.length ? N.top.map(o => `<div class="need"><b>${o.pct}% ${o.label}</b><span>${o.tip}</span></div>`).join('') : `<div class="note">${N.n ? 'Nobody is complaining. Keep it up.' : 'No guests yet. They arrive while the park is open.'}</div>`) +
      `<div class="ds" style="margin-top:10px;font-size:12px;color:var(--bone2)">Tap a guest to see what they are thinking.</div></div>`; }
  else if (k === 'guest'){ const g = sel.ref; if (!g || g.gone){ closeSheet(); return; } const th = guestThought(g);
    const fav = guestFavDino(g), wp = g.linger > 0 && g.goal === 'view' && g.goalPen >= 0 ? dinos.filter(x => x.pen === g.goalPen && x.state === 'pen') : [], wd = wp.length ? wp[g.id % wp.length] : null;
    const doing = g.state === 'ride' ? 'Riding the Monorail' : g.state === 'queue' ? 'Queueing for the Monorail' : wd ? `Watching ${escH(wd.name)} the ${SPECIES[wd.sp].short}` : g.state === 'leave' ? 'Heading home' : g.state === 'flee' ? 'Running for the exit' : g.linger > 0 && g.goal === 'view' ? 'Watching the dinosaurs' : g.goal === 'food' ? 'Looking for food' : g.goal === 'drink' ? 'Looking for a drink' : g.goal === 'restroom' ? 'Looking for a restroom' : g.goal === 'view' ? 'Walking to an exhibit' : g.goal === 'gift' ? 'Off to the gift shop' : 'Exploring the park';
    h += header(guestName(g), 'guests') + `<div class="bd"><div class="ds" style="margin:-4px 0 8px;color:var(--bone2);font-size:13px">${doing}. ${fmt(Math.round(g.money))} left to spend.</div>
      ${th ? `<div class="thought">“${THOUGHT_TEXT[th]}”</div>` : `<div class="thought">“Having a nice time.”</div>`}
      <div class="row"><span class="k">Happiness</span>${meter(g.happy / 100)}</div><div class="row"><span class="k">Hunger</span>${meter(clamp(g.hunger, 0, 1), true)}</div><div class="row"><span class="k">Thirst</span>${meter(clamp(g.thirst || 0, 0, 1), true)}</div><div class="row"><span class="k">Restroom</span>${meter(clamp(g.bladder, 0, 1), true)}</div>
      <div class="row"><span class="k">Boredom</span>${meter(g.bored || 0, true)}</div><div class="row"><span class="k">Exhibits seen</span><span class="v">${g.seen ? g.seen.size : 0} of ${pens.size}</span></div>${fav ? `<div class="row"><span class="k">Favourite dinosaur</span><span class="v">${escH(fav.name)} (${SPECIES[fav.sp].short})</span></div>` : ''}</div>`; }
  else if (k === 'goals'){
    h += header('Goals', 'goals') + `<div class="bd">` + MISSIONS.map(m => `<div class="mis ${G.missions.includes(m.id) ? 'done' : ''}"><span class="ck">${G.missions.includes(m.id) ? ic('check') : ''}</span><div><b>${m.name}</b><span>${m.desc} Reward ${fmt(m.reward)}.</span></div></div>`).join('') +
      `<div class="lbl" style="margin:12px 0 6px">Unlocks</div><div class="note">${SP_KEYS.map(s => `${SPECIES[s].short}: ${SPECIES[s].stars ? SPECIES[s].stars + ' stars' : 'available'}`).join('<br>')}</div></div>`;
  }
  sh.innerHTML = h; updateDockState();
}
function dinoStatus(d){ if (d.state === 'carcass') return 'Dead'; if (d.state === 'escaping') return 'ESCAPING TO SEA'; if (d.state === 'transfer') return 'Being moved'; if (d.hunt) return 'Hunting ' + SPECIES[d.hunt.sp].short; if (d.fleeFrom) return 'Fleeing'; if ((d.injT || 0) > 0) return 'Injured'; if (d.state === 'loose') return 'LOOSE'; if (d.state === 'sedated' || d.state === 'airlift') return 'Sedated'; if (d.state === 'holding') return 'In holding'; if (d.eatT > 0) return 'Eating'; if (d.drinkT > 0) return 'Drinking'; if (d.prey) return 'Hunting'; if ((d.thirst || 0) > 0.75 && needsWater(d.sp)) return 'Thirsty'; if (d.hunger > 0.7) return 'Hungry'; if (d.stress > 0.6) return 'Agitated'; return 'Calm'; }
$('sheet').addEventListener('pointerdown', () => { sheetHeld = true; }); window.addEventListener('pointerup', () => { setTimeout(() => sheetHeld = false, 50); });
$('sheet').onclick = (e) => {
  const t = e.target.closest('button'); if (!t) return; SFX.unlock(); SFX.click();
  if (t.dataset.tab){ sel.ref = t.dataset.tab; renderSheet(); return; }
  if (t.dataset.pk){ penKindSel = t.dataset.pk; renderSheet(); return; }
  if (t.dataset.feed){ const P = pens.get(sel.ref); const ty = t.dataset.feed; if (G.stars < BUILD[ty].stars && !G.unlockAll){ toast(`${BUILD[ty].name} unlocks at ${BUILD[ty].stars} stars.`, 'bad'); return; } startTool({ kind: 'bld', type: ty, pen: P ? P.id : undefined }); return; }
  if (t.dataset.scheme || t.dataset.pattern !== undefined){ const d = sel.ref; if (!d || !d.model) return; const sc = t.dataset.scheme || d.sc || 'natural', pt = t.dataset.pattern !== undefined ? +t.dataset.pattern : (d.pt ?? -1); d.sc = sc; d.pt = pt; d.model.setScheme(sc, pt); renderSheet(); saveGame(); return; }
  if (t.dataset.bpal){ const id = t.dataset.bpal; if (sel.kind === 'park'){ G.bldPal = id; applyPalettes(); } else { const b = buildings.get(sel.ref); if (b){ b.pal = id === 'park' ? null : id; setBldPal(b.mesh, palOf(b)); } } renderSheet(); saveGame(); return; }
  if (t.dataset.fence !== undefined){ const tier = +t.dataset.fence; if (G.stars < FENCE_STARS[tier] && !G.unlockAll){ toast(`${FT[tier].name} unlocks at ${FENCE_STARS[tier]} stars.`, 'bad'); return; } startTool({ kind: 'pen', tier, pk: penKindSel }); return; }
  if (t.dataset.tool){ if (t.dataset.tool === 'mono' && !G.expand){ toast('The monorail serves the new land. Buy the Expansion permit in Park first.', 'bad'); return; } startTool({ kind: t.dataset.tool }); return; }
  if (t.dataset.bld){ const ty = t.dataset.bld; if (ty === 'station' && !G.expand){ toast('Monorail stations come with the Expansion permit (Park).', 'bad'); return; } if (G.stars < BUILD[ty].stars && !G.unlockAll){ toast(`${BUILD[ty].name} unlocks at ${BUILD[ty].stars} stars.`, 'bad'); return; } startTool({ kind: 'bld', type: ty }); return; }
  if (t.dataset.dino){ const d = dinos.find(x => x.id === +t.dataset.dino); if (d){ openSheet('dino', d); focusOn(d.x, d.z, Math.max(30, SPECIES_DATA[d.sp].size * 3)); } return; }
  if (t.dataset.pen){ const p = pens.get(+t.dataset.pen); if (p){ openSheet('pen', p.id); const [cx, cz] = penCenter(p); focusOn(cx, cz, Math.max(50, (p.i1 - p.i0 + 1) * TILE * 1.6)); } return; }
  if (t.dataset.sp){ const pen = pens.get(sel.ref); const s = t.dataset.sp; if (!unlocked(s)){ toast(`${SPECIES[s].name} unlocks at ${SPECIES[s].stars} stars.`, 'bad'); return; }
    if (!habOk(s, pen)){ toast(`${SPECIES[s].short} needs ${HAB_NAME[habOf(s)]}. Build one from Build, Enclosures.`, 'bad'); return; }
    if (t.dataset.hunt && !t.dataset.hconfirm){ t.dataset.hconfirm = '1'; toast(t.dataset.hunt === 'prey' ? `Carnivore will hunt this animal. Tap again to hatch anyway.` : `This ${SPECIES[s].short} will hunt the animals in ${pen.name}. Tap again to hatch anyway.`, 'bad'); return; }
    const weak = SPECIES[s].str > FT[pen.tier].str - 0.75; if (weak && !t.dataset.confirm){ t.dataset.confirm = '1'; toast(`${FT[pen.tier].name} fencing will not hold a ${SPECIES[s].short}. Tap again to hatch anyway.`, 'bad'); return; }
    if (orderEgg(s, pen)) openSheet('pen', pen.id); return; }
  const act = t.dataset.act; if (!act) return;
  if (act === 'close'){ closeSheet(); return; }
  const pen = sel && sel.kind === 'pen' ? pens.get(sel.ref) : null;
  if (act === 'adddino'){ openSheet('species', pen.id); return; }
  if (act === 'feeder'){ const res = dinos.filter(d => d.pen === pen.id && d.state !== 'carcass'); const missing = res.map(d => FOODS[d.sp][0]).find(t => !pen.feeders.some(f => f.type === t) && (G.stars >= BUILD[t].stars || G.unlockAll));
    startTool({ kind: 'bld', type: pen.kind === 'lagoon' ? 'fish' : missing || (res.some(d => SPECIES[d.sp].diet === 'meat') ? 'meat' : 'plant'), pen: pen.id }); return; }
  if (act === 'feeders'){ openSheet('feeders', pen.id); return; }
  if (act === 'schemeall'){ const d = sel.ref; G.spScheme = G.spScheme || {}; G.spScheme[d.sp] = { sc: d.sc || 'natural', pt: d.pt ?? -1 }; for (const o of dinos) if (o.sp === d.sp && o !== d && o.state !== 'carcass'){ o.sc = d.sc; o.pt = d.pt; o.model.setScheme(o.sc || 'natural', o.pt ?? -1); } toast(`Every ${SPECIES[d.sp].short} now uses this look, including new hatchlings.`, 'good'); saveGame(); return; }
  if (act === 'water'){ startTool({ kind: 'bld', type: 'water', pen: pen.id }); return; }
  if (act === 'upgrade'){ const t2 = pen.tier + 1, cost = pen.segs.length * Math.round(FT[t2].cost - FT[pen.tier].cost * 0.3); if (G.money < cost){ toast('Not enough funds.', 'bad'); return; } spend('build', cost); pen.tier = t2; for (const s of pen.segs){ s.cond = 1; s.broken = false; } releaseHeld(pen); rebuildFences(); refreshVegetation(); SFX.build(); toast(`${pen.name} upgraded to ${FT[t2].name}.`, 'good'); renderSheet(); return; }
  if (act === 'repair'){ const c = repairCost(pen); if (G.money < c){ toast('Not enough funds.', 'bad'); return; } spend('build', c); for (const s of pen.segs){ s.cond = 1; s.broken = false; } releaseHeld(pen); rebuildFences(); SFX.build(); toast(`${pen.name} repaired.`, 'good'); showAlert(); renderSheet(); return; }
  if (act === 'feed'){ if (feedGuest(pen)) closeSheet(); return; }
  if (act === 'feedd'){ const p = pens.get(sel.ref.pen); if (p && feedGuest(p)) closeSheet(); return; }
  if (act === 'demolish'){ if (!t.dataset.confirm){ t.dataset.confirm = '1'; t.innerHTML = 'Tap again to demolish'; return; } const refund = penCost(pen.i0, pen.j0, pen.i1, pen.j1, pen.tier, pen.kind) * 0.5; G.money += refund; removePen(pen); afterStructureChange(); closeSheet(); return; }
  if (act === 'rename'){ sel.renaming = true; renderSheet(); const inp = $('dinoName'); if (inp){ inp.addEventListener('input', () => { const v = inp.value.replace(/^\s+/, '').replace(/\s{2,}/g, ' '); if (v !== inp.value) inp.value = v; }); inp.focus(); inp.select(); } return; }
  if (act === 'renameok'){ const inp = $('dinoName'); const d = sel.ref; if (inp && !cleanName(inp.value)){ toast('Type a name first.', 'bad'); inp.focus(); return; } sel.renaming = false; if (inp) renameDino(d, inp.value); renderSheet(); return; }
  if (act === 'renamecancel'){ sel.renaming = false; renderSheet(); return; }
  if (act === 'follow'){ cam.follow = cam.follow === sel.ref ? null : sel.ref; renderSheet(); return; }
  if (act === 'openpen'){ openSheet('pen', sel.ref.pen); return; }
  if (act === 'transfer'){ startTransfer(sel.ref); return; }
  if (act === 'sell'){ const d = sel.ref; G.money += SPECIES[d.sp].cost * 0.4; toast(`${d.name} shipped to a mainland zoo.`, ''); removeDino(d); closeSheet(); return; }
  if (act === 'demob'){ const b = buildings.get(sel.ref); G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); closeSheet(); return; }
  if (act === 'pdown' || act === 'pup'){ G.price = clamp(G.price + (act === 'pup' ? 5 : -5), 0, 150); renderSheet(); return; }
  if (act === 'expand'){ if (buyExpansion()) renderSheet(); return; }
  if (act === 'region'){ const id = t.dataset.reg; if (buyRegion(id)) renderSheet(); return; }
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
let tutK = -1, tutDoneT = 0; let penKindSel = 'land';
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
function placeToasts(){ const co = $('coach'), t = $('toasts'), al = $('alert'); if (!co || !t) return;
  // v7: the breakout banner and the tutorial card share a slot; stack the card under the banner instead of overlapping it
  const alOn = al && !al.classList.contains('hidden'), coOn = !co.classList.contains('hidden');
  co.style.top = alOn && coOn ? (al.getBoundingClientRect().bottom + 8) + 'px' : '';
  if (coOn) t.style.top = (co.getBoundingClientRect().bottom + 8) + 'px'; else if (alOn) t.style.top = (al.getBoundingClientRect().bottom + 8) + 'px'; else t.style.top = ''; }

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
function monoAdvice(){ if (!G.expand) return null; const cut = expansionCut(); const stations = [...buildings.values()].filter(b => b.type === 'station');
  if (!cut.length) return null; const names = cut.map(p => p.name).join(', ');
  if (!stations.length) return `${names} ${cut.length > 1 ? 'have' : 'has'} no visitors: guests cannot walk over the ridge. Build a Monorail Station by your paths, another on the new land, and link them with Monorail track.`;
  if (!monoOperational()) return `${names} ${cut.length > 1 ? 'have' : 'has'} no visitors yet. Link your stations with Monorail track, and make sure each station touches a path.`;
  return `${names} ${cut.length > 1 ? 'are' : 'is'} not on a path joined to a monorail station. Connect ${cut.length > 1 ? 'them' : 'it'} to the station path.`; }
function monoAdvisorTick(){ const a = monoAdvice(); if (!a){ G.monoTipAt = 0; return; } const h = absHour(); if (G.monoTipAt && h - G.monoTipAt < 8) return; G.monoTipAt = h; toast(a, 'bad'); }
function moneyAdvisor(){ const out = []; { const a = monoAdvice(); if (a) out.push({ k: 'mono', amt: 1e9, text: a }); } const perDay = (DAY_END - DAY_START);
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
function showNotice(title, text){ if (G && G.headless) return; const m = $('modal'); if (!m.classList.contains('hidden') || !$('tut').classList.contains('hidden')){ setTimeout(() => showNotice(title, text), 2500); return; }
  m.innerHTML = `<div class="box glass"><div class="lbl">Primeval Park</div><h2>${title}</h2><div class="sub">${text}</div><div class="btns"><button class="btn pri" data-act="ok">Got it</button></div></div>`;
  m.classList.remove('hidden'); m.onclick = (e) => { const b = e.target.closest('[data-act]'); if (!b) return; SFX.click(); m.classList.add('hidden'); }; }
function showMoneyTips(){ const m = $('modal'); const best = 48; const sp = SPECIES; const gf = expectedGuestsPerDay() / (24 + appealTotal() * 1.8);
  const li = (h, t) => `<div class="tip"><b>${h}</b><span>${t}</span></div>`;
  m.innerHTML = `<div class="box glass tips"><div class="lbl">Director's guide</div><h2>How to make money</h2>
    ${li('Tickets are most of your income', `Every guest pays the ticket price (now ${fmt(G.price)}) at the gate. With your current rating and reputation, a park with no dinosaurs gets about ${Math.round(24 * gf)} guests a day, and each point of dinosaur appeal adds about ${(1.8 * gf).toFixed(1)} more. Right now you can expect about ${Math.round(expectedGuestsPerDay())} guests a day.`)}
    ${li('Dinosaurs bring the crowds', `Appeal: Parasaurolophus ${sp.para.appeal}, Triceratops ${sp.trike.appeal}, Stegosaurus ${sp.stego.appeal}, Velociraptor ${sp.raptor.appeal}, T. rex ${sp.trex.appeal}, Spinosaurus ${sp.spino.appeal}, Mosasaurus ${sp.mosa.appeal}. A second animal of the same species counts 75%, so mixing species pays more. Herd animals stay calm with company.`)}
    ${li('Let guests see them', 'Guests get happier while they can see dinosaurs from a path, and bored when they cannot. Happy guests raise your reputation, and reputation brings more guests. Put enclosures right beside paths and add Viewing Platforms.')}
    ${li('Shops add extra', `Hungry guests pay ${fmt(FOOD_PRICE)} at a Food Stand and happy guests spend ${fmt(GIFT_PRICE)} in a Gift Shop. Shops only sell to guests on a path they touch.`)}
    ${li('Food and drink', `Guests get hungry and thirsty. Burgers ${fmt(SHOP.food.p)}, pizza ${fmt(SHOP.pizza.p)} and the Fossil Grill ${fmt(SHOP.restaurant.p)} fix hunger; Cold Drinks ${fmt(SHOP.drinks.p)}, coffee ${fmt(SHOP.coffee.p)} and ice cream ${fmt(SHOP.icecream.p)} fix thirst. A mix of stands keeps guests happier than one kind.`)}
    ${li('Water and the right food', 'Every land animal and pterosaur needs a Water Hole in its enclosure. Each species has favourite food: sauropods love the Browse Tower, big carnivores the Live Goat Corral, Spinosaurus, marine reptiles and pterosaurs the Fish Chute. Favourite food fills them faster.')}
    ${li('Carnivores hunt', 'Put a carnivore in with herbivores or smaller carnivores and it will hunt them when hungry. The kill draws a crowd for a while, but you lose the animal and what it cost. Armoured giants such as Ankylosaurus and Triceratops fight back.')}
    ${li('New habitats', 'Buy land permits in Park to open new regions beyond the forest wall. Aviaries hold Pteranodon and Dimorphodon, lake enclosures in the River Valley hold Spinosaurus and Sarcosuchus, and ocean lagoons on the Beach Coast hold Mosasaurus and Elasmosaurus. A Lagoon Grandstand beside a lagoon or lake more than doubles what guests get from it.')}
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
  const g = new THREE.PlaneGeometry(w, d, sx, sz); g.rotateX(-Math.PI / 2); g.translate(x0 + w / 2, 0, z0 + d / 2); const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, Math.max(H(p.getX(k), p.getZ(k)), 0) + 0.12);
  overlay.geometry.dispose(); overlay.geometry = g; overlay.visible = true; overlayMat.color.set(ok ? 0x8fdf6a : 0xff5a3a);
  const pts = []; const per = (ax, az, bx, bz) => { for (let k = 0; k <= 8; k++){ const x = lerp(ax, bx, k / 8), z = lerp(az, bz, k / 8); pts.push(new THREE.Vector3(x, Math.max(H(x, z), 0) + 0.25, z)); } };
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
function clearPending(){ pendMesh.visible = false; if (monoPrev) monoPrev.visible = false; for (const m of nodeMeshes) scene.remove(m); nodeMeshes = []; }
function pathRoute(a, b){ const out = []; let [i, j] = a; const [i1, j1] = b; const xFirst = Math.abs(i1 - i) >= Math.abs(j1 - j);
  out.push([i, j]); const stepI = () => { while (i !== i1){ i += Math.sign(i1 - i); out.push([i, j]); } }, stepJ = () => { while (j !== j1){ j += Math.sign(j1 - j); out.push([i, j]); } };
  if (xFirst){ stepI(); stepJ(); } else { stepJ(); stepI(); } return out; }
function pathTileOk(i, j){ if (!inGrid(i, j)) return 'Outside the park'; ensureTestUnlock(); const t = tileType[idx(i, j)]; if (t === T_EMPTY || t === T_PATH) return ''; if (t === T_LOCK || t === T_BLOCK){ const w = lockWhyAt(i, j); return w === 'Ground too rough' ? 'Ground too rough for a path' : w; } return t === T_PEN ? 'Paths cannot cross an enclosure' : 'A building is in the way'; }
function pendingTiles(){ const seen = new Set(), out = []; if (!tool || !tool.nodes) return out;
  const add = ([i, j]) => { const k = idx(i, j); if (seen.has(k)) return; seen.add(k); if (tileType[k] === T_EMPTY) out.push([i, j]); };
  if (tool.nodes.length === 1) add(tool.nodes[0]); for (const s of tool.segs) s.forEach(add); return out; }
function pendingCost(){ return pathTilesCost(pendingTiles()); }
function drawPending(){ clearPending(); if (!tool || tool.kind !== 'path' || !tool.nodes || !tool.nodes.length) return;
  const all = []; const seen = new Set(); const push = ([i, j]) => { const k = idx(i, j); if (!seen.has(k)){ seen.add(k); all.push([i, j]); } }; tool.nodes.forEach(push); tool.segs.forEach(s => s.forEach(push));
  const pos = []; const q = TILE * 0.47;
  for (const [i, j] of all){ const cx = tX(i), cz = tZ(j); const c = [[-q, -q], [q, -q], [q, q], [-q, q]].map(([a, b]) => [cx + a, H(cx + a, cz + b) + 0.16, cz + b]); pos.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pendMesh.geometry.dispose(); pendMesh.geometry = g; pendMesh.visible = true;
  tool.nodes.forEach((n, k) => { const m = new THREE.Mesh(nodeGeo, k === tool.nodes.length - 1 ? nodeMatLast : nodeMat); const x = tX(n[0]), z = tZ(n[1]); m.position.set(x, H(x, z) + 0.4, z); m.renderOrder = 7; scene.add(m); nodeMeshes.push(m); }); }
function startTool(t){ tool = t; closeSheet(); TU.uGrid.value = 1; $('dock').classList.add('hidden');
  if (t.kind === 'path'){ t.nodes = []; t.segs = []; }
  if (t.kind === 'mono'){ t.nodes = []; t.st = []; t.loop = false; }
  if (t.kind === 'bld'){ ghost = new THREE.Mesh(bldGeo(t.type), ghostMat); ghost.visible = false; scene.add(ghost); t.rot = null; t.hover = null; }
  renderToolbar(); $('toolbar').classList.remove('hidden'); placeUndoBar(); }
function cancelTool(){ if (!tool) return; if (tool.kind === 'penmove' && tool.p) cancelPenMove(); if (tool.move){ const m = tool.move; tool.move = null; const opts = { id: m.id }; if (!BUILD[m.type].inPen) opts.rot = m.rot; placeBuilding(m.type, m.i, m.j, opts); afterStructureChange(); } tool = null; TU.uGrid.value = 0; hideOverlay(); $('toolbar').classList.add('hidden'); if (G.running) $('dock').classList.remove('hidden'); placeUndoBar(); }
function renderToolbar(){
  if (!tool) return; const tb = $('toolbar'); let title = '', hint = '', cost = '', costBad = false, btns = '';
  if (tool.kind === 'path'){ title = 'Footpath'; const n = tool.nodes.length, pt = pendingTiles(), tiles = pt.length, c = pathTilesCost(pt), gr = c - tiles * BUILD.path.cost;
    hint = !n ? 'Tap where the path starts. Drag to look around.' : n === 1 ? 'Tap the next point to lay a segment.' : `${tool.segs.length} segment${tool.segs.length > 1 ? 's' : ''}, ${tiles} new tile${tiles === 1 ? '' : 's'}. Tap to extend.`;
    if (gr > 0) hint += ` Includes ${fmt(gr)} grading on rough ground.`;
    cost = n ? fmt(c) : fmt(BUILD.path.cost) + ' / tile'; costBad = n > 0 && G.money < c;
    btns = `<button class="btn" data-t="exit">Cancel</button><button class="btn" data-t="undo" ${n ? '' : 'disabled'}>${ic('undo')}Undo</button><button class="btn pri" data-t="pathdone" ${costBad ? 'disabled' : ''}>${tiles ? 'Done' : 'Close'}</button>`; }
  if (tool.kind === 'mono'){ title = 'Monorail Track'; const n = tool.nodes.length, len = n > 1 ? monoToolLen() : 0, c = monoToolCost(), due = monoToolDue(), ready = monoToolReady();
    hint = !n ? 'Tap a Monorail Station to start. Drag to look around.' : n === 1 ? 'Tap points across the ridge. Pillars follow the ground.' : ready ? `${Math.round(len)} m of track${tool.loop ? ', closed loop' : ''}. Done builds it, or keep extending.` : `${Math.round(len)} m. End the track on another station.`;
    if (n > 1 && due < c) hint += ` Starter credit covers ${fmt(c - due)}.`;
    cost = n > 1 ? fmt(due) : fmt(MONO_COST_M) + ' / m'; costBad = n > 1 && G.money < due;
    btns = `<button class="btn" data-t="exit">Cancel</button><button class="btn" data-t="undo" ${n ? '' : 'disabled'}>${ic('undo')}Undo</button><button class="btn pri" data-t="pathdone" ${ready && !costBad ? '' : 'disabled'}>Done</button>`; }
  if (tool.kind === 'bulldoze'){ title = 'Bulldoze'; hint = 'Tap a path tile, building or feeder to remove it (50% refund). Drag to look around.'; btns = `<button class="btn pri" data-t="exit">Done</button>`; }
  if (tool.kind === 'bld'){ const B = BUILD[tool.type]; const mv = !!tool.move; title = (mv ? 'Move ' : '') + B.name; const hv = tool.hover; const bc0 = hv ? bldCost(tool.type, hv[0], hv[1]) : B.cost, bc = tool.type === 'station' ? Math.max(0, bc0 - (G.monoCredit || 0)) : bc0; cost = mv ? 'Free' : bc < bc0 ? `${fmt(bc)} (credit)` : fmt(bc); const ok = hv && hv[2].ok; const funds = mv || G.money >= bc;
    costBad = !funds || (hv && !ok);
    hint = !hv ? (B.inPen ? 'Tap a tile inside an enclosure to preview.' : 'Tap open ground next to a path to preview.') + ' Drag to look around.' : !ok ? hv[2].why : !funds ? 'Not enough funds.' : mv ? 'Drag it or tap a new spot, then Place. Cancel puts it back.' : (bc0 > B.cost ? `Rough ground: ${fmt(bc0 - B.cost)} to level a pad. ` : '') + (tool.type === 'station' ? 'Stations must touch a path. Then lay Monorail track between stations.' : 'Green means it fits. Drag the preview or tap elsewhere to move it.');
    btns = `<button class="btn" data-t="rotate" ${hv && !B.inPen ? '' : 'disabled'}>${ic('rotate')}Rotate</button><button class="btn" data-t="exit">${hv || mv ? 'Cancel' : 'Close'}</button><button class="btn pri" data-t="place" ${ok && funds ? '' : 'disabled'}>Place</button>`; }
  if (tool.kind === 'transfer'){ const d = tool.d, pk = tool.pick; title = 'Move ' + d.name; cost = fmt(TRANSFER_FEE); costBad = G.money < TRANSFER_FEE;
    hint = pk && !pk.chk.ok ? `${pk.P.name}: ${pk.chk.why}. Tap a green enclosure.` : `Tap a green enclosure. Rangers dart ${d.name} and airlift it there.`;
    btns = `<button class="btn" data-t="exit">Cancel</button>`; }
  if (tool.kind === 'penmove'){ title = 'Move ' + tool.p.name; cost = 'Free'; costBad = !tool.ok;
    hint = tool.ok ? 'Drag it or tap a new spot, then Place. Dinosaurs, feeders and fences move with it. Cancel puts it back.' : tool.why;
    btns = `<button class="btn" data-t="rotate">${ic('rotate')}Rotate</button><button class="btn" data-t="exit">Cancel</button><button class="btn pri" data-t="place" ${tool.ok ? '' : 'disabled'}>Place</button>`; }
  if (tool.kind === 'pen'){ title = tool.pk && tool.pk !== 'land' ? PEN_KINDS[tool.pk].name : 'Enclosure'; const r = tool.rect;
    if (r){ const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); const chk = penCanBuild(i0, j0, i1, j1, tool.pk); const c = penCost(i0, j0, i1, j1, tool.tier, tool.pk);
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
  if (a === 'undo' && tool.kind === 'mono'){ if (tool.loop) tool.loop = false; else { tool.nodes.pop(); tool.st.pop(); } drawMonoPreview(); renderToolbar(); return; }
  if (a === 'pathdone'){ if (tool.kind === 'mono') commitMono(); else commitPaths(); return; }
  if (tool.kind === 'penmove'){ if (a === 'rotate') penRotate(); if (a === 'place') commitPenMove(); if (a === 'exit') cancelTool(); return; }
  if (a === 'rotate' && tool.hover){ const [i, j] = tool.hover, [w, h] = footprint(tool.type, 0); const cur = tool.rot ?? faceRot(i, j, w, h); tool.rot = Math.round((cur + Math.PI / 2) / (Math.PI / 2)) % 4 * (Math.PI / 2); setPreview([i + Math.floor((w - 1) / 2), j + Math.floor((h - 1) / 2)]); return; }
  if (a === 'place'){ commitBuilding(); return; }
  if (a === 'confirm'){ const r = tool.rect; const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); const c = penCost(i0, j0, i1, j1, tool.tier, tool.pk);
    if (penCanBuild(i0, j0, i1, j1, tool.pk).ok && G.money >= c){ spend('build', c); const pen = createPen(i0, j0, i1, j1, tool.tier, { kind: tool.pk || 'land' }); afterStructureChange(); SFX.build(); dust((eX(i0) + eX(i1 + 1)) / 2, (eX(j0) + eX(j1 + 1)) / 2, 6, 8); cancelTool(); recordUndo({ kind: 'pen', pen, cost: c, label: pen.name }); openSheet('pen', pen.id); toast(`${pen.name} built. Now add a dinosaur and a feeder.`, 'good'); } }
};
function updatePenPreview(){ const r = tool.rect; drawPenMarkersSoon(); const i0 = Math.min(r[0], r[2]), i1 = Math.max(r[0], r[2]), j0 = Math.min(r[1], r[3]), j1 = Math.max(r[1], r[3]); setOverlay(i0, j0, i1, j1, !tool.pending || (penCanBuild(i0, j0, i1, j1, tool.pk).ok && G.money >= penCost(i0, j0, i1, j1, tool.tier, tool.pk))); }
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
  if (tool.kind === 'mono'){ monoTap(t); return; }
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
  if (tool.move){ const m = tool.move; const opts = { id: m.id }; if (!B.inPen) opts.rot = tool.rot ?? faceRot(i, j, m.w, m.h); const b = placeBuilding(m.type, i, j, opts); tool.move = null; SFX.build(); dust(b.x, b.z, 3, 5); afterStructureChange(); cancelTool(); toast(`${B.name} moved.`, 'good'); return; } const bc0 = bldCost(tool.type, i, j), cr = tool.type === 'station' ? Math.min(G.monoCredit || 0, bc0) : 0, bc = bc0 - cr; if (G.money < bc){ toast('Not enough funds.', 'bad'); return; }
  if (cr) G.monoCredit -= cr; spend('build', bc); const opts = {}; if (!B.inPen && tool.rot != null) opts.rot = tool.rot; const b = placeBuilding(tool.type, i, j, opts); SFX.build(); dust(b.x, b.z, 4, 6); afterStructureChange();
  recordUndo({ kind: 'bld', b, cost: bc, label: B.name });
  if (SHOP_T.includes(tool.type) || tool.type === 'station'){ const touches = [[0, -1], [-1, 0], [b.w, 0], [0, b.h]].some(([di, dj]) => isPath(i + di, j + dj)); if (!touches) toast('Tip: shops must touch a path to get customers.', ''); }
  if (tool.type === 'hatchery' && !G.tutHatch){ G.tutHatch = true; toast('Hatchery ready. Tap an enclosure and choose Add dinosaur.', 'good'); }
  tool.hover = null; tool.rot = null; overlay.visible = false; outline.visible = false; if (ghost) ghost.visible = false; renderToolbar(); }
function commitPaths(){ const tiles = pendingTiles(), c = pathTilesCost(tiles);
  if (!tiles.length){ cancelTool(); return; } if (G.money < c){ toast('Not enough funds.', 'bad'); return; }
  for (const [i, j] of tiles) tileType[idx(i, j)] = T_PATH; spend('build', c); afterStructureChange(); SFX.build(); { const cut = tiles.filter(([i, j]) => !reachK(idx(i, j))); const ex = cut.filter(([i, j]) => isExpK(idx(i, j))).length; if (cut.length) setTimeout(() => toast(ex && !monoOperational() ? `Paths on the new land need a Monorail: guests cannot walk over the ridge. Build a Monorail Station touching this path, one in the park, and link them with track.` : `${cut.length} of these path tiles do not join the paths from the gate${ex ? ' or a monorail station' : ''}, so guests cannot reach them. Connect them edge to edge.`, 'bad'), 400); }
  cancelTool(); recordUndo({ kind: 'paths', tiles, cost: c, label: `${tiles.length} path tile${tiles.length > 1 ? 's' : ''}` }); }
/* press and hold (~0.5 s, finger still, no tool active) on a building or feeder picks it up to move it */
function buildingAtScreen(x, y){ const t = tileAtScreen(x, y); if (!t) return null; const k = idx(t[0], t[1]);
  if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); return b && !BUILD[b.type].fixed && !BUILD[b.type].noMove ? b : null; }
  if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen && pen.feeders.find(f => f.i === t[0] && f.j === t[1]); return f ? buildings.get(f.id) : null; }
  return null; }
function pickUp(b, p){ closeSheet(); clearUndo(); const m = { id: b.id, type: b.type, i: b.i, j: b.j, w: b.w, h: b.h, rot: b.rot, pen: b.pen };
  removeBuilding(b); afterStructureChange(); startTool({ kind: 'bld', type: b.type, pen: b.pen >= 0 ? b.pen : undefined }); tool.move = m; tool.rot = BUILD[b.type].inPen ? null : b.rot;
  setPreview([m.i + Math.floor((m.w - 1) / 2), m.j + Math.floor((m.h - 1) / 2)]); if (ghost){ ghost.position.y += 0.8; ghost.scale.setScalar(1.06); }
  try { navigator.vibrate && navigator.vibrate(18); } catch (e) {} SFX.click(); }
function bulldozeTap(p){ const t = tileAtScreen(p.x, p.y); if (!t) return; const k = idx(t[0], t[1]);
  if (tileType[k] === T_PATH){ if (t[1] === GATE.j && (t[0] === GATE.i || t[0] === GATE.i + 1)){ toast('The gate path stays.', ''); return; } tileType[k] = tileBase[k] === T_BLOCK ? T_BLOCK : T_EMPTY; G.money += BUILD.path.cost * 0.5; afterStructureChange(); SFX.build(); return; }
  if (tileType[k] === T_BUILD){ const b = buildings.get(tileRef[k]); if (b && !BUILD[b.type].fixed){ G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); SFX.build(); } else toast('That cannot be removed.', ''); }
  else if (tileType[k] === T_PEN){ const pen = pens.get(tileRef[k]); const f = pen.feeders.find(f => f.i === t[0] && f.j === t[1]); if (f){ const b = buildings.get(f.id); G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); } else toast('Open the enclosure to demolish it.', ''); }
}
/* ---- press and hold on an enclosure (fence or floor) picks up the whole pen: fences, feeders and dinosaurs move together ---- */
function penAtScreen(x, y){ const p = groundAtScreen(x, y); if (!p) return null; const m = 1.4;
  for (const pen of pens.values()) if (p.x >= eX(pen.i0) - m && p.x <= eX(pen.i1 + 1) + m && p.z >= eX(pen.j0) - m && p.z <= eX(pen.j1 + 1) + m) return pen; return null; }
function penMoveBlock(pen){
  if (pen.kind === 'lake' || pen.kind === 'lagoon') return `${pen.kind === 'lake' ? 'Lake enclosures' : 'Lagoons'} cannot be moved. Demolish and rebuild instead.`;
  if (dinos.some(d => d.pen === pen.id && d.state === 'carcass')) return `Wait until the carcass in ${pen.name} is cleared.`;
  const bad = dinos.find(d => (d.pen === pen.id || d.transferFrom === pen.id) && d.state !== 'pen' && d.state !== 'holding' && d.state !== 'carcass');
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
  if (visual){ drawMask(); rebuildFences(); penDeco(pen); if (tool && tool.kind === 'penmove' && pen.deco) for (const m of pen.deco) m.position.y += 0.8; } }
function pickUpPen(pen, q){ const why = penMoveBlock(pen); if (why){ toast(why, 'bad'); return false; }
  closeSheet(); clearUndo(); const o = penSnapshot(pen);
  for (let j = pen.j0; j <= pen.j1; j++) for (let i = pen.i0; i <= pen.i1; i++){ const k = idx(i, j); tileType[k] = T_EMPTY; tileRef[k] = -1; }
  pen.held = true; startTool({ kind: 'penmove', p: pen, o, r: 0, at: [pen.i0, pen.j0], ok: true, why: '' });
  const t = q && tileAtScreen(q.x, q.y); tool.grab = t ? [t[0] - pen.i0, t[1] - pen.j0] : [0, 0];
  penPreview(pen.i0, pen.j0); try { navigator.vibrate && navigator.vibrate(18); } catch (e) {} SFX.click(); return true; }
function penPreview(i0, j0){ const T = tool, pen = T.p; const X = penXf(T.o, T.r); i0 = clamp(i0, LO, HI - X.W); j0 = clamp(j0, LO, HI - X.H); T.at = [i0, j0];
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
  if (d.prey || d.biting || d.hunt || (G.feeding && G.feeding.dino === d)) return `${d.name} is hunting. Try again in a moment.`;
  if (d.state === 'carcass' || d.state === 'escaping') return `${d.name} cannot be moved now.`;
  if (pen && pen.held) return 'Finish moving the enclosure first.';
  if (G.money < TRANSFER_FEE) return 'Not enough funds for the ranger team.';
  return ''; }
function transferCheck(d, P){ const S = SPECIES[d.sp];
  if (P.id === d.pen) return { ok: false, why: 'Current home', short: 'HOME' };
  if (penBroken(P)) return { ok: false, why: 'Fence is broken', short: 'BROKEN' };
  if (!habOk(d.sp, P)) return { ok: false, why: `Needs ${HAB_NAME[habOf(d.sp)]}`, short: 'WRONG HABITAT' };
  if (S.str > FT[P.tier].str - 0.75) return { ok: false, why: `${FT[P.tier].name} fence too weak for a ${S.short}`, short: 'FENCE TOO WEAK' };
  const res = dinos.filter(o => o.pen === P.id && o !== d && o.state !== 'wild' && o.state !== 'carcass');
  const need = res.reduce((a, o) => a + SPECIES[o.sp].space, 0) + S.space, area = penArea(P);
  if (!res.length && area < S.space) return { ok: false, why: `Too small for a ${S.short} (needs ${S.space} tiles)`, short: 'TOO SMALL' };
  if (need > area) return { ok: false, why: `Full: needs ${need} tiles of space, has ${area}`, short: 'FULL' };
  const hp = huntPairs({ id: P.id }, d.sp).filter(x => x.pred === d.sp || x.prey === d.sp);
  if (hp.some(x => x.prey === d.sp)) return { ok: true, why: 'Carnivore will hunt this animal', short: 'WILL BE HUNTED', hunt: true };
  if (hp.some(x => x.pred === d.sp)) return { ok: true, why: 'Will hunt the animals there', short: 'WILL HUNT', hunt: true };
  return { ok: true, why: feederOf(P, d.sp) ? (needsWater(d.sp) && !hasWater(P) ? 'No water hole there yet' : '') : `No ${FOODS[d.sp][0]} feeder there yet`, short: 'MOVE HERE' }; }
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
  if (d.trDart){ const k = Math.min(1, d.trT / 0.35); d.trDart.position.set(lerp(d.trA[0], d.x, k), lerp(d.trA[1], H(d.x, d.z) + SD.hipH, k), lerp(d.trA[2], d.z, k)); d.trDart.lookAt(d.x, d.trDart.position.y, d.z);
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
  if (r.kind === 'mono') monoRemoveLine(r.id);
  if (r.kind === 'paths'){ for (const [i, j] of r.tiles){ const k = idx(i, j); if (tileType[k] === T_PATH) tileType[k] = tileBase[k] === T_BLOCK ? T_BLOCK : T_EMPTY; } }
  if (r.kind === 'pen'){ if (!pens.has(r.pen.id)) return; if (dinos.some(d => d.pen === r.pen.id)){ toast('A dinosaur already lives there. Demolish it from the enclosure panel instead.', 'bad'); return; } if (sel && sel.kind === 'pen' && sel.ref === r.pen.id) closeSheet(); removePen(r.pen); }
  refund(r.cost); afterStructureChange(); SFX.click(); updateHUD(); toast(`Undone. ${fmt(r.cost)} refunded.`, 'money'); }
function renderUndoBar(){ const el = $('undoBar'); if (!undoRec){ el.classList.add('hidden'); return; }
  el.innerHTML = `<span>Placed ${undoRec.label}</span><button class="btn" data-t="undolast">${ic('undo')}Undo</button>`; el.classList.remove('hidden'); placeUndoBar(); }
function placeUndoBar(){ const el = $('undoBar'); if (!el || el.classList.contains('hidden')) return; const ref = tool ? $('toolbar') : $('dock'); const r = ref.getBoundingClientRect(); el.style.bottom = (r.height > 0 ? innerHeight - r.top + 8 : 90) + 'px'; }
$('undoBar').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; SFX.unlock(); undoLast(); };
function afterStructureChange(){ drawMask(); computeExitField(); monoRefresh(); rebuildGuestSpots(); rebuildFences(); refreshVegetation(); refreshForestWall(); updateLockMarks(); computeViewMap(); }

/* ================= camera + input ================= */
/* v7 camera clipping: pull the camera in front of buildings and fence walls between it and its target (foliage and bark fade out near the camera instead) */
const CAM_BOX = []; // [x0, y0, z0, x1, y1, z1]
const BLD_H = { visitor: 12.2, hatchery: 7.2, ranger: 9, viewing: 7.6, food: 4.4, gift: 4.9, restroom: 3.7, meat: 7.4, plant: 3.4, pizza: 4.6, icecream: 3.4, coffee: 3.8, drinks: 3.6, restaurant: 6.5, stand: 5.5, water: 1, goat: 2.4, fish: 4, browse: 8, insect: 2.4 }, FENCE_H = [2.3, 3.1, 5.2, 7.1];
function rebuildCamObstacles(){ CAM_BOX.length = 0; camObsDirty = false;
  for (const b of buildings.values()){ if (!b.mesh) continue; const y0 = b.mesh.position.y;
    if (b.pen >= 0){ const x = b.mesh.position.x, z = b.mesh.position.z; CAM_BOX.push([x - 1.3, y0 - 2, z - 1.3, x + 1.3, y0 + (BLD_H[b.type] || 4), z + 1.3]); continue; }
    const hw = b.w * TILE / 2 - 0.3, hd = b.h * TILE / 2 - 0.3; CAM_BOX.push([b.x - hw, y0 - 2, b.z - hd, b.x + hw, y0 + (BLD_H[b.type] || 5), b.z + hd]); }
  if (gateMesh){ const g = gateMesh.position; for (const sd of [-1, 1]) CAM_BOX.push([g.x + sd * 5.2 - 1, g.y - 2, g.z - 1, g.x + sd * 5.2 + 1, g.y + 13.2, g.z + 1]); CAM_BOX.push([g.x - 6.7, g.y + 9.9, g.z - 0.8, g.x + 6.7, g.y + 11.6, g.z + 0.8]); }
  for (const pen of pens.values()){ if (pen.kind === 'lagoon') continue; const x0 = eX(pen.i0), x1 = eX(pen.i1 + 1), z0 = eX(pen.j0), z1 = eX(pen.j1 + 1), t = pen.tier >= 3 ? 0.9 : 0.35; let top = -9;
    for (let i = pen.i0; i <= pen.i1 + 1; i++) top = Math.max(top, H(eX(i), z0), H(eX(i), z1)); for (let j = pen.j0; j <= pen.j1 + 1; j++) top = Math.max(top, H(x0, eX(j)), H(x1, eX(j)));
    const y1 = top + FENCE_H[pen.tier] + 0.3; CAM_BOX.push([x0 - t, -20, z0 - t, x1 + t, y1, z0 + t], [x0 - t, -20, z1 - t, x1 + t, y1, z1 + t], [x0 - t, -20, z0 - t, x0 + t, y1, z1 + t], [x1 - t, -20, z0 - t, x1 + t, y1, z1 + t]); } }
function segBox(o, d, B){ let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++){ if (Math.abs(d[k]) < 1e-9){ if (o[k] < B[k] || o[k] > B[k + 3]) return 2; continue; } let ta = (B[k] - o[k]) / d[k], tb = (B[k + 3] - o[k]) / d[k]; if (ta > tb){ const q = ta; ta = tb; tb = q; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return 2; }
  return t0; }
function camInsideSolid(x, y, z){ const m = 1.6; for (const B of CAM_BOX) if (x > B[0] - m && x < B[3] + m && z > B[2] - m && z < B[5] + m && y > B[1] - m && y < B[4] + m) return true; return false; }
function cameraClearance(ax, ay, az, bx, by, bz){ // fraction of the target->camera segment that is free
  if (camObsDirty) rebuildCamObstacles(); const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1; let best = 1; const o = [ax, ay, az], d = [dx, dy, dz];
  const m = 1.6, E = [0, 0, 0, 0, 0, 0]; // only react when the camera itself would sit inside (or within m of) a solid: plain occlusion is left alone
  for (const B of CAM_BOX){ if (bx < B[0] - m || bx > B[3] + m || bz < B[2] - m || bz > B[5] + m || by < B[1] - m || by > B[4] + m) continue;
    if (ax > B[0] && ax < B[3] && az > B[2] && az < B[5] && ay > B[1] && ay < B[4]) continue;
    E[0] = B[0] - m; E[1] = B[1] - m; E[2] = B[2] - m; E[3] = B[3] + m; E[4] = B[4] + m; E[5] = B[5] + m; const t = segBox(o, d, E); if (t < best) best = t; }
  if (best >= 1) return 1; return clamp(best, Math.min(1, 4 / L), 1); }
const cam = { tx: 0, tz: 40, clip: 1, yaw: 0.5, pitch: 0.62, dist: 210, goal: { tx: 0, tz: 40, yaw: 0.5, pitch: 0.62, dist: 210 }, shake: 0, follow: null };
const title = { on: true };
function focusOn(x, z, dist){ cam.goal.tx = x; cam.goal.tz = z; if (dist) cam.goal.dist = clamp(dist, 12, maxCamDist()); }
function updateCamera(dt){
  const g = cam.goal; if (cam.follow){ if (!dinos.includes(cam.follow) || !cam.follow.model.root.visible) cam.follow = null; else { g.tx = cam.follow.x; g.tz = cam.follow.z; } }
  if (title.on){ g.yaw += dt * 0.04; } else updateFling(dt);
  g.pitch = clamp(g.pitch, 0.1, 1.45); const md = maxCamDist(); g.dist = clamp(g.dist, 12, md); scene.fog.density = 0.00115 * clamp(1 - (cam.dist - 400) / 1400, 0.55, 1); const ub = unlockedBounds(); g.tx = clamp(g.tx, ub[0], ub[2]); g.tz = clamp(g.tz, ub[1], ub[3]);
  const k = 10; cam.tx = damp(cam.tx, g.tx, k, dt); cam.tz = damp(cam.tz, g.tz, k, dt); cam.dist = damp(cam.dist, g.dist, k, dt); cam.pitch = damp(cam.pitch, g.pitch, k, dt);
  let dy = g.yaw - cam.yaw; if (dy > Math.PI || dy < -Math.PI){ dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI; g.yaw = cam.yaw + dy; }
  cam.yaw += dy * (1 - Math.exp(-k * dt));
  const ty = Math.max(H(cam.tx, cam.tz), 0) + (cam.follow ? SPECIES_DATA[cam.follow.sp].size * 0.2 : 0.5);
  const cp = Math.cos(cam.pitch); let px = cam.tx + Math.sin(cam.yaw) * cp * cam.dist, pz = cam.tz + Math.cos(cam.yaw) * cp * cam.dist, py = ty + Math.sin(cam.pitch) * cam.dist;
  if (!title.on && cam.dist < 140){ const cl = cameraClearance(cam.tx, ty, cam.tz, px, py, pz);
    if (cl < cam.clip) cam.clip = cl; else { const c2 = damp(cam.clip, cl, 3, dt); cam.clip = camInsideSolid(cam.tx + (px - cam.tx) * c2, ty + (py - ty) * c2, cam.tz + (pz - cam.tz) * c2) ? cl : c2; } } // easing back out must not pass through a wall
  else cam.clip = damp(cam.clip, 1, 3, dt);
  if (cam.clip < 0.999){ px = cam.tx + (px - cam.tx) * cam.clip; pz = cam.tz + (pz - cam.tz) * cam.clip; py = ty + (py - ty) * cam.clip; }
  const floor = Math.max(H(px, pz), 0) + 2.5; if (py < floor){ py = floor; } nearVegTick(dt);
  cam.shake = Math.max(0, cam.shake - dt * 1.5); const sh = cam.shake * cam.shake;
  camera.position.set(px + (rnd() - 0.5) * sh, py + (rnd() - 0.5) * sh, pz + (rnd() - 0.5) * sh); camera.lookAt(cam.tx, ty, cam.tz);
  if (typeof updateLockMarks === 'function') { for (const id in lockMarks){ const s = lockMarks[id]; if (!s || !s.visible) continue; const sc = clamp(cam.dist * 0.06, 8, 22); s.scale.set(sc, sc, 1); } }
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
  for (const d of dinos){ if (!d.model.root.visible || d.state === 'wild' || d.state === 'carcass') continue; const S = SPECIES_DATA[d.sp]; _sv.set(d.x, d.model.root.position.y + Math.max(S.hipH * 0.5, S.size * 0.05), d.z); const dist = _sv.distanceTo(camera.position); _sv.project(camera); if (_sv.z > 1) continue;
    const sx = (_sv.x * 0.5 + 0.5) * innerWidth, sy = (-_sv.y * 0.5 + 0.5) * innerHeight; const r = Math.max(30, S.size * 0.45 / dist * f); const dd = Math.hypot(sx - x, sy - y); if (dd < r && dd / r < bd){ bd = dd / r; best = d; } }
  return best; }
function tap(x, y){
  if (tool){ return; }
  const lk = pickLock(x, y); if (lk){ SFX.click(); openSheet('park'); toast(`${REGIONS[lk].name}: ${REGIONS[lk].special} Permit ${fmtK(REGIONS[lk].cost)}${REGIONS[lk].stars ? ', ' + REGIONS[lk].stars + ' stars' : ''}.`, 'good'); return; }
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
  const pitch = clamp(g.pitch, 0.1, 1.45), dist = clamp(g.dist, 12, maxCamDist()); const ty = Math.max(H(g.tx, g.tz), 0) + 0.5; const cp = Math.cos(pitch);
  goalCamera.position.set(g.tx + Math.sin(g.yaw) * cp * dist, ty + Math.sin(pitch) * dist, g.tz + Math.cos(g.yaw) * cp * dist); goalCamera.lookAt(g.tx, ty, g.tz); goalCamera.updateMatrixWorld(true); }
function grabMap(l, n){ const g = cam.goal; cam.follow = null; syncGoalCamera(); const A = groundAtScreen(l.cx, l.cy, goalCamera);
  if (l.d > 10 && n.d > 10) g.dist = clamp(g.dist * l.d / n.d, 12, maxCamDist());
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
const GOAL_X = [-WHALF - 30, WHALF + 30], GOAL_Z = [-WHALF - 40, HALF + 40];
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
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.goal.dist = clamp(cam.goal.dist * Math.exp(e.deltaY * 0.0012), 12, maxCamDist()); }, { passive: false });
const keys = new Set(); window.addEventListener('keydown', (e) => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')){ if (e.target.id === 'dinoName'){ if (e.key === 'Enter'){ e.preventDefault(); const b = document.querySelector('[data-act=renameok]'); b && b.click(); } else if (e.key === 'Escape'){ e.preventDefault(); const b = document.querySelector('[data-act=renamecancel]'); b && b.click(); } } return; } keys.add(e.key.toLowerCase()); if (e.key === 'Escape'){ if (tool) cancelTool(); else closeSheet(); } if (e.key === ' ' && G.running){ G.speed = G.speed ? 0 : 1; updateHUD(); e.preventDefault(); } });
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

/* v11: the scenery herd is gone — it looked like animals had escaped into the expansion. */
const wild = [];
function wildOk(x, z){ return false; }
function updateWild(dt){ }

/* ================= save / load ================= */
function serialize(){
  const hp = tool && tool.kind === 'penmove' && tool.p ? tool : null; if (hp) applyPenPose(hp.p, hp.o, hp.o.i0, hp.o.j0, 0, false);
  try { return serialize0(); } finally { if (hp) applyPenPose(hp.p, hp.o, hp.at[0], hp.at[1], hp.r, false); } }
function serialize0(){
  const paths = [], p2 = []; for (let k = 0; k < tileType.length; k++) if (tileType[k] === T_PATH){ const i = kI(k), j = kJ(k); p2.push(i, j); if (i >= 0 && j >= 0 && i < GRID && j < GRID) paths.push(j * GRID + i); } // paths: v8 format (old grid only); p2: i,j pairs anywhere
  const g = {}; for (const k in G) if (!['running', 'feeding', 'headless', 'score', 'avgHappy', 'tick', 'unlockAll', 'spawnAcc'].includes(k)) g[k] = G[k];
  return { v: 1, G: g, paths, p2,
    buildings: [...buildings.values()].map(b => ({ id: b.id, type: b.type, i: b.i, j: b.j, rot: b.rot, pen: b.pen, ...(b.pal ? { pal: b.pal } : {}) })).concat(tool && tool.move ? [{ id: tool.move.id, type: tool.move.type, i: tool.move.i, j: tool.move.j, rot: tool.move.rot, pen: tool.move.pen }] : []),
    pens: [...pens.values()].map(p => ({ id: p.id, i0: p.i0, j0: p.j0, i1: p.i1, j1: p.j1, tier: p.tier, kind: p.kind || 'land', name: p.name, segs: p.segs.map(s => +s.cond.toFixed(3)), broken: p.segs.map((s, k) => s.broken ? k : -1).filter(k => k >= 0) })),
    dinos: dinos.filter(d => d.state !== 'carcass' && d.state !== 'escaping').map(d => ({ id: d.id, sp: d.sp, pen: d.pen, x: +d.x.toFixed(2), z: +d.z.toFixed(2), hunger: +d.hunger.toFixed(3), thirst: +(d.thirst || 0).toFixed(3), name: d.name, fedSkip: d.fedSkip, state: d.state === 'pen' || d.state === 'transfer' ? 'pen' : 'holding', ...(d.sc ? { sc: d.sc, pt: d.pt ?? -1 } : {}) })),
    eggs };
}
function saveGame(){ if (!G || G.noSave) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) {} }
function clearWorld(){
  for (const b of buildings.values()) scene.remove(b.mesh); buildings.clear(); pens.clear(); for (const d of dinos) scene.remove(d.model.root); dinos = []; eggs = []; guests = [];
  for (const j of jeeps) scene.remove(j.mesh); jeeps.length = 0; tileRef.fill(-1);
  if (LAKES.length){ const oldL = LAKES.splice(0); for (const L of oldL) retopo(L.x0, L.z0, L.x1, L.z1); }
  computeBuildable();
  monoClearRuntime(); if (PADS.length){ const pp = PADS.splice(0); for (const p of pp) retopo(p.x0 - 4, p.z0 - 4, p.x1 + 4, p.z1 + 4); } if (gateMesh){ scene.remove(gateMesh); gateMesh = null; }
}
let gateMesh = null;
function placeGate(){ for (const i of [GATE.i, GATE.i + 1]){ tileType[idx(i, GATE.j)] = T_PATH; } gateMesh = makeBuildingMesh('gate'); setBldPal(gateMesh, palOf(null)); const x = eX(GATE.i + 1), z = tZ(GATE.j); gateMesh.position.set(x, H(x, z) - 0.1, z); scene.add(gateMesh); }
function newGame(save = true){
  clearWorld(); G = freshState(); placeGate();
  for (let j = 44; j < GATE.j; j++) for (const i of [GATE.i, GATE.i + 1]) tileType[idx(i, j)] = T_PATH;
  for (let i = 20; i <= 35; i++) tileType[idx(i, 44)] = T_PATH;
  for (const k of [idx(29, 48), idx(30, 48), idx(31, 48), idx(29, 49), idx(30, 49), idx(31, 49), idx(29, 50), idx(30, 50), idx(31, 50)]) tileType[k] = T_EMPTY;
  placeBuilding('visitor', 29, 48, { rot: -Math.PI / 2 });
  afterStructureChange(); cam.goal.tx = 0; cam.goal.tz = 60; if (save) saveGame();
}
// v9 upgrade for older saves: one free water hole per land / aviary enclosure, and a grace period before mixed enclosures start hunting
function migrateV9(){ if (G.v9) return; G.v9 = true; let n = 0;
  for (const pen of pens.values()){ if (pen.kind === 'lake' || pen.kind === 'lagoon' || hasWater(pen)) continue; const used = new Set(pen.feeders.map(f => f.i + ',' + f.j));
    let spot = null; for (let j = pen.j0 + 1; j <= pen.j1 - 1 && !spot; j++) for (let i = pen.i1 - 1; i >= pen.i0 + 1 && !spot; i--) if (!used.has(i + ',' + j)) spot = [i, j];
    if (!spot) for (let j = pen.j0; j <= pen.j1 && !spot; j++) for (let i = pen.i0; i <= pen.i1 && !spot; i++) if (!used.has(i + ',' + j)) spot = [i, j];
    if (spot && canPlace('water', spot[0], spot[1]).ok){ placeBuilding('water', spot[0], spot[1]); n++; } }
  const mixed = [...pens.values()].filter(p => huntPairs(p).length);
  if (mixed.length){ G.predAt = absHour() + 6; }
  setTimeout(() => { if (n) toast(`Park update: dinosaurs now need water. ${n} free Water Hole${n > 1 ? 's were' : ' was'} added to your enclosures.`, 'good');
    if (mixed.length) setTimeout(() => toast(`Warning: carnivores now hunt animals they share an enclosure with. ${mixed.map(p => p.name).join(', ')} ${mixed.length > 1 ? 'are' : 'is'} mixed. Hunting starts in 6 park hours. Move them apart.`, 'bad'), 2500); }, 1500); }
// v10 upgrade: the expansion became rough country behind a ridge. Paths over the ridge are removed (nothing else is touched) and parks that already own the permit get a free starter monorail
const MONO_CREDIT = 140000;
function migrateV10(){ if (G.v10) return; G.v10 = true; if (!G.expand) return; let cut = 0;
  for (let k = 0; k < tileType.length; k++){ if (tileType[k] !== T_PATH || !ridgeMask[k]) continue; const i = kI(k), j = kJ(k); if (j === GATE.j && (i === GATE.i || i === GATE.i + 1)) continue; tileType[k] = T_BLOCK; cut++; }
  G.monoCredit = MONO_CREDIT; const exp = [...pens.values()].some(p => isExpK(idx((p.i0 + p.i1) >> 1, (p.j0 + p.j1) >> 1))) || [...buildings.values()].some(b => isExpK(idx(b.i, b.j)));
  setTimeout(() => showNotice('Park update', `The new land is now rough country beyond a rocky ridge${cut ? `, and ${cut} path tile${cut > 1 ? 's' : ''} over the ridge ${cut > 1 ? 'were' : 'was'} removed` : ''}. ${exp ? 'Everything you built out there stays. ' : ''}Guests now reach it by Monorail: your first ${fmt(MONO_CREDIT)} of stations and track is free (Build > Paths).`), 1800); }
function fmtHourIn(at){ const h = Math.max(0, at - absHour()); return h < 1 ? 'within the hour' : `in ${Math.ceil(h)} park hour${Math.ceil(h) > 1 ? 's' : ''}`; }
function loadGame(){
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; let S; try { S = JSON.parse(raw); } catch (e) { return false; } if (!S || S.v !== 1) return false;
  clearWorld(); G = Object.assign(freshState(), S.G); G.stats = Object.assign(freshState().stats, S.G.stats || {}); G.ledger = Object.assign(freshState().ledger, S.G.ledger || {}); G.v9 = !!S.G.v9; G.v10 = !!S.G.v10; G.v11 = !!S.G.v11; G.regions = Object.assign(emptyRegions(), S.G.regions || {}); G.mono = S.G.mono && S.G.mono.lines ? S.G.mono : { lines: [] }; G.spScheme = S.G.spScheme || {}; G.bldPal = S.G.bldPal || 'classic';
  applyExpansion(); placeGate(); if (S.p2) for (let n = 0; n + 1 < S.p2.length; n += 2) tileType[idx(S.p2[n], S.p2[n + 1])] = T_PATH; else for (const k of S.paths) tileType[idx(k % GRID, (k / GRID) | 0)] = T_PATH;
  for (const p of S.pens) createPen(p.i0, p.j0, p.i1, p.j1, p.tier, { id: p.id, name: p.name, segs: p.segs, broken: p.broken, kind: p.kind || 'land' });
  for (const b of S.buildings){ if (BUILD[b.type].inPen && !pens.has(b.pen)) continue; placeBuilding(b.type, b.i, b.j, { id: b.id, rot: b.rot, pal: b.pal }); }
  for (const d of S.dinos){ const pen = pens.get(d.pen); if (!pen) continue; spawnDino(d.sp, pen, { id: d.id, x: d.x, z: d.z, hunger: d.hunger, thirst: d.thirst ?? 0.2, sc: d.sc, pt: d.pt, name: d.name, fedSkip: d.fedSkip, state: d.state === 'holding' || penBroken(pen) ? 'holding' : 'pen' }); }
  eggs = S.eggs || []; G.hour = Math.max(G.hour, DAY_START); if (!G.econ6){ G.econ6 = true; G.rep = Math.max(G.rep, 55); G.safety = Math.max(G.safety, 70); } migrateV9();
  G.mono.lines = G.mono.lines.filter(d => d.st.filter(Boolean).every(id => buildings.has(id))); monoRebuildAll(); migrateV10(); migrateV11(); afterStructureChange(); return true;
}

/* ================= species thumbnails ================= */
const THUMBS = {};
function makeThumbs(keys = SP_V8){
  const W = 256, Hh = 150; const rt = new THREE.WebGLRenderTarget(W, Hh, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene(); s.background = new THREE.Color(0x3a4a34); s.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, 1.1)); const l = new THREE.DirectionalLight(0xfff0d8, 2.2); l.position.set(3, 5, 4); s.add(l);
  const fl = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 1 })); s.add(fl);
  const c = new THREE.PerspectiveCamera(30, W / Hh, 0.1, 200); const buf = new Uint8Array(W * Hh * 4); const cv = M.mk(W, Hh), g = cv.getContext('2d'); const img = g.createImageData(W, Hh);
  const prevTM = renderer.toneMapping;
  for (const sp of keys){ const d = new Dino(sp, { lod: 'hi' }); d.root.rotation.y = -1.0; s.add(d.root); d.animate(0.01, 0, 0); const SD = SPECIES_DATA[sp]; const L = SD.size, Hgt = sp === 'brachio' ? 12 : sp === 'diplo' ? 6 : Math.max(SD.hipH * 1.6, SD.size * 0.14);
    const dist = Math.max(L * 1.15, Hgt * 2.2); c.position.set(dist * 0.15, Hgt * 0.65 + dist * 0.12, dist); c.lookAt(0, Hgt * 0.5, 0);
    renderer.setRenderTarget(rt); renderer.render(s, c); renderer.readRenderTargetPixels(rt, 0, 0, W, Hh, buf); renderer.setRenderTarget(null);
    for (let y = 0; y < Hh; y++) img.data.set(buf.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4); g.putImageData(img, 0, 0); THUMBS[sp] = cv.toDataURL('image/jpeg', 0.82); s.remove(d.root); }
  renderer.toneMapping = prevTM; rt.dispose();
}

/* ================= quality ================= */
function resize(){ const w = innerWidth, h = innerHeight; renderer.setPixelRatio(Math.min(DPR, QUALITY.pr[QUALITY.level])); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 55 : 45; camera.updateProjectionMatrix(); }
function setQuality(l, manual){ QUALITY.level = l; setDinoQuality(l); if (manual) QUALITY.forced = true; const ms = QUALITY.shadow[l]; sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } shadowR = 0; resize(); refreshVegetation();
  applyBuildingDetail(); applyFenceDetail(); applyGuestDetail(); curbIM.visible = detailHi(); }
window.addEventListener('resize', resize); window.addEventListener('resize', () => placeToasts()); if (window.ResizeObserver){ const ro = new ResizeObserver(() => placeToasts()); for (const id of ['alert', 'coach']){ const el = document.getElementById(id); if (el) ro.observe(el); } } // re-stack when the banner or card changes size
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
  updateGuests(gdt, hourDt); updateMono(gdt); updateEggs(gdt); updateJeeps(gdt); G.feedCooldown = Math.max(0, G.feedCooldown - gdt);
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
  viewT -= dt; if (viewT <= 0){ viewT = 1; computeViewMap(); SFX.setCrowd(G.running ? clamp(guestsInPark() / 160, 0, 1) * clamp(1.4 - cam.dist / 250, 0.2, 1) : 0); }
  starT -= dt; if (starT <= 0 && G.running){ starT = 1; G.stars = computeStars(); checkMissions(); }
  sheetT -= dt; if (sheetT <= 0){ sheetT = 1; if (sel && ['pen', 'dino', 'park', 'dinos', 'guests', 'guest'].includes(sel.kind)) refreshSheet(); }
  saveT -= dt; if (saveT <= 0){ saveT = 20; if (G.running) saveGame(); }
  if (!window.__DP.noRender) renderer.render(scene, camera);
  perfTick(now, performance.now() - t0);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.running) saveGame(); });
window.addEventListener('pagehide', () => { if (G && G.running) saveGame(); });

/* ================= debug / test hook ================= */
const _sv10 = new THREE.Vector3(); function screenOfTile(i, j){ _sv10.set(tX(i), H(tX(i), tZ(j)), tZ(j)).project(camera); if (_sv10.z > 1 || Math.abs(_sv10.x) > 1 || Math.abs(_sv10.y) > 1) return null; return { x: (_sv10.x * 0.5 + 0.5) * innerWidth, y: (-_sv10.y * 0.5 + 0.5) * innerHeight }; }
window.__DP = {
  get G(){ return G; }, get dinos(){ return dinos; }, get guests(){ return guests.filter(g => !g.gone); }, get pens(){ return [...pens.values()]; }, get buildings(){ return [...buildings.values()]; }, get perf(){ return { blood: bloodIM.count, fps: PERF.fps, cpu: PERF.cpu, q: QUALITY.level, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
  vegCounts(){ const o = {}; for (const k in VEG) o[k] = [VEG[k].items.length, VEG[k].ims[0].count]; return o; },
  cam, SPECIES, OFF, LO, HI, landCounts, buyExpansion, expandFree(){ G.expand = true; applyExpansion(); if (typeof applyRegionLand === 'function') applyRegionLand('highland'); afterStructureChange(); }, start(fresh = true){ if (fresh) newGame(); G.tutorialDone = true; startPlaying(false); $('tut').classList.add('hidden'); },
  path(i0, j0, i1, j1){ paintLine([i0, j0], [i1, j1], false); afterStructureChange(); },
  pen(i0, j0, i1, j1, tier, kind = 'land'){ const c = penCanBuild(i0, j0, i1, j1, kind); if (!c.ok) return c.why; spend('build', penCost(i0, j0, i1, j1, tier, kind)); const p = createPen(i0, j0, i1, j1, tier, { kind }); afterStructureChange(); return p.id; },
  build(type, i, j){ const c = canPlace(type, i, j); if (!c.ok) return c.why; spend('build', bldCost(type, i, j)); const b = placeBuilding(type, i, j); afterStructureChange(); return b.id; },
  hatch(sp, penId, instant){ const pen = pens.get(penId); if (!pen) return 'no enclosure'; G.unlockAll = true; const ok = orderEgg(sp, pen); if (ok && instant){ const e = eggs.pop(); hatchEgg(e); } return ok; },
  spawnGuests(n){ for (let k = 0; k < n; k++){ const g = spawnGuest(); if (!g) break; if (g.state === 'walk') continue; g.state = 'walk'; const t = [...Array(GN * GN).keys()].filter(k => tileType[k] === T_PATH && exitDist[k] < 1e6); if (!t.length) continue; const k2 = t[(rnd() * t.length) | 0]; g.ci = kI(k2); g.cj = kJ(k2); g.x = tX(g.ci); g.z = tZ(g.cj); g.tx = g.x; g.tz = g.z; G.stats.guestsTotal++; G.stats.guestsToday++; earn('tickets', G.price); } },
  feed(penId){ return feedGuest(pens.get(penId)); }, breakout(dinoId){ const d = dinos.find(x => x.id === dinoId); breakout(d, pens.get(d.pen)); }, dispatch: dispatchRangers,
  repair(penId){ const pen = pens.get(penId); for (const s of pen.segs){ s.cond = 1; s.broken = false; } releaseHeld(pen); rebuildFences(); showAlert(); },
  focus: focusOn, openSheet, closeSheet, setSpeed(s){ G.speed = s; }, setHour(h){ G.hour = h; }, setQuality, sim(sec){ let t = sec; while (t > 0){ const s = Math.min(t, 0.05); simulate(s); updateWild(s); t -= s; this._vt = (this._vt || 0) + s; if (this._vt >= 1){ this._vt = 0; computeViewMap(); } } }, tick(){ updateCamera(0.05); applyLighting(); renderer.render(scene, camera); },
  v9: { H, H0, LAKES, lakeAt, tX, tZ, eX, penCanBuild, penCost, canPlace, huntPairs, predationOn, absHour, SHOP, serialize, saveGame, transferCheck: (id, pid) => transferCheck(dinos.find(d => d.id === id), pens.get(pid)), migrateV9, BLD_PALETTES: M.BLD_PALETTES, applyPalettes, bldMatFor, THUMBS: () => Object.keys(THUMBS) },
  v10: { roughInfo(x, z){ roughInfo(x, z); return { rb: _rb, ri: _ri }; }, tileBase: () => tileBase, tileGrade: () => tileGrade, ridgeMask: () => ridgeMask, idx, kI, kJ, GATE, PADS, gradeCost, bldCost, pathTilesCost, isExpK, reachK, pcomp: () => pcomp, comps: () => ({ main: mainComp, reach: [...compReach], home: [...homeVia.entries()] }),
    monoLine(stIds, pts = [], loop = false){ const sts = stIds.map(id => buildings.get(id)); if (sts.some(b => !b)) return 'no station'; const nodes = [[sts[0].x, sts[0].z], ...pts, ...sts.slice(1).map(b => [b.x, b.z])]; const st = [sts[0].id, ...pts.map(() => 0), ...sts.slice(1).map(b => b.id)];
      const def = { id: G.nextId++, nodes, st, loop, cost: 0 }; let l = 0; for (let k = 1; k < nodes.length; k++) l += Math.hypot(nodes[k][0] - nodes[k - 1][0], nodes[k][1] - nodes[k - 1][1]); def.cost = Math.round(l * MONO_COST_M / 100) * 100; { const cr = Math.min(G.monoCredit || 0, def.cost); if (cr) G.monoCredit -= cr; spend('build', def.cost - cr); } monoDefs().push(def); monoBuildLine(def); afterStructureChange(); return def.id; },
    lines: () => MONO.lines.map(L => ({ id: L.def.id, ok: L.ok, len: Math.round(L.path.len), stops: L.path.stops.map(s => s.bid), s: +L.train.s.toFixed(2), v: +L.train.v.toFixed(2), dwell: +L.train.dwell.toFixed(2), riders: L.train.riders.length, dist: Math.round(L.train.ds || 0), car: L.train.cars[1].getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)), tris: L.mesh.geometry.attributes.position.count / 3 })),
    removeLine: (id) => monoRemoveLine(id, 0.5), monoAdvice, expansionCut: () => expansionCut().map(p => p.id), monoOperational, migrateV10, dartY: (id) => dartY(dinos.find(d => d.id === id)), dinoY: (id) => dinoY(dinos.find(d => d.id === id)), MONO_FARE, MONO_CREDIT, ringPaths(){ let n = 0; for (let k = 0; k < tileType.length; k++) if (tileType[k] === T_PATH && ridgeMask[k]) n++; return n; },
    guestStates(){ const o = {}; for (const g of guests) if (!g.gone) o[g.state] = (o[g.state] || 0) + 1; return o; }, expGuests(){ return guests.filter(g => !g.gone && (g.state === 'walk' || g.state === 'leave') && isExpK(idx(g.ci, g.cj))).length; },
    tileTypes: () => tileType, previewVisible: () => !!(monoPrev && monoPrev.visible), bulldoze(id){ const b = buildings.get(id); if (!b) return false; G.money += BUILD[b.type].cost * 0.5; removeBuilding(b); afterStructureChange(); return true; }, tileAt: (x, y) => tileAtScreen(x, y), toolTapTile(i, j){ const p = screenOfTile(i, j); if (p) toolTap(p); return !!p; } },
  hourly(){ hourTick(); }, ready: false,
  get tool(){ return tool; }, get camera(){ return camera; }, groundAt(x, y){ return groundAtScreen(x, y); }, get undo(){ return undoRec; }, startTool, undoLast, tutorial(k){ showTutorial(k); }, get penMarkers(){ return penMarkers.length; }, guestNeeds, get bubbles(){ return bubbles.filter(b => b.s.visible).length; }, get penSpots(){ return penSpots; }, get ferry(){ return { pendingIn: FERRY.pendingIn, boats: FERRY.boats.map(b => ({ kind: b.slot.kind, state: b.state, t: +b.t.toFixed(1), x: +b.slot.mesh.position.x.toFixed(1), z: +b.slot.mesh.position.z.toFixed(1) })), waiting: waitingAtDock() }; }, onPier, walkH, advisor(){ return moneyAdvisor(); }, guestSpread(){ const gx = tX(GATE.i) + TILE / 2, gz = tZ(GATE.j); const w = guests.filter(g => !g.gone && g.state === 'walk'); const d = w.map(g => Math.hypot(g.x - gx, g.z - gz)); const f = x => d.length ? +(d.filter(v => v > x).length / d.length).toFixed(2) : 0; return { walking: w.length, over30m: f(30), over60m: f(60), over100m: f(100), maxM: Math.round(Math.max(0, ...d)) }; }, penWarn(id){ const p = pens.get(id); return !!p && (!!penWeak(p) || penBroken(p) || penMinCond(p) < 0.45 || penWorn(p)); }, heightAt(x, z){ return H(x, z); }, dailyUpkeep, guestThought, pickGuest, screenOfXZ(x, y, z){ const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, transferCheck(dId, pId){ return transferCheck(dinos.find(d => d.id === dId), pens.get(pId)); }, startTransfer(dId){ startTransfer(dinos.find(d => d.id === dId)); }, get tutK(){ return tutK; }, flowPerMin(){ return flowPerMin(); }, stars(){ G.stars = computeStars(); checkMissions(); return G.stars; }, get fling(){ return { ...fling }; }, serialize(){ return serialize(); }, load(){ return loadGame(); }, save(){ saveGame(); }, screenOf(i, j){ const v = new THREE.Vector3(tX(i), H(tX(i), tZ(j)), tZ(j)).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, tileType(i, j){ return tileType[idx(i, j)]; },
  v11: { REGIONS, regionAt, regionOpen, buyRegion, applyRegion, ensureTestUnlock, tileReg: () => tileReg, tileLand: () => tileLand, openings: () => REGOPEN, lockWhyAt, lagoonRegionOk, lakeRegionOk, unlockedBounds, maxCamDist, migrateV11, wild: () => wild, forest: () => FOREST.items.length, apprDist, V10_LO, V10_HI },
  get v7(){ return { clip: cam.clip, curbs: curbIM.count, curbVis: curbIM.visible, grass: VEG.grass.ims[0].count, flower: VEG.flower.ims[0].count, shrub: VEG.shrub.ims[0].count, log: VEG.log.ims[0].count, guestHi: guestIM.geometry === GGEO[1], fenceHi: FENCE_IM[3].panel.geometry === FENCE_GEO[3][1].panel, bldHi: [...buildings.values()].every(b => b.mesh.userData.body.geometry === bldGeo(b.type, true)), camBoxes: CAM_BOX.length }; },
};

/* ================= init ================= */
function init(){
  const m = localStorage.getItem('pp-muted'); if (m === '1') SFX.setMuted(true);
  computeBuildable(); scatterVegetation(); buildForestWall(); buildEnv(); buildPier(); prewarm(SP_V8);
  if (!loadGame()) newGame(false);
  setQuality(QUALITY.level); buildDock(); makeThumbs();
  { // the v9 species are meshed a few at a time after start-up so loading stays as fast as v8
    const rest = SP_KEYS.filter(k => !SP_V8.includes(k) && !dinos.some(d => d.sp === k)); let n = 0; const step = () => { if (n >= rest.length) return; makeThumbs([rest[n++]]); if (sel && sel.kind === 'species') refreshSheet(); setTimeout(step, 150); }; setTimeout(step, 2500);
    const mine = SP_KEYS.filter(k => !SP_V8.includes(k) && dinos.some(d => d.sp === k)); if (mine.length) makeThumbs(mine); }
  cam.goal.tx = 0; cam.goal.tz = 30; cam.goal.dist = 230; cam.goal.pitch = 0.42; Object.assign(cam, { tx: 0, tz: 30, dist: 230, pitch: 0.42, yaw: 0.5 });
  if (QS.has('play')){ startPlaying(false); $('tut').classList.add('hidden'); } else showTitle();
  const waitTex = () => { if (texPending > 0) return setTimeout(waitTex, 50); $('loading').classList.add('hidden'); window.__DP.ready = true; };
  waitTex(); requestAnimationFrame(frame);
}
init();
