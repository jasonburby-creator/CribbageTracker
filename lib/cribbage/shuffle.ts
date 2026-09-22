import { randomInt } from "crypto";
import type { Card } from "./deck";

// Server-only (uses Node's crypto for real shuffling) — imported exclusively
// from lib/onlineGameServer.ts, never from a client component. Kept separate
// from deck.ts so the rest of the cribbage engine (scoring, legality checks)
// stays safe to import from the browser too.
export function shuffle(cards: Card[]): Card[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
