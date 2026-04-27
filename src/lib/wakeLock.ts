let lock: any = null;

export async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      lock = await (navigator as any).wakeLock.request("screen");
      lock.addEventListener?.("release", () => { lock = null; });
    }
  } catch {}
}

export function releaseWakeLock() {
  try { lock?.release?.(); } catch {}
  lock = null;
}

export function setupWakeLockReacquire(isActive: () => boolean) {
  const handler = () => {
    if (document.visibilityState === "visible" && isActive() && !lock) {
      requestWakeLock();
    }
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}
