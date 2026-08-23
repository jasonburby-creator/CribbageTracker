import { computeTripSummary, formatCents, WINNING_SCORE } from "@/lib/scoring";
import type { Game, Trip } from "@/lib/types";

export type RecapPhoto = { url: string; caption: string };

export type MarginStat = {
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
};

export type LongestGameStat = {
  winnerName: string;
  loserName: string;
  handsPlayed: number;
};

export type RecapData = {
  tripName: string;
  dateRange: string;
  player1Name: string;
  player2Name: string;
  gamesPlayed: number;
  player1Wins: number;
  player2Wins: number;
  owesLine: string | null;
  biggestMargin: MarginStat | null;
  longestGame: LongestGameStat | null;
  skunkCount: number;
  heroPhoto: RecapPhoto | null;
};

function formatDateRange(trip: Trip, games: Game[]): string {
  const start = new Date(trip.created_at);
  const completedDates = games
    .map((g) => g.completed_at)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime());
  const endMs = trip.ended_at
    ? new Date(trip.ended_at).getTime()
    : completedDates.length
    ? Math.max(...completedDates)
    : start.getTime();
  const end = new Date(endMs);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, {
    ...opts,
    year: "numeric",
  })}`;
}

// Everything the recap card, story cards, and highlight video all need,
// computed once from a single trip's games.
export function buildRecapData(trip: Trip, games: Game[]): RecapData {
  const completed = games.filter((g) => g.status === "completed" && g.winner_player);
  const summary = computeTripSummary(games);
  const p1Name = trip.player1?.name ?? "Player 1";
  const p2Name = trip.player2?.name ?? "Player 2";

  const netCents = summary.player1.netCents;
  const owesLine =
    netCents === 0
      ? null
      : netCents < 0
      ? `${p1Name} owes ${p2Name} ${formatCents(Math.abs(netCents))}`
      : `${p2Name} owes ${p1Name} ${formatCents(Math.abs(netCents))}`;

  let biggestMargin: MarginStat | null = null;
  let longestGame: LongestGameStat | null = null;
  let skunkCount = 0;
  let heroPhoto: RecapPhoto | null = null;
  let heroMargin = -1;
  let mostRecentPhotoGame: Game | null = null;

  for (const g of completed) {
    const winnerName = g.winner_player === 1 ? p1Name : p2Name;
    const loserName = g.winner_player === 1 ? p2Name : p1Name;
    const winnerScore = Math.min(WINNING_SCORE, Math.max(g.player1_score, g.player2_score));
    const loserScore = Math.min(g.player1_score, g.player2_score);
    const margin = winnerScore - loserScore;

    if (!biggestMargin || margin > biggestMargin.winnerScore - biggestMargin.loserScore) {
      biggestMargin = { winnerName, loserName, winnerScore, loserScore };
    }
    if (g.hands_played && g.hands_played > 0) {
      if (!longestGame || g.hands_played > longestGame.handsPlayed) {
        longestGame = { winnerName, loserName, handsPlayed: g.hands_played };
      }
    }
    if (g.is_skunk || g.is_double_skunk) skunkCount += 1;

    if (g.photo_url) {
      if (margin > heroMargin) {
        heroMargin = margin;
        const badge = g.is_double_skunk ? " · double skunk" : g.is_skunk ? " · skunk" : "";
        heroPhoto = {
          url: g.photo_url,
          caption: `${winnerName} won ${winnerScore}–${loserScore}${badge}`,
        };
      }
      if (
        !mostRecentPhotoGame ||
        (g.completed_at ?? "") > (mostRecentPhotoGame.completed_at ?? "")
      ) {
        mostRecentPhotoGame = g;
      }
    }
  }

  // Fall back to the most recent photo if no game with a photo had a
  // meaningful margin recorded yet (heroMargin stays -1 only if no photos at all).
  const fallbackPhotoUrl = mostRecentPhotoGame?.photo_url;
  if (!heroPhoto && mostRecentPhotoGame && fallbackPhotoUrl) {
    const g = mostRecentPhotoGame;
    const winnerName = g.winner_player === 1 ? p1Name : p2Name;
    const loserName = g.winner_player === 1 ? p2Name : p1Name;
    heroPhoto = {
      url: fallbackPhotoUrl,
      caption: `${winnerName} beat ${loserName}`,
    };
  }

  return {
    tripName: trip.name,
    dateRange: formatDateRange(trip, games),
    player1Name: p1Name,
    player2Name: p2Name,
    gamesPlayed: summary.gamesPlayed,
    player1Wins: summary.player1.wins,
    player2Wins: summary.player2.wins,
    owesLine,
    biggestMargin,
    longestGame,
    skunkCount,
    heroPhoto,
  };
}
