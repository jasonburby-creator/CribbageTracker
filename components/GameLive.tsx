"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PeggingBoard from "@/components/PeggingBoard";
import { computeGameResult, WINNING_SCORE } from "@/lib/scoring";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const MAX_PHOTO_BYTES = 1_000_000; // 1MB

  function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function drawAtSize(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  }

  function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("compression failed"))),
        "image/jpeg",
        quality
      );
    });
  }

  // Compresses to under MAX_PHOTO_BYTES: first steps quality down at a fixed
  // size, then shrinks dimensions further and repeats, until under budget
  // or we hit a sane floor.
  async function compressImage(file: File): Promise<Blob> {
    const img = await loadImage(file);
    const dims = [1600, 1200, 1000, 800, 600, 400];
    let lastBlob: Blob | null = null;
    for (const maxDim of dims) {
      const canvas = drawAtSize(img, maxDim);
      for (const quality of [0.8, 0.65, 0.5, 0.35, 0.2]) {
        const blob = await canvasToBlob(canvas, quality);
        lastBlob = blob;
        if (blob.size <= MAX_PHOTO_BYTES) {
          return blob;
        }
      }
    }
    // Fell through every step — return the smallest we managed.
    return lastBlob as Blob;
  }

  async function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const path = `${game.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("game-photos")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from("game-photos")
        .getPublicUrl(path);
      const photoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
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

  return (
    <div className="space-y-6">
      <PeggingBoard
        player1Name={p1Name}
        player2Name={p2Name}
        player1Score={game.player1_score}
        player2Score={game.player2_score}
        player1Prev={p1Prev}
        player2Prev={p2Prev}
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
                    className="bg-walnut-light/30 hover:bg-brass hover:text-walnut-deep border border-brass/30 rounded-md py-2 text-sm font-score disabled:opacity-40"
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
                  className="px-3 rounded-md bg-brass/80 text-walnut-deep text-sm font-medium disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={undo}
        disabled={busy || game.events.length === 0}
        className="w-full text-sm text-track/60 border border-brass/20 rounded-lg py-2 disabled:opacity-30"
      >
        ↺ Undo last point
      </button>
    </div>
  );
}
