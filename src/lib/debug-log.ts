// Lightweight in-app event log used during diagnostics.
// Stores up to 200 entries in memory and notifies subscribers on change.

export interface LogEntry {
  t: number; // ms since first log
  level: "info" | "warn" | "error";
  msg: string;
}

const MAX = 200;
let entries: LogEntry[] = [];
let firstT: number | null = null;
let listeners: (() => void)[] = [];

export function dlog(level: LogEntry["level"], msg: string) {
  const now = performance.now();
  if (firstT === null) firstT = now;
  entries.push({ t: Math.round(now - firstT), level, msg });
  if (entries.length > MAX) entries = entries.slice(-MAX);
  listeners.forEach((l) => l());
}

export function dgetEntries(): LogEntry[] {
  return entries;
}

export function dclear() {
  entries = [];
  firstT = null;
  listeners.forEach((l) => l());
}

export function dsubscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
