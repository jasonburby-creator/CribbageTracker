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

export type PlayerTally = {
  playerId: string;
  name: string;
  wins: number; // raw game count
  winPoints: number; // sum of win_weight (skunk-weighted)
  skunks: number;
  doubleSkunks: number;
  netCents: number; // positive = this player is up
  // Σ(winnerScore capped at 121 − loserScore) over this player's wins.
  winMarginSum: number;
  // Accumulated only over games where hands_played is recorded, for per-hand rates.
  handsTotal: number;
  pointsInHandGames: number; // this player's capped score summed
  skunksInHandGames: number;
  doubleSkunksInHandGames: number;
};

export type HeadToHead = {
  key: string; // canonical, order-independent pair key
  gamesPlayed: number;
  players: [PlayerTally, PlayerTally];
};

type TallyTrip = {
  id: string;
  name: string;
  player1_id: string;
  player2_id: string;
  player1?: { name: string } | null;
  player2?: { name: string } | null;
};

type TallyGame = {
  trip_id: string;
  status: string;
  winner_player: 1 | 2 | null;
  is_skunk: boolean;
  is_double_skunk: boolean;
  payout_cents: number | null;
  win_weight: number | null;
  player1_score: number;
  player2_score: number;
  hands_played: number | null;
};

/**
 * Aggregates completed games into all-time head-to-head records, one per
 * unique pair of players. A person can be player1 in one trip and player2 in
 * another, so results are keyed by real player id (not by trip position).
 */
export function computeHeadToHeads(
  trips: TallyTrip[],
  games: TallyGame[]
): HeadToHead[] {
  const tripById = new Map(trips.map((t) => [t.id, t]));

  const pairs = new Map<
    string,
    { tallies: Map<string, PlayerTally>; order: string[]; gamesPlayed: number }
  >();

  const blankTally = (playerId: string, name: string): PlayerTally => ({
    playerId,
    name,
    wins: 0,
    winPoints: 0,
    skunks: 0,
    doubleSkunks: 0,
    netCents: 0,
    winMarginSum: 0,
    handsTotal: 0,
    pointsInHandGames: 0,
    skunksInHandGames: 0,
    doubleSkunksInHandGames: 0,
  });

  for (const g of games) {
    if (g.status !== "completed" || !g.winner_player) continue;
    const trip = tripById.get(g.trip_id);
    if (!trip) continue;

    const p1 = { id: trip.player1_id, name: trip.player1?.name ?? "Player 1" };
    const p2 = { id: trip.player2_id, name: trip.player2?.name ?? "Player 2" };
    // Canonical pair key so A-vs-B and B-vs-A collapse into one bucket.
    const order = [p1.id, p2.id].sort();
    const key = order.join("|");

    let bucket = pairs.get(key);
    if (!bucket) {
      bucket = {
        tallies: new Map([
          [p1.id, blankTally(p1.id, p1.name)],
          [p2.id, blankTally(p2.id, p2.name)],
        ]),
        order,
        gamesPlayed: 0,
      };
      pairs.set(key, bucket);
    }
    // Keep the freshest known name for each player.
    bucket.tallies.get(p1.id)!.name = p1.name;
    bucket.tallies.get(p2.id)!.name = p2.name;

    const winnerId = g.winner_player === 1 ? p1.id : p2.id;
    const loserId = g.winner_player === 1 ? p2.id : p1.id;
    const winner = bucket.tallies.get(winnerId)!;
    const loser = bucket.tallies.get(loserId)!;
    const payout = g.payout_cents ?? 0;

    // Scores capped at 121 (older rows can overshoot from before the cap).
    const winnerScore = Math.min(
      WINNING_SCORE,
      Math.max(g.player1_score, g.player2_score)
    );
    const loserScore = Math.min(g.player1_score, g.player2_score);

    bucket.gamesPlayed += 1;
    winner.wins += 1;
    winner.winPoints += g.win_weight ?? 1;
    winner.netCents += payout;
    loser.netCents -= payout;
    winner.winMarginSum += winnerScore - loserScore;
    if (g.is_double_skunk) winner.doubleSkunks += 1;
    else if (g.is_skunk) winner.skunks += 1;

    // Per-hand accumulators only for games with a recorded hand count.
    if (g.hands_played && g.hands_played > 0) {
      const winnerCapped = winnerScore;
      const loserCapped = loserScore;
      winner.handsTotal += g.hands_played;
      loser.handsTotal += g.hands_played;
      winner.pointsInHandGames += winnerCapped;
      loser.pointsInHandGames += loserCapped;
      if (g.is_double_skunk) winner.doubleSkunksInHandGames += 1;
      else if (g.is_skunk) winner.skunksInHandGames += 1;
    }
  }

  return [...pairs.values()]
    .map((bucket) => ({
      key: bucket.order.join("|"),
      gamesPlayed: bucket.gamesPlayed,
      players: [
        bucket.tallies.get(bucket.order[0])!,
        bucket.tallies.get(bucket.order[1])!,
      ] as [PlayerTally, PlayerTally],
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
}

export type MarginRecord = {
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  margin: number;
  tripName: string;
  date: string | null;
};

export type LongestGameRecord = {
  winnerName: string;
  loserName: string;
  handsPlayed: number;
  tripName: string;
  date: string | null;
};

export type SkunkiestTripRecord = {
  playerName: string;
  opponentName: string;
  tripName: string;
  skunkCount: number;
};

export type StreakRecord = {
  key: string;
  playerName: string;
  opponentName: string;
  length: number;
  lastPlayedAt: string | null;
};

export type Records = {
  biggestMargin: MarginRecord | null;
  closestGame: MarginRecord | null;
  longestGame: LongestGameRecord | null;
  skunkiestTrip: SkunkiestTripRecord | null;
  streaks: StreakRecord[];
};

/**
 * All-time records and current per-pairing win streaks — same underlying
 * data as computeHeadToHeads (same trip/game shapes, same canonical pairing
 * key), just summarized differently. Callers should pass a `trips` array
 * with demo trips already filtered out, same as for computeHeadToHeads.
 */
export function computeRecords(
  trips: TallyTrip[],
  games: (TallyGame & { completed_at?: string | null })[]
): Records {
  const tripById = new Map(trips.map((t) => [t.id, t]));

  let biggestMargin: MarginRecord | null = null;
  let closestGame: MarginRecord | null = null;
  let longestGame: LongestGameRecord | null = null;

  // trip_id -> winning playerId -> skunk/double-skunk wins delivered, for
  // finding the single most lopsided trip.
  const skunksByTrip = new Map<string, Map<string, number>>();

  // canonical pair key -> that pairing's games in play order, for streaks.
  const pairGames = new Map<
    string,
    {
      order: string[];
      names: Map<string, string>;
      games: { winnerId: string; completed_at: string | null }[];
    }
  >();

  for (const g of games) {
    if (g.status !== "completed" || !g.winner_player) continue;
    const trip = tripById.get(g.trip_id);
    if (!trip) continue;

    const p1 = { id: trip.player1_id, name: trip.player1?.name ?? "Player 1" };
    const p2 = { id: trip.player2_id, name: trip.player2?.name ?? "Player 2" };
    const winnerId = g.winner_player === 1 ? p1.id : p2.id;
    const winnerName = g.winner_player === 1 ? p1.name : p2.name;
    const loserName = g.winner_player === 1 ? p2.name : p1.name;
    const date = g.completed_at ?? null;

    const winnerScore = Math.min(
      WINNING_SCORE,
      Math.max(g.player1_score, g.player2_score)
    );
    const loserScore = Math.min(g.player1_score, g.player2_score);
    const margin = winnerScore - loserScore;

    if (!biggestMargin || margin > biggestMargin.margin) {
      biggestMargin = {
        winnerName,
        loserName,
        winnerScore,
        loserScore,
        margin,
        tripName: trip.name,
        date,
      };
    }
    if (!closestGame || margin < closestGame.margin) {
      closestGame = {
        winnerName,
        loserName,
        winnerScore,
        loserScore,
        margin,
        tripName: trip.name,
        date,
      };
    }
    if (
      g.hands_played &&
      g.hands_played > 0 &&
      (!longestGame || g.hands_played > longestGame.handsPlayed)
    ) {
      longestGame = {
        winnerName,
        loserName,
        handsPlayed: g.hands_played,
        tripName: trip.name,
        date,
      };
    }
    if (g.is_skunk || g.is_double_skunk) {
      let byPlayer = skunksByTrip.get(g.trip_id);
      if (!byPlayer) {
        byPlayer = new Map();
        skunksByTrip.set(g.trip_id, byPlayer);
      }
      byPlayer.set(winnerId, (byPlayer.get(winnerId) ?? 0) + 1);
    }

    const order = [p1.id, p2.id].sort();
    const key = order.join("|");
    let bucket = pairGames.get(key);
    if (!bucket) {
      bucket = { order, names: new Map(), games: [] };
      pairGames.set(key, bucket);
    }
    bucket.names.set(p1.id, p1.name);
    bucket.names.set(p2.id, p2.name);
    bucket.games.push({ winnerId, completed_at: date });
  }

  let skunkiestTrip: SkunkiestTripRecord | null = null;
  for (const [tripId, byPlayer] of skunksByTrip) {
    const trip = tripById.get(tripId);
    if (!trip) continue;
    for (const [playerId, count] of byPlayer) {
      if (!skunkiestTrip || count > skunkiestTrip.skunkCount) {
        const isP1 = playerId === trip.player1_id;
        skunkiestTrip = {
          playerName: isP1
            ? trip.player1?.name ?? "Player 1"
            : trip.player2?.name ?? "Player 2",
          opponentName: isP1
            ? trip.player2?.name ?? "Player 2"
            : trip.player1?.name ?? "Player 1",
          tripName: trip.name,
          skunkCount: count,
        };
      }
    }
  }

  // Sort each pairing's games newest-first, count consecutive wins by the
  // most recent winner — a streak of 1 isn't worth surfacing.
  const streaks: StreakRecord[] = [];
  for (const [key, bucket] of pairGames) {
    const sorted = [...bucket.games].sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );
    if (sorted.length === 0) continue;
    const currentWinner = sorted[0].winnerId;
    let length = 0;
    for (const g of sorted) {
      if (g.winnerId !== currentWinner) break;
      length += 1;
    }
    if (length < 2) continue;
    const opponentId = bucket.order.find((id) => id !== currentWinner)!;
    streaks.push({
      key,
      playerName: bucket.names.get(currentWinner) ?? "?",
      opponentName: bucket.names.get(opponentId) ?? "?",
      length,
      lastPlayedAt: sorted[0].completed_at,
    });
  }
  streaks.sort((a, b) => b.length - a.length);

  return { biggestMargin, closestGame, longestGame, skunkiestTrip, streaks };
}

/**
 * Sorts games newest-first by the date they were actually played
 * (completed_at), falling back to created_at when a game has no completed_at.
 */
export function sortGamesByPlayedDesc<
  T extends { completed_at: string | null; created_at: string }
>(games: T[]): T[] {
  return [...games].sort((a, b) =>
    (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at)
  );
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
