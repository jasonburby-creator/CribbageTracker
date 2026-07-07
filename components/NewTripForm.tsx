"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Player } from "@/lib/types";

export default function NewTripForm() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [boardName, setBoardName] = useState("");
  const [boardTheme, setBoardTheme] = useState("");
  const [baseAmount, setBaseAmount] = useState("1.00");
  const [perPoint, setPerPoint] = useState("10");
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("name")
      .then(({ data }) => setPlayers(data ?? []));
  }, []);

  // Finds a player by exact name (case-insensitive) or creates one.
  async function resolvePlayer(rawName: string): Promise<string> {
    const trimmed = rawName.trim();
    const existing = players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase
      .from("players")
      .insert({ name: trimmed })
      .select()
      .single();
    if (data) return data.id;

    // Unique-constraint race (e.g. someone else just added the same name) —
    // fall back to fetching it.
    const { data: fetched } = await supabase
      .from("players")
      .select("*")
      .ilike("name", trimmed)
      .single();
    if (fetched) return fetched.id;

    throw insertError ?? new Error(`Couldn't resolve player "${trimmed}"`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !boardName.trim() || !player1Name.trim() || !player2Name.trim()) {
      setError("Fill in the trip name, board name, and both players.");
      return;
    }
    if (player1Name.trim().toLowerCase() === player2Name.trim().toLowerCase()) {
      setError("Pick two different players.");
      return;
    }
    const baseCents = Math.round(parseFloat(baseAmount || "0") * 100);
    if (!baseCents || baseCents <= 0) {
      setError("Set a base win amount greater than $0.");
      return;
    }
    const perPointCents = Math.round(parseFloat(perPoint || "0"));
    if (!perPointCents || perPointCents <= 0) {
      setError("Set a per-point amount greater than 0¢.");
      return;
    }

    setSubmitting(true);
    try {
      const [player1Id, player2Id] = await Promise.all([
        resolvePlayer(player1Name),
        resolvePlayer(player2Name),
      ]);

      const { data, error: insertError } = await supabase
        .from("trips")
        .insert({
          name: name.trim(),
          board_name: boardName.trim(),
          board_theme: boardTheme.trim() || null,
          base_amount_cents: baseCents,
          per_point_cents: perPointCents,
          player1_id: player1Id,
          player2_id: player2Id,
          status: "active",
        })
        .select()
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(`/trip/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const playerNames = players.map((p) => p.name);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          Trip name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="San Sebastián 2026"
          className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          Board name
        </label>
        <input
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          placeholder="El Tablero"
          className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          What shape/theme should the board be?
        </label>
        <textarea
          value={boardTheme}
          onChange={(e) => setBoardTheme(e.target.value)}
          placeholder="Match it to where you're headed — e.g. shaped like a paella pan for Spain, or a surfboard for a coast trip"
          rows={2}
          className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
        />
        <p className="text-xs text-track/40 mt-1">
          This is just recorded for the record — you'll build or bring the
          physical board yourselves.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
            Base win amount ($)
          </label>
          <input
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
            inputMode="decimal"
            className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
            Per point (¢)
          </label>
          <input
            value={perPoint}
            onChange={(e) => setPerPoint(e.target.value)}
            inputMode="numeric"
            className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
            Player 1
          </label>
          <input
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
            placeholder="Dad"
            list="known-players"
            className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
            Player 2
          </label>
          <input
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
            placeholder="Blake"
            list="known-players"
            className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </div>
      </div>
      <datalist id="known-players">
        {playerNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <p className="text-xs text-track/40">
        Type a name you've used before, or a new one — either works, no extra
        step needed.
      </p>
      {error && <p className="text-skunk text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brass text-walnut-deep font-display font-semibold text-lg py-3 rounded-lg hover:bg-brass-light transition-colors disabled:opacity-50"
      >
        {submitting ? "Starting trip…" : "Start the trip"}
      </button>
    </form>
  );
}
