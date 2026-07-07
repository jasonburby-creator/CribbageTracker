"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Player } from "@/lib/types";

function PlayerField({
  label,
  players,
  value,
  onChange,
  onNewPlayer,
}: {
  label: string;
  players: Player[];
  value: string;
  onChange: (id: string) => void;
  onNewPlayer: (name: string) => Promise<string>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  if (adding) {
    return (
      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Player name"
            className="flex-1 bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <button
            type="button"
            onClick={async () => {
              if (!newName.trim()) return;
              const id = await onNewPlayer(newName.trim());
              onChange(id);
              setAdding(false);
              setNewName("");
            }}
            className="px-3 rounded-lg bg-brass text-walnut-deep font-medium"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__new__") {
            setAdding(true);
          } else {
            onChange(e.target.value);
          }
        }}
        className="w-full bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track focus:outline-none focus:ring-2 focus:ring-brass"
      >
        <option value="">Choose a player&hellip;</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="__new__">+ New player&hellip;</option>
      </select>
    </div>
  );
}

export default function NewTripForm() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [boardName, setBoardName] = useState("");
  const [boardTheme, setBoardTheme] = useState("");
  const [baseAmount, setBaseAmount] = useState("1.00");
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("name")
      .then(({ data }) => setPlayers(data ?? []));
  }, []);

  async function createPlayer(playerName: string): Promise<string> {
    const { data, error } = await supabase
      .from("players")
      .insert({ name: playerName })
      .select()
      .single();
    if (error || !data) {
      // could be a unique-name collision, try fetching existing
      const existing = await supabase
        .from("players")
        .select("*")
        .eq("name", playerName)
        .single();
      if (existing.data) {
        setPlayers((p) => [...p, existing.data]);
        return existing.data.id;
      }
      throw error;
    }
    setPlayers((p) => [...p, data]);
    return data.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !boardName.trim() || !player1Id || !player2Id) {
      setError("Fill in the trip name, board name, and both players.");
      return;
    }
    if (player1Id === player2Id) {
      setError("Pick two different players.");
      return;
    }
    const cents = Math.round(parseFloat(baseAmount || "0") * 100);
    if (!cents || cents <= 0) {
      setError("Set a base win amount greater than $0.");
      return;
    }
    setSubmitting(true);
    const { data, error: insertError } = await supabase
      .from("trips")
      .insert({
        name: name.trim(),
        board_name: boardName.trim(),
        board_theme: boardTheme.trim() || null,
        base_amount_cents: cents,
        player1_id: player1Id,
        player2_id: player2Id,
        status: "active",
      })
      .select()
      .single();
    setSubmitting(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Something went wrong.");
      return;
    }
    router.push(`/trip/${data.id}`);
  }

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
      <div className="grid grid-cols-2 gap-3">
        <PlayerField
          label="Player 1"
          players={players}
          value={player1Id}
          onChange={setPlayer1Id}
          onNewPlayer={createPlayer}
        />
        <PlayerField
          label="Player 2"
          players={players}
          value={player2Id}
          onChange={setPlayer2Id}
          onNewPlayer={createPlayer}
        />
      </div>
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
