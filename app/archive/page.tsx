"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PullToRefresh from "@/components/PullToRefresh";
import type { Trip } from "@/lib/types";

export default function ArchivePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = useCallback(async () => {
    const { data } = await supabase
      .from("trips")
      .select("*, player1:player1_id(*), player2:player2_id(*)")
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
            <p className="font-display text-lg text-track">{trip.name}</p>
            <p className="text-xs text-brass-light/70">
              {trip.player1?.name} vs {trip.player2?.name} ·{" "}
              {trip.ended_at ? new Date(trip.ended_at).toLocaleDateString() : ""}
            </p>
          </Link>
        ))}
      </div>
    </main>
    </PullToRefresh>
  );
}
