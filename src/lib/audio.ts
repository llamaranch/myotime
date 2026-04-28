import { storage } from "./storage";

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!audioCtx) {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = new C() as AudioContext;
  }
  const c = audioCtx as AudioContext;
  if (c.state === "suspended") c.resume();
  return c;
}

export async function ensureAudio(): Promise<void> {
  try {
    const c = ctx();
    if (c.state === "suspended") {
      await c.resume();
    }
  } catch {}
}

export function unlockAudio() {
  try {
    const c = ctx();
    if (c.state === "suspended") c.resume();
    // Play a silent buffer synchronously to unlock on iOS/Safari
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
  } catch {}
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
        beep(880, 200, v);
        setTimeout(() => { try { beep(880, 200, v); } catch {} }, 300);
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
      beep(523.25, 250, v); // C5
      setTimeout(() => { try { beep(659.25, 250, v); } catch {} }, 180);
      setTimeout(() => { try { beep(783.99, 500, v); } catch {} }, 360);
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
