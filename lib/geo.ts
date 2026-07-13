// Best-effort current location for pinning a game's photo on the trip-review
// map. Resolves null on denial, timeout, or unsupported — callers treat a
// missing fix as "no pin" and carry on; a photo is never blocked on location.

export type Coords = { latitude: number; longitude: number };

export function getCurrentCoords(timeoutMs = 8000): Promise<Coords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: Coords | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => done({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => done(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
    // Hard stop in case the browser never calls either callback.
    setTimeout(() => done(null), timeoutMs + 500);
  });
}
