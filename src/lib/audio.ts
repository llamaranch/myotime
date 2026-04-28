import { storage } from "./storage";

let audioCtx: AudioContext | null = null;
const htmlTones = new Map<string, HTMLAudioElement>();

function ctx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = new C() as AudioContext;
  }
  const c = audioCtx as AudioContext;
  if ((c.state as string) !== "running") { try { c.resume(); } catch {} }
  return c;
}

export async function ensureAudio(): Promise<void> {
  try {
    const c = ctx();
    if ((c.state as string) !== "running" && c.state !== "closed") {
      // Race against a timeout — some browsers never resolve resume() if the
      // page lost focus or the gesture window expired.
      await Promise.race([
        c.resume(),
        new Promise(r => setTimeout(r, 400)),
      ]);
    }
  } catch {}
}

function wavDataUrl(freq: number, durationMs: number): string {
  const sampleRate = 44100;
  const samples = Math.ceil(sampleRate * durationMs / 1000);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 220, (samples - i) / 220);
    const sample = Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.85 * fade;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function toneElement(freq: number, durationMs: number): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const key = `${freq}:${durationMs}`;
  let el = htmlTones.get(key);
  if (!el) {
    el = new Audio(wavDataUrl(freq, durationMs));
    el.preload = "auto";
    htmlTones.set(key, el);
  }
  return el;
}

function primeHtmlTones() {
  [[880, 200], [523.25, 250], [659.25, 250], [783.99, 500]].forEach(([freq, duration]) => {
    try {
      const el = toneElement(freq, duration);
      if (!el) return;
      el.volume = 0.001;
      el.currentTime = 0;
      const played = el.play();
      played?.then(() => {
        el.pause();
        el.currentTime = 0;
      }).catch(() => {});
    } catch {}
  });
}

function playTone(freq: number, durationMs: number, volume: number) {
  try {
    const el = toneElement(freq, durationMs);
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.volume = Math.max(0, Math.min(1, volume));
      el.play()?.catch(() => { try { beep(freq, durationMs, volume); } catch {} });
      return;
    }
  } catch {}
  try { beep(freq, durationMs, volume); } catch {}
}

export function unlockAudio() {
  try {
    const c = ctx();
    if ((c.state as string) !== "running") c.resume();
    // Play a silent buffer synchronously to unlock on iOS/Safari
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.04);
  } catch {}
  primeHtmlTones();
  // Prime speech synthesis: cancel any pending, then speak a silent utterance
  // synchronously inside the gesture. We do NOT leave it queued — cancel right
  // after to avoid it interfering with the first real utterance.
  try {
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 10;
      speechSynthesis.speak(u);
      // Force-load voices
      speechSynthesis.getVoices();
    }
  } catch {}
}

function beep(freq: number, durationMs: number, volume: number) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0;
  osc.connect(gain).connect(c.destination);
  const now = c.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function playTransitionBeeps(): Promise<void> {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) return new Promise(r => setTimeout(r, 600));
  const v = (prefs.beep_volume / 100) * 0.6;
  return new Promise(resolve => {
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };
    // Hard safety: always resolve so the workout never freezes
    const safety = setTimeout(done, 1500);
    const run = () => {
      try {
        playTone(880, 200, v);
        setTimeout(() => { try { playTone(880, 200, v); } catch {} }, 300);
      } catch {}
      setTimeout(() => { clearTimeout(safety); done(); }, 600);
    };
    ensureAudio().then(run, run);
  });
}

export function playChime(): void {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) return;
  const v = (prefs.beep_volume / 100) * 0.5;
  ensureAudio().then(() => {
    try {
      playTone(523.25, 250, v); // C5
      setTimeout(() => { try { playTone(659.25, 250, v); } catch {} }, 180);
      setTimeout(() => { try { playTone(783.99, 500, v); } catch {} }, 360);
    } catch {}
  });
}

let voicesCache: SpeechSynthesisVoice[] = [];
export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  if (voicesCache.length === 0) voicesCache = speechSynthesis.getVoices();
  return voicesCache;
}
if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.onvoiceschanged = () => { voicesCache = speechSynthesis.getVoices(); };
}

export function speak(text: string): Promise<void> {
  const prefs = storage.getPrefs();
  if (prefs.voice_muted || prefs.voice_volume === 0) return Promise.resolve();
  if (typeof speechSynthesis === "undefined") return Promise.resolve();
  return new Promise(resolve => {
    try {
      speechSynthesis.cancel();
      // Chrome quirk: after cancel(), calling speak() in the same tick can be
      // dropped. resume() + microtask defer keeps the utterance reliable.
      try { speechSynthesis.resume(); } catch {}
      const u = new SpeechSynthesisUtterance(text);
      u.volume = prefs.voice_volume / 100;
      u.rate = 1;
      u.lang = "en-US";
      const voices = getVoices();
      if (prefs.preferred_voice) {
        const v = voices.find(v => v.name === prefs.preferred_voice);
        if (v) u.voice = v;
      }
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      // Defer one tick so cancel() fully clears the queue first
      setTimeout(() => {
        try { speechSynthesis.speak(u); } catch { finish(); return; }
        // safety timeout
        setTimeout(finish, Math.max(2500, text.length * 120));
      }, 0);
    } catch { resolve(); }
  });
}

export function cancelSpeech() {
  try { speechSynthesis?.cancel(); } catch {}
}
