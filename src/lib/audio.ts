import { storage } from "./storage";

// ---------------------------------------------------------------------------
// AudioContext singleton.
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

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

async function ensureRunning(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  if (c.state === "running") return true;
  try {
    await c.resume();
  } catch {
    // ignore
  }
  return c.state === "running";
}

export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;

  try {
    if (c.state !== "running") {
      c.resume().catch(() => {});
    }
  } catch {}

  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
  } catch {}

  audioUnlocked = true;

  try {
    if (typeof speechSynthesis !== "undefined") {
      try { speechSynthesis.getVoices(); } catch {}
      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0;
      u.rate = 1;
      try { speechSynthesis.speak(u); } catch {}
    }
  } catch {}
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

async function playBeep(
  freq: number,
  durationMs: number,
  volume: number,
): Promise<void> {
  const c = getCtx();
  if (!c) return;

  const ok = await ensureRunning();
  if (!ok) return;

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

export async function playTransitionBeeps(): Promise<void> {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) {
    await new Promise((r) => setTimeout(r, 100));
    return;
  }
  const v = (prefs.beep_volume / 100) * 0.6;

  await ensureRunning();

  await playBeep(880, 180, v);
  await new Promise((r) => setTimeout(r, 80));
  await playBeep(880, 180, v);
  await new Promise((r) => setTimeout(r, 100));
}

export async function playChime(): Promise<void> {
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) return;
  const v = (prefs.beep_volume / 100) * 0.5;

  await ensureRunning();

  await playBeep(523.25, 250, v);
  await new Promise((r) => setTimeout(r, 50));
  await playBeep(659.25, 250, v);
  await new Promise((r) => setTimeout(r, 50));
  await playBeep(783.99, 500, v);
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
