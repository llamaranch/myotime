import { storage } from "./storage";

// ---------------------------------------------------------------------------
// AudioContext — the single source of truth for all sound on the page.
// We lazily create it on first user gesture (iOS requirement) and never
// dispose of it during the app's lifetime.
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;
let speechUnlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const C =
      (window as any).AudioContext ||
      (window as any).webkitAudioContext;
    if (!C) return null;
    try {
      audioCtx = new C() as AudioContext;
    } catch {
      return null;
    }
  }
  return audioCtx;
}

// ---------------------------------------------------------------------------
// unlockAudio() — MUST be called synchronously inside a user gesture handler
// (e.g. an onClick or onPointerDown). Calling it from a useEffect or any
// async context will not work on iOS.
// ---------------------------------------------------------------------------

export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;

  // 1. Resume the AudioContext synchronously.
  try {
    if (c.state !== "running") {
      c.resume().catch(() => {});
    }
  } catch {}

  // 2. Play a 1-sample silent buffer to confirm unlock on iOS.
  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
  } catch {}

  audioUnlocked = true;

  // 3. Prime speechSynthesis.
  try {
    if (typeof speechSynthesis !== "undefined") {
      try { speechSynthesis.getVoices(); } catch {}

      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0;
      u.rate = 1;
      try { speechSynthesis.speak(u); } catch {}
      speechUnlocked = true;
    }
  } catch {}
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

function playBeep(freq: number, durationMs: number, volume: number): void {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") {
    try { c.resume(); } catch {}
  }
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain).connect(c.destination);

    const now = c.currentTime;
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + Math.max(0, dur - 0.02));
    gain.gain.linearRampToValueAtTime(0, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch {}
}

export function playTransitionBeeps(): Promise<void> {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) {
    return new Promise((r) => setTimeout(r, 100));
  }
  const v = (prefs.beep_volume / 100) * 0.6;
  playBeep(880, 180, v);
  return new Promise((resolve) => {
    setTimeout(() => {
      playBeep(880, 180, v);
      setTimeout(resolve, 200);
    }, 250);
  });
}

export function playChime(): void {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) return;
  const v = (prefs.beep_volume / 100) * 0.5;
  playBeep(523.25, 250, v); // C5
  setTimeout(() => playBeep(659.25, 250, v), 180); // E5
  setTimeout(() => playBeep(783.99, 500, v), 360); // G5
}

let voicesCache: SpeechSynthesisVoice[] = [];

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  if (voicesCache.length === 0) {
    try { voicesCache = speechSynthesis.getVoices(); } catch {}
  }
  return voicesCache;
}

if (typeof speechSynthesis !== "undefined") {
  try {
    speechSynthesis.onvoiceschanged = () => {
      try { voicesCache = speechSynthesis.getVoices(); } catch {}
    };
  } catch {}
}

export function speak(text: string): Promise<void> {
  const prefs = storage.getPrefs();
  if (prefs.voice_muted || prefs.voice_volume === 0) return Promise.resolve();
  if (typeof speechSynthesis === "undefined") return Promise.resolve();
  if (!text || !text.trim()) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };

    let utter: SpeechSynthesisUtterance;
    try {
      utter = new SpeechSynthesisUtterance(text);
    } catch {
      finish();
      return;
    }
    utter.volume = prefs.voice_volume / 100;
    utter.rate = 1;
    utter.lang = "en-US";
    const voices = getVoices();
    if (prefs.preferred_voice) {
      const v = voices.find((vc) => vc.name === prefs.preferred_voice);
      if (v) utter.voice = v;
    }

    utter.onend = finish;
    utter.onerror = finish;

    const fallbackMs = Math.min(5000, 800 + text.length * 90);
    setTimeout(finish, fallbackMs);

    try {
      speechSynthesis.speak(utter);
    } catch {
      finish();
    }
  });
}

export function cancelSpeech(): void {
  if (typeof speechSynthesis === "undefined") return;
  try { speechSynthesis.cancel(); } catch {}
}
