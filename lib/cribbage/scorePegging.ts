import { type Card, cardValue, rankOf, rankIndex } from "./deck";

export type PeggingPlayScore = {
  points: number;
  breakdown: { fifteen: number; thirtyOne: number; pairs: number; runs: number };
};

// Running total of a pegging pile (resets to 0 after 31 or a "go").
export function pileCount(pile: Card[]): number {
  return pile.reduce((sum, c) => sum + cardValue(c), 0);
}

export function canPlay(pile: Card[], card: Card): boolean {
  return pileCount(pile) + cardValue(card) <= 31;
}

// Scores the single card just played, given the pile as it stood before it.
// Doesn't award the "last card"/"go" point — that's a flow-level fact (was
// this the only card left either player could play?), not something this
// card's own value can determine, so the caller awards it separately.
export function scorePeggingPlay(pileBefore: Card[], newCard: Card): PeggingPlayScore {
  const pile = [...pileBefore, newCard];
  const count = pileCount(pile);

  const fifteen = count === 15 ? 2 : 0;
  const thirtyOne = count === 31 ? 2 : 0;

  // Pairs / n-of-a-kind: how many cards of the same rank were just played in
  // a row, ending at the new card.
  let pairs = 0;
  {
    let n = 1;
    for (let i = pile.length - 2; i >= 0 && rankOf(pile[i]) === rankOf(newCard); i--) n++;
    if (n >= 2) pairs = n * (n - 1);
  }

  // Runs: the longest trailing suffix (3+) whose ranks are distinct and
  // consecutive once sorted — order played doesn't matter, only the largest
  // qualifying suffix counts.
  let runs = 0;
  for (let k = pile.length; k >= 3; k--) {
    const slice = pile.slice(pile.length - k);
    const idxs = slice.map(rankIndex);
    if (new Set(idxs).size !== k) continue;
    const min = Math.min(...idxs);
    const max = Math.max(...idxs);
    if (max - min === k - 1) {
      runs = k;
      break;
    }
  }

  const points = fifteen + thirtyOne + pairs + runs;
  return { points, breakdown: { fifteen, thirtyOne, pairs, runs } };
}
