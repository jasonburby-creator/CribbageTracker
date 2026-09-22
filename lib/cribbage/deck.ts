// Pure card helpers, safe to import from both server and client code (no
// Node builtins here — see shuffle.ts for the one function that needs them).

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"] as const;
export const SUITS = ["S", "H", "D", "C"] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
// Two characters: rank + suit, e.g. "AS", "TH", "JD". "T" stands for ten so
// every card is exactly two characters.
export type Card = string;

export function rankOf(card: Card): Rank {
  return card.slice(0, -1) as Rank;
}

export function suitOf(card: Card): Suit {
  return card.slice(-1) as Suit;
}

export function rankIndex(card: Card): number {
  return RANKS.indexOf(rankOf(card));
}

export function cardValue(card: Card): number {
  const r = rankOf(card);
  if (r === "A") return 1;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return parseInt(r, 10);
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) deck.push(`${r}${s}`);
  }
  return deck;
}
