export const WINNING_SCORE = 121;
export const SKUNK_THRESHOLD = 91; // loser under this = skunk
export const DOUBLE_SKUNK_THRESHOLD = 61; // loser under this = double skunk

export type GameResult = {
  winnerPlayer: 1 | 2;
  winnerScore: number;
  loserScore: number;
  isSkunk: boolean;
  isDoubleSkunk: boolean;
  multiplier: 1 | 2 | 4 | 8;
  payoutCents: number;
  winWeight: 1 | 2 | 4 | 8;
};

/**
 * Computes the payout and win-weight for a completed game.
 * baseAmountCents: the flat per-game stake set at the start of the trip
 * perPointCents: bonus per point of differential (10 cents per requirements)
 */
export function computeGameResult(
  player1Score: number,
  player2Score: number,
  baseAmountCents: number,
  isTieFlip: boolean = false,
  perPointCents: number = 10
): GameResult {
  const winnerPlayer: 1 | 2 = player1Score > player2Score ? 1 : 2;
  const winnerScoreRaw = Math.max(player1Score, player2Score);
  const loserScore = Math.min(player1Score, player2Score);
  // Standard cribbage: the winner's score is capped at 121 for scoring purposes,
  // even if they physically pegged past it.
  const winnerScore = Math.min(winnerScoreRaw, WINNING_SCORE);

  const isDoubleSkunk = loserScore < DOUBLE_SKUNK_THRESHOLD;
  const isSkunk = !isDoubleSkunk && loserScore < SKUNK_THRESHOLD;

  const skunkMultiplier = isDoubleSkunk ? 4 : isSkunk ? 2 : 1;
  const multiplier = (skunkMultiplier * (isTieFlip ? 2 : 1)) as 1 | 2 | 4 | 8;
  const winWeight = multiplier;

  const diff = winnerScore - loserScore;
  const payoutCents = (baseAmountCents + diff * perPointCents) * multiplier;

  return {
    winnerPlayer,
    winnerScore,
    loserScore,
    isSkunk,
    isDoubleSkunk,
    multiplier,
    payoutCents,
    winWeight,
  };
}

export type TripSummary = {
  gamesPlayed: number;
  player1: {
    wins: number; // raw game count
    winPoints: number; // weighted (skunk=2, double skunk=4)
    skunks: number;
    doubleSkunks: number;
    netCents: number;
  };
  player2: {
    wins: number;
    winPoints: number;
    skunks: number;
    doubleSkunks: number;
    netCents: number;
  };
};

export function computeTripSummary(
  games: {
    status: string;
    winner_player: 1 | 2 | null;
    is_skunk: boolean;
    is_double_skunk: boolean;
    payout_cents: number | null;
    win_weight: number | null;
  }[]
): TripSummary {
  const summary: TripSummary = {
    gamesPlayed: 0,
    player1: { wins: 0, winPoints: 0, skunks: 0, doubleSkunks: 0, netCents: 0 },
    player2: { wins: 0, winPoints: 0, skunks: 0, doubleSkunks: 0, netCents: 0 },
  };

  for (const g of games) {
    if (g.status !== "completed" || !g.winner_player) continue;
    summary.gamesPlayed += 1;
    const payout = g.payout_cents ?? 0;
    const winner = g.winner_player === 1 ? summary.player1 : summary.player2;
    const loser = g.winner_player === 1 ? summary.player2 : summary.player1;
    winner.wins += 1;
    winner.winPoints += g.win_weight ?? 1;
    winner.netCents += payout;
    loser.netCents -= payout;
    if (g.is_double_skunk) winner.doubleSkunks += 1;
    else if (g.is_skunk) winner.skunks += 1;
  }

  return summary;
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
