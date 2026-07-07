"use client";

import { useState } from "react";
import { computeGameResult } from "@/lib/scoring";
import type { Trip } from "@/lib/types";

function toLocalDatetimeInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function LogPastGameForm({
  trip,
  onSave,
  onCancel,
}: {
  trip: Trip;
  onSave: (payload: {
    player1Score: number;
    player2Score: number;
    isTieFlip: boolean;
    location: string;
    playedAt: string;
  }) => void;
  onCancel: () => void;
}) {
  const [p1Score, setP1Score] = useState("");
  const [p2Score, setP2Score] = useState("");
  const [isTieFlip, setIsTieFlip] = useState(false);
  const [location, setLocation] = useState("");
  const [playedAt, setPlayedAt] = useState(toLocalDatetimeInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);

  const s1 = parseInt(p1Score, 10);
  const s2 = parseInt(p2Score, 10);
  const validScores =
    !isNaN(s1) && !isNaN(s2) && s1 >= 0 && s2 >= 0 && s1 !== s2 && Math.max(s1, s2) >= 121;

  const preview =
    validScores && trip
      ? computeGameResult(s1, s2, trip.base_amount_cents, isTieFlip, trip.per_point_cents)
      : null;

  function handleSubmit() {
    if (!validScores) {
      setError("Enter final scores — one player must have reached exactly 121.");
      return;
    }
    setError(null);
    onSave({
      player1Score: s1,
      player2Score: s2,
      isTieFlip,
      location: location.trim(),
      playedAt: new Date(playedAt).toISOString(),
    });
  }

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-5 space-y-4">
      <h2 className="font-display text-xl">Log a past game</h2>
      <p className="text-xs text-track/50">
        For a game you already finished playing — enter the final score
        instead of pegging it live.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
            {trip.player1?.name ?? "Player 1"}
          </label>
          <input
            value={p1Score}
            onChange={(e) => setP1Score(e.target.value)}
            inputMode="numeric"
            placeholder="121"
            className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track text-center font-score text-lg"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
            {trip.player2?.name ?? "Player 2"}
          </label>
          <input
            value={p2Score}
            onChange={(e) => setP2Score(e.target.value)}
            inputMode="numeric"
            placeholder="87"
            className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track text-center font-score text-lg"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          When was this played?
        </label>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          Where (optional)
        </label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="The finca terrace"
          className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isTieFlip}
          onChange={(e) => setIsTieFlip(e.target.checked)}
          className="mt-1 w-4 h-4 accent-[#B08D57]"
        />
        <span className="text-sm text-track">
          <span className="block">Cut for deal was a tie — double odds</span>
        </span>
      </label>

      {preview && (
        <p className="text-xs text-brass-light/70 text-center">
          {preview.winnerPlayer === 1 ? trip.player1?.name : trip.player2?.name} wins
          {preview.isDoubleSkunk ? " (double skunk)" : preview.isSkunk ? " (skunk)" : ""} —{" "}
          {(preview.payoutCents / 100).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </p>
      )}

      {error && <p className="text-skunk text-sm text-center">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-brass/30 text-track/60 rounded-lg py-2.5 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-brass text-walnut-deep font-display font-semibold rounded-lg py-2.5"
        >
          Save game
        </button>
      </div>
    </div>
  );
}
