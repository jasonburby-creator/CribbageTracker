"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeTripSummary, formatCents } from "@/lib/scoring";
import type { Game, Trip } from "@/lib/types";

const METHODS = ["Venmo", "Cash", "PayPal", "Other"] as const;

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A single trusted declaration by either tied player — not a two-sided
// handshake. Whoever gets to it first records it; the other can undo it if
// it was a mistake. Renders nothing once the trip is fully square.
export default function PaymentStatus({
  trip,
  games,
  canEdit,
  myPlayerId,
  onUpdate,
}: {
  trip: Trip;
  games: Game[];
  canEdit: boolean;
  myPlayerId: string | null;
  onUpdate: (trip: Trip) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Venmo");
  const [otherMethod, setOtherMethod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = computeTripSummary(games);
  if (summary.gamesPlayed === 0) return null;
  const netCents = summary.player1.netCents;
  if (netCents === 0 && !trip.paid_at) return null;

  const p1Name = trip.player1?.name ?? "Player 1";
  const p2Name = trip.player2?.name ?? "Player 2";
  const owerName = netCents < 0 ? p1Name : p2Name;
  const owedToName = netCents < 0 ? p2Name : p1Name;
  const amount = formatCents(Math.abs(netCents));

  async function markPaid() {
    setBusy(true);
    setError(null);
    const methodText = method === "Other" ? `Other: ${otherMethod.trim() || "unspecified"}` : method;
    const { data, error: updateError } = await supabase
      .from("trips")
      .update({
        paid_at: new Date().toISOString(),
        paid_on: date,
        paid_method: methodText,
        paid_by_player_id: myPlayerId,
      })
      .eq("id", trip.id)
      .select(
        "*, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
      )
      .single();
    setBusy(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Couldn't save that — try again.");
      return;
    }
    setShowForm(false);
    onUpdate(data as unknown as Trip);
  }

  async function undoPaid() {
    if (!confirm("Mark this trip as unpaid again?")) return;
    setBusy(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("trips")
      .update({ paid_at: null, paid_on: null, paid_method: null, paid_by_player_id: null })
      .eq("id", trip.id)
      .select(
        "*, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
      )
      .single();
    setBusy(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Couldn't undo that — try again.");
      return;
    }
    onUpdate(data as unknown as Trip);
  }

  if (trip.paid_at) {
    const markedByName =
      trip.paid_by_player_id === trip.player1_id
        ? p1Name
        : trip.paid_by_player_id === trip.player2_id
        ? p2Name
        : null;
    const paidDate = trip.paid_on
      ? new Date(trip.paid_on + "T00:00:00").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    return (
      <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4 mb-4">
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-1.5 text-sm"
        >
          <span className="text-brass-light font-semibold">✓ Paid</span>
          <span className="text-track/40 text-xs">{showDetails ? "▲" : "▼"}</span>
        </button>
        {showDetails && (
          <div className="mt-2 pt-2 border-t border-brass/20 space-y-1">
            <p className="text-xs text-track/70">
              {trip.paid_method ? `Via ${trip.paid_method}` : ""}
              {paidDate ? ` · ${paidDate}` : ""}
              {markedByName ? ` · marked by ${markedByName}` : ""}
            </p>
            {canEdit && (
              <button
                onClick={undoPaid}
                disabled={busy}
                className="text-xs text-track/50 underline underline-offset-4 disabled:opacity-40"
              >
                Undo
              </button>
            )}
            {error && <p className="text-skunk text-xs">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4 mb-4">
      <p className="text-sm text-track">
        <strong className="text-track">{owerName}</strong> owes{" "}
        <strong className="text-track">{owedToName}</strong>{" "}
        <span className="font-score text-brass-light">{amount}</span>
      </p>

      {!canEdit ? null : !showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs border border-brass/40 text-brass-light rounded-lg px-3 py-1.5 mt-2"
        >
          Mark as paid
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track text-sm"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
              className="flex-1 bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track text-sm"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {method === "Other" && (
            <input
              value={otherMethod}
              onChange={(e) => setOtherMethod(e.target.value)}
              placeholder="e.g. Check, Zelle"
              className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 text-sm"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              disabled={busy}
              className="flex-1 border border-brass/30 text-track/60 rounded-lg py-2 text-sm disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={markPaid}
              disabled={busy}
              className="flex-1 bg-brass text-ink font-display font-semibold rounded-lg py-2 text-sm disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
          {error && <p className="text-skunk text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}
