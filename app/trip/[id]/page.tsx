"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import GameLive from "@/components/GameLive";
import NewGameForm from "@/components/NewGameForm";
import LogPastGameForm from "@/components/LogPastGameForm";
import TripSummary from "@/components/TripSummary";
import { formatCents, computeGameResult } from "@/lib/scoring";
import type { Game, Trip } from "@/lib/types";

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const [showLogPastGame, setShowLogPastGame] = useState(false);

  async function loadAll() {
    const { data: tripData } = await supabase
      .from("trips")
      .select("*, player1:player1_id(*), player2:player2_id(*)")
      .eq("id", tripId)
      .single();
    setTrip(tripData as unknown as Trip);

    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    setGames((gamesData as Game[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const activeGame = games.find((g) => g.status === "in_progress") ?? null;
  const completedGames = games.filter((g) => g.status === "completed");

  async function startNewGame(opts: { isTieFlip: boolean; location: string }) {
    const { data } = await supabase
      .from("games")
      .insert({
        trip_id: tripId,
        is_tie_flip: opts.isTieFlip,
        location: opts.location || null,
      })
      .select()
      .single();
    if (data) setGames((g) => [...g, data as Game]);
    setShowNewGameForm(false);
  }

  async function logPastGame(payload: {
    player1Score: number;
    player2Score: number;
    isTieFlip: boolean;
    location: string;
    playedAt: string;
  }) {
    if (!trip) return;
    const result = computeGameResult(
      payload.player1Score,
      payload.player2Score,
      trip.base_amount_cents,
      payload.isTieFlip
    );
    const { data } = await supabase
      .from("games")
      .insert({
        trip_id: tripId,
        player1_score: payload.player1Score,
        player2_score: payload.player2Score,
        status: "completed",
        winner_player: result.winnerPlayer,
        is_skunk: result.isSkunk,
        is_double_skunk: result.isDoubleSkunk,
        is_tie_flip: payload.isTieFlip,
        location: payload.location || null,
        payout_cents: result.payoutCents,
        win_weight: result.winWeight,
        events: [],
        created_at: payload.playedAt,
        completed_at: payload.playedAt,
      })
      .select()
      .single();
    if (data) setGames((g) => [...g, data as Game]);
    setShowLogPastGame(false);
  }

  function handleGameChange(updated: Game) {
    setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  async function endTrip() {
    if (!confirm("End this trip and move it to the archive?")) return;
    setEnding(true);
    await supabase
      .from("trips")
      .update({ status: "archived", ended_at: new Date().toISOString() })
      .eq("id", tripId);
    router.push(`/archive/${tripId}`);
  }

  if (loading || !trip) {
    return (
      <main className="max-w-md mx-auto px-5 py-10 text-center text-track/50">
        Loading…
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-5 py-8">
      <Link href="/" className="text-sm text-brass-light/60">
        ← Trips
      </Link>
      <header className="text-center mt-2 mb-6">
        <h1 className="font-display italic text-3xl text-track">{trip.name}</h1>
        <p className="text-xs text-brass-light/60 mt-1">
          {trip.board_name}
          {trip.board_theme ? ` — ${trip.board_theme}` : ""}
        </p>
        <p className="text-xs text-track/50 mt-1">
          Base stake {formatCents(trip.base_amount_cents)} · 10¢/point differential
        </p>
      </header>

      {activeGame ? (
        <GameLive trip={trip} game={activeGame} onGameChange={handleGameChange} />
      ) : showNewGameForm ? (
        <NewGameForm onStart={startNewGame} onCancel={() => setShowNewGameForm(false)} />
      ) : showLogPastGame ? (
        <LogPastGameForm
          trip={trip}
          onSave={logPastGame}
          onCancel={() => setShowLogPastGame(false)}
        />
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => setShowNewGameForm(true)}
            className="w-full bg-brass text-walnut-deep font-display font-semibold text-lg py-3 rounded-lg hover:bg-brass-light transition-colors"
          >
            Deal a new game
          </button>
          <button
            onClick={() => setShowLogPastGame(true)}
            className="w-full border border-brass/40 text-brass-light rounded-lg py-2.5 text-sm"
          >
            Log a game already played
          </button>
        </div>
      )}

      <div className="mt-8">
        <TripSummary trip={trip} games={games} />
      </div>

      {completedGames.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-2">
            Game log
          </p>
          <div className="space-y-1.5">
            {[...completedGames].reverse().map((g) => (
              <div
                key={g.id}
                className="text-sm text-track/70 border-b border-brass/10 pb-1.5"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <span>
                      {g.winner_player === 1 ? trip.player1?.name : trip.player2?.name} won{" "}
                      {Math.max(g.player1_score, g.player2_score)}–
                      {Math.min(g.player1_score, g.player2_score)}
                      {g.is_double_skunk ? " (double skunk)" : g.is_skunk ? " (skunk)" : ""}
                      {g.is_tie_flip ? " ×2" : ""}
                    </span>
                    <p className="text-xs text-track/40">
                      {g.completed_at
                        ? new Date(g.completed_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                      {g.location ? ` · ${g.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {g.photo_url && (
                      <img
                        src={g.photo_url}
                        alt=""
                        className="w-10 h-10 rounded-md object-cover border border-brass/30"
                      />
                    )}
                    <span className="font-score">{formatCents(g.payout_cents ?? 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activeGame && (
        <button
          onClick={endTrip}
          disabled={ending}
          className="w-full mt-8 border border-skunk/50 text-skunk rounded-lg py-2.5 text-sm disabled:opacity-40"
        >
          {ending ? "Ending trip…" : "End trip & archive"}
        </button>
      )}
    </main>
  );
}
