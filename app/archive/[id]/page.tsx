"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import TripSummary from "@/components/TripSummary";
import { formatCents } from "@/lib/scoring";
import type { Game, Trip } from "@/lib/types";

export default function ArchivedTripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  async function deleteTrip() {
    if (
      !confirm("Delete this trip and every game in it? This can't be undone.")
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
    router.push("/archive");
  }

  useEffect(() => {
    async function load() {
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
        .eq("status", "completed")
        .order("created_at", { ascending: true });
      setGames((gamesData as Game[]) ?? []);
      setLoading(false);
    }
    load();
  }, [tripId]);

  if (loading || !trip) {
    return (
      <main className="max-w-md mx-auto px-5 py-10 text-center text-track/50">
        Loading…
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-5 py-8">
      <Link href="/archive" className="text-sm text-brass-light/60">
        ← Past trips
      </Link>
      <header className="text-center mt-2 mb-6">
        <h1 className="font-display italic text-3xl text-track">{trip.name}</h1>
        <p className="text-xs text-track/50 mt-2">
          {new Date(trip.created_at).toLocaleDateString()} –{" "}
          {trip.ended_at ? new Date(trip.ended_at).toLocaleDateString() : ""}
        </p>
      </header>

      <TripSummary trip={trip} games={games} />

      {games.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-2">
            Game log
          </p>
          <div className="space-y-1.5">
            {games.map((g) => (
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
                      <img
                        src={g.photo_url}
                        alt=""
                        className="w-10 h-10 rounded-md object-cover border border-brass/30"
                      />
                    )}
                    <span className="font-score">{formatCents(g.payout_cents ?? 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={deleteTrip}
        disabled={deleting}
        className="w-full mt-8 border border-skunk/50 text-skunk rounded-lg py-2.5 text-sm disabled:opacity-40"
      >
        {deleting ? "Deleting…" : "Delete trip"}
      </button>
    </main>
  );
}
