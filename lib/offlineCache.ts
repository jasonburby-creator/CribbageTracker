// Tiny localStorage-backed cache so the home and trip pages can show your
// last-known data instead of a blank screen when there's no signal — mirrors
// the same try/catch-wrapped localStorage JSON pattern already used for the
// geocode cache in lib/geocode.ts, just generalized to any shape of data.

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
