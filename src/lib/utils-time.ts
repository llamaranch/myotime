export function formatTime(totalSeconds: number): string {
  // Use Math.ceil so a value like 29.987 displays as "0:30" until it
  // actually crosses below 29.0. This makes the countdown feel correct
  // (especially after Repeat resets the timer).
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function formatTimeMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function totalDuration(activities: { duration_seconds: number }[]): number {
  return activities.reduce((sum, a) => sum + a.duration_seconds, 0);
}
