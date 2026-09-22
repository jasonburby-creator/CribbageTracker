import { type Card, cardValue, rankOf, suitOf, rankIndex } from "./deck";

export type HandScoreBreakdown = {
  fifteens: number;
  pairs: number;
  runs: number;
  flush: number;
  nobs: number;
};

export type HandScore = {
  total: number;
  breakdown: HandScoreBreakdown;
};

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function scoreFifteens(cards: Card[]): number {
  let count = 0;
  for (let size = 2; size <= cards.length; size++) {
    for (const combo of combinations(cards, size)) {
      const sum = combo.reduce((s, c) => s + cardValue(c), 0);
      if (sum === 15) count++;
    }
  }
  return count * 2;
}

function scorePairs(cards: Card[]): number {
  let count = 0;
  for (const pair of combinations(cards, 2)) {
    if (rankOf(pair[0]) === rankOf(pair[1])) count++;
  }
  return count * 2;
}

// Groups the 5 cards by rank, finds maximal runs of 3+ consecutive rank
// values, and scores run-length × the product of how many cards share each
// rank in that run (this is what makes "double runs" / "triple runs" work).
function scoreRuns(cards: Card[]): number {
  const counts = new Map<number, number>();
  for (const c of cards) {
    const idx = rankIndex(c);
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  const present = [...counts.keys()].sort((a, b) => a - b);

  let total = 0;
  let i = 0;
  while (i < present.length) {
    let j = i;
    while (j + 1 < present.length && present[j + 1] === present[j] + 1) j++;
    const runLength = j - i + 1;
    if (runLength >= 3) {
      let multiplicity = 1;
      for (let k = i; k <= j; k++) multiplicity *= counts.get(present[k])!;
      total += runLength * multiplicity;
    }
    i = j + 1;
  }
  return total;
}

// 4 hand cards all one suit = 4; if the starter matches too, 5. A crib only
// ever scores the 5-card (starter-matching) flush, never the 4-card one.
function scoreFlush(handCards: Card[], starter: Card, isCrib: boolean): number {
  const suits = new Set(handCards.map(suitOf));
  if (suits.size !== 1) return 0;
  const starterMatches = suitOf(starter) === [...suits][0];
  if (isCrib) return starterMatches ? 5 : 0;
  return starterMatches ? 5 : 4;
}

// "His heels"/nobs: a jack among the 4 counted cards matching the starter's suit.
function scoreNobs(handCards: Card[], starter: Card): number {
  const starterSuit = suitOf(starter);
  return handCards.some((c) => rankOf(c) === "J" && suitOf(c) === starterSuit) ? 1 : 0;
}

// Scores a 4-card hand (or crib) plus the shared starter card. `isCrib` only
// changes flush scoring (a crib flush requires the starter to match too).
export function scoreHand(handCards: Card[], starter: Card, isCrib: boolean): HandScore {
  if (handCards.length !== 4) {
    throw new Error("scoreHand expects exactly 4 cards plus a starter");
  }
  const all = [...handCards, starter];
  const breakdown: HandScoreBreakdown = {
    fifteens: scoreFifteens(all),
    pairs: scorePairs(all),
    runs: scoreRuns(all),
    flush: scoreFlush(handCards, starter, isCrib),
    nobs: scoreNobs(handCards, starter),
  };
  const total =
    breakdown.fifteens + breakdown.pairs + breakdown.runs + breakdown.flush + breakdown.nobs;
  return { total, breakdown };
}
