/* Primeval Park v2 - procedural dinosaurs (Three.js r160).
   Anatomy is described as signed-distance primitives (elliptic spine tube, round-cone limbs, muscle ellipsoids, carved sockets),
   meshed with surface nets at two LODs, soft-skinned from the primitives, shaded with a triplanar scale bump + procedural
   countershaded patterns, and animated with a stride-matched IK gait. */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function cr(p0, p1, p2, p3, t){ const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }

/* ============================================================ species ============================================================
   nodes: [z, y, halfWidth, radiusUp, radiusDown], tail tip -> snout tip. pel/chest/head = node indices (head and beyond are rigid skull).
   jaw: hinge [dy, dz] from head node; pts [dz, dy, w, up, down] from hinge.
   legs: joints [dx, dy, dz, r] from 'at'; 5 joints for legs (hip, knee, ankle, ball, toe tip), 4 for arms. sx = lateral squash per joint. */
const SPECIES = {
  trex: {
    size: 12, gait: 'biped', scaleF: 1.25, teeth: [13, 12], toothL: 0.13,
    nodes: [[-6.6,2.0,.03,.03,.03],[-5.8,2.25,.12,.14,.13],[-4.8,2.55,.23,.28,.27],[-3.7,2.86,.36,.44,.44],[-2.6,3.12,.5,.62,.64],[-1.4,3.32,.66,.82,.88],
      [-.3,3.4,.8,.94,1.06],[.85,3.34,.9,.98,1.34],[1.9,3.36,.84,.9,1.24],[2.75,3.58,.64,.7,.92],[3.4,3.88,.5,.56,.66],[3.9,4.1,.46,.52,.54],
      [4.3,4.22,.6,.54,.52],[4.8,4.18,.46,.5,.44],[5.25,4.06,.31,.47,.33],[5.6,3.96,.21,.38,.26],[5.86,3.9,.11,.22,.12]],
    pel: 6, chest: 8, head: 11, headTaper: .32,
    jaw: { hinge: [-.12, .3], pts: [[0,0,.47,.14,.42],[.42,-.1,.42,.13,.36],[.85,-.15,.33,.11,.27],[1.22,-.15,.23,.09,.19],[1.5,-.12,.1,.06,.08]] },
    eye: { p: [.42, .34, .5], r: .068, gaze: [.74, .08, .67], pupil: 'slit', iris: '#c28a2c' },
    legs: [
      { hind: true, at: [.66, 3.16, .15], j: [[0,0,0,.74],[0,-1.45,.55,.48],[0,-2.42,-.3,.23],[0,-3.0,.12,.17],[0,-3.07,.86,.075]], sx: [.78,.82,.9,1.1,1.2],
        thigh: [.06,-.45,.08, .52,.98,.78], calf: [0,-1.72,.12, .27,.46,.3], toes: { n: 3, spread: .36, len: [.82,1,.86] } },
      { arm: true, at: [.46, 2.82, 2.5], j: [[0,0,0,.12],[.08,-.4,.12,.09],[.08,-.56,.42,.06],[.08,-.58,.6,.03]], sx: [1,1,1,1], fingers: 2 }],
    col: { top: 0x463f31, belly: 0xb09c78, mark: 0x221c14, pat: 1, patF: 2.4, mouth: 0x6e2a26, claw: 0x221d17 },
    feat(P, c){ const { H, hb } = c;
      P.ell(hb, [.5, H[1] - .04, H[0] + .42], [.17, .2, .4], { k: .14, mirror: true });
      P.ell(hb, [.4, H[1] + .24, H[0] + .06], [.2, .26, .3], { k: .12, mirror: true });
      P.ell(hb, [.36, H[1] + .5, H[0] + .44], [.13, .09, .24], { k: .06, mirror: true });
      P.ell(hb, [.26, H[1] + .55, H[0] + .76], [.08, .08, .13], { k: .05, mirror: true });
      P.ell(hb, [0, H[1] + .43, H[0] + 1.2], [.15, .07, .5], { k: .1, rot: [.46, 0, 0] });
      P.ell(hb, [.26, H[1] + .02, H[0] + 1.05], [.1, .11, .52], { k: .1, mirror: true });
      P.sub(hb, [.46, H[1] + .34, H[0] + .5], [.1, .08, .1], { k: .03, mirror: true });
      P.sub(hb, [.14, H[1] + .08, H[0] + 1.86], [.045, .035, .07], { k: .02, mirror: true });
    } },
  raptor: {
    size: 3.8, gait: 'biped', scaleF: 4, teeth: [11, 10], toothL: .028, quills: true,
    nodes: [[-2.3,.92,.02,.02,.02],[-1.9,.98,.045,.05,.05],[-1.45,1.02,.07,.08,.08],[-1.0,1.05,.1,.12,.12],[-.52,1.07,.14,.17,.17],
      [0,1.08,.17,.2,.24],[.36,1.07,.19,.2,.27],[.7,1.1,.16,.16,.21],[.95,1.23,.15,.15,.17],[1.08,1.41,.125,.13,.135],[1.17,1.555,.104,.108,.088],
      [1.3,1.6,.085,.09,.052],[1.46,1.585,.068,.075,.044],[1.6,1.555,.05,.056,.036],[1.72,1.53,.022,.03,.02]],
    pel: 5, chest: 7, head: 10,
    jaw: { hinge: [-.035, .07], pts: [[0,0,.075,.03,.045],[.17,-.01,.062,.028,.034],[.33,-.016,.044,.024,.024],[.45,-.016,.02,.016,.012]] },
    eye: { p: [.068, .045, .13], r: .02, gaze: [.9, .05, .42], pupil: 'round', iris: '#d8a22a' },
    legs: [
      { hind: true, at: [.15, .99, .02], j: [[0,0,0,.16],[0,-.38,.15,.085],[0,-.75,-.13,.042],[0,-.95,.04,.035],[0,-.98,.2,.016]], sx: [.75,.8,.9,1.1,1.2],
        thigh: [.02,-.12,.03, .12,.22,.17], calf: [0,-.5,.06, .055,.12,.07], toes: { n: 2, spread: .12, len: [1, .9] }, sickle: true },
      { arm: true, at: [.12, .99, .74], j: [[0,0,0,.045],[0,-.17,-.07,.03],[0,-.28,.13,.022],[0,-.31,.26,.01]], sx: [1,1,1,1], fingers: 3 }],
    col: { top: 0x8a7550, belly: 0xd2c29c, mark: 0x3a2b1b, pat: 3, patF: 1.6, mouth: 0x6e2a26, claw: 0x1c1712 },
    feat(P, c){ const { H, hb } = c;
      P.ell(hb, [.06, H[1] + .055, H[0] + .1], [.035, .03, .07], { k: .02, mirror: true });
      P.ell(hb, [.055, H[1] + .07, H[0] + .14], [.03, .015, .05], { k: .015, mirror: true });
      P.sub(hb, [.075, H[1] + .045, H[0] + .13], [.026, .022, .026], { k: .008, mirror: true });
      P.sub(hb, [.022, H[1] + .015, H[0] + .52], [.012, .008, .018], { k: .005, mirror: true });
    } },
  dilo: {
    size: 6.5, gait: 'biped', scaleF: 2.4, teeth: [11, 10], toothL: .045,
    nodes: [[-3.3,1.45,.03,.03,.03],[-2.7,1.55,.075,.08,.08],[-2.05,1.62,.12,.13,.13],[-1.4,1.68,.17,.2,.2],[-.7,1.71,.24,.28,.28],
      [0,1.72,.3,.32,.38],[.55,1.7,.31,.32,.42],[1.05,1.74,.26,.26,.33],[1.45,1.95,.15,.16,.17],[1.7,2.25,.115,.12,.12],[1.86,2.5,.12,.12,.09],
      [2.04,2.58,.125,.12,.06],[2.28,2.56,.1,.1,.05],[2.5,2.5,.07,.07,.04],[2.66,2.46,.03,.035,.02]],
    pel: 5, chest: 7, head: 10,
    jaw: { hinge: [-.055, .09], pts: [[0,0,.1,.035,.06],[.22,-.02,.085,.03,.045],[.45,-.03,.06,.022,.03],[.6,-.03,.024,.014,.014]] },
    eye: { p: [.1, .06, .17], r: .026, gaze: [.88, .05, .47], pupil: 'slit', iris: '#b8a030' },
    legs: [
      { hind: true, at: [.24, 1.6, .03], j: [[0,0,0,.25],[0,-.62,.24,.13],[0,-1.2,-.2,.065],[0,-1.53,.05,.055],[0,-1.58,.36,.025]], sx: [.76,.8,.9,1.1,1.2],
        thigh: [.03,-.2,.04, .19,.36,.28], calf: [0,-.8,.08, .09,.18,.1], toes: { n: 3, spread: .34, len: [.8,1,.85] } },
      { arm: true, at: [.18, 1.56, 1.15], j: [[0,0,0,.07],[0,-.26,-.1,.05],[0,-.44,.18,.035],[0,-.49,.32,.015]], sx: [1,1,1,1], fingers: 3 }],
    col: { top: 0x58653f, belly: 0xc4b98c, mark: 0x283019, pat: 2, patF: 1.4, mouth: 0x6e2a26, crest: 0xb44a26, claw: 0x221d17 },
    feat(P, c){ const { H, hb } = c;
      P.ell(hb, [.085, H[1] + .07, H[0] + .1], [.05, .05, .1], { k: .03, mirror: true });
      P.sub(hb, [.11, H[1] + .06, H[0] + .17], [.034, .03, .034], { k: .01, mirror: true });
      P.sub(hb, [.03, H[1] + .02, H[0] + .6], [.014, .01, .02], { k: .006, mirror: true });
      P.sub(hb, [.07, H[1] - .05, H[0] + .42], [.03, .025, .03], { k: .02, mirror: true });
    } },
  trike: {
    size: 9, gait: 'quad', trot: 1, scaleF: 1.4,
    nodes: [[-4.6,1.55,.05,.05,.05],[-3.8,1.8,.17,.2,.2],[-2.8,2.1,.34,.4,.4],[-1.8,2.38,.56,.6,.65],[-.8,2.62,.84,.78,.88],
      [.1,2.76,1.04,.8,1.08],[1.1,2.7,1.16,.78,1.16],[2.05,2.46,1.06,.72,1.06],[2.85,2.14,.78,.58,.76],[3.4,1.94,.55,.5,.5],
      [3.85,1.88,.5,.6,.44],[4.3,1.8,.42,.58,.42],[4.72,1.62,.3,.48,.36],[5.02,1.42,.18,.32,.26],[5.18,1.26,.07,.12,.1]],
    pel: 5, chest: 7, head: 9,
    jaw: { hinge: [-.3, .7], pts: [[0,0,.34,.1,.28],[.45,-.1,.28,.09,.24],[.85,-.22,.17,.07,.15],[1.12,-.32,.06,.04,.06]] },
    eye: { p: [.38, .3, .55], r: .055, gaze: [.95, .1, .3], pupil: 'round', iris: '#5a3a1c' },
    legs: [
      { hind: true, at: [.84, 2.25, .1], j: [[0,0,0,.52],[0,-1.05,.22,.32],[0,-1.86,-.05,.22],[0,-2.15,.08,.25],[0,-2.22,.38,.12]], sx: [.8,.85,.95,1.15,1.3],
        thigh: [.05,-.35,.05, .44,.8,.62], calf: [0,-1.3,.02, .26,.4,.28], toes: { n: 3, spread: .3, len: [.9,1,.9], hoof: true } },
      { front: true, at: [.82, 1.78, 2.65], j: [[0,0,0,.4],[.14,-.75,-.12,.28],[.14,-1.45,.06,.2],[.14,-1.74,.1,.22],[.14,-1.8,.34,.11]], sx: [.85,.9,.95,1.15,1.3],
        thigh: [.06,-.28,0, .36,.58,.46], toes: { n: 4, spread: .26, len: [.8,1,1,.8], hoof: true } }],
    col: { top: 0x5a5340, belly: 0xa89a76, mark: 0x3a3426, pat: 2, patF: 1.0, mouth: 0x6e3a30, frill: 0x7a4c30, horn: 0xe0d4b6, beak: 0x2a241c, claw: 0x2a241c },
    feat(P, c){ const { H, hb, F } = c;
      P.ell(hb, [.34, H[1] + .3, H[0] + .52], [.1, .07, .18], { k: .06, mirror: true });
      P.ell(hb, [.42, H[1] - .02, H[0] + .45], [.16, .2, .26], { k: .1, mirror: true });
      P.ell(hb, [.46, H[1] - .12, H[0] + .3], [.1, .1, .12], { k: .05, mirror: true, reg: F.horn });
      P.sub(hb, [.44, H[1] + .3, H[0] + .55], [.075, .065, .075], { k: .02, mirror: true });
      P.sub(hb, [.13, H[1] + .02, H[0] + 1.3], [.07, .07, .1], { k: .03, mirror: true });
      P.cone(hb, hb, [0, H[1] - .1, H[0] + 1.5], [0, H[1] - .6, H[0] + 1.86], .16, .035, { k: .04, sx: .62, reg: F.beak });
      P.frill(hb, [0, H[1] + .3, H[0] - .05], 1.3, 1.25, .12, -.62, F.frill);
      P.ell(hb, [.27, H[1] + .42, H[0] + .48], [.13, .13, .13], { k: .06, mirror: true });
      P.ell(hb, [0, H[1] + .16, H[0] + 1.15], [.1, .1, .14], { k: .06 });
    } },
  brachio: {
    size: 18, gait: 'quad', trot: 0, scaleF: .9,
    nodes: [[-8.4,2.6,.07,.07,.07],[-7.2,3.1,.24,.25,.25],[-5.8,3.6,.44,.45,.45],[-4.3,4.1,.7,.72,.72],[-2.6,4.55,1.05,1.0,1.08],
      [-.8,4.82,1.34,1.12,1.42],[1.0,5.1,1.48,1.16,1.6],[2.7,5.6,1.38,1.06,1.5],[4.1,6.25,1.0,.9,1.08],[5.1,7.2,.66,.68,.72],[5.8,8.3,.5,.52,.54],
      [6.4,9.5,.4,.42,.43],[6.9,10.6,.33,.35,.35],[7.25,11.42,.29,.3,.3],
      [7.62,11.62,.32,.4,.26],[8.0,11.52,.29,.32,.22],[8.38,11.36,.21,.24,.16],[8.66,11.24,.09,.11,.07]],
    pel: 5, chest: 7, head: 13, sleepNeck: 1.75, sleepHead: .55, sleepCurl: 1.3, sleepFoot: 1,
    jaw: { hinge: [-.02, .4], pts: [[0,0,.25,.08,.15],[.42,-.12,.22,.07,.12],[.8,-.24,.17,.06,.09],[1.02,-.3,.08,.035,.045]] },
    eye: { p: [.3, .3, .42], r: .06, gaze: [.95, .1, .3], pupil: 'round', iris: '#4a3218' },
    legs: [
      { hind: true, at: [1.05, 4.25, -.6], j: [[0,0,0,.9],[0,-2.1,.3,.55],[0,-3.7,-.05,.4],[0,-4.12,.1,.44],[0,-4.22,.42,.2]], sx: [.82,.9,1,1.15,1.3],
        thigh: [.05,-.7,.1, .72,1.4,1.0], toes: { n: 3, spread: .3, len: [.9,1,.9], hoof: true } },
      { front: true, at: [1.15, 5.05, 3.6], j: [[0,0,0,.78],[0,-2.4,-.25,.5],[0,-4.4,.05,.36],[0,-4.92,.1,.4],[0,-5.02,.36,.18]], sx: [.85,.9,1,1.15,1.3],
        thigh: [.05,-.6,0, .66,1.1,.8], toes: { n: 1, spread: 0, len: [1], hoof: true } }],
    col: { top: 0x5e6454, belly: 0xa2a08c, mark: 0x3e4438, pat: 0, patF: .7, mouth: 0x6e3a30, claw: 0x2a241c },
    feat(P, c){ const { H, hb } = c;
      P.ell(hb, [0, H[1] + .5, H[0] + .4], [.22, .26, .32], { k: .14 });
      P.ell(hb, [.26, H[1] + .38, H[0] + .42], [.08, .06, .14], { k: .05, mirror: true });
      P.sub(hb, [.32, H[1] + .3, H[0] + .42], [.075, .065, .075], { k: .02, mirror: true });
      P.sub(hb, [.1, H[1] + .7, H[0] + .4], [.06, .05, .08], { k: .03, mirror: true });
    } },
  stego: {
    size: 8, gait: 'quad', trot: .4, scaleF: 1.5,
    nodes: [[-4.3,1.45,.05,.05,.05],[-3.5,1.8,.15,.17,.17],[-2.5,2.15,.3,.33,.33],[-1.4,2.45,.52,.55,.58],[-.3,2.66,.74,.76,.84],
      [.6,2.62,.84,.8,.96],[1.5,2.35,.8,.72,.9],[2.3,1.85,.64,.56,.68],[2.9,1.38,.4,.38,.4],[3.32,1.08,.22,.22,.22],
      [3.6,.93,.17,.18,.12],[3.86,.86,.15,.14,.1],[4.1,.8,.1,.09,.07],[4.26,.76,.04,.045,.04]],
    pel: 4, chest: 6, head: 10,
    jaw: { hinge: [-.08, .06], pts: [[0,0,.12,.03,.07],[.26,-.03,.1,.03,.06],[.5,-.05,.07,.02,.04],[.64,-.05,.03,.012,.016]] },
    eye: { p: [.12, .07, .12], r: .028, gaze: [.95, .1, .3], pupil: 'round', iris: '#4a3218' },
    legs: [
      { hind: true, at: [.58, 2.18, -.05], j: [[0,0,0,.48],[0,-1.05,.25,.29],[0,-1.86,-.05,.19],[0,-2.12,.08,.21],[0,-2.2,.34,.1]], sx: [.8,.85,.95,1.15,1.3],
        thigh: [.04,-.35,.05, .4,.75,.58], toes: { n: 3, spread: .3, len: [.9,1,.9], hoof: true } },
      { front: true, at: [.55, 1.34, 2.4], j: [[0,0,0,.29],[.08,-.55,-.08,.2],[.1,-1.05,.05,.15],[.1,-1.28,.08,.17],[.1,-1.34,.28,.08]], sx: [.85,.9,.95,1.15,1.3],
        thigh: [.04,-.2,0, .24,.4,.3], toes: { n: 4, spread: .26, len: [.8,1,1,.8], hoof: true } }],
    col: { top: 0x67663f, belly: 0xb2a680, mark: 0x3b3b25, pat: 0, patF: 1.1, mouth: 0x6e3a30, plate: 0x6e5c3e, plate2: 0x4a2c22, horn: 0xd8ccae, beak: 0x2a241c, claw: 0x2a241c },
    feat(P, c){ const { H, hb, F } = c;
      P.ell(hb, [.11, H[1] + .1, H[0] + .1], [.045, .03, .08], { k: .03, mirror: true });
      P.sub(hb, [.135, H[1] + .07, H[0] + .12], [.034, .03, .034], { k: .01, mirror: true });
      P.cone(hb, hb, [0, H[1] - .02, H[0] + .56], [0, H[1] - .1, H[0] + .68], .05, .02, { k: .02, sx: .8, reg: F.beak });
    } },
  para: {
    size: 9.5, gait: 'quad', trot: 1, scaleF: 1.4,
    nodes: [[-4.8,2.2,.04,.04,.04],[-4.0,2.4,.12,.16,.16],[-3.0,2.62,.23,.32,.32],[-2.0,2.82,.38,.5,.52],[-1.0,2.95,.56,.68,.72],
      [0,3.0,.68,.76,.88],[1.0,2.88,.7,.72,.9],[1.85,2.75,.58,.58,.72],[2.55,2.85,.36,.38,.42],[3.05,3.25,.24,.25,.25],[3.35,3.65,.21,.22,.2],
      [3.6,3.85,.23,.25,.17],[3.95,3.78,.2,.21,.14],[4.3,3.62,.16,.15,.1],[4.55,3.52,.08,.07,.05]],
    pel: 5, chest: 7, head: 11,
    jaw: { hinge: [-.1, .08], pts: [[0,0,.17,.05,.1],[.35,-.05,.15,.04,.08],[.7,-.1,.12,.03,.05],[.88,-.1,.08,.02,.03]] },
    eye: { p: [.17, .1, .2], r: .038, gaze: [.95, .1, .3], pupil: 'round', iris: '#4a3218' },
    legs: [
      { hind: true, at: [.5, 2.62, .05], j: [[0,0,0,.52],[0,-1.2,.4,.32],[0,-2.1,-.25,.18],[0,-2.53,.08,.18],[0,-2.62,.42,.08]], sx: [.78,.85,.95,1.15,1.3],
        thigh: [.04,-.4,.08, .38,.82,.6], calf: [0,-1.45,.12, .22,.42,.26], toes: { n: 3, spread: .3, len: [.9,1,.9], hoof: true } },
      { front: true, at: [.45, 2.28, 2.0], j: [[0,0,0,.22],[0,-.95,-.15,.15],[0,-2.0,.08,.11],[0,-2.2,.12,.12],[0,-2.28,.3,.06]], sx: [.9,.95,1,1.15,1.3],
        thigh: [.03,-.25,0, .16,.36,.22], toes: { n: 3, spread: .2, len: [.9,1,.9], hoof: true } }],
    col: { top: 0x6c553a, belly: 0xbfa985, mark: 0x3e2c1a, pat: 1, patF: 1.6, mouth: 0x6e3a30, crest: 0x9a4a2a, beak: 0x2e281e, claw: 0x2a241c },
    feat(P, c){ const { H, hb, F } = c;
      P.ell(hb, [.15, H[1] + .1, H[0] + .1], [.06, .04, .1], { k: .03, mirror: true });
      P.sub(hb, [.19, H[1] + .1, H[0] + .2], [.045, .04, .045], { k: .015, mirror: true });
      P.sub(hb, [.06, H[1] + .02, H[0] + .74], [.03, .02, .06], { k: .01, mirror: true });
      const cp = []; for (let i = 0; i <= 6; i++){ const t = i / 6; cp.push([0, H[1] + .16 + t * .42 + Math.sin(t * 2.2) * .05, H[0] + .45 - t * 1.25]); }
      for (let i = 0; i < 6; i++) P.cone(hb, hb, cp[i], cp[i + 1], lerp(.1, .085, i / 6), lerp(.1, .085, (i + 1) / 6), { k: .1, sx: .75, reg: F.crest, g: 'crest' });
    } },
  ankylo: {
    size: 7, gait: 'quad', trot: .3, scaleF: 1.6, square: true, osteo: true,
    nodes: [[-3.9,.95,.08,.08,.08],[-3.3,1.0,.11,.12,.12],[-2.6,1.12,.2,.2,.2],[-1.8,1.28,.42,.36,.38],
      [-.8,1.5,.9,.58,.58],[.3,1.6,1.28,.66,.7],[1.35,1.55,1.3,.62,.72],[2.3,1.4,1.02,.55,.6],[2.9,1.2,.6,.4,.4],
      [3.25,1.08,.46,.33,.3],[3.6,1.0,.43,.29,.24],[3.9,.92,.33,.23,.18],[4.08,.86,.14,.11,.08]],
    pel: 4, chest: 6, head: 9,
    jaw: { hinge: [-.12, .12], pts: [[0,0,.3,.06,.12],[.3,-.04,.27,.05,.1],[.56,-.06,.18,.04,.06],[.7,-.06,.08,.02,.03]] },
    eye: { p: [.33, .1, .14], r: .036, gaze: [.95, .1, .3], pupil: 'round', iris: '#4a3218' },
    legs: [
      { hind: true, at: [.82, 1.22, -.3], j: [[0,0,0,.4],[.05,-.6,.15,.27],[.08,-1.0,-.02,.19],[.08,-1.17,.06,.21],[.08,-1.23,.3,.1]], sx: [.85,.9,.95,1.15,1.3],
        thigh: [.04,-.15,0, .34,.42,.4], toes: { n: 3, spread: .3, len: [.9,1,.9], hoof: true } },
      { front: true, at: [.82, 1.06, 2.3], j: [[0,0,0,.32],[.08,-.5,-.06,.22],[.12,-.86,.04,.16],[.12,-1.02,.06,.18],[.12,-1.07,.26,.09]], sx: [.9,.95,1,1.15,1.3],
        thigh: [.04,-.12,0, .26,.32,.3], toes: { n: 4, spread: .26, len: [.8,1,1,.8], hoof: true } }],
    col: { top: 0x5a5242, belly: 0x948b72, mark: 0x37322a, pat: 0, patF: 1, mouth: 0x6e3a30, osteo: 0x6e6450, horn: 0xb8a988, beak: 0x2a241c, claw: 0x2a241c },
    feat(P, c){ const { H, hb, F } = c;
      for (const sd of [1, -1]){
        P.cone(hb, hb, [sd * .34, H[1] + .2, H[0] + .1], [sd * .5, H[1] + .26, H[0] - .12], .09, .02, { k: .05, reg: F.horn });
        P.cone(hb, hb, [sd * .34, H[1] - .08, H[0] + .12], [sd * .5, H[1] - .2, H[0] - .04], .08, .02, { k: .05, reg: F.horn }); }
      P.ell(hb, [.3, H[1] + .2, H[0] + .2], [.08, .05, .1], { k: .04, mirror: true });
      P.sub(hb, [.35, H[1] + .1, H[0] + .14], [.045, .04, .045], { k: .015, mirror: true });
      P.sub(hb, [.12, H[1] + .02, H[0] + .9], [.05, .04, .06], { k: .02, mirror: true });
      P.cone(hb, hb, [0, H[1] - .08, H[0] + .86], [0, H[1] - .14, H[0] + .98], .1, .04, { k: .04, sx: 1.5, reg: F.beak });
    } },
};

/* ============================================================ textures ============================================================ */
let SKIN_TEX = null;
function skinTexture(){
  if (SKIN_TEX) return SKIN_TEX;
  const N = 512, r = mulberry(11);
  const layer = (C, jit) => { const pts = new Float32Array(C * C * 3);
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++){ const k = (j * C + i) * 3; pts[k] = (i + .5 + (r() - .5) * jit) / C; pts[k + 1] = (j + .5 + (r() - .5) * jit) / C; pts[k + 2] = .55 + r() * .45; }
    const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
      const u = (x + .5) / N, v = (y + .5) / N, ci = Math.floor(u * C), cj = Math.floor(v * C); let d1 = 9, d2 = 9, hv = 1;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){
        let ii = ci + di, jj = cj + dj, ou = 0, ov = 0; if (ii < 0){ ii += C; ou = -1; } else if (ii >= C){ ii -= C; ou = 1; } if (jj < 0){ jj += C; ov = -1; } else if (jj >= C){ jj -= C; ov = 1; }
        const k = (jj * C + ii) * 3; const dx = pts[k] + ou - u, dy = pts[k + 1] + ov - v; const d = dx * dx + dy * dy;
        if (d < d1){ d2 = d1; d1 = d; hv = pts[k + 2]; } else if (d < d2) d2 = d; }
      const e = clamp((Math.sqrt(d2) - Math.sqrt(d1)) * C * 1.7, 0, 1); out[y * N + x] = Math.pow(e, .55) * hv; }
    return out; };
  const big = layer(9, .8), small = layer(26, .9), tiny = layer(52, .9);
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++){
    const hb = big[i], hs = small[i], ht = tiny[i];
    const h = clamp(hs * .62 + ht * .2 + hb * .28, 0, 1); const ao = clamp(Math.min(hs * 1.6, 1) * .7 + hb * .3, 0, 1);
    img.data[i * 4] = h * 255; img.data[i * 4 + 1] = ao * 255; img.data[i * 4 + 2] = hb * 255; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  SKIN_TEX = t; return t;
}
const EYE_TEX = {};
function eyeTexture(pupil, iris){
  const key = pupil + iris; if (EYE_TEX[key]) return EYE_TEX[key];
  const W = 256, Hh = 128, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  g.fillStyle = '#24170c'; g.fillRect(0, 0, W, Hh);
  g.save(); g.translate(W * .25, Hh * .5);
  const R = Hh * .42; const gr = g.createRadialGradient(0, 0, R * .1, 0, 0, R); gr.addColorStop(0, iris); gr.addColorStop(.65, iris); gr.addColorStop(1, '#140c06');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, R * .55, R, 0, 0, TAU); g.fill();
  g.globalAlpha = .22; g.strokeStyle = '#000'; for (let i = 0; i < 40; i++){ const a = i / 40 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * R * .07, Math.sin(a) * R * .15); g.lineTo(Math.cos(a) * R * .5, Math.sin(a) * R * .92); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = '#050302'; g.beginPath(); if (pupil === 'slit') g.ellipse(0, 0, R * .07, R * .72, 0, 0, TAU); else g.ellipse(0, 0, R * .2, R * .36, 0, 0, TAU); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; EYE_TEX[key] = t; return t;
}
const EYE_MAT = {};
function eyeMaterial(S){ const k = S.eye.pupil + S.eye.iris; if (!EYE_MAT[k]) EYE_MAT[k] = new THREE.MeshPhysicalMaterial({ map: eyeTexture(S.eye.pupil, S.eye.iris), roughness: .1, metalness: 0, clearcoat: 1, clearcoatRoughness: .03 }); return EYE_MAT[k]; }

/* ============================================================ SDF primitives ============================================================ */
// t: 0 elliptic tube segment (y-z plane), 1 round cone (lateral squash), 2 ellipsoid
function primDist(p, x, y, z){
  if (p.t === 0){
    const dy = p.by - p.ay, dz = p.bz - p.az; let t = ((y - p.ay) * dy + (z - p.az) * dz) * p.il2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ry = y - (p.ay + dy * t), rz = z - (p.az + dz * t);
    let uy = p.ua0 + (p.ub0 - p.ua0) * t, uz = p.ua1 + (p.ub1 - p.ua1) * t; const ul = Math.sqrt(uy * uy + uz * uz); uy /= ul; uz /= ul;
    const ly = ry * uy + rz * uz, lz = ry * p.dy + rz * p.dz;
    let w = p.w0 + (p.w1 - p.w0) * t; const hv = ly > 0 ? p.u0 + (p.u1 - p.u0) * t : p.d0 + (p.d1 - p.d0) * t;
    if (p.tpA || p.tpB){ const tp = p.tpA + (p.tpB - p.tpA) * t, bq = ly / hv; w *= 1 - tp * (bq > 1 ? 1 : bq < -1 ? -1 : bq); }
    let de;
    if (p.sq){ const a = x / w, b = ly / hv; const k0 = Math.sqrt(Math.sqrt(a * a * a * a + b * b * b * b)); de = (k0 - 1) * Math.min(w, hv) * .92; }
    else { const a = x / w, b = ly / hv, a2 = a / w, b2 = b / hv; const k0 = Math.sqrt(a * a + b * b), k1 = Math.sqrt(a2 * a2 + b2 * b2); de = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(w, hv); }
    if (p.fold && ly < 0) de += p.fold * Math.sin(z * p.foldF) * Math.min(1, -ly / hv);
    p._t = t;
    if (t <= 0 || t >= 1){ const cap = t <= 0 ? p.capA : p.capB; const le = cap ? Math.abs(lz) : Math.max(0, Math.abs(lz) - p.tau);
      if (le > 1e-7) return de > 0 ? Math.sqrt(de * de + le * le) : Math.max(de, le - Math.min(w, hv)); }
    return de;
  }
  if (p.t === 1){
    const px = p.ax + (x - p.ax) * p.isx;
    const bax = p.bx - p.ax, bay = p.by - p.ay, baz = p.bz - p.az; const l2 = p.l2, rr = p.ra - p.rb, a2 = l2 - rr * rr, il2 = 1 / l2;
    const pax = px - p.ax, pay = y - p.ay, paz = z - p.az; const yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
    const xx = pax * l2 - bax * yy, xy = pay * l2 - bay * yy, xz = paz * l2 - baz * yy; const x2 = xx * xx + xy * xy + xz * xz;
    const y2 = yy * yy * l2, z2 = zz * zz * l2; const k = Math.sign(rr) * rr * rr * x2; let d;
    p._t = clamp(yy * il2, 0, 1);
    if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - p.rb;
    else if (Math.sign(yy) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - p.ra;
    else d = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - p.ra;
    return d * p.msx;
  }
  let lx = x - p.cx, ly = y - p.cy, lz = z - p.cz;
  if (p.m){ const m = p.m; const ax = m[0] * lx + m[1] * ly + m[2] * lz, ay = m[3] * lx + m[4] * ly + m[5] * lz, az = m[6] * lx + m[7] * ly + m[8] * lz; lx = ax; ly = ay; lz = az; }
  const a = lx / p.rx, b = ly / p.ry, c = lz / p.rz, a2 = a / p.rx, b2 = b / p.ry, c2 = c / p.rz;
  const k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(p.rx, p.ry, p.rz);
}
// spine groups: choose the segment whose axis is closest, evaluate only that one (continuous across joints)
function spinePick(ps, x, y, z){ let best = null, bd = Infinity;
  for (let i = 0; i < ps.length; i++){ const p = ps[i], b = p.bb; if (x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5]) continue;
    const dy = p.by - p.ay, dz = p.bz - p.az; let t = ((y - p.ay) * dy + (z - p.az) * dz) * p.il2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ry = y - (p.ay + dy * t), rz = z - (p.az + dz * t); const d2 = ry * ry + rz * rz;
    if (d2 < bd){ bd = d2; best = p; } }
  return best; }
function smin(a, b, k){ if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }

class Builder {
  constructor(){ this.groups = []; this.regs = [{ c: new THREE.Color(1, 1, 1), s: 1, r: .7 }]; }
  reg(color, skin = 0, rough = .5){ this.regs.push({ c: new THREE.Color(color), s: skin, r: rough }); return this.regs.length - 1; }
  group(op, k, name){ if (name){ const g = this.groups.find(g => g.name === name); if (g) return g; } const g = { op, k, prims: [], name }; this.groups.push(g); return g; }
  push(g, p, margin){ const m = margin + g.k; p.bb[0] -= m; p.bb[1] -= m; p.bb[2] -= m; p.bb[3] += m; p.bb[4] += m; p.bb[5] += m; g.prims.push(p); p.sig = Math.max(g.k * .45, margin * .35); return p; }
  tube(a, b, A, B, sA, sB, opts = {}){
    const dy = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dy, dz) || 1e-6;
    const p = { t: 0, ay: a[0], az: a[1], by: b[0], bz: b[1], il2: 1 / (L * L), dy: dy / L, dz: dz / L, uy: dz / L, uz: -dy / L,
      w0: A[0], u0: A[1], d0: A[2], w1: B[0], u1: B[1], d1: B[2], sA, sB, ua0: (opts.ua || [dz / L, -dy / L])[0], ua1: (opts.ua || [dz / L, -dy / L])[1], ub0: (opts.ub || [dz / L, -dy / L])[0], ub1: (opts.ub || [dz / L, -dy / L])[1], capA: !!opts.capA, capB: !!opts.capB, tau: L * .8, tpA: opts.tpA || 0, tpB: opts.tpB || 0, sq: !!opts.square, fold: opts.fold || 0, foldF: opts.foldF || 1, reg: 0 };
    const R = Math.max(A[0], A[1], A[2], B[0], B[1], B[2]) * (opts.square ? 1.1 : 1);
    p.bb = [-Math.max(A[0], B[0]) * 1.1, Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(A[0], B[0]) * 1.1, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R];
    return p;
  }
  cone(b0, b1, a, b, ra, rb, opts = {}){
    const sx = opts.sx || 1; const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2 || 1e-8;
    const p = { t: 1, ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], ra, rb, l2, isx: 1 / sx, msx: Math.min(1, sx), bones: [b0, b1], reg: opts.reg || 0, blendEnd: opts.blendEnd ?? .5 };
    const R = Math.max(ra, rb) * Math.max(1, sx);
    p.bb = [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.min(a[2], b[2]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, Math.max(a[2], b[2]) + R];
    return p;
  }
  ellp(bone, c, r, opts = {}){
    const p = { t: 2, cx: c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2], bones: [bone, bone], reg: opts.reg || 0 };
    if (opts.rot){ const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(opts.rot[0], opts.rot[1], opts.rot[2], 'YXZ')).invert().elements; p.m = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]]; }
    const R = Math.max(r[0], r[1], r[2]); p.bb = [c[0] - R, c[1] - R, c[2] - R, c[0] + R, c[1] + R, c[2] + R]; return p;
  }
}
function evalAt(groups, x, y, z){
  let d = Infinity;
  for (let gi = 0; gi < groups.length; gi++){ const g = groups[gi]; let dg = Infinity; const ps = g.prims;
    if (g.spine){ const p = spinePick(ps, x, y, z); if (p) dg = primDist(p, x, y, z); }
    else for (let i = 0; i < ps.length; i++){ const p = ps[i], b = p.bb; if (x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5]) continue; const v = primDist(p, x, y, z); if (v < dg) dg = v; }
    if (dg === Infinity) continue;
    if (g.op === 'sub'){ if (d !== Infinity) d = -smin(-d, dg, g.k); }
    else d = d === Infinity ? dg : smin(d, dg, g.k);
  }
  return d === Infinity ? 1e3 : d;
}
function surfaceNets(groups, cell){
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const g of groups) if (g.op !== 'sub') for (const p of g.prims) for (let i = 0; i < 3; i++){ bb[i] = Math.min(bb[i], p.bb[i]); bb[i + 3] = Math.max(bb[i + 3], p.bb[i + 3]); }
  const nx = Math.ceil((bb[3] - bb[0]) / cell) + 1, ny = Math.ceil((bb[4] - bb[1]) / cell) + 1, nz = Math.ceil((bb[5] - bb[2]) / cell) + 1;
  const F = new Float32Array(nx * ny * nz).fill(1e3);
  for (let k = 0; k < nz; k++){ const z = bb[2] + k * cell;
    const slab = []; for (const g of groups){ const ps = g.prims.filter(p => z >= p.bb[2] && z <= p.bb[5]); if (ps.length) slab.push({ op: g.op, k: g.k, prims: ps, spine: g.spine }); }
    if (!slab.length) continue;
    for (let j = 0; j < ny; j++){ const y = bb[1] + j * cell;
      const row = []; for (const g of slab){ const ps = g.prims.filter(p => y >= p.bb[1] && y <= p.bb[4]); if (ps.length) row.push({ op: g.op, k: g.k, prims: ps, spine: g.spine }); }
      if (!row.some(r => r.op !== 'sub')) continue;
      const base = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) F[base + i] = evalAt(row, bb[0] + i * cell, y, z);
    } }
  const cx = nx - 1, cy = ny - 1, cz = nz - 1; const vid = new Int32Array(cx * cy * cz).fill(-1); const pos = [];
  const E = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const co = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]]; const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++){
    let m = 0; for (let c = 0; c < 8; c++){ const o = co[c]; v[c] = F[(i + o[0]) + nx * ((j + o[1]) + ny * (k + o[2]))]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E){ const va = v[a], vb = v[b]; if ((va < 0) === (vb < 0)) continue; const t = va / (va - vb); const oa = co[a], ob = co[b];
      sx += oa[0] + (ob[0] - oa[0]) * t; sy += oa[1] + (ob[1] - oa[1]) * t; sz += oa[2] + (ob[2] - oa[2]) * t; n++; }
    vid[i + cx * (j + cy * k)] = pos.length / 3; pos.push(bb[0] + (i + sx / n) * cell, bb[1] + (j + sy / n) * cell, bb[2] + (k + sz / n) * cell);
  }
  const idx = []; const C = (i, j, k) => vid[i + cx * (j + cy * k)];
  const P0 = pos;
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const dac = (P0[a*3]-P0[c*3])**2 + (P0[a*3+1]-P0[c*3+1])**2 + (P0[a*3+2]-P0[c*3+2])**2, dbd = (P0[b*3]-P0[d*3])**2 + (P0[b*3+1]-P0[d*3+1])**2 + (P0[b*3+2]-P0[d*3+2])**2;
    if (dac <= dbd){ if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); }
    else { if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d); } };
  for (let k = 1; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 0; i < cx; i++){ const f0 = F[i + nx * (j + ny * k)], f1 = F[i + 1 + nx * (j + ny * k)]; if ((f0 < 0) === (f1 < 0)) continue; quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), f0 >= 0); }
  for (let k = 1; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 1; i < cx; i++){ const f0 = F[i + nx * (j + ny * k)], f1 = F[i + nx * (j + 1 + ny * k)]; if ((f0 < 0) === (f1 < 0)) continue; quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), f0 >= 0); }
  for (let k = 0; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 1; i < cx; i++){ const f0 = F[i + nx * (j + ny * k)], f1 = F[i + nx * (j + ny * (k + 1))]; if ((f0 < 0) === (f1 < 0)) continue; quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), f0 >= 0); }
  const P = new Float32Array(pos), N = new Float32Array(P.length); const e = cell * .35;
  for (let i = 0; i < P.length; i += 3){ let x = P[i], y = P[i + 1], z = P[i + 2]; let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++){
      const d = evalAt(groups, x, y, z); gx = evalAt(groups, x + e, y, z) - evalAt(groups, x - e, y, z); gy = evalAt(groups, x, y + e, z) - evalAt(groups, x, y - e, z); gz = evalAt(groups, x, y, z + e) - evalAt(groups, x, y, z - e);
      if (it === 2) break; const gl = Math.hypot(gx, gy, gz) / (2 * e); if (gl < 1e-6) break; const step = clamp(d / gl, -cell * .6, cell * .6) / gl; const inv = 1 / (2 * e); x -= gx * inv * step; y -= gy * inv * step; z -= gz * inv * step; }
    const l = Math.hypot(gx, gy, gz) || 1; P[i] = x; P[i + 1] = y; P[i + 2] = z; N[i] = gx / l; N[i + 1] = gy / l; N[i + 2] = gz / l; }
  let agree = 0; for (let t = 0; t < Math.min(idx.length, 6000); t += 3){ const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    agree += Math.sign((uy * vz - uz * vy) * N[a] + (uz * vx - ux * vz) * N[a + 1] + (ux * vy - uy * vx) * N[a + 2]); }
  if (agree < 0) for (let t = 0; t < idx.length; t += 3){ const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  return { P, N, idx };
}

/* ============================================================ species build ============================================================ */
const BUILT = {};
function buildSpecies(key){
  if (BUILT[key]) return BUILT[key];
  const S = SPECIES[key]; S.key = key; const N = S.nodes, sz = S.size / 12;
  S.hipH = S.legs[0].at[1]; S.quad = S.gait === 'quad'; S.carn = S.gait === 'biped';
  // v7: lower jaw fills the upper jaw's outline so a closed mouth reads as a lip line, not a slit
  if (!S._jawAdj){ S._jawAdj = true; const wf = S.carn ? .93 : 1, uf = S.carn ? 2.1 : 1.4; S.jaw.pts = S.jaw.pts.map(p => [p[0], p[1], p[2] * wf, p[3] * uf, p[4]]); }
  S.halfW = Math.max(...N.map(n => n[2]));
  const t0 = performance.now();
  // ---------- rig ----------
  const rig = [];
  for (let i = 0; i <= S.head; i++) rig.push({ parent: i === S.pel ? -1 : (i < S.pel ? i + 1 : i - 1), abs: [0, N[i][1], N[i][0]] });
  const hb = S.head, H = [N[hb][0], N[hb][1]];
  const jawBone = rig.length; const hinge = [0, H[1] + S.jaw.hinge[0], H[0] + S.jaw.hinge[1]]; rig.push({ parent: hb, abs: hinge });
  const eyeBones = []; for (const sd of [1, -1]){ eyeBones.push(rig.length); rig.push({ parent: hb, abs: [sd * S.eye.p[0], H[1] + S.eye.p[1], H[0] + S.eye.p[2]] }); }
  const legInfo = [];
  for (const L of S.legs) for (const sd of [1, -1]){
    const parent = L.front || L.arm ? S.chest : S.pel; const J = L.j.map(p => [sd * (L.at[0] + p[0]), L.at[1] + p[1], L.at[2] + p[2], p[3]]);
    const nb = J.length - 1; const bones = [];
    for (let i = 0; i < nb; i++){ bones.push(rig.length); rig.push({ parent: i === 0 ? parent : rig.length - 1, abs: J[i].slice(0, 3) }); }
    const len = []; for (let i = 0; i < nb; i++) len.push(Math.hypot(J[i + 1][0] - J[i][0], J[i + 1][1] - J[i][1], J[i + 1][2] - J[i][2]));
    legInfo.push({ side: sd, L, J, bones, len, hind: !!L.hind, front: !!L.front, arm: !!L.arm });
  }
  // ---------- spine sampling ----------
  const SPS = 3, samples = [];
  for (let i = 0; i < N.length - 1; i++) for (let s = 0; s < SPS; s++){ const f = s / SPS; const a = N[Math.max(0, i - 1)], b = N[i], c = N[i + 1], d = N[Math.min(N.length - 1, i + 2)];
    samples.push([0, 1, 2, 3, 4].map(k => k < 2 ? cr(a[k], b[k], c[k], d[k], f) : Math.max(.006, cr(a[k], b[k], c[k], d[k], f))).concat([i + f])); }
  samples.push([...N[N.length - 1], N.length - 1]);
  const spineAt = (z) => { for (let i = 0; i < samples.length - 1; i++){ const a = samples[i], b = samples[i + 1]; if (z >= a[0] && z <= b[0]){ const f = (z - a[0]) / (b[0] - a[0] || 1); return a.map((v, k) => lerp(v, b[k], f)); } } return samples[z < samples[0][0] ? 0 : samples.length - 1]; };
  const atS = (s) => samples.find(q => q[5] >= s) || samples[samples.length - 1];
  const owner = (j) => j >= S.head ? hb : (j >= S.pel ? j : j + 1);
  const bodyW = (s) => { const j = Math.min(Math.floor(s), N.length - 2), f = s - j; const cur = owner(j);
    if (f < .5 && j > 0){ const o = owner(j - 1); return o === cur ? [[cur], [1]] : [[cur, o], [.5 + f, .5 - f]]; }
    if (f >= .5 && j < N.length - 2){ const o = owner(j + 1); return o === cur ? [[cur], [1]] : [[cur, o], [1.5 - f, f - .5]]; }
    return [[cur], [1]]; };
  // ---------- body field ----------
  const make = (cell) => {
    const B = new Builder(); const margin = cell * 3;
    const F = { horn: B.reg(S.col.horn || 0xd8ccae, 0, .45), beak: B.reg(S.col.beak || 0x2a241c, 0, .4), crest: B.reg(S.col.crest || S.col.top, .35, .6), frill: B.reg(S.col.frill || S.col.top, .3, .65), osteo: B.reg(S.col.osteo || S.col.top, .35, .75) };
    const body = B.group('add', 0); body.spine = true; const headTp = (s) => (S.headTaper || 0) * ss(S.head - 1, S.head + .4, s);
    const ups = samples.map((q, i) => { const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)]; const dy = b[1] - a[1], dz = b[0] - a[0], l = Math.hypot(dy, dz) || 1; return [dz / l, -dy / l]; });
    for (let i = 0; i < samples.length - 1; i++){ const a = samples[i], b = samples[i + 1];
      const neck = a[5] > S.chest + .3 && a[5] < S.head - .1;
      B.push(body, B.tube([a[1], a[0]], [b[1], b[0]], [a[2], a[3], a[4]], [b[2], b[3], b[4]], a[5], b[5], { square: S.square && a[5] > 1 && a[5] < S.head, fold: neck ? .006 * sz : 0, foldF: TAU / (.14 * sz), ua: ups[i], ub: ups[i + 1], tpA: headTp(a[5]), tpB: headTp(b[5]), capA: i === 0, capB: i === samples.length - 2 }), margin); }
    for (const li of legInfo){ const { J, L, bones, side } = li; const g = B.group('add', (li.arm ? .05 : .14) * sz * (S.quad ? 1.5 : 1));
      for (let i = 0; i < J.length - 2; i++) B.push(g, B.cone(bones[i], bones[i + 1] ?? bones[i], J[i], J[i + 1], J[i][3], J[i + 1][3], { sx: L.sx[i] }), margin);
      if (L.thigh){ const t = L.thigh; B.push(g, B.ellp(bones[0], [J[0][0] + side * t[0], J[0][1] + t[1], J[0][2] + t[2]], [t[3], t[4], t[5]]), margin); }
      if (L.calf){ const t = L.calf; B.push(g, B.ellp(bones[1], [J[0][0], J[0][1] + t[1], J[0][2] + t[2]], [t[3], t[4], t[5]]), margin); }
      const ball = J[J.length - 2], tip = J[J.length - 1], fb = bones[bones.length - 1]; li.tips = [];
      if (li.arm){
        const n = L.fingers; const wr = J[2], ft = J[3]; const dz = ft[2] - wr[2], dy = ft[1] - wr[1];
        for (let f = 0; f < n; f++){ const sp = (f - (n - 1) / 2) * .4; const e = [wr[0] + side * Math.sin(sp) * Math.abs(dz) * .6 + side * .15 * Math.abs(dz), wr[1] + dy, wr[2] + dz * Math.cos(sp)];
          B.push(g, B.cone(bones[2], bones[2], wr, e, wr[3] * .62, Math.max(ft[3], cell * .55)), margin); li.tips.push(e); }
      } else {
        const T = L.toes; const len0 = Math.hypot(tip[2] - ball[2], tip[0] - ball[0]);
        for (let f = 0; f < T.n; f++){ const a = T.n === 1 ? 0 : (f - (T.n - 1) / 2) / ((T.n - 1) / 2) * T.spread * side; const l = len0 * T.len[f];
          const e = [ball[0] + Math.sin(a) * l, tip[1] + (T.hoof ? tip[3] * .4 : tip[3] * .2), ball[2] + Math.cos(a) * l];
          B.push(g, B.cone(fb, fb, [ball[0], ball[1] - ball[3] * .25, ball[2]], e, ball[3] * (T.hoof ? .75 : .55), Math.max(tip[3] * (T.hoof ? 1.2 : 1), cell * .55)), margin);
          li.tips.push(e); }
        if (T.hoof) B.push(g, B.ellp(fb, [ball[0], ball[1] - ball[3] * .2, ball[2] + ball[3] * .25], [ball[3] * 1.2, ball[3] * .78, ball[3] * 1.25]), margin);
      }
    }
    const P = {
      ell: (bone, c, r, o = {}) => { for (const sd of (o.mirror ? [1, -1] : [1])){ const g = B.group(o.sub ? 'sub' : 'add', o.k ?? .05 * sz); B.push(g, B.ellp(bone, [c[0] * sd, c[1], c[2]], r, { reg: o.reg, rot: o.rot ? [o.rot[0], o.rot[1] * sd, o.rot[2] * sd] : null }), margin); } },
      sub: (bone, c, r, o = {}) => P.ell(bone, c, r, Object.assign({}, o, { sub: true })),
      cone: (b0, b1, a, b, ra, rb, o = {}) => { for (const sd of (o.mirror ? [1, -1] : [1])){ const g = o.g ? B.group('add', o.k ?? .05 * sz, o.g) : B.group('add', o.k ?? .05 * sz);
        B.push(g, B.cone(b0, b1, [a[0] * sd, a[1], a[2]], [b[0] * sd, b[1], b[2]], ra, rb, { sx: o.sx, reg: o.reg }), margin); } },
      frill: (bone, base, w, h, th, tilt, reg) => { const g = B.group('add', .12 * sz);
        B.push(g, B.ellp(bone, [base[0], base[1] + h * .45 * Math.cos(tilt), base[2] + h * .45 * Math.sin(tilt)], [w, h * .55, th], { reg, rot: [tilt, 0, 0] }), margin); },
    };
    S.feat(P, { H, hb, F, sz });
    if (S.osteo){ const g = B.group('add', .018 * sz); const r = mulberry(5);
      for (let i = 0; i < 150; i++){ const s = 1.6 + r() * (S.head - 1.9); const sp = atS(s); const a = (r() - .5) * 2.7; const ca = Math.cos(a), sa = Math.sin(a);
        const rr = (.06 + r() * .07) * (s > S.pel - 1 && s < S.chest + 1 ? 1.3 : .8);
        B.push(g, B.ellp(owner(Math.floor(s)), [sa * sp[2] * .97, sp[1] + ca * sp[3] * .96, sp[0]], [rr, rr * .55, rr * 1.15], { reg: F.osteo }), margin); }
      const t0 = samples[1], cb = owner(0);
      B.push(g, B.ellp(cb, [.2, t0[1], t0[0]], [.26, .17, .32], { reg: F.osteo }), margin); B.push(g, B.ellp(cb, [-.2, t0[1], t0[0]], [.26, .17, .32], { reg: F.osteo }), margin);
      B.push(g, B.ellp(cb, [0, t0[1] + .02, t0[0] + .1], [.2, .15, .28], { reg: F.osteo }), margin); }
    return B;
  };
  const makeJaw = (cell) => { const B = new Builder(); const g = B.group('add', 0); g.spine = true;
    const pts = S.jaw.pts.map(p => [hinge[1] + p[1], hinge[2] + p[0], p[2], p[3], p[4]]);
    for (let i = 0; i < pts.length - 1; i++){ const a = pts[i], b = pts[i + 1]; B.push(g, B.tube([a[0], a[1]], [b[0], b[1]], [a[2], a[3], a[4]], [b[2], b[3], b[4]], 0, 0, { capA: i === 0, capB: i === pts.length - 2 }), cell * 3); }
    return B; };
  // ---------- mesh with soft skin weights, regions, mouth colouring ----------
  const mouthCol = new THREE.Color(S.col.mouth);
  const jawLen = S.jaw.pts[S.jaw.pts.length - 1][0];
  const lipCol = new THREE.Color(S.col.top).lerp(new THREE.Color(S.col.mouth), .5).multiplyScalar(.6);
  const jawAt = (z) => { const J = S.jaw.pts; const dz = z - hinge[2]; let k = 0; while (k < J.length - 2 && J[k + 1][0] < dz) k++; const f = clamp((dz - J[k][0]) / (J[k + 1][0] - J[k][0]), 0, 1); return J[k].map((v, i) => lerp(v, J[k + 1][i], f)); };
  const jawWidth = (z) => { const J = S.jaw.pts; const dz = z - hinge[2]; let k = 0; while (k < J.length - 2 && J[k + 1][0] < dz) k++; const f = clamp((dz - J[k][0]) / (J[k + 1][0] - J[k][0]), 0, 1); return lerp(J[k][2], J[k + 1][2], f); };
  const meshFrom = (B, res, isJaw) => {
    const { P, N: NN, idx } = res; const n = P.length / 3; const regs = B.regs;
    const col = new Float32Array(n * 3), mask = new Float32Array(n * 4), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const prims = B.groups.filter(g => g.op !== 'sub').flatMap(g => g.prims); const spineP = prims.filter(p => p.t === 0); const acc = new Map(); const ds = new Float32Array(prims.length);
    for (let v = 0; v < n; v++){ const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; acc.clear();
      const pick = spinePick(spineP, x, y, z);
      let dmin = Infinity; for (let i = 0; i < prims.length; i++){ const p = prims[i], b = p.bb; if (p.t === 0 && p !== pick){ ds[i] = Infinity; continue; } if (x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5]){ ds[i] = Infinity; continue; } const d = primDist(p, x, y, z); ds[i] = d; p._tt = p._t; if (d < dmin) dmin = d; }
      let cr2 = 0, cg = 0, cb = 0, cwt = 0, sk = 0, ro = 0, br = 0, wt = 0, bl = 0; const nyv = NN[v * 3 + 1];
      for (let i = 0; i < prims.length; i++){ const d = ds[i]; if (d === Infinity) continue; const p = prims[i]; const w = Math.exp(-(d - dmin) / p.sig); if (w < .01) continue;
        if (isJaw){ acc.set(jawBone, (acc.get(jawBone) || 0) + w); bl += w * ss(-.55, -.92, nyv) * (1 - ss(.45, .8, (z - hinge[2]) / jawLen)); }
        else if (p.t === 0){ const s = lerp(p.sA, p.sB, p._tt); const [bs, ws] = bodyW(s); for (let k = 0; k < bs.length; k++) acc.set(bs[k], (acc.get(bs[k]) || 0) + w * ws[k]);
          br += w * ss(S.pel - 1.6, S.pel - .3, s) * (1 - ss(S.chest + .2, S.chest + 1.2, s));
          const dy = p.by - p.ay, dz = p.bz - p.az, tt = p._tt; let uy = p.ua0 + (p.ub0 - p.ua0) * tt, uz = p.ua1 + (p.ub1 - p.ua1) * tt; const ul = Math.hypot(uy, uz); const ly = ((y - (p.ay + dy * tt)) * uy + (z - (p.az + dz * tt)) * uz) / ul;
          const hv = ly > 0 ? lerp(p.u0, p.u1, tt) : lerp(p.d0, p.d1, tt); const hd = ss(S.head - .6, S.head + .3, s); bl += w * ss(lerp(.05, -.82, hd), lerp(-.7, -1.02, hd), ly / hv); }
        else { bl += w * ss(.15, -.75, nyv) * .85; const e = p.t === 1 && p.bones[1] !== p.bones[0] ? ss(.72, 1, p._tt) * p.blendEnd : 0;
          acc.set(p.bones[0], (acc.get(p.bones[0]) || 0) + w * (1 - e)); if (e > 0) acc.set(p.bones[1], (acc.get(p.bones[1]) || 0) + w * e); }
        const R = regs[p.reg || 0]; const wn = w * (1 - R.s) + 1e-9; cr2 += R.c.r * wn; cg += R.c.g * wn; cb += R.c.b * wn; cwt += wn; sk += R.s * w; ro += R.r * w; wt += w; }
      const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const tw = top.reduce((a, b) => a + b[1], 0) || 1;
      for (let k = 0; k < 4; k++){ si[v * 4 + k] = top[k] ? top[k][0] : 0; sw[v * 4 + k] = top[k] ? top[k][1] / tw : 0; }
      wt = wt || 1; cwt = cwt || 1; col[v * 3] = cr2 / cwt; col[v * 3 + 1] = cg / cwt; col[v * 3 + 2] = cb / cwt; mask[v * 4] = sk / wt; mask[v * 4 + 1] = br / wt; mask[v * 4 + 2] = ro / wt; mask[v * 4 + 3] = bl / wt;
      const ny = NN[v * 3 + 1];
      const tint = (k, c2, f, rgh = .58) => { const m0 = mask[v * 4], m1 = m0 * (1 - k), dn = Math.max(1e-4, 1 - m1), cs = [c2.r, c2.g, c2.b]; // keep the blend exact: mix(col', skin, m1) == mix(mix(col, skin, m0), c2, k)
        for (let q = 0; q < 3; q++) col[v * 3 + q] = (col[v * 3 + q] * (1 - m0) * (1 - k) + cs[q] * f * k) / dn; mask[v * 4] = m1; mask[v * 4 + 2] = lerp(mask[v * 4 + 2], rgh, k); };
      if (isJaw){ const ja = jawAt(z), yc = hinge[1] + ja[1], jw = ja[2]; mask[v * 4 + 1] = -.01;
        if (ny > .25 && z > hinge[2] - .02 * sz) tint(ss(.25, .6, ny) * (1 - ss(jw * .4, jw * .66, Math.abs(x))), mouthCol, .55, .95);
        if (z > hinge[2] - .02 * sz){ const rel = (y - yc) / Math.max(ja[3], 1e-3); const k = ss(.05, .6, rel) * (1 - ss(.5, .85, ny)) * (1 - ss(jw * .2, jw * .45, jw - Math.abs(x))) * .75; if (k > .01) tint(k, lipCol, 1, .96); } }
      else if (z > hinge[2] - .05 * sz){ const sp = spineAt(z); const yl = sp[1] - sp[4], rel = (y - yl) / sp[4];
        if (ny < -.35 && y < sp[1] && Math.abs(x) < sp[2] * .62) tint(ss(-.35, -.7, ny), mouthCol, .5, .95);
        else if (rel > -.15 && rel < .4 && ny > -.97){ const k = (1 - ss(.06, .3, rel)) * .45; if (k > .01) tint(k, lipCol, 1, .9); } }
      if (!isJaw){ const zz = z - hinge[2]; if (zz > -.6 * sz && zz < .1 * sz && y < hinge[1] - .02 * sz){ const k = ss(-.6 * sz, -.1 * sz, zz) * .45; if (k > .02){ for (let q = 0; q < 4; q++) sw[v * 4 + q] *= 1 - k; let slot = 0; for (let q = 1; q < 4; q++) if (sw[v * 4 + q] < sw[v * 4 + slot]) slot = q; if (sw[v * 4 + slot] > 0 && si[v * 4 + slot] !== jawBone){ /* merge smallest into largest */ sw[v * 4] += sw[v * 4 + slot]; } si[v * 4 + slot] = jawBone; sw[v * 4 + slot] = k; } } }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(NN, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4)); g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1)); return g;
  };
  const cellHi = S.size / 112, cellLo = S.size / (S.size < 7 ? 60 : 46); // slim snouts need a finer far mesh
  const hiB = make(cellHi), loB = make(cellLo);
  const bodyHi = meshFrom(hiB, surfaceNets(hiB.groups, cellHi)), bodyLo = meshFrom(loB, surfaceNets(loB.groups, cellLo));
  const jB = makeJaw(cellHi * .8), jawHi = meshFrom(jB, surfaceNets(jB.groups, cellHi * .8), true); const jBl = makeJaw(cellLo), jawLo = meshFrom(jBl, surfaceNets(jBl.groups, cellLo), true);
  const ex = buildExtras(S, { N, H, hb, jawBone, hinge, legInfo, spineAt, owner, samples, atS, sz });
  const eyes = buildEyes(S, { H, eyeBones });
  const hi = mergeGeometries([mergeGeometries([bodyHi, jawHi, ...ex.hi], false), eyes], true);
  const lo = mergeGeometries([mergeGeometries([bodyLo, jawLo, ...ex.lo], false), eyes], true);
  for (const g of [hi, lo]){ g.computeBoundingSphere(); g.boundingSphere.radius *= 1.25; }
  const out = { S, rig, legInfo, jawBone, eyeBones, hi, lo, buildMs: performance.now() - t0, tris: { hi: hi.index.count / 3, lo: lo.index.count / 3 }, counts: { body: bodyHi.attributes.position.count, jaw: jawHi.attributes.position.count } };
  BUILT[key] = out; return out;
}

/* ---------- rigid parts: teeth, claws, horns, plates, spikes, quills ---------- */
function rigid(geo, color, bone, rough = .45, colorFn){
  const g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals(); const n = g.attributes.position.count;
  const col = new Float32Array(n * 3), mask = new Float32Array(n * 4), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); const c = new THREE.Color(color), v = new THREE.Vector3();
  for (let i = 0; i < n; i++){ let cc = c; if (colorFn){ v.fromBufferAttribute(g.attributes.position, i); cc = colorFn(v, c); } col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; mask[i * 3 + 2] = rough; si[i * 4] = bone; sw[i * 4] = 1; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', g.attributes.position); out.setAttribute('normal', g.attributes.normal);
  out.setAttribute('uv', g.attributes.uv && g.attributes.uv.count === n ? g.attributes.uv : new THREE.BufferAttribute(new Float32Array(n * 2), 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; out.setIndex(new THREE.BufferAttribute(ix, 1)); return out;
}
function curvedCone(len, r, bend, radial = 7, segs = 5){
  const g = new THREE.CylinderGeometry(0, 1, 1, radial, segs, false); g.translate(0, .5, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const t = p.getY(i); p.setXYZ(i, p.getX(i) * r, t * len, p.getZ(i) * r + bend * len * t * t); }
  g.computeVertexNormals(); return g;
}
const _m4 = new THREE.Matrix4(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3(), _vx = new THREE.Vector3();
function place(g, base, dir, hint = [0, 0, 1]){ _vy.set(dir[0], dir[1], dir[2]).normalize(); _vz.set(hint[0], hint[1], hint[2]); _vz.addScaledVector(_vy, -_vz.dot(_vy)); if (_vz.lengthSq() < 1e-6) _vz.set(1, 0, 0); _vz.normalize(); _vx.crossVectors(_vy, _vz);
  _m4.makeBasis(_vx, _vy, _vz).setPosition(base[0], base[1], base[2]); g.applyMatrix4(_m4); return g; }
function buildExtras(S, c){
  const { N, H, hb, jawBone, hinge, legInfo, spineAt, owner, samples, atS, sz } = c; const hi = [], lo = [];
  const claw = new THREE.Color(S.col.claw || 0x221d17); const both = (g) => { hi.push(g); lo.push(g); };
  const ivory = new THREE.Color(0xeee6cf), stain = new THREE.Color(0xb09a70);
  if (S.teeth){ const [nu, nl] = S.teeth; const tip = N[N.length - 1][0]; const z0 = hinge[2] + .12 * sz, z1 = tip - .025 * S.size / 4;
    for (const sd of [1, -1]){
      for (let i = 0; i < nu; i++){ const t = i / (nu - 1); const z = lerp(z0, z1, t); const sp = spineAt(z); const yl = sp[1] - sp[4] * .8; const xl = sp[2] * .6 * .97;
        const L = S.toothL * (1.1 - Math.abs(t - .35) * .7);
        hi.push(rigid(place(curvedCone(L, L * .2, -.25, 5, 3), [sd * xl, yl + L * .62, z], [0, -1, 0], [0, 0, 1]), 0xffffff, hb, .3, (v) => ivory.clone().lerp(stain, clamp((v.y - (yl - L * .6)) / L, 0, 1)))); }
      const J = S.jaw.pts, jl = J[J.length - 1][0];
      for (let i = 0; i < nl; i++){ const t = .1 + .82 * i / (nl - 1); const dz = jl * t; let k = 0; while (k < J.length - 2 && J[k + 1][0] < dz) k++; const f = (dz - J[k][0]) / (J[k + 1][0] - J[k][0]);
        const w = lerp(J[k][2], J[k + 1][2], f), up = lerp(J[k][3], J[k + 1][3], f), dy = lerp(J[k][1], J[k + 1][1], f); const L = S.toothL * .75 * (1.1 - Math.abs(t - .4) * .7);
        hi.push(rigid(place(curvedCone(L, L * .2, -.2, 5, 3), [sd * w * .6, hinge[1] + dy + up * .75 - L * .35, hinge[2] + dz], [0, 1, 0], [0, 0, 1]), 0xe8dfc6, jawBone, .3)); } } }
  for (const li of legInfo){ if (!li.tips.length) continue; const fb = li.bones[li.bones.length - 1]; const ball = li.J[li.J.length - 2]; const hoof = li.L.toes && li.L.toes.hoof;
    for (const e of li.tips){ const base = li.arm ? li.J[2] : ball; const d = [e[0] - base[0], e[1] - base[1], e[2] - base[2]]; const dl = Math.hypot(...d);
      const L = li.arm ? dl * .42 : hoof ? Math.max(ball[3] * .5, dl * .22) : dl * .3; const r = li.arm ? L * .2 : hoof ? L * .5 : L * .24;
      const g = curvedCone(L, r, hoof ? -.15 : -.5, 6, 3); place(g, [e[0] - d[0] / dl * L * .3, e[1] - (hoof ? r * .5 : L * .05), e[2] - d[2] / dl * L * .3], [d[0] / dl, hoof ? -.35 : -.12, d[2] / dl], [0, 1, 0]);
      const cg = rigid(g, claw, li.arm ? li.bones[2] : fb, .35); hi.push(cg); if (S.size >= 7) lo.push(cg); } // small species: far mesh toes are too thin to hold claws
    if (li.L.sickle){ const g = curvedCone(.1, .018, -1.0, 6, 5); place(g, [ball[0] - li.side * .012, ball[1] + .03, ball[2] + .01], [0, .7, .7], [0, .3, 1]); hi.push(rigid(g, claw, fb, .3)); } }
  if (S.key === 'trike'){ const hcol = (v) => new THREE.Color(S.col.horn).lerp(new THREE.Color(0x3a3024), clamp((v.y - H[1] - .8) * .9, 0, 1) * .7);
    for (const sd of [1, -1]){ const g = curvedCone(1.05, .12, .22, 10, 6); place(g, [sd * .27, H[1] + .48, H[0] + .48], [sd * .12, .62, .78], [0, 1, -.2]); both(rigid(g, S.col.horn, hb, .4, hcol)); }
    const g = curvedCone(.38, .1, .12, 10, 4); place(g, [0, H[1] + .22, H[0] + 1.15], [0, .9, .44], [0, 0, 1]); both(rigid(g, S.col.horn, hb, .4, hcol));
    const tilt = -.62, base = [0, H[1] + .3, H[0] - .05], w = 1.3, h = 1.25;
    for (let i = 0; i <= 14; i++){ const a = -.15 + (Math.PI + .3) * i / 14; const ex2 = Math.cos(a) * w * .97, ey = Math.sin(a) * h * .55 * .97;
      const cy = base[1] + h * .45 * Math.cos(tilt) + ey * Math.cos(tilt), cz = base[2] + h * .45 * Math.sin(tilt) + ey * Math.sin(tilt);
      const g2 = curvedCone(.17, .075, 0, 6, 2); place(g2, [ex2, cy, cz], [Math.cos(a), Math.sin(a) * Math.cos(tilt), Math.sin(a) * Math.sin(tilt)], [0, -Math.sin(tilt), Math.cos(tilt)]); both(rigid(g2, 0xcfc3a3, hb, .5)); } }
  if (S.key === 'stego'){ const pc = new THREE.Color(S.col.plate), pe = new THREE.Color(S.col.plate2), pb = new THREE.Color(S.col.top);
    let k = 0; for (let s = .9; s < S.head - 1.4; s += .52){ const sp = atS(s); const mid = 1 - Math.abs(s - (S.pel + .6)) / 5.2; if (mid < .12) continue;
      const hgt = .22 + mid * .72; const side = (k++ % 2) ? 1 : -1; const y0 = sp[1] + sp[3] * .8;
      const sh = new THREE.Shape(); sh.moveTo(-hgt * .5, 0); sh.bezierCurveTo(-hgt * .62, hgt * .55, -hgt * .2, hgt * .95, hgt * .05, hgt); sh.bezierCurveTo(hgt * .4, hgt * .9, hgt * .6, hgt * .45, hgt * .5, 0); sh.lineTo(-hgt * .5, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: .02 * hgt + .015, bevelEnabled: true, bevelThickness: .025, bevelSize: .022, bevelSegments: 2, curveSegments: 8 });
      g.translate(0, 0, -.015); g.rotateY(Math.PI / 2); g.rotateZ(side * .1); g.translate(side * .07, y0 - .05, sp[0]);
      const fn = (v) => { const t = clamp((v.y - y0) / hgt, 0, 1); const c2 = pb.clone().lerp(pc, ss(.05, .4, t)); const vein = Math.sin(v.z * 26 + v.y * 15) * .5 + .5; c2.lerp(pe, ss(.82, 1, t) * .6 + vein * .1 * t); return c2; };
      both(rigid(g, 0xffffff, owner(Math.floor(s)), .55, fn)); }
    for (const sd of [1, -1]) for (const q of [0, 1]){ const sp = samples[2 + q * 2]; const g = curvedCone(.75, .07, .1, 8, 4); place(g, [sd * sp[2] * .6, sp[1] + sp[3] * .5, sp[0]], [sd * .75, .45, -.35 + q * .2], [0, 1, 0]); both(rigid(g, S.col.horn, owner(Math.floor(sp[5])), .4)); } }
  if (S.key === 'ankylo'){ for (const sd of [1, -1]) for (let s = S.pel - 1.2; s < S.chest + 1.3; s += .45){ const sp = atS(s); const g = curvedCone(.26, .09, 0, 6, 2);
      place(g, [sd * sp[2] * .95, sp[1] + .05, sp[0]], [sd, .25, -.15], [0, 1, 0]); both(rigid(g, S.col.horn, owner(Math.floor(s)), .5)); } }
  if (S.key === 'dilo'){ const cc = new THREE.Color(S.col.crest), c2 = new THREE.Color(0xe8d8a8);
    for (const sd of [1, -1]){ const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(.06, .2, .3, .26, .48, .14); sh.bezierCurveTo(.54, .08, .56, .03, .56, 0); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: .008, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1, curveSegments: 10 }); g.rotateY(-Math.PI / 2); g.rotateZ(sd * .12); g.translate(sd * .045, H[1] + .085, H[0] + .02);
      both(rigid(g, 0xffffff, hb, .55, (v) => cc.clone().lerp(c2, (Math.sin((v.z - H[0]) * 46) > .4 ? .55 : 0) * clamp((v.y - H[1] - .14) * 9, 0, 1)))); } }
  if (S.quills){ const qc = new THREE.Color(0x2a2016), qt = new THREE.Color(0x8a7454);
    for (let s = S.pel - 2.6; s < S.head + .2; s += .12){ const sp = atS(s); const L = (.03 + .028 * ss(S.pel - 2.6, S.chest, s) * (1 - ss(S.head - .6, S.head + .2, s))) * (1 + Math.sin(s * 9) * .15);
      const g = curvedCone(L, .004, -.5, 4, 2); place(g, [0, sp[1] + sp[3] * .92, sp[0]], [0, .55, -.8], [0, 1, 0]); hi.push(rigid(g, 0xffffff, owner(Math.floor(s)), .6, (v) => qc.clone().lerp(qt, clamp((v.y - sp[1] - sp[3]) / L, 0, 1)))); } }
  return { hi, lo };
}
function buildEyes(S, c){ const { H, eyeBones } = c; const out = [];
  [1, -1].forEach((sd, i) => { const g = new THREE.SphereGeometry(S.eye.r, 16, 12); g.rotateY(Math.PI / 2); // iris (u=.25 -> -X after default) moved to +Z
    const gz = S.eye.gaze; g.rotateX(-gz[1]); g.rotateY(Math.atan2(sd * gz[0], gz[2])); g.translate(sd * S.eye.p[0], H[1] + S.eye.p[1], H[0] + S.eye.p[2]);
    out.push(rigid(g, 0xffffff, eyeBones[i], .1)); });
  return mergeGeometries(out, false); }

/* ============================================================ skin material ============================================================ */
const SKIN_VERT = `attribute vec4 aMask; uniform float uBreath; varying vec3 vRP; varying vec3 vRN; varying vec4 vMask;\n`;
const SKIN_FRAG = `uniform sampler2D uSkin; uniform vec3 uTop; uniform vec3 uBelly; uniform vec3 uMark; uniform vec4 uPat; uniform float uScale; uniform float uBump; uniform float uSize;
varying vec3 vRP; varying vec3 vRN; varying vec4 vMask;
float dhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dhash(i), dhash(i + vec3(1,0,0)), f.x), mix(dhash(i + vec3(0,1,0)), dhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dhash(i + vec3(0,0,1)), dhash(i + vec3(1,0,1)), f.x), mix(dhash(i + vec3(0,1,1)), dhash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float dfbm(vec3 p){ return dnoise(p) * 0.55 + dnoise(p * 2.03 + 7.1) * 0.3 + dnoise(p * 4.1 + 3.3) * 0.15; }
vec3 dinoPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float fd){
  vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos); vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * fd; vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2); return normalize(abs(fDet) * surf_norm - vGrad); }
`;
const SKIN_COLOR = `
  vec3 tw = pow(abs(vRN), vec3(4.0)); tw /= (tw.x + tw.y + tw.z + 1e-5);
  vec3 tp = vRP * uScale;
  vec4 sk = texture2D(uSkin, tp.zy) * tw.x + texture2D(uSkin, tp.xz) * tw.y + texture2D(uSkin, tp.xy) * tw.z;
  float dH = sk.r;
#ifdef DINO_HI
  { // v7 close-up scales: big tubercle rosettes on back and flanks, transverse scutes on the belly, both only when near
    float nr = 1.0 - smoothstep(0.02, 0.08, length(fwidth(tp)));
    vec3 tb = tp * 0.34 + 0.37;
    vec4 sk2 = texture2D(uSkin, tb.zy) * tw.x + texture2D(uSkin, tb.xz) * tw.y + texture2D(uSkin, tb.xy) * tw.z;
    float tub = smoothstep(0.35, 0.9, sk2.r) * (1.0 - vMask.w) * smoothstep(-0.3, 0.5, vRN.y);
    dH = mix(dH, max(dH, tub * 1.05), 0.55 * nr);
    float fz = fract(vRP.z * uScale * 1.6 + sk.b * 0.25); float scute = smoothstep(0.0, 0.1, fz) * (1.0 - smoothstep(0.82, 1.0, fz));
    dH = mix(dH, dH * 0.35 + scute * 0.65, smoothstep(0.5, 0.9, vMask.w) * smoothstep(-0.2, -0.7, vRN.y) * nr);
  }
#endif
  vec3 q = vRP / uSize * 6.0 + uPat.zwz;
  float belly = vMask.w;
  float dorsal = smoothstep(0.6, 0.97, vRN.y) * smoothstep(-0.01, 0.0, vMask.y); // jaw vertices carry a tiny negative breath flag: no dorsal stripe on the lip
  float warp = dfbm(q * 1.3); float m = 0.0;
  if (uPat.x < 0.5) m = smoothstep(0.5, 0.68, dfbm(q * 1.1 * uPat.y + 2.0)) * 0.85;
  else if (uPat.x < 1.5) m = smoothstep(0.42, 0.85, sin(q.z * 3.0 * uPat.y + warp * 5.0 + q.y * 0.8) * 0.5 + 0.5 + (dfbm(q * 1.9 + 4.0) - 0.5) * 0.9) * smoothstep(-0.2, 0.45, vRN.y) * 0.8;
  else if (uPat.x < 2.5) m = max(smoothstep(0.6, 0.7, dfbm(q * 2.2 * uPat.y)), smoothstep(0.35, 0.8, sin(q.z * 2.2 * uPat.y + warp * 5.0) * 0.5 + 0.5) * 0.6 * smoothstep(0.0, 0.6, vRN.y));
  else m = smoothstep(0.4, 0.62, sin(q.z * 4.2 * uPat.y + warp * 3.5 + q.y * 1.2) * 0.5 + 0.5) * smoothstep(-0.2, 0.5, vRN.y);
  vec3 skin = mix(uTop, uBelly, belly);
  skin = mix(skin, uMark, m * (1.0 - belly) * 0.85);
  skin = mix(skin, uMark, dorsal * 0.35);
  skin *= 0.88 + 0.24 * dfbm(q * 0.45 + 9.0);
  float fwT = length(fwidth(tp)); float near = 1.0 - smoothstep(0.012, 0.045, fwT);
  skin *= mix(1.0, mix(0.72, 1.07, min(sk.g, 0.35 + dH)), near);
  skin = mix(skin, skin * vec3(1.06, 1.03, 0.95), smoothstep(0.6, 0.95, dH) * 0.5 * near);
  diffuseColor.rgb = mix(vColor.rgb, skin, vMask.x);
`;
function makeSkin(S, U, hi){
  const Mat = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Mat({ vertexColors: true, roughness: .7, metalness: 0 });
  if (hi) mat.defines = { DINO_HI: '' };
  if (hi){ mat.sheen = .3; mat.sheenRoughness = .55; mat.sheenColor = new THREE.Color(U.uBelly.value).multiplyScalar(.45); }
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = SKIN_VERT + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * aMask.y * uBreath; vRP = position; vRN = normal; vMask = aMask;');
    sh.fragmentShader = SKIN_FRAG + sh.fragmentShader
      .replace('#include <color_fragment>', SKIN_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(vMask.z, mix(0.92, 0.58, dH), vMask.x);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float fade = 1.0 - smoothstep(0.01, 0.05, length(fwidth(tp))); vec2 dHdxy = vec2(dFdx(dH), dFdy(dH)) * uBump * fade * mix(0.3, 1.0, vMask.x);
    normal = dinoPerturb(-vViewPosition, normal, dHdxy, faceDirection); }`);
  };
  mat.customProgramCacheKey = () => 'dinoskin2' + (hi ? 'h' : 'l');
  return mat;
}
const INVIS = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
// shadow proxy: low LOD pulled inside the detailed surface so it never self-shadows it
const DEPTH = {};
function shrinkDepth(amount){ const k = amount.toFixed(3); if (DEPTH[k]) return DEPTH[k];
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed -= normal * ' + amount.toFixed(4) + ';'); };
  m.customProgramCacheKey = () => 'dshrink' + k; DEPTH[k] = m; return m; }

/* ============================================================ LOD / quality ============================================================ */
let CAM = null, QLEVEL = 2;
export function setDinoCamera(c){ CAM = c; }
export function setDinoQuality(q){ QLEVEL = clamp(q | 0, 0, 2); }
const LOD_NEAR = [14, 26, 40], LOD_SIZE = [1.2, 2.2, 3.2];

/* ============================================================ instance ============================================================ */
const _inv = new THREE.Matrix4(), _mA = new THREE.Matrix4(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ');
const _p0 = new THREE.Vector3(), _K = new THREE.Vector3(), _A = new THREE.Vector3(), _B = new THREE.Vector3(), _T = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _ax = new THREE.Vector3(1, 0, 0), _lt = new THREE.Vector3();
export class Dino {
  constructor(key, opts = {}){
    const B = buildSpecies(key); this.key = key; this.B = B; this.S = B.S; const S = this.S;
    this.root = new THREE.Group();
    const bones = B.rig.map(() => new THREE.Bone());
    B.rig.forEach((r, i) => { if (r.parent >= 0){ const p = B.rig[r.parent].abs; bones[i].position.set(r.abs[0] - p[0], r.abs[1] - p[1], r.abs[2] - p[2]); bones[r.parent].add(bones[i]); } else bones[i].position.set(r.abs[0], r.abs[1], r.abs[2]); });
    for (let i = 0; i <= S.head; i++) bones[i].rotation.order = 'YXZ';
    const rnd = mulberry(opts.seed ?? ((Math.random() * 1e9) | 0)); this.rnd = rnd;
    const jit = (hex, h, l) => { const c = new THREE.Color(hex); c.offsetHSL((rnd() - .5) * h, (rnd() - .5) * .06, (rnd() - .5) * l); return c; };
    this.U = { uSkin: { value: skinTexture() }, uTop: { value: jit(S.col.top, .04, .07) }, uBelly: { value: jit(S.col.belly, .03, .06) }, uMark: { value: jit(S.col.mark, .03, .05) },
      uPat: { value: new THREE.Vector4(S.col.pat, S.col.patF * (.9 + rnd() * .2), rnd() * 40, rnd() * 40) }, uScale: { value: S.scaleF }, uBump: { value: .42 / (26 * S.scaleF) }, uSize: { value: S.size }, uBreath: { value: 0 } };
    this.matHi = makeSkin(S, this.U, true); this.matLo = makeSkin(S, this.U, false); const eye = eyeMaterial(S);
    this.meshHi = new THREE.SkinnedMesh(B.hi, [this.matHi, eye]); this.meshLo = new THREE.SkinnedMesh(B.lo, [this.matLo, eye]); this._loMats = [this.matLo, eye]; this._invMats = [INVIS, INVIS];
    const rootBone = bones[S.pel]; this.root.add(rootBone); this.root.add(this.meshHi); this.root.add(this.meshLo); this.root.updateMatrixWorld(true);
    const sk = new THREE.Skeleton(bones); this.meshHi.bind(sk); this.meshLo.bind(sk, this.meshHi.bindMatrix);
    for (const m of [this.meshHi, this.meshLo]){ m.receiveShadow = true; m.boundingSphere = m.geometry.boundingSphere.clone(); }
    this.meshHi.castShadow = false; this.meshLo.castShadow = true; this.meshLo.customDepthMaterial = shrinkDepth(S.size / 46 * .45);
    this.mesh = this.meshHi; this.bones = bones; this.skeleton = sk; this.rest = bones.map(b => b.position.clone());
    this.forceLOD = opts.lod || null; this.near = null; this._setNear(this.forceLOD !== 'lo');
    this.legs = B.legInfo.map(li => { const J = li.J; const n = li.bones.length;
      const restDir = []; for (let i = 0; i < n; i++){ const a = J[i], b = J[i + 1]; restDir.push(new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()); }
      if (li.arm) return { li, n, restDir };
      const ank = J[2], ball = J[3]; const mt = Math.hypot(ank[1] - ball[1], ank[2] - ball[2]); const alpha0 = Math.atan2(-(ank[2] - ball[2]), ank[1] - ball[1]);
      const toe = new THREE.Vector3(J[4][0] - ball[0], J[4][1] - ball[1], J[4][2] - ball[2]);
      return { li, n, restDir, alpha0, mt, toe, ball: new THREE.Vector3(ball[0], ball[1], ball[2]), off: li.side > 0 ? 0 : .5, hipH: J[0][1], knee: li.front ? -1 : 1 }; });
    this.maxStance = .9 * Math.min(...this.legs.filter(l => !l.li.arm).map(l => l.hipH));
    { let lo = Infinity; for (let i = Math.max(0, S.pel - 1); i <= S.chest; i++) lo = Math.min(lo, S.nodes[i][1] - S.nodes[i][4]); this.sleepDrop = Math.max(0, lo - .025 * S.size); }
    this.sleepSide = rnd() < .5 ? -1 : 1; this.phase = rnd() * TAU; this.cyc = rnd(); this.t = rnd() * 10; this.action = null; this.actT = 0; this.actDur = 1; this.sleep = 0;
    this.mv = 0; this.run = 0; this.lookY = 0; this.lookX = 0; this.lookTarget = null; this._lookGoal = [0, 0]; this._lookT = 0; this.blinkT = 1 + rnd() * 3; this.blink = 0; this.exert = 0;
  }
  get tris(){ return this.near ? this.B.tris.hi : this.B.tris.lo; }
  _setNear(n){ if (n === this.near) return; this.near = n; this.meshHi.visible = n; this.meshLo.material = n ? this._invMats : this._loMats; }
  _lod(){ if (this.forceLOD){ this._setNear(this.forceLOD !== 'lo'); return; } if (!CAM) return;
    const d = this.root.position.distanceTo(CAM.position); const th = LOD_NEAR[QLEVEL] + this.S.size * LOD_SIZE[QLEVEL]; this._setNear(this.near ? d < th * 1.1 : d < th * .9); }
  setAction(a, dur){ this.action = a; this.actT = 0; this.actDur = dur || 1; }
  setLook(v){ this.lookTarget = v; }
  animate(dt, speed, turn){
    const S = this.S, bones = this.bones; turn = turn || 0; this.t += dt; const t = this.t; this._lod();
    if (this.action){ this.actT += dt; if (this.actT > this.actDur) this.action = null; }
    const act = this.action, at = clamp(this.actT / this.actDur, 0, 1); const sl = clamp(this.sleep, 0, 1);
    for (let i = 0; i < bones.length; i++){ bones[i].quaternion.identity(); bones[i].position.copy(this.rest[i]); bones[i].scale.set(1, 1, 1); }
    // gait clock: stride length from the Froude number (Alexander), stance travel = speed * stance time => planted feet
    const h = S.hipH; const eff = Math.max(Math.abs(speed), Math.abs(turn) * S.halfW * 1.2) * (1 - sl);
    const fr = eff * eff / (9.8 * h); this.run = damp(this.run, ss(.35, 1.4, fr), 3, dt); const run = this.run;
    const duty = lerp(.64, S.quad ? .45 : .36, run);
    let L = 2.3 * h * Math.pow(Math.max(fr, 1e-6), .3); L = Math.min(L, this.maxStance / duty); const f = eff > .02 ? eff / L : 0;
    this.cyc = (this.cyc + f * dt) % 1; this.phase += f * dt * TAU;
    this.mv = damp(this.mv, clamp(eff / (.3 * Math.sqrt(h)), 0, 1), 6, dt); const mv = this.mv;
    const A = f > 0 ? eff * duty / f : 0; const c = this.cyc;
    this.exert = clamp(this.exert + (run > .5 ? dt * .2 : -dt * .04), 0, 1);
    // pelvis: bob (vaulting walk / bouncing run), weight shift onto the stance leg, hip yaw, lean into speed
    const pel = bones[S.pel]; const biped = !S.quad;
    const bob = lerp(Math.cos(TAU * 2 * (c - duty * .5)) * h * .016, -Math.cos(TAU * 2 * (c - duty * .5)) * h * (biped ? .075 : .05), run) * mv;
    const breath = Math.sin(t * lerp(1.0, 2.6, this.exert) * (6 / Math.sqrt(S.size + 4)));
    const drop = sl * this.sleepDrop; const slTail = .075, sSide = this.sleepSide;
    pel.position.y += bob - drop; pel.position.x += Math.sin(TAU * c) * h * .022 * mv * (biped ? 1 : .4);
    const lean = (biped ? (.03 + .17 * run) : .03 * run) * mv + (biped ? Math.cos(TAU * 2 * (c - duty * .5)) * .025 * run * mv : 0); const roll = Math.sin(TAU * c) * (biped ? .035 : .018) * mv - turn * speed * .01 + sl * .07 * sSide;
    const pelYaw = Math.sin(TAU * c) * .045 * mv - turn * .05;
    _eu.set(lean, pelYaw, roll); pel.quaternion.setFromEuler(_eu);
    // tail: delayed counter-sway, straightens when running, droops to the ground asleep
    for (let i = 0; i < S.pel; i++){ const k = (S.pel - i) / S.pel; const b = bones[i];
      const sway = -Math.sin(TAU * c - (S.pel - i) * .45) * .06 * mv * (.4 + k) + Math.sin(t * .55 + i * .5) * .035 * (1 - mv) * (1 - sl);
      b.rotation.set(run * (biped ? -.02 : .012) * mv - sl * slTail + breath * .002 + (biped ? Math.cos(TAU * 2 * c - (S.pel - i) * .5) * .018 * run * mv : 0), sway - turn * .1 * (.3 + k) - pelYaw * .4 + sl * sSide * .1 * (.4 + k), 0); }
    // head & neck
    let headDown = 0, headUp = 0, jaw = 0, lunge = 0, tremor = 0;
    if (act === 'eat'){ const e = ss(0, .15, at) * (1 - ss(.85, 1, at)); headDown = e; if (biped){ jaw = (Math.sin(t * 7) * .5 + .5) * .45 * e; lunge = Math.max(0, Math.sin(t * 3.5)) * .3 * e; } else jaw = (Math.sin(t * 9) * .5 + .5) * .22 * e; }
    if (act === 'roar'){ const e = Math.sin(at * Math.PI); headUp = e * .85; jaw = ss(0, .25, at) * (1 - ss(.8, 1, at)); tremor = e; }
    if (act === 'bite'){ const e = Math.sin(at * Math.PI); lunge = e; jaw = at < .55 ? Math.sin(at / .55 * Math.PI / 2) : Math.max(0, 1 - (at - .55) * 6); headDown = e * .4; }
    this._lookT -= dt; let gy = this._lookGoal[0], gx = this._lookGoal[1];
    if (this.lookTarget){ _lt.copy(this.lookTarget); this.root.worldToLocal(_lt); const hz = S.nodes[S.head][0];
      gy = clamp(Math.atan2(_lt.x, _lt.z - hz * .6), -1.1, 1.1); gx = clamp(-Math.atan2(_lt.y - S.nodes[S.head][1], Math.hypot(_lt.x, _lt.z - hz)), -.4, .5); }
    else if (this._lookT < 0){ this._lookT = 2 + this.rnd() * 5; this._lookGoal = this.rnd() < .35 ? [0, 0] : [(this.rnd() - .5) * 1.4, (this.rnd() - .4) * .35]; gy = this._lookGoal[0]; gx = this._lookGoal[1]; }
    const free = (act ? 0 : 1) * (1 - sl) * (1 - run * .7); this.lookY = damp(this.lookY, gy * free, 3, dt); this.lookX = damp(this.lookX, gx * free, 3, dt);
    const nn = S.head - S.chest;
    for (let i = S.pel + 1; i <= S.head; i++){ const b = bones[i];
      if (i <= S.chest){ b.rotation.set(breath * .004 + lunge * .02, -pelYaw * .6, -roll * .5); continue; }
      const share = 1 / nn, kk = i - S.chest - 1, wd = 2 * (nn - kk) / (nn * (nn + 1)); // sleeping necks bend most at the base
      const rx = share * (headDown * (S.key === 'brachio' ? 1.3 : .95) - headUp * .55 - lean - bob / h * 2 + lunge * .25 + this.lookX) + sl * (S.sleepNeck ?? .6) * wd
        + (i === S.head ? -lunge * .35 + headUp * .2 - sl * (S.sleepHead || 0) : 0) + Math.sin(t * 40) * .006 * tremor + (biped && i === S.head ? -run * .12 * mv : 0);
      b.rotation.set(rx, share * (this.lookY + turn * .25 + pelYaw * .8 + sl * sSide * (S.sleepCurl ?? .35)), share * -roll * .6); }
    bones[S.chest].position.z += lunge * .05 * S.size / 6;
    bones[this.B.jawBone].rotation.x = jaw * (S.key === 'trex' ? .62 : S.quad ? .35 : .5);
    this.blinkT -= dt; if (this.blinkT < 0){ this.blink += dt / .08; if (this.blink >= 2){ this.blink = 0; this.blinkT = 2 + this.rnd() * 5; } }
    const lid = Math.max(sl, this.blink < 1 ? this.blink : 2 - this.blink, 0);
    for (const eb of this.B.eyeBones) bones[eb].scale.set(1, Math.max(.06, 1 - lid * .94), 1);
    this.U.uBreath.value = breath * S.size * (.0016 + this.exert * .002) * (1 + sl * .3);
    // limbs: two-bone IK hip->ankle, metatarsus angle from the step phase (heel lift at push-off), toes curl in swing
    pel.updateMatrixWorld(true); _inv.copy(this.root.matrixWorld).invert();
    const trot = S.trot || 0;
    for (const Lg of this.legs){ const li = Lg.li; const bs = li.bones;
      if (li.arm){ const sd = li.side; const sw = Math.sin(TAU * c + (sd > 0 ? 0 : Math.PI)) * .12 * mv;
        bones[bs[0]].rotation.set(-.15 + sw - jaw * .25 + sl * .3 + Math.sin(t * 1.3 + sd) * .03, 0, sd * .05); bones[bs[1]].rotation.set(-.2 - jaw * .3 - run * .3, 0, 0); bones[bs[2]].rotation.set(.1 + jaw * .2, 0, 0); continue; }
      let off = Lg.off; if (li.front) off = li.side > 0 ? lerp(.25, .5, trot * run) : lerp(.75, 1.0, trot * run);
      const ph = (c + off) % 1; let zoff, lift = 0, push = 0, curl = 0; const legH = Lg.hipH; const liftH = lerp(Math.min(.2 * legH, .07 * legH + .25 * A), (biped ? .4 : .26) * legH, run) * mv;
      if (ph < duty){ const u = ph / duty; zoff = A * (.5 - u); push = ss(.55, 1, u); }
      else { const u = (ph - duty) / (1 - duty); const e = u * u * (3 - 2 * u); zoff = A * (-.5 + e); lift = liftH * Math.sin(Math.PI * Math.pow(u, lerp(1, .75, run))); curl = Math.sin(Math.PI * u) * (1 + run * .6); push = 1 - ss(0, .35, u);
        if (run > .05){ const kick = Math.sin(Math.PI * clamp(u / .55, 0, 1)) * run; zoff -= A * .22 * kick; lift += liftH * .25 * kick; } }
      zoff *= mv;
      const b0 = bones[bs[0]]; _mA.multiplyMatrices(_inv, b0.parent.matrixWorld); _qp.setFromRotationMatrix(_mA); _p0.copy(b0.position).applyMatrix4(_mA);
      _B.copy(Lg.ball); _B.z += zoff + sl * (li.front ? -(S.sleepFoot ? .3 : .12) : (S.sleepFoot ? .32 : .1)) * legH; _B.x += sl * li.side * (S.sleepFoot || 0) * .25 * legH; _B.y += lift;
      const alpha = Lg.alpha0 + push * .5 * mv * (li.front ? .6 : 1) + curl * .25 * mv + sl * ((li.front ? .9 : 1.42) - Lg.alpha0);
      _A.set(_B.x, _B.y + Lg.mt * Math.cos(alpha), _B.z - Lg.mt * Math.sin(alpha));
      const L1 = li.len[0], L2 = li.len[1]; _d.subVectors(_A, _p0); let dd = _d.length(); const dmax = (L1 + L2) * .999, dmin = Math.abs(L1 - L2) + 1e-3;
      if (dd > dmax){ _d.multiplyScalar(dmax / dd); _A.copy(_p0).add(_d); dd = dmax; } else if (dd < dmin){ _d.multiplyScalar(dmin / Math.max(dd, 1e-4)); _A.copy(_p0).add(_d); dd = dmin; }
      _u.copy(_d).divideScalar(dd); const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      _w.set(0, 0, Lg.knee); _w.addScaledVector(_u, -_w.dot(_u)); if (_w.lengthSq() < 1e-6) _w.set(0, 1, 0); _w.normalize();
      _K.copy(_p0).addScaledVector(_u, a).addScaledVector(_w, hh);
      _T.copy(Lg.toe).applyAxisAngle(_ax, curl * .7 * mv - sl * .05).add(_B);
      const pts = [_p0, _K, _A, _B, _T]; _qw.copy(_qp);
      for (let i = 0; i < Lg.n; i++){ _d.subVectors(pts[i + 1], pts[i]).normalize(); _qi.copy(_qw).invert(); _d.applyQuaternion(_qi); const b = bones[bs[i]]; b.quaternion.setFromUnitVectors(Lg.restDir[i], _d); _qw.multiply(b.quaternion); }
    }
  }
}
export const SPECIES_DATA = SPECIES;
export function prewarm(keys){ for (const k of keys) buildSpecies(k); }
export function dinoStats(){ const o = {}; for (const k in BUILT) o[k] = { tris: BUILT[k].tris, ms: Math.round(BUILT[k].buildMs) }; return o; }
export function dinoMaterials(){ return { skin: skinTexture() }; }
