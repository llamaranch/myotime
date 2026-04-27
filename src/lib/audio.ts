import { storage } from "./storage";

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!audioCtx) {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = new C();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function unlockAudio() {
  try { ctx(); } catch {}
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
  if (prefs.beep_muted || prefs.beep_volume === 0) return Promise.resolve();
  const v = (prefs.beep_volume / 100) * 0.6;
  return new Promise(resolve => {
    try {
      beep(880, 200, v);
      setTimeout(() => beep(880, 200, v), 300);
      setTimeout(resolve, 600);
    } catch { resolve(); }
  });
}

export function playChime(): void {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) return;
  const v = (prefs.beep_volume / 100) * 0.5;
  try {
    beep(523.25, 250, v); // C5
    setTimeout(() => beep(659.25, 250, v), 180); // E5
    setTimeout(() => beep(783.99, 500, v), 360); // G5
  } catch {}
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
      const u = new SpeechSynthesisUtterance(text);
      u.volume = prefs.voice_volume / 100;
      u.rate = 1;
      const voices = getVoices();
      if (prefs.preferred_voice) {
        const v = voices.find(v => v.name === prefs.preferred_voice);
        if (v) u.voice = v;
      }
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      // safety timeout
      setTimeout(finish, Math.max(2500, text.length * 120));
    } catch { resolve(); }
  });
}

export function cancelSpeech() {
  try { speechSynthesis?.cancel(); } catch {}
}
