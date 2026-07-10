"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PeggingBoard from "@/components/PeggingBoard";
import { computeGameResult, WINNING_SCORE } from "@/lib/scoring";
import { uploadGamePhoto } from "@/lib/photo";
import type { Game, ScoreEvent, Trip } from "@/lib/types";

const QUICK_POINTS = [1, 2, 3, 4, 6, 8, 12, 15, 24];

function scoreFromEvents(events: ScoreEvent[], player: 1 | 2) {
  return events
    .filter((e) => e.player === player)
    .reduce((sum, e) => sum + e.points, 0);
}

function prevScoreFromEvents(events: ScoreEvent[], player: 1 | 2) {
  const playerEvents = events.filter((e) => e.player === player);
  if (playerEvents.length === 0) return 0;
  const withoutLast = playerEvents.slice(0, -1);
  return withoutLast.reduce((sum, e) => sum + e.points, 0);
}

export default function GameLive({
  trip,
  game,
  onGameChange,
}: {
  trip: Trip;
  game: Game;
  onGameChange: (g: Game) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [customValue, setCustomValue] = useState<{ [k: string]: string }>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const P1_COLOR = "#F27A21"; // Safety Orange
  const P2_COLOR = "#197B8F"; // Trail Blue
  const P2_NUM = "#2FA7BE"; // brighter teal for the big number

  // Subscribe to realtime updates on this game so other phones stay in sync
  useEffect(() => {
    const channel = supabase
      .channel(`game-${game.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        (payload) => {
          onGameChange(payload.new as Game);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  async function addPoints(player: 1 | 2, points: number) {
    if (busy || game.status !== "in_progress") return;
    setBusy(true);
    const events = [...game.events, { player, points, at: new Date().toISOString() } as ScoreEvent];
    const p1 = scoreFromEvents(events, 1);
    const p2 = scoreFromEvents(events, 2);

    const gameOver = p1 >= WINNING_SCORE || p2 >= WINNING_SCORE;

    if (!gameOver) {
      const { data } = await supabase
        .from("games")
        .update({ player1_score: p1, player2_score: p2, events })
        .eq("id", game.id)
        .select()
        .single();
      if (data) onGameChange(data as Game);
      setBusy(false);
      return;
    }

    const result = computeGameResult(
      p1,
      p2,
      trip.base_amount_cents,
      game.is_tie_flip,
      trip.per_point_cents
    );
    const { data } = await supabase
      .from("games")
      .update({
        player1_score: p1,
        player2_score: p2,
        events,
        status: "completed",
        winner_player: result.winnerPlayer,
        is_skunk: result.isSkunk,
        is_double_skunk: result.isDoubleSkunk,
        payout_cents: result.payoutCents,
        win_weight: result.winWeight,
        completed_at: new Date().toISOString(),
      })
      .eq("id", game.id)
      .select()
      .single();
    if (data) onGameChange(data as Game);
    setBusy(false);
  }

  async function undo() {
    if (busy || game.events.length === 0) return;
    setBusy(true);
    const events = game.events.slice(0, -1);
    const p1 = scoreFromEvents(events, 1);
    const p2 = scoreFromEvents(events, 2);
    const { data } = await supabase
      .from("games")
      .update({
        player1_score: p1,
        player2_score: p2,
        events,
        status: "in_progress",
        winner_player: null,
        is_skunk: false,
        is_double_skunk: false,
        payout_cents: null,
        win_weight: null,
        completed_at: null,
        photo_url: null,
      })
      .eq("id", game.id)
      .select()
      .single();
    if (data) onGameChange(data as Game);
    setBusy(false);
  }

  // Nudge one player's score by ±1 to fix a mis-count, recorded as a point
  // event so undo/history stay consistent. A +1 that reaches 121 completes the
  // game; a −1 pulls a completed game back to in-progress.
  async function adjustScore(player: 1 | 2, delta: 1 | -1) {
    if (busy) return;
    const current = scoreFromEvents(game.events, player);
    if (delta < 0 && current <= 0) return; // don't go below zero
    setBusy(true);
    const events = [
      ...game.events,
      { player, points: delta, at: new Date().toISOString() } as ScoreEvent,
    ];
    const p1 = scoreFromEvents(events, 1);
    const p2 = scoreFromEvents(events, 2);
    const gameOver = delta > 0 && (p1 >= WINNING_SCORE || p2 >= WINNING_SCORE);

    const base = { player1_score: p1, player2_score: p2, events };
    const update = gameOver
      ? (() => {
          const result = computeGameResult(
            p1,
            p2,
            trip.base_amount_cents,
            game.is_tie_flip,
            trip.per_point_cents
          );
          return {
            ...base,
            status: "completed" as const,
            winner_player: result.winnerPlayer,
            is_skunk: result.isSkunk,
            is_double_skunk: result.isDoubleSkunk,
            payout_cents: result.payoutCents,
            win_weight: result.winWeight,
            completed_at: new Date().toISOString(),
          };
        })()
      : {
          ...base,
          status: "in_progress" as const,
          winner_player: null,
          is_skunk: false,
          is_double_skunk: false,
          payout_cents: null,
          win_weight: null,
          completed_at: null,
        };

    const { data } = await supabase
      .from("games")
      .update(update)
      .eq("id", game.id)
      .select()
      .single();
    if (data) onGameChange(data as Game);
    setBusy(false);
  }

  async function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const photoUrl = await uploadGamePhoto(game.id, file);
      const { data } = await supabase
        .from("games")
        .update({ photo_url: photoUrl })
        .eq("id", game.id)
        .select()
        .single();
      if (data) onGameChange(data as Game);
    } catch (err) {
      setPhotoError("Couldn't upload that photo — try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const p1Name = trip.player1?.name ?? "Player 1";
  const p2Name = trip.player2?.name ?? "Player 2";
  const p1Prev = prevScoreFromEvents(game.events, 1);
  const p2Prev = prevScoreFromEvents(game.events, 2);

  const bigScores = [
    { name: p1Name, score: game.player1_score, dot: P1_COLOR, num: P1_COLOR },
    { name: p2Name, score: game.player2_score, dot: P2_COLOR, num: P2_NUM },
  ];

  return (
    <div className="space-y-6">
      {/* big, prominent scores */}
      <div className="grid grid-cols-2 gap-3">
        {bigScores.map((s) => (
          <div
            key={s.name}
            className="rounded-2xl border border-brass/25 bg-walnut-light/10 px-2 pt-3 pb-2.5 text-center"
          >
            <p className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.18em] text-brass-light/80">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.dot }} />
              {s.name}
            </p>
            <p className="font-score text-6xl leading-none mt-1" style={{ color: s.num }}>
              {s.score}
            </p>
            <div className="h-1 rounded-full mx-auto mt-2 w-3/4" style={{ backgroundColor: s.dot }} />
          </div>
        ))}
      </div>

      <PeggingBoard
        player1Name={p1Name}
        player2Name={p2Name}
        player1Score={game.player1_score}
        player2Score={game.player2_score}
        player1Prev={p1Prev}
        player2Prev={p2Prev}
        boardName={trip.board_name}
      />

      {game.is_tie_flip && game.status === "in_progress" && (
        <p className="text-center text-xs uppercase tracking-widest text-brass-light bg-brass/10 border border-brass/30 rounded-lg py-1.5">
          🎴 Tied cut — double odds this game
        </p>
      )}

      {game.status === "completed" ? (
        <div className="text-center rounded-xl border border-brass/40 bg-walnut-light/10 py-4 px-4">
          <p className="font-display text-2xl text-brass-light">
            {game.winner_player === 1 ? p1Name : p2Name} wins
            {game.is_double_skunk ? " — double skunk!" : game.is_skunk ? " — skunk!" : ""}
            {game.is_tie_flip ? " (double odds)" : ""}
          </p>

          <div className="mt-4">
            {game.photo_url ? (
              <img
                src={game.photo_url}
                alt="Winner's photo"
                className="mx-auto rounded-lg max-h-64 border border-brass/30"
              />
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="text-sm border border-brass/40 text-brass-light rounded-lg px-4 py-2 disabled:opacity-40"
                >
                  {uploadingPhoto
                    ? "Uploading…"
                    : `📸 ${game.winner_player === 1 ? p1Name : p2Name} adds a photo`}
                </button>
                {photoError && <p className="text-xs text-skunk mt-1">{photoError}</p>}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {([1, 2] as const).map((player) => (
            <div key={player} className="space-y-2">
              <p className="text-center text-sm text-track/70">
                {player === 1 ? p1Name : p2Name}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {QUICK_POINTS.map((pts) => (
                  <button
                    key={pts}
                    disabled={busy}
                    onClick={() => addPoints(player, pts)}
                    className="bg-walnut-light/30 hover:bg-brass hover:text-ink border border-brass/30 rounded-md py-2 text-sm font-score disabled:opacity-40"
                  >
                    +{pts}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={customValue[player] ?? ""}
                  onChange={(e) =>
                    setCustomValue((v) => ({ ...v, [player]: e.target.value }))
                  }
                  placeholder="#"
                  inputMode="numeric"
                  className="w-full bg-walnut-deep border border-brass/30 rounded-md px-2 py-1.5 text-sm text-track"
                />
                <button
                  disabled={busy}
                  onClick={() => {
                    const n = parseInt(customValue[player] ?? "", 10);
                    if (n > 0) {
                      addPoints(player, n);
                      setCustomValue((v) => ({ ...v, [player]: "" }));
                    }
                  }}
                  className="px-3 rounded-md bg-brass/80 text-ink text-sm font-medium disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={undo}
          disabled={busy || game.events.length === 0}
          className="w-full text-sm text-track/60 border border-brass/20 rounded-lg py-2 disabled:opacity-30"
        >
          ↺ Undo last point
        </button>
        <button
          onClick={() => setShowAdjust((v) => !v)}
          className="w-full text-sm text-track/60 border border-brass/20 rounded-lg py-2"
        >
          ⚙ Adjust score
        </button>

        {showAdjust && (
          <div className="rounded-lg border border-brass/25 bg-walnut-light/10 p-3 space-y-1">
            {([1, 2] as const).map((player) => {
              const name = player === 1 ? p1Name : p2Name;
              const score = player === 1 ? game.player1_score : game.player2_score;
              const color = player === 1 ? P1_COLOR : P2_COLOR;
              return (
                <div
                  key={player}
                  className="flex items-center justify-between py-1 border-b border-brass/10 last:border-0"
                >
                  <span className="flex items-center gap-2 text-sm text-track">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {name}
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      onClick={() => adjustScore(player, -1)}
                      disabled={busy || score <= 0}
                      className="w-9 h-9 rounded-md border border-brass/40 bg-walnut-light/20 text-track text-lg leading-none disabled:opacity-30"
                      aria-label={`Remove one point from ${name}`}
                    >
                      −
                    </button>
                    <span className="font-score text-lg w-8 text-center">{score}</span>
                    <button
                      onClick={() => adjustScore(player, 1)}
                      disabled={busy}
                      className="w-9 h-9 rounded-md border border-brass/40 bg-walnut-light/20 text-track text-lg leading-none disabled:opacity-30"
                      aria-label={`Add one point to ${name}`}
                    >
                      +
                    </button>
                  </span>
                </div>
              );
            })}
            <p className="text-xs text-track/50 text-center pt-1">
              Nudge a score by one to fix a mis-count.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
