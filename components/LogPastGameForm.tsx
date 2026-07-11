"use client";

import { useRef, useState } from "react";
import { computeGameResult } from "@/lib/scoring";
import PhotoThumb from "@/components/PhotoThumb";
import type { Game, Trip } from "@/lib/types";

function toLocalDatetimeInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export type PastGamePayload = {
  player1Score: number;
  player2Score: number;
  isTieFlip: boolean;
  location: string;
  playedAt: string;
  handsPlayed: number | null;
};

export type PhotoChange = {
  file: File | null; // a newly picked photo to upload
  remove: boolean; // clear the existing photo
};

export default function LogPastGameForm({
  trip,
  game,
  onSubmit,
  onDelete,
  onCancel,
}: {
  trip: Trip;
  game?: Game;
  onSubmit: (payload: PastGamePayload, photo: PhotoChange) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const editing = !!game;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [p1Score, setP1Score] = useState(
    game ? String(game.player1_score) : ""
  );
  const [p2Score, setP2Score] = useState(
    game ? String(game.player2_score) : ""
  );
  const [isTieFlip, setIsTieFlip] = useState(game?.is_tie_flip ?? false);
  const [location, setLocation] = useState(game?.location ?? "");
  const [handsPlayed, setHandsPlayed] = useState(
    game?.hands_played != null ? String(game.hands_played) : ""
  );
  const [playedAt, setPlayedAt] = useState(
    toLocalDatetimeInputValue(
      new Date(game?.completed_at ?? game?.created_at ?? Date.now())
    )
  );

  // Photo: an existing url (unless removed), or a freshly picked file.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s1 = parseInt(p1Score, 10);
  const s2 = parseInt(p2Score, 10);
  const validScores =
    !isNaN(s1) && !isNaN(s2) && s1 >= 0 && s2 >= 0 && s1 !== s2 && Math.max(s1, s2) >= 121;

  const preview =
    validScores && trip
      ? computeGameResult(s1, s2, trip.base_amount_cents, isTieFlip, trip.per_point_cents)
      : null;

  const existingPhoto = game?.photo_url && !removePhoto ? game.photo_url : null;
  const shownPhoto = photoPreview ?? existingPhoto;

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!validScores) {
      setError("Enter final scores — one player must have reached at least 121.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const handsNum = parseInt(handsPlayed, 10);
      await onSubmit(
        {
          player1Score: s1,
          player2Score: s2,
          isTieFlip,
          location: location.trim(),
          playedAt: new Date(playedAt).toISOString(),
          handsPlayed: Number.isFinite(handsNum) && handsNum > 0 ? handsNum : null,
        },
        { file: photoFile, remove: removePhoto }
      );
    } catch (err) {
      setError("Couldn't save that game — try again.");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this game? This can't be undone.")) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setError("Couldn't delete that game — try again.");
      setDeleting(false);
    }
  }

  const busy = submitting || deleting;

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-5 space-y-4">
      <h2 className="font-display text-xl">{editing ? "Edit game" : "Log a past game"}</h2>
      {!editing && (
        <p className="text-xs text-track/50">
          For a game you already finished playing — enter the final score
          instead of pegging it live.
        </p>
      )}

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

      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          Hands played (optional)
        </label>
        <input
          value={handsPlayed}
          onChange={(e) => setHandsPlayed(e.target.value)}
          inputMode="numeric"
          placeholder="e.g. 11"
          className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30"
        />
        <p className="text-xs text-track/40 mt-1">
          Number of deals — powers points-per-hand stats.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isTieFlip}
          onChange={(e) => setIsTieFlip(e.target.checked)}
          className="mt-1 w-4 h-4 accent-brass"
        />
        <span className="text-sm text-track">
          <span className="block">Cut for deal was a tie — double odds</span>
        </span>
      </label>

      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          Photo (optional)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
        {shownPhoto ? (
          <div className="flex items-center gap-3">
            <PhotoThumb
              src={shownPhoto}
              alt="Game photo"
              className="w-16 h-16 rounded-lg object-cover border border-brass/30"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm border border-brass/40 text-brass-light rounded-lg px-3 py-1.5"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={clearPhoto}
              className="text-sm text-skunk"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm border border-brass/40 text-brass-light rounded-lg px-4 py-2"
          >
            📷 Add a photo
          </button>
        )}
        <p className="text-xs text-track/40 mt-1">
          Automatically sized down before it&apos;s saved.
        </p>
      </div>

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
          disabled={busy}
          className="flex-1 border border-brass/30 text-track/60 rounded-lg py-2.5 text-sm disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="flex-1 bg-brass text-ink font-display font-semibold rounded-lg py-2.5 disabled:opacity-50"
        >
          {submitting ? "Saving…" : editing ? "Save changes" : "Save game"}
        </button>
      </div>

      {editing && onDelete && (
        <button
          onClick={handleDelete}
          disabled={busy}
          className="w-full border border-skunk/50 text-skunk rounded-lg py-2 text-sm disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Delete this game"}
        </button>
      )}
    </div>
  );
}
