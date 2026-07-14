"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PeggingBoard from "@/components/PeggingBoard";
import PhotoThumb from "@/components/PhotoThumb";
import { computeGameResult, WINNING_SCORE } from "@/lib/scoring";
import { uploadGamePhoto } from "@/lib/photo";
import { enqueuePhoto } from "@/lib/uploadQueue";
import {
  saveGameSnapshot,
  getGameSnapshot,
  clearGameSnapshot,
  pushGameSnapshot,
  flushGameSnapshots,
  type GameSnapshot,
} from "@/lib/gameSync";
import { getCurrentCoords } from "@/lib/geo";
import type { Coords } from "@/lib/geo";
import type { Game, ScoreEvent, Trip } from "@/lib/types";

// The scoring columns we own and sync (photo/location sync separately).
function snapshotOf(g: Game): GameSnapshot {
  return {
    player1_score: g.player1_score,
    player2_score: g.player2_score,
    events: g.events,
    status: g.status,
    winner_player: g.winner_player,
    is_skunk: g.is_skunk,
    is_double_skunk: g.is_double_skunk,
    payout_cents: g.payout_cents,
    win_weight: g.win_weight,
    completed_at: g.completed_at,
    hands_played: g.hands_played,
  };
}

const QUICK_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14];

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
  game: gameProp,
  onGameChange,
  onNextGame,
  onDismiss,
}: {
  trip: Trip;
  game: Game;
  onGameChange: (g: Game) => void;
  // Shown on the game-over summary so players can move on from the final board.
  onNextGame?: () => void;
  onDismiss?: () => void;
}) {
  // Local-first: `game` is the on-device source of truth for the live game so
  // taps land instantly and keep working offline. Changes are persisted and
  // synced to Supabase in the background (see mutate / gameSync).
  const [game, setGame] = useState<Game>(gameProp);
  const gameRef = useRef<Game>(gameProp);
  gameRef.current = game;
  // True while we have local taps not yet confirmed by the server.
  const pendingRef = useRef(false);
  const [syncPending, setSyncPending] = useState(false);
  const [online, setOnline] = useState(true);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoQueued, setPhotoQueued] = useState(false);
  const [queuedPreview, setQueuedPreview] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const P1_COLOR = "#F27A21"; // Safety Orange
  const P2_COLOR = "#197B8F"; // Trail Blue
  const P2_NUM = "#2FA7BE"; // brighter teal for the big number

  // On open, restore any locally-pending snapshot (taps made while offline that
  // haven't synced yet) so we don't show stale server scores over them — then
  // try to sync it immediately if we're online.
  useEffect(() => {
    let alive = true;
    (async () => {
      const snap = await getGameSnapshot(gameProp.id);
      if (!alive || !snap) return;
      pendingRef.current = true;
      setSyncPending(true);
      setGame((prev) => ({ ...prev, ...snap }));
      if (navigator.onLine) {
        const ok = await pushGameSnapshot(gameProp.id, snap);
        if (ok && alive) {
          await clearGameSnapshot(gameProp.id);
          pendingRef.current = false;
          setSyncPending(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [gameProp.id]);

  // Accept fresh data from the parent (reload / realtime) only when we have no
  // unsynced local taps — otherwise our local scores would be clobbered.
  useEffect(() => {
    if (!pendingRef.current) setGame(gameProp);
  }, [gameProp]);

  // Track connectivity and drain pending snapshots when it returns.
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = async () => {
      setOnline(true);
      await flushGameSnapshots();
      const still = await getGameSnapshot(gameProp.id);
      if (!still) {
        pendingRef.current = false;
        setSyncPending(false);
      }
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [gameProp.id]);

  // Subscribe to realtime updates so other phones stay in sync — but ignore
  // them while we hold unsynced local taps.
  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameProp.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameProp.id}` },
        (payload) => {
          if (pendingRef.current) return;
          setGame(payload.new as Game);
          onGameChange(payload.new as Game);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameProp.id]);

  // Apply a scoring change locally (instant), persist it, and try to sync.
  async function mutate(fields: Partial<Game>) {
    const next = { ...gameRef.current, ...fields } as Game;
    gameRef.current = next; // so rapid successive taps read the latest events
    setGame(next);
    onGameChange(next); // keep the parent's copy optimistic too

    const snap = snapshotOf(next);
    pendingRef.current = true;
    await saveGameSnapshot(next.id, snap);
    const ok = await pushGameSnapshot(next.id, snap);
    // Only settle if no newer tap arrived while this push was in flight — the
    // later mutate owns clearing/settling in that case.
    if (ok && gameRef.current === next) {
      await clearGameSnapshot(next.id);
      pendingRef.current = false;
      setSyncPending(false);
    } else if (!ok) {
      setSyncPending(true);
    }
  }

  function addPoints(player: 1 | 2, points: number) {
    const g = gameRef.current;
    if (g.status !== "in_progress") return;
    const events = [...g.events, { player, points, at: new Date().toISOString() } as ScoreEvent];
    // Cribbage tops out at 121 — clamp so a final tap can't overshoot.
    const p1 = Math.min(WINNING_SCORE, scoreFromEvents(events, 1));
    const p2 = Math.min(WINNING_SCORE, scoreFromEvents(events, 2));

    const gameOver = p1 >= WINNING_SCORE || p2 >= WINNING_SCORE;

    if (!gameOver) {
      mutate({ player1_score: p1, player2_score: p2, events });
      return;
    }

    const result = computeGameResult(
      p1,
      p2,
      trip.base_amount_cents,
      g.is_tie_flip,
      trip.per_point_cents
    );
    mutate({
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
    });
  }

  function undo() {
    const g = gameRef.current;
    if (g.events.length === 0) return;
    const events = g.events.slice(0, -1);
    const p1 = scoreFromEvents(events, 1);
    const p2 = scoreFromEvents(events, 2);
    mutate({
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
    });
  }

  // Nudge one player's score by ±1 to fix a mis-count, recorded as a point
  // event so undo/history stay consistent. A +1 that reaches 121 completes the
  // game; a −1 pulls a completed game back to in-progress.
  function adjustScore(player: 1 | 2, delta: 1 | -1) {
    const g = gameRef.current;
    const current = scoreFromEvents(g.events, player);
    if (delta < 0 && current <= 0) return; // don't go below zero
    const events = [
      ...g.events,
      { player, points: delta, at: new Date().toISOString() } as ScoreEvent,
    ];
    const p1 = Math.min(WINNING_SCORE, scoreFromEvents(events, 1));
    const p2 = Math.min(WINNING_SCORE, scoreFromEvents(events, 2));
    const gameOver = delta > 0 && (p1 >= WINNING_SCORE || p2 >= WINNING_SCORE);

    if (gameOver) {
      const result = computeGameResult(
        p1,
        p2,
        trip.base_amount_cents,
        g.is_tie_flip,
        trip.per_point_cents
      );
      mutate({
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
      });
    } else {
      mutate({
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
      });
    }
  }

  // Save the picked photo for later upload (offline or on failure).
  async function queuePhoto(file: File, coords: Coords | null): Promise<boolean> {
    const ok = await enqueuePhoto(game.id, file, coords);
    if (ok) {
      setQueuedPreview(URL.createObjectURL(file));
      setPhotoQueued(true);
    }
    return ok;
  }

  async function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPhotoQueued(false);

    // Grab where this photo was taken so it can pin on the trip-review map.
    // Never blocks the upload — a missing fix just means no pin.
    const coords = await getCurrentCoords();

    // Offline: don't even try — stash it and it'll upload when back online.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const ok = await queuePhoto(file, coords);
      if (!ok) setPhotoError("You're offline and this photo couldn't be saved to retry.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const photoUrl = await uploadGamePhoto(game.id, file);
      const patch: Partial<Game> = { photo_url: photoUrl };
      if (coords) {
        patch.latitude = coords.latitude;
        patch.longitude = coords.longitude;
      }
      const { data } = await supabase
        .from("games")
        .update(patch)
        .eq("id", game.id)
        .select()
        .single();
      if (data) {
        setGame((prev) => ({ ...prev, photo_url: (data as Game).photo_url }));
        onGameChange(data as Game);
      }
    } catch (err) {
      // Likely a dropped connection mid-upload — queue it to retry rather than lose it.
      const ok = await queuePhoto(file, coords);
      if (!ok) {
        const msg = err instanceof Error ? err.message : String(err);
        setPhotoError(`Couldn't upload that photo — ${msg}`);
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Record how many hands (deals) this game took — powers the recap and the
  // all-time per-hand stats.
  function setHands(value: string) {
    const n = parseInt(value, 10);
    const hands = Number.isFinite(n) && n > 0 ? n : null;
    if (hands === gameRef.current.hands_played) return;
    mutate({ hands_played: hands });
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
      {(!online || syncPending) && (
        <p className="text-center text-xs rounded-lg py-1.5 border border-brass/30 bg-brass/10 text-brass-light">
          {online
            ? "Syncing scores…"
            : "Offline — scores are saved on this phone and sync when you reconnect."}
        </p>
      )}

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
        <div
          className="text-center rounded-xl border-2 bg-walnut-light/10 py-5 px-4"
          style={{ borderColor: game.winner_player === 1 ? P1_COLOR : P2_NUM }}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-brass-light/70">
            Game over
          </p>
          <p
            className="font-display text-4xl leading-tight mt-1"
            style={{ color: game.winner_player === 1 ? P1_COLOR : P2_NUM }}
          >
            🏆 {game.winner_player === 1 ? p1Name : p2Name} wins
          </p>
          <p className="font-score text-2xl text-track mt-1">
            {Math.max(game.player1_score, game.player2_score)}–
            {Math.min(game.player1_score, game.player2_score)}
          </p>
          {(game.is_double_skunk || game.is_skunk || game.is_tie_flip) && (
            <p className="text-sm text-skunk font-semibold mt-1">
              {game.is_double_skunk
                ? "DOUBLE SKUNK"
                : game.is_skunk
                ? "SKUNK"
                : ""}
              {(game.is_double_skunk || game.is_skunk) && game.is_tie_flip
                ? " · "
                : ""}
              {game.is_tie_flip ? "DOUBLE ODDS" : ""}
            </p>
          )}

          <div className="mt-4">
            {game.photo_url ? (
              <PhotoThumb
                src={game.photo_url}
                alt="Winner's photo"
                className="mx-auto rounded-lg max-h-64 border border-brass/30"
              />
            ) : photoQueued ? (
              <div>
                {queuedPreview && (
                  <img
                    src={queuedPreview}
                    alt="Photo waiting to upload"
                    className="mx-auto rounded-lg max-h-64 border border-brass/30 opacity-80"
                  />
                )}
                <p className="text-xs text-brass-light/80 mt-2">
                  📶 Saved — uploads when you're back online
                </p>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
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

          {/* Recap: hands played + points per hand */}
          <div className="mt-4 pt-3 border-t border-brass/20">
            <div className="flex items-center justify-center gap-2 text-sm text-track/70">
              <label htmlFor="hands-played">Hands this game</label>
              <input
                id="hands-played"
                inputMode="numeric"
                defaultValue={game.hands_played ?? ""}
                onBlur={(e) => setHands(e.target.value)}
                placeholder="—"
                className="w-16 bg-walnut-deep border border-brass/30 rounded-md px-2 py-1 text-center font-score text-track"
              />
            </div>
            {game.hands_played && game.hands_played > 0 && (
              <p className="text-xs text-track/50 text-center mt-2">
                {game.hands_played} hand{game.hands_played === 1 ? "" : "s"} ·{" "}
                {p1Name} {(Math.min(game.player1_score, WINNING_SCORE) / game.hands_played).toFixed(1)} ·{" "}
                {p2Name} {(Math.min(game.player2_score, WINNING_SCORE) / game.hands_played).toFixed(1)} pts/hand
              </p>
            )}
          </div>

          {(onNextGame || onDismiss) && (
            <div className="mt-5 flex gap-2">
              {onNextGame && (
                <button
                  onClick={onNextGame}
                  className="flex-1 bg-brass text-ink font-display font-semibold rounded-lg py-2.5 hover:brightness-110 transition-[filter]"
                >
                  Deal next game
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="flex-1 border border-brass/40 text-brass-light rounded-lg py-2.5 text-sm"
                >
                  Done
                </button>
              )}
            </div>
          )}
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
                    onClick={() => addPoints(player, pts)}
                    className="bg-walnut-light/30 hover:bg-brass hover:text-ink border border-brass/30 rounded-md py-2 text-sm font-score disabled:opacity-40"
                  >
                    +{pts}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={undo}
          disabled={game.events.length === 0}
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
                      disabled={score <= 0}
                      className="w-9 h-9 rounded-md border border-brass/40 bg-walnut-light/20 text-track text-lg leading-none disabled:opacity-30"
                      aria-label={`Remove one point from ${name}`}
                    >
                      −
                    </button>
                    <span className="font-score text-lg w-8 text-center">{score}</span>
                    <button
                      onClick={() => adjustScore(player, 1)}
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
