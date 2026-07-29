"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import type { Player } from "@/lib/types";

// Shown once, right after a new Google sign-in, when that email isn't linked
// to any player yet — links it to an existing unclaimed player (e.g. one of
// the trips played before login existed) or creates a brand-new one. This is
// what lets new people onboard themselves instead of a manual database edit
// every time someone joins.
export default function ClaimPlayer({
  onClaimed,
}: {
  onClaimed: (player: Player) => void;
}) {
  const { user } = useAuth();
  const [unclaimed, setUnclaimed] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("players")
      .select("id, name, email, created_at")
      .is("email", null)
      .order("name")
      .then(({ data }) => {
        if (alive) {
          setUnclaimed((data as Player[]) ?? []);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  async function claim(playerId: string) {
    if (!user?.email) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("players")
      .update({ email: user.email.toLowerCase() })
      .eq("id", playerId)
      .select("id, name, email, created_at")
      .single();
    setBusy(false);
    if (error || !data) {
      setError("Couldn't link that player — try again.");
      return;
    }
    onClaimed(data as Player);
  }

  async function createNew() {
    if (!user?.email || !newName.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("players")
      .insert({ name: newName.trim(), email: user.email.toLowerCase() })
      .select("id, name, email, created_at")
      .single();
    setBusy(false);
    if (error || !data) {
      setError("Couldn't add you as a player — try again.");
      return;
    }
    onClaimed(data as Player);
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-5 mb-6 space-y-3">
      <h2 className="font-display text-lg text-track">Which player are you?</h2>
      <p className="text-xs text-track/50">
        Link your Google account to a player so you can score and edit the
        trips you&rsquo;re part of.
      </p>

      {unclaimed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unclaimed.map((p) => (
            <button
              key={p.id}
              onClick={() => claim(p.id)}
              disabled={busy}
              className="border border-brass/40 text-brass-light rounded-lg px-3 py-1.5 text-sm disabled:opacity-40"
            >
              That&rsquo;s me — {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Not listed — type your name"
          className="flex-1 bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30"
        />
        <button
          onClick={createNew}
          disabled={busy || !newName.trim()}
          className="border border-brass/40 text-brass-light rounded-lg px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Add me
        </button>
      </div>

      {error && <p className="text-skunk text-sm">{error}</p>}
    </div>
  );
}
