"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PullToRefresh from "@/components/PullToRefresh";
import { useAuth } from "@/components/AuthProvider";
import type { Trip } from "@/lib/types";

export default function ArchivePage() {
  const { user, signInWithGoogle } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // A full backup — every player, trip, and game, fresh from the database —
  // not just what's on screen. JSON rather than CSV so nothing gets flattened
  // or dropped (the point-by-point `events` log in particular).
  async function exportAllData() {
    if (!user) return; // players.email isn't selectable by a signed-out request
    setExporting(true);
    setExportError(null);
    try {
      const [playersRes, tripsRes, gamesRes] = await Promise.all([
        supabase.from("players").select("*"),
        supabase
          .from("trips")
          .select(
            "*, player1:player1_id(id, name), player2:player2_id(id, name)"
          ),
        supabase.from("games").select("*"),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (tripsRes.error) throw tripsRes.error;
      if (gamesRes.error) throw gamesRes.error;

      const payload = {
        exportedAt: new Date().toISOString(),
        players: playersRes.data,
        trips: tripsRes.data,
        games: gamesRes.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skunklife-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const loadTrips = useCallback(async () => {
    const { data } = await supabase
      .from("trips")
      .select(
        "*, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
      )
      .eq("status", "archived")
      .order("ended_at", { ascending: false });
    setTrips((data as unknown as Trip[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  return (
    <PullToRefresh onRefresh={loadTrips}>
    <main className="max-w-md mx-auto px-5 py-10">
      <Link href="/" className="text-sm text-brass-light/60">
        ← Trips
      </Link>
      <h1 className="font-display italic text-3xl text-track text-center mt-2 mb-8">
        Past Trips
      </h1>

      {loading && <p className="text-center text-track/50">Loading…</p>}

      {!loading && trips.length === 0 && (
        <p className="text-center text-track/50 text-sm">
          No archived trips yet. Once you end a trip it'll show up here.
        </p>
      )}

      <div className="space-y-3">
        {trips.map((trip) => (
          <Link
            key={trip.id}
            href={`/archive/${trip.id}`}
            className="block rounded-xl border border-brass/30 bg-walnut-light/10 px-4 py-3 hover:border-brass/60 transition-colors"
          >
            <p className="font-display text-lg text-track flex items-center gap-2">
              {trip.name}
              {trip.is_demo && (
                <span className="text-[10px] uppercase tracking-widest border border-brass/40 text-brass-light/80 rounded px-1.5 py-0.5">
                  Demo
                </span>
              )}
            </p>
            <p className="text-xs text-brass-light/70">
              {trip.player1?.name} vs {trip.player2?.name} ·{" "}
              {trip.ended_at ? new Date(trip.ended_at).toLocaleDateString() : ""}
            </p>
          </Link>
        ))}
      </div>

      <div className="text-center mt-10">
        {user ? (
          <>
            <button
              onClick={exportAllData}
              disabled={exporting}
              className="text-sm border border-brass/40 text-brass-light rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "⬇ Export all data"}
            </button>
            {exportError && (
              <p className="text-skunk text-xs mt-2">{exportError}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-track/50">
            <button
              onClick={signInWithGoogle}
              className="underline underline-offset-4 text-brass-light"
            >
              Sign in with Google
            </button>{" "}
            to export a full backup of every trip and game.
          </p>
        )}
      </div>
    </main>
    </PullToRefresh>
  );
}
