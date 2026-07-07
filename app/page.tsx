"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import NewTripForm from "@/components/NewTripForm";
import type { Trip } from "@/lib/types";

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("trips")
      .select("*, player1:player1_id(*), player2:player2_id(*)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTrips((data as unknown as Trip[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="max-w-md mx-auto px-5 py-10">
      <header className="mb-8 text-center">
        <p className="uppercase tracking-[0.35em] text-brass-light/70 text-xs mb-2">
          Skunk Line
        </p>
        <h1 className="font-display italic text-4xl text-track">
          Cribbage Trips
        </h1>
      </header>

      {!loading && trips.length > 0 && !showForm && (
        <div className="space-y-3 mb-8">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trip/${trip.id}`}
              className="block rounded-xl border border-brass/30 bg-walnut-light/20 px-4 py-3 hover:border-brass/60 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg text-track">
                    {trip.name}
                  </p>
                  <p className="text-xs text-brass-light/70">
                    {trip.player1?.name} vs {trip.player2?.name} · {trip.board_name}
                  </p>
                </div>
                <span className="text-brass text-xl">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && trips.length === 0 && !showForm && (
        <p className="text-center text-track/50 text-sm mb-8">
          No active trip yet. Start one below.
        </p>
      )}

      {showForm ? (
        <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-5">
          <h2 className="font-display text-xl mb-4">New trip</h2>
          <NewTripForm />
          <button
            onClick={() => setShowForm(false)}
            className="w-full text-center text-sm text-track/50 mt-3"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full border border-dashed border-brass/50 text-brass-light rounded-xl py-4 font-display text-lg hover:bg-walnut-light/10 transition-colors"
        >
          + Start a new trip
        </button>
      )}

      <div className="text-center mt-10">
        <Link href="/archive" className="text-sm text-brass-light/70 underline underline-offset-4">
          View past trips
        </Link>
      </div>
    </main>
  );
}
