/* Primeval Park - synthesized WebAudio sound (no samples). */
let ctx = null, master = null, muted = false, crowdGain = null, jungleGain = null, noiseBuf = null, unlocked = false;
export function setMuted(m){ muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); }
export function isMuted(){ return muted; }
function noise(){ if (noiseBuf) return noiseBuf; const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++){ const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; } return noiseBuf; }
export function unlock(){
  if (!ctx){ const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp); comp.connect(ctx.destination);
    // crowd ambience: band-passed noise with slow amplitude wobble
    const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'lowpass'; bp2.frequency.value = 1100; bp2.Q.value = 0.5; crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.31; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    src.connect(bp); bp.connect(bp2); bp2.connect(crowdGain); crowdGain.connect(master); src.start();
    // jungle bed: very soft low wind
    const s2 = ctx.createBufferSource(); s2.buffer = noise(); s2.loop = true; s2.playbackRate.value = 0.5; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; jungleGain = ctx.createGain(); jungleGain.gain.value = 0.05; s2.connect(lp); lp.connect(jungleGain); jungleGain.connect(master); s2.start();
  }
  if (ctx.state !== 'running') ctx.resume(); unlocked = true;
}
const now = () => ctx.currentTime;
function env(g, t, a, peak, d){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function ok(){ return ctx && unlocked && !muted && ctx.state === 'running'; }
export function setCrowd(level){ if (!ctx) return; crowdGain.gain.setTargetAtTime(Math.min(0.16, level * 0.16), ctx.currentTime, 0.6); }
function shaper(k){ const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++){ const x = i / n * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } const w = ctx.createWaveShaper(); w.curve = c; return w; }
// v9: only deep, occasional animal calls. Every voice is low-passed; there are no chirps, beeps or whistles left in the game.
// roar: low saw sweep + formant noise; 'size' sets the pitch but is floored so even small animals growl rather than squeak
export function roar(size = 1, vol = 1, opt = {}){ if (!ok() || vol < 0.02) return; size = Math.max(1.3, size); const t = now(); const f0 = 95 / Math.sqrt(size); const dur = (opt.dur || 1) * (1.0 + Math.min(size, 3) * 0.45);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.3, t); o.frequency.linearRampToValueAtTime(f0 * 1.55, t + 0.25); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur);
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f0 * 0.5; const vib = ctx.createOscillator(); vib.frequency.value = opt.rumble ? 11 : 23; const vg = ctx.createGain(); vg.gain.value = f0 * 0.15; vib.connect(vg); vg.connect(o.frequency);
  const n = ctx.createBufferSource(); n.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(420 / Math.sqrt(size), t); bp.frequency.linearRampToValueAtTime(900 / Math.sqrt(size), t + 0.3); bp.frequency.exponentialRampToValueAtTime(220 / Math.sqrt(size), t + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4; const ws = shaper(6); const g = ctx.createGain(); env(g, t, 0.12, 0.5 * vol, dur);
  const gn = ctx.createGain(); gn.gain.value = opt.breathy ? 1.4 : 0.9; o.connect(ws); o2.connect(ws); n.connect(bp); bp.connect(gn); gn.connect(lp); ws.connect(lp); lp.connect(g); g.connect(master);
  o.start(t); o2.start(t); vib.start(t); n.start(t); const e = t + dur + 0.3; o.stop(e); o2.stop(e); vib.stop(e); n.stop(e); }
// smaller hunters (raptors, Dilophosaurus, pterosaurs): a short throaty growl, not a screech
export function screech(vol = 1){ roar(1.5, vol * 0.8, { dur: 0.55, breathy: true }); }
export function chomp(vol = 1){ if (!ok()) return; const t = now(); for (const dt of [0, 0.16]){ const n = ctx.createBufferSource(); n.buffer = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = ctx.createGain(); env(g, t + dt, 0.005, 0.9 * vol, 0.14); n.connect(lp); lp.connect(g); g.connect(master); n.start(t + dt); n.stop(t + dt + 0.25);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t + dt); o.frequency.exponentialRampToValueAtTime(45, t + dt + 0.12); const g2 = ctx.createGain(); env(g2, t + dt, 0.003, 0.8 * vol, 0.13); o.connect(g2); g2.connect(master); o.start(t + dt); o.stop(t + dt + 0.2); } }
// a guest's shout: a short, low, muffled yell (was a high-pitched scream)
export function scream(vol = 1){ if (!ok()) return; const t = now(); const o = ctx.createOscillator(); o.type = 'sawtooth'; const base = 210 + Math.random() * 50; o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.35, t + 0.15); o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.7);
  const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 800; f1.Q.value = 1.2; const g = ctx.createGain(); env(g, t, 0.04, 0.18 * vol, 0.7); o.connect(f1); f1.connect(g); g.connect(master); o.start(t); o.stop(t + 0.9); }
export function thud(vol = 1, size = 1){ if (!ok() || vol < 0.03) return; const t = now(); const o = ctx.createOscillator(); o.frequency.setValueAtTime(70 / Math.sqrt(size) + 20, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.25); const g = ctx.createGain(); env(g, t, 0.005, Math.min(0.9, 0.5 * vol), 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4); }
// containment alarm: a low two-tone horn
export function siren(){ if (!ok()) return; const t = now(); const o = ctx.createOscillator(); o.type = 'sawtooth'; for (let i = 0; i < 4; i++){ o.frequency.setValueAtTime(i % 2 ? 165 : 220, t + i * 0.5); } const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.08); g.gain.setValueAtTime(0.14, t + 1.85); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0); o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 2.1); }
// money / goal: a soft low wooden knock instead of a bell
export function cash(){ if (!ok()) return; const t = now(); for (const [f, dt] of [[196, 0], [262, 0.09]]){ const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); env(g, t + dt, 0.004, 0.14, 0.18); o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 0.3); } }
// UI tap: a quiet low tock (the old 900 Hz blip was one of the high-pitched sounds)
export function click(){ if (!ok()) return; const t = now(); const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.04); const g = ctx.createGain(); env(g, t, 0.002, 0.07, 0.05); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.08); }
export function build(){ if (!ok()) return; const t = now(); for (const dt of [0, 0.09, 0.2]){ const n = ctx.createBufferSource(); n.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260 + dt * 600; bp.Q.value = 2; const g = ctx.createGain(); env(g, t + dt, 0.004, 0.35, 0.08); n.connect(bp); bp.connect(g); g.connect(master); n.start(t + dt); n.stop(t + dt + 0.15); } }
export function zap(){ if (!ok()) return; const t = now(); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = ctx.createGain(); env(g, t, 0.003, 0.15, 0.25); const lfo = ctx.createOscillator(); lfo.frequency.value = 60; const lg = ctx.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency); o.connect(lp); lp.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 0.3); lfo.stop(t + 0.3); }
// tranquilizer shot: a dull low pop (was a 2.5 kHz hiss)
export function dart(){ if (!ok()) return; const t = now(); const n = ctx.createBufferSource(); n.buffer = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const g = ctx.createGain(); env(g, t, 0.002, 0.5, 0.07); n.connect(lp); lp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.12); }
// v9: the bird chirp (2.2-3.8 kHz, played every few seconds) is gone; kept as a no-op so old callers stay safe
export function bird(){}
