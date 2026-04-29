import { storage } from "./storage";
import { dlog } from "./debug-log";

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
    if (!C) {
      dlog("error", "No AudioContext class available");
      return null;
    }
    try {
      audioCtx = new C() as AudioContext;
      dlog("info", `AudioContext created, state=${audioCtx.state}`);
    } catch (e) {
      dlog("error", `AudioContext creation failed: ${String(e)}`);
      return null;
    }
  }
  return audioCtx;
}

async function ensureRunning(): Promise<boolean> {
  const c = getCtx();
  if (!c) {
    dlog("warn", "ensureRunning: no context");
    return false;
  }
  if (c.state === "running") return true;
  dlog("info", `ensureRunning: state=${c.state}, calling resume()`);
  try {
    await c.resume();
  } catch (e) {
    dlog("error", `resume threw: ${String(e)}`);
  }
  dlog("info", `ensureRunning: post-resume state=${c.state}`);
  return c.state === "running";
}

// ---------------------------------------------------------------------------
// unlockAudio() — synchronous, must run inside a user gesture.
// ---------------------------------------------------------------------------

export function unlockAudio(): void {
  dlog("info", "unlockAudio() called");
  const c = getCtx();
  if (!c) return;

  try {
    if (c.state !== "running") {
      dlog("info", `unlockAudio: state=${c.state}, calling resume()`);
      c.resume()
        .then(() => dlog("info", `unlockAudio: resume completed, state=${c.state}`))
        .catch((e) => dlog("error", `unlockAudio: resume rejected: ${String(e)}`));
    } else {
      dlog("info", "unlockAudio: already running");
    }
  } catch (e) {
    dlog("error", `unlockAudio: resume threw: ${String(e)}`);
  }

  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
    dlog("info", "unlockAudio: silent buffer started");
  } catch (e) {
    dlog("error", `unlockAudio: silent buffer failed: ${String(e)}`);
  }

  audioUnlocked = true;

  try {
    if (typeof speechSynthesis !== "undefined") {
      try { speechSynthesis.getVoices(); } catch {}
      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0;
      u.rate = 1;
      try {
        speechSynthesis.speak(u);
        dlog("info", "unlockAudio: speech primed");
      } catch (e) {
        dlog("error", `unlockAudio: speech prime failed: ${String(e)}`);
      }
    }
  } catch {}
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

// ---------------------------------------------------------------------------
// Beep generation.
// ---------------------------------------------------------------------------

async function playBeep(
  freq: number,
  durationMs: number,
  volume: number,
): Promise<void> {
  const c = getCtx();
  if (!c) {
    dlog("warn", "playBeep: no context");
    return;
  }

  const ok = await ensureRunning();
  if (!ok) {
    dlog("error", `playBeep(${freq}): ensureRunning returned false, state=${c.state}`);
    return;
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
    dlog("info", `playBeep(${freq}, ${durationMs}ms, vol=${volume.toFixed(2)}) started, ctxTime=${now.toFixed(3)}`);
  } catch (e) {
    dlog("error", `playBeep failed: ${String(e)}`);
  }
}

export async function playTransitionBeeps(): Promise<void> {
  dlog("info", "playTransitionBeeps()");
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) {
    dlog("info", `beep muted=${prefs.beep_muted} vol=${prefs.beep_volume}`);
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
  dlog("info", "playChime()");
  const prefs = storage.getPrefs();
  if (prefs.beep_muted || prefs.beep_volume === 0) {
    dlog("info", `chime muted=${prefs.beep_muted} vol=${prefs.beep_volume}`);
    return;
  }
  const v = (prefs.beep_volume / 100) * 0.5;

  await ensureRunning();

  await playBeep(523.25, 250, v);
  await new Promise((r) => setTimeout(r, 50));
  await playBeep(659.25, 250, v);
  await new Promise((r) => setTimeout(r, 50));
  await playBeep(783.99, 500, v);
}

// ---------------------------------------------------------------------------
// Speech synthesis.
// ---------------------------------------------------------------------------

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
    const finish = (why: string) => {
      if (!done) {
        done = true;
        dlog("info", `speak("${text}") finished via ${why}`);
        resolve();
      }
    };

    let utter: SpeechSynthesisUtterance;
    try {
      utter = new SpeechSynthesisUtterance(text);
    } catch (e) {
      dlog("error", `speak: utterance creation failed: ${String(e)}`);
      finish("create-error");
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

    utter.onend = () => finish("onend");
    utter.onerror = (ev) => {
      dlog("warn", `speak("${text}") onerror: ${(ev as any).error || "unknown"}`);
      finish("onerror");
    };

    const fallbackMs = Math.min(5000, 800 + text.length * 90);
    setTimeout(() => finish("fallback"), fallbackMs);

    try {
      speechSynthesis.speak(utter);
      dlog("info", `speak("${text}") submitted`);
    } catch (e) {
      dlog("error", `speak: speechSynthesis.speak threw: ${String(e)}`);
      finish("speak-error");
    }
  });
}

export function cancelSpeech(): void {
  if (typeof speechSynthesis === "undefined") return;
  try { speechSynthesis.cancel(); } catch {}
}
