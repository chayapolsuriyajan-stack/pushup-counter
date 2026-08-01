// Keeps the screen awake while a set is running. Not supported in Safari —
// silently unsupported there, same as it always was in the vanilla app.
export function requestWakeLock() {
  if (!("wakeLock" in navigator)) return Promise.resolve(null);
  return navigator.wakeLock.request("screen").catch((err) => {
    console.warn("Wake lock failed:", err);
    return null;
  });
}

export function releaseWakeLock(wakeLock) {
  wakeLock?.release().catch(() => {});
}
