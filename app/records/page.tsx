"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PullToRefresh from "@/components/PullToRefresh";
import { computeRecords } from "@/lib/scoring";
import type { Records } from "@/lib/scoring";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RecordsPage() {
  const [records, setRecords] = useState<Records | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [tripsRes, gamesRes] = await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, name, is_demo, player1_id, player2_id, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
        ),
      supabase
        .from("games")
        .select(
          "trip_id, status, winner_player, is_skunk, is_double_skunk, payout_cents, win_weight, player1_score, player2_score, hands_played, completed_at"
        )
        .eq("status", "completed"),
    ]);
    const realTrips = ((tripsRes.data as any[]) ?? []).filter((t) => !t.is_demo);
    setRecords(computeRecords(realTrips, (gamesRes.data as any[]) ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PullToRefresh onRefresh={load}>
    <main className="max-w-md mx-auto px-5 py-10">
      <Link href="/" className="text-sm text-brass-light/60">
        ← Trips
      </Link>
      <header className="text-center mt-2 mb-8">
        <p className="uppercase tracking-[0.35em] text-brass-light/70 text-xs mb-2">
          Skunk Life
        </p>
        <h1 className="font-display italic text-3xl text-track">Records</h1>
        <p className="text-xs text-track/50 mt-2">
          Across every trip, shared by everyone
        </p>
      </header>

      {loading && <p className="text-center text-track/50">Loading…</p>}

      {!loading && records && (
        <div className="space-y-4">
          {records.biggestMargin && (
            <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4">
              <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-1">
                Biggest blowout
              </p>
              <p className="font-display text-lg text-track">
                {records.biggestMargin.winnerName} {records.biggestMargin.winnerScore}–
                {records.biggestMargin.loserScore} {records.biggestMargin.loserName}
              </p>
              <p className="text-xs text-track/50 mt-1">
                {records.biggestMargin.margin}-point margin · {records.biggestMargin.tripName}
                {records.biggestMargin.date ? ` · ${formatDate(records.biggestMargin.date)}` : ""}
              </p>
            </div>
          )}

          {records.closestGame && (
            <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4">
              <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-1">
                Closest game
              </p>
              <p className="font-display text-lg text-track">
                {records.closestGame.winnerName} {records.closestGame.winnerScore}–
                {records.closestGame.loserScore} {records.closestGame.loserName}
              </p>
              <p className="text-xs text-track/50 mt-1">
                {records.closestGame.margin}-point margin · {records.closestGame.tripName}
                {records.closestGame.date ? ` · ${formatDate(records.closestGame.date)}` : ""}
              </p>
            </div>
          )}

          {records.longestGame && (
            <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4">
              <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-1">
                Longest game
              </p>
              <p className="font-display text-lg text-track">
                {records.longestGame.handsPlayed} hand
                {records.longestGame.handsPlayed === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-track/50 mt-1">
                {records.longestGame.winnerName} beat {records.longestGame.loserName} ·{" "}
                {records.longestGame.tripName}
                {records.longestGame.date ? ` · ${formatDate(records.longestGame.date)}` : ""}
              </p>
            </div>
          )}

          {records.skunkiestTrip && (
            <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4">
              <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-1">
                Skunkiest trip
              </p>
              <p className="font-display text-lg text-track">
                {records.skunkiestTrip.playerName} skunked {records.skunkiestTrip.opponentName}{" "}
                {records.skunkiestTrip.skunkCount}×
              </p>
              <p className="text-xs text-track/50 mt-1">{records.skunkiestTrip.tripName}</p>
            </div>
          )}

          {records.streaks.length > 0 && (
            <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4">
              <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-2">
                Current streaks
              </p>
              <div className="space-y-2">
                {records.streaks.map((s) => (
                  <p key={s.key} className="text-sm text-track">
                    <strong className="text-track">{s.playerName}</strong> is on a{" "}
                    <strong className="text-brass-light">{s.length}-game</strong> win
                    streak vs. {s.opponentName}
                    {s.lastPlayedAt && (
                      <span className="text-track/40"> · {formatDate(s.lastPlayedAt)}</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {!records.biggestMargin && (
            <p className="text-center text-track/50 text-sm">
              No completed games yet — records show up once a few trips are in the books.
            </p>
          )}
        </div>
      )}
    </main>
    </PullToRefresh>
  );
}
