"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import NewTripForm from "@/components/NewTripForm";
import HeadToHeadTally from "@/components/HeadToHeadTally";
import PullToRefresh from "@/components/PullToRefresh";
import ClaimPlayer from "@/components/ClaimPlayer";
import { useAuth } from "@/components/AuthProvider";
import { computeHeadToHeads } from "@/lib/scoring";
import type { HeadToHead } from "@/lib/scoring";
import type { Player, Trip } from "@/lib/types";

export default function HomePage() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [heads, setHeads] = useState<HeadToHead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [myPlayerChecked, setMyPlayerChecked] = useState(false);
  const [showAllTrips, setShowAllTrips] = useState(false);

  // Find (if any) the player row linked to the signed-in user's email.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setMyPlayer(null);
      setMyPlayerChecked(true);
      return;
    }
    setMyPlayerChecked(false);
    supabase
      .from("players")
      .select("id, name, email, created_at")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        setMyPlayer((data as Player) ?? null);
        setMyPlayerChecked(true);
      });
  }, [user, authLoading]);

  const visibleTrips =
    myPlayer && !showAllTrips
      ? trips.filter((t) => t.player1_id === myPlayer.id || t.player2_id === myPlayer.id)
      : trips;

  // Once signed in and linked, only show head-to-head cards involving you —
  // one per opponent you've actually played. Signed out (or signed in but
  // not yet linked to a player) still sees everything, matching the rest of
  // the app staying open to anonymous visitors.
  const visibleHeads = myPlayer
    ? heads.filter((h) => h.players.some((p) => p.playerId === myPlayer.id))
    : heads;

  const loadHome = useCallback(async () => {
    // Active trips for the list, plus every trip + completed game for the
    // all-time head-to-head tally.
    const [activeRes, allTripsRes, gamesRes] = await Promise.all([
      supabase
        .from("trips")
        .select(
          "*, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("trips")
        .select(
          "id, player1_id, player2_id, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
        ),
      supabase
        .from("games")
        .select(
          "trip_id, status, winner_player, is_skunk, is_double_skunk, payout_cents, win_weight, player1_score, player2_score, hands_played"
        )
        .eq("status", "completed"),
    ]);
    setTrips((activeRes.data as unknown as Trip[]) ?? []);
    setHeads(
      computeHeadToHeads(
        (allTripsRes.data as any[]) ?? [],
        (gamesRes.data as any[]) ?? []
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  return (
    <PullToRefresh onRefresh={loadHome}>
    <main className="max-w-md mx-auto px-5 py-10">
      <header className="mb-8 text-center">
        <p className="uppercase tracking-[0.35em] text-brass-light/70 text-xs mb-2">
          Skunk Life
        </p>
        <h1 className="font-display italic text-4xl text-track">
          Cribbage Trips
        </h1>
        {!authLoading && (
          <p className="mt-3 text-xs text-brass-light/70">
            {user ? (
              <>
                Signed in as {user.user_metadata?.full_name ?? user.email}
                {" · "}
                <button onClick={signOut} className="underline underline-offset-4">
                  Sign out
                </button>
              </>
            ) : (
              <button onClick={signInWithGoogle} className="underline underline-offset-4">
                Sign in with Google
              </button>
            )}
          </p>
        )}
      </header>

      {user && myPlayerChecked && !myPlayer && !showForm && (
        <ClaimPlayer onClaimed={setMyPlayer} />
      )}

      {!loading && !showForm && <HeadToHeadTally heads={visibleHeads} />}

      {!loading && myPlayer && trips.length > 0 && !showForm && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-widest text-brass-light/60">
            {showAllTrips ? "All active trips" : "Your trips"}
          </p>
          <button
            onClick={() => setShowAllTrips((v) => !v)}
            className="text-xs text-brass-light/70 underline underline-offset-4"
          >
            {showAllTrips ? "Show just mine" : "Show all trips"}
          </button>
        </div>
      )}

      {!loading && visibleTrips.length > 0 && !showForm && (
        <div className="space-y-3 mb-8">
          {visibleTrips.map((trip) => (
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

      {!loading && visibleTrips.length === 0 && !showForm && (
        <p className="text-center text-track/50 text-sm mb-8">
          {trips.length > 0
            ? "None of your trips are active right now."
            : "No active trip yet. Start one below."}
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
    </PullToRefresh>
  );
}
