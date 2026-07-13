"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import GameLive from "@/components/GameLive";
import NewTripForm from "@/components/NewTripForm";
import NewGameForm from "@/components/NewGameForm";
import LogPastGameForm from "@/components/LogPastGameForm";
import type { PastGamePayload, PhotoChange } from "@/components/LogPastGameForm";
import TripSummary from "@/components/TripSummary";
import TripReview from "@/components/TripReview";
import PhotoThumb from "@/components/PhotoThumb";
import PullToRefresh from "@/components/PullToRefresh";
import { formatCents, computeGameResult, sortGamesByPlayedDesc } from "@/lib/scoring";
import { uploadGamePhoto } from "@/lib/photo";
import type { Game, Trip } from "@/lib/types";

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const [showLogPastGame, setShowLogPastGame] = useState(false);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

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

  function closePastGameForm() {
    setShowLogPastGame(false);
    setEditingGame(null);
  }

  // Handles both logging a brand-new past game and editing an existing one,
  // plus adding/replacing/removing its photo.
  async function submitPastGame(payload: PastGamePayload, photo: PhotoChange) {
    if (!trip) return;
    const result = computeGameResult(
      payload.player1Score,
      payload.player2Score,
      trip.base_amount_cents,
      payload.isTieFlip,
      trip.per_point_cents
    );
    // Fields common to insert and update. `events` is left untouched on edit
    // so a live-pegged game keeps its point-by-point history.
    const fields = {
      player1_score: payload.player1Score,
      player2_score: payload.player2Score,
      status: "completed" as const,
      winner_player: result.winnerPlayer,
      is_skunk: result.isSkunk,
      is_double_skunk: result.isDoubleSkunk,
      is_tie_flip: payload.isTieFlip,
      location: payload.location || null,
      payout_cents: result.payoutCents,
      win_weight: result.winWeight,
      hands_played: payload.handsPlayed,
      created_at: payload.playedAt,
      completed_at: payload.playedAt,
    };

    let saved: Game;
    if (editingGame) {
      const { data, error } = await supabase
        .from("games")
        .update(fields)
        .eq("id", editingGame.id)
        .select()
        .single();
      if (error || !data) throw error ?? new Error("update failed");
      saved = data as Game;
    } else {
      const { data, error } = await supabase
        .from("games")
        .insert({ trip_id: tripId, events: [], ...fields })
        .select()
        .single();
      if (error || !data) throw error ?? new Error("insert failed");
      saved = data as Game;
    }

    // Resolve the photo after the row exists (upload keys off the game id).
    let photoUrl = saved.photo_url;
    if (photo.remove) photoUrl = null;
    if (photo.file) photoUrl = await uploadGamePhoto(saved.id, photo.file);
    if (photoUrl !== saved.photo_url) {
      const { data } = await supabase
        .from("games")
        .update({ photo_url: photoUrl })
        .eq("id", saved.id)
        .select()
        .single();
      if (data) saved = data as Game;
    }

    setGames((prev) => {
      const next = prev.some((x) => x.id === saved.id)
        ? prev.map((x) => (x.id === saved.id ? saved : x))
        : [...prev, saved];
      // Keep chronological (oldest-first) in state; the log view sorts for display.
      return next.sort((a, b) =>
        (a.completed_at ?? a.created_at).localeCompare(b.completed_at ?? b.created_at)
      );
    });
    closePastGameForm();
  }

  async function deletePastGame() {
    if (!editingGame) return;
    const id = editingGame.id;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) throw error;
    supabase.storage.from("game-photos").remove([`${id}.jpg`]);
    setGames((prev) => prev.filter((x) => x.id !== id));
    closePastGameForm();
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

  async function deleteTrip() {
    if (
      !confirm(
        "Delete this trip and every game in it? This can't be undone."
      )
    )
      return;
    setDeleting(true);
    // Clean up game photos first — storage isn't covered by the DB cascade.
    const photoPaths = games
      .filter((g) => g.photo_url)
      .map((g) => `${g.id}.jpg`);
    if (photoPaths.length) {
      await supabase.storage.from("game-photos").remove(photoPaths);
    }
    // Games are removed automatically via the trip_id FK's ON DELETE CASCADE.
    const { error } = await supabase.from("trips").delete().eq("id", tripId);
    if (error) {
      alert(`Couldn't delete the trip: ${error.message}`);
      setDeleting(false);
      return;
    }
    router.push("/");
  }

  if (loading || !trip) {
    return (
      <main className="max-w-md mx-auto px-5 py-10 text-center text-track/50">
        Loading…
      </main>
    );
  }

  return (
    <PullToRefresh onRefresh={loadAll}>
    <main className="max-w-md mx-auto px-5 py-8">
      <Link href="/" className="text-sm text-brass-light/60">
        ← Trips
      </Link>
      <header className="text-center mt-2 mb-6">
        <h1 className="font-display italic text-3xl text-track">{trip.name}</h1>
        <p className="text-xs text-track/50 mt-2">
          Base stake {formatCents(trip.base_amount_cents)} · {trip.per_point_cents}¢/point differential
        </p>
      </header>

      {activeGame ? (
        <GameLive trip={trip} game={activeGame} onGameChange={handleGameChange} />
      ) : showEditTrip ? (
        <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-5">
          <h2 className="font-display text-xl mb-4">Edit trip</h2>
          <NewTripForm
            trip={trip}
            onSaved={(updated) => {
              setTrip(updated);
              setShowEditTrip(false);
            }}
          />
          <button
            onClick={() => setShowEditTrip(false)}
            className="w-full text-center text-sm text-track/50 mt-3"
          >
            Cancel
          </button>
        </div>
      ) : showNewGameForm ? (
        <NewGameForm onStart={startNewGame} onCancel={() => setShowNewGameForm(false)} />
      ) : showLogPastGame ? (
        <LogPastGameForm
          trip={trip}
          onSubmit={submitPastGame}
          onCancel={closePastGameForm}
        />
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => setShowNewGameForm(true)}
            className="w-full bg-brass text-ink font-display font-semibold text-lg py-3 rounded-lg hover:brightness-110 transition-[filter]"
          >
            Deal a new game
          </button>
          <button
            onClick={() => {
              setEditingGame(null);
              setShowLogPastGame(true);
            }}
            className="w-full border border-brass/40 text-brass-light rounded-lg py-2.5 text-sm"
          >
            Log a game already played
          </button>
        </div>
      )}

      <div className="mt-8">
        <TripSummary trip={trip} games={games} />
      </div>

      {games.some((g) => g.photo_url) && (
        <button
          onClick={() => setShowReview(true)}
          className="w-full mt-4 border border-brass/40 text-brass-light rounded-lg py-2.5 text-sm"
        >
          ▶ Trip review
        </button>
      )}

      {showReview && (
        <TripReview
          trip={trip}
          games={games}
          onClose={() => setShowReview(false)}
        />
      )}

      {completedGames.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-2">
            Game log
          </p>
          <div className="space-y-1.5">
            {sortGamesByPlayedDesc(completedGames).map((g) =>
              editingGame?.id === g.id ? (
                <LogPastGameForm
                  key={g.id}
                  trip={trip}
                  game={g}
                  onSubmit={submitPastGame}
                  onDelete={deletePastGame}
                  onCancel={closePastGameForm}
                />
              ) : (
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
                        <PhotoThumb
                          src={g.photo_url}
                          className="w-10 h-10 rounded-md object-cover border border-brass/30"
                        />
                      )}
                      <div className="text-right">
                        <span className="font-score block">{formatCents(g.payout_cents ?? 0)}</span>
                        <button
                          onClick={() => {
                            setShowLogPastGame(false);
                            setShowNewGameForm(false);
                            setEditingGame(g);
                          }}
                          className="text-xs text-brass-light/70 underline underline-offset-2"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {!activeGame && !showEditTrip && (
        <div className="mt-8 space-y-2">
          <button
            onClick={endTrip}
            disabled={ending || deleting}
            className="w-full border border-skunk/50 text-skunk rounded-lg py-2.5 text-sm disabled:opacity-40"
          >
            {ending ? "Ending trip…" : "End trip & archive"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowNewGameForm(false);
                setShowLogPastGame(false);
                setEditingGame(null);
                setShowEditTrip(true);
              }}
              disabled={ending || deleting}
              className="flex-1 border border-brass/40 text-brass-light rounded-lg py-2.5 text-sm disabled:opacity-40"
            >
              Edit trip details
            </button>
            <button
              onClick={deleteTrip}
              disabled={ending || deleting}
              className="flex-1 border border-skunk/50 text-skunk rounded-lg py-2.5 text-sm disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete trip"}
            </button>
          </div>
        </div>
      )}
    </main>
    </PullToRefresh>
  );
}
