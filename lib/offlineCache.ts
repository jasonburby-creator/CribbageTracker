// Tiny localStorage-backed cache so the home and trip pages can show your
// last-known data instead of a blank screen when there's no signal — mirrors
// the same try/catch-wrapped localStorage JSON pattern already used for the
// geocode cache in lib/geocode.ts, just generalized to any shape of data.
//
// This is the app's real offline mechanism for page data — it caches the
// already-parsed result, so it survives query-shape changes (unlike the
// service worker's URL-keyed HTTP cache in public/sw.js, which orphans
// itself whenever a select() column list changes). The service worker is a
// secondary layer on top, mainly useful for a cold load that's never
// happened before. Never cache anything containing a player's `email` here
// either — same reasoning as the guard in sw.js.

export function readCache<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/unavailable — the page just won't have a stale fallback
  }
}
