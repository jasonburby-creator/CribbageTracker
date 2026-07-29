import type { Coords } from "@/lib/geo";

// Forward-geocodes a free-text location (e.g. "Madrid" or "the finca
// terrace") into approximate coordinates, for games that never got a GPS
// fix — mainly ones logged after the fact via "Log a game already played."
// Same Nominatim endpoint NewGameForm already reverse-geocodes with, no key
// needed. Results are cached in localStorage: the same text repeats across a
// trip, and Nominatim's usage policy asks callers not to re-request results
// unlikely to change.

const CACHE_KEY = "skunklife-geocode-cache-v1";
const MIN_GAP_MS = 1100; // Nominatim policy: max ~1 request/second

function readCache(): Record<string, Coords | null> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, Coords | null>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full/unavailable — just won't be cached this session
  }
}

let lastRequestAt = 0;

export async function forwardGeocode(query: string): Promise<Coords | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const cache = readCache();
  if (key in cache) return cache[key];

  const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  let result: Coords | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query
      )}`
    );
    const data = await res.json();
    const hit = data?.[0];
    if (hit) {
      result = { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon) };
    }
  } catch {
    result = null;
  }

  cache[key] = result;
  writeCache(cache);
  return result;
}
