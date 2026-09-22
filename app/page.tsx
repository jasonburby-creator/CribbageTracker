"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import NewTripForm from "@/components/NewTripForm";
import HeadToHeadTally from "@/components/HeadToHeadTally";
import PullToRefresh from "@/components/PullToRefresh";
import ClaimPlayer from "@/components/ClaimPlayer";
import InstallPrompt from "@/components/InstallPrompt";
import { useAuth } from "@/components/AuthProvider";
import { fetchOnlineGameState } from "@/lib/onlineGameClient";
import { computeHeadToHeads, computeTripSummary, formatCents } from "@/lib/scoring";
import type { HeadToHead } from "@/lib/scoring";
import { readCache, writeCache } from "@/lib/offlineCache";
import type { Player, Trip } from "@/lib/types";

const HOME_CACHE_KEY = "skunklife-home-cache-v1";
type UnpaidTrip = { trip: Trip; oweCents: number };
type HomeCache = { trips: Trip[]; heads: HeadToHead[]; unpaid: UnpaidTrip[] };
type MyTurnGame = { gameId: string; tripId: string; tripName: string };

export default function HomePage() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [heads, setHeads] = useState<HeadToHead[]>([]);
  const [unpaid, setUnpaid] = useState<UnpaidTrip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [myPlayerChecked, setMyPlayerChecked] = useState(false);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [myTurnGames, setMyTurnGames] = useState<MyTurnGame[]>([]);

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

  // Any in-progress online game across any trip (active or archived) where
  // it's the signed-in player's move — the closest thing this app has to a
  // "you have a notification" indicator for the moment the app is actually
  // open. Small dataset (a family, a handful of concurrent online games at
  // most), so a per-game state fetch each is simpler than a dedicated
  // aggregate endpoint.
  useEffect(() => {
    let alive = true;
    if (!myPlayer) {
      setMyTurnGames([]);
      return;
    }
    (async () => {
      const { data: onlineGames } = await supabase
        .from("games")
        .select("id, trip_id")
        .eq("mode", "online")
        .eq("status", "in_progress");
      const games = (onlineGames as { id: string; trip_id: string }[] | null) ?? [];
      if (games.length === 0) {
        if (alive) setMyTurnGames([]);
        return;
      }
      const tripIds = [...new Set(games.map((g) => g.trip_id))];
      const { data: tripsData } = await supabase
        .from("trips")
        .select("id, name, player1_id, player2_id")
        .in("id", tripIds);
      const tripsById = new Map(
        (
          (tripsData as { id: string; name: string; player1_id: string; player2_id: string }[]) ??
          []
        ).map((t) => [t.id, t])
      );
      const myGames = games.filter((g) => {
        const t = tripsById.get(g.trip_id);
        return !!t && (t.player1_id === myPlayer.id || t.player2_id === myPlayer.id);
      });

      const results: MyTurnGame[] = [];
      for (const g of myGames) {
        try {
          const { view } = await fetchOnlineGameState(g.id);
          if (view.isMyTurn) {
            const t = tripsById.get(g.trip_id)!;
            results.push({ gameId: g.id, tripId: g.trip_id, tripName: t.name });
          }
        } catch {
          // A game that fails to load just doesn't get a reminder.
        }
      }
      if (alive) setMyTurnGames(results);
    })();
    return () => {
      alive = false;
    };
  }, [myPlayer]);

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
    // Check connectivity directly rather than only reacting to a thrown
    // error: the service worker's own cache (public/sw.js) can transparently
    // serve these same requests from its cache even while offline, so the
    // fetch can "succeed" with stale data and never throw at all — that's
    // good for keeping the app usable, but it means we can't tell the user
    // is offline just from the request working.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = readCache<HomeCache>(HOME_CACHE_KEY);
      if (cached) {
        setTrips(cached.trips);
        setHeads(cached.heads);
        setUnpaid(cached.unpaid);
      }
      setOffline(true);
      setLoading(false);
      return;
    }
    try {
      // Active trips for the list, plus every trip + completed game for the
      // all-time head-to-head tally and the unpaid-balance reminder below.
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
            "id, name, status, is_demo, paid_at, player1_id, player2_id, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)"
          ),
        supabase
          .from("games")
          .select(
            "trip_id, status, winner_player, is_skunk, is_double_skunk, payout_cents, win_weight, player1_score, player2_score, hands_played"
          )
          .eq("status", "completed"),
      ]);
      if (activeRes.error) throw activeRes.error;
      if (allTripsRes.error) throw allTripsRes.error;
      if (gamesRes.error) throw gamesRes.error;

      const nextTrips = (activeRes.data as unknown as Trip[]) ?? [];
      const allTrips = (allTripsRes.data as any[]) ?? [];
      const allGames = (gamesRes.data as any[]) ?? [];
      // Demo/practice trips still work normally on their own page, but never
      // feed into the all-time head-to-head tally.
      const realTrips = allTrips.filter((t) => !t.is_demo);
      const nextHeads = computeHeadToHeads(realTrips, allGames);

      // Archived, non-demo trips with a balance that's never been marked paid.
      const gamesByTrip = new Map<string, any[]>();
      for (const g of allGames) {
        const list = gamesByTrip.get(g.trip_id) ?? [];
        list.push(g);
        gamesByTrip.set(g.trip_id, list);
      }
      const nextUnpaid: UnpaidTrip[] = realTrips
        .filter((t) => t.status === "archived" && !t.paid_at)
        .map((t) => ({
          trip: t as Trip,
          oweCents: computeTripSummary(gamesByTrip.get(t.id) ?? []).player1.netCents,
        }))
        .filter((u) => u.oweCents !== 0);

      setTrips(nextTrips);
      setHeads(nextHeads);
      setUnpaid(nextUnpaid);
      setOffline(false);
      writeCache<HomeCache>(HOME_CACHE_KEY, { trips: nextTrips, heads: nextHeads, unpaid: nextUnpaid });
    } catch {
      // Offline (or the request otherwise failed) — fall back to whatever we
      // last successfully loaded rather than leaving the page blank.
      const cached = readCache<HomeCache>(HOME_CACHE_KEY);
      if (cached) {
        setTrips(cached.trips);
        setHeads(cached.heads);
        setUnpaid(cached.unpaid);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Show cached data immediately on first paint if we have it, so there's
  // something real on screen before the network request even resolves.
  useEffect(() => {
    const cached = readCache<HomeCache>(HOME_CACHE_KEY);
    if (cached) {
      setTrips(cached.trips);
      setHeads(cached.heads);
      setUnpaid(cached.unpaid);
      setLoading(false);
    }
    loadHome();
  }, [loadHome]);

  // Reminders for trips you're actually tied to.
  const myUnpaid = myPlayer
    ? unpaid.filter(
        (u) => u.trip.player1_id === myPlayer.id || u.trip.player2_id === myPlayer.id
      )
    : [];

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

      {offline && (
        <p className="text-center text-xs rounded-lg py-1.5 mb-4 border border-brass/30 bg-brass/10 text-brass-light">
          Offline — showing your last loaded trips.
        </p>
      )}

      {myTurnGames.length > 0 && (
        <div className="space-y-2 mb-4">
          {myTurnGames.map((g) => (
            <Link
              key={g.gameId}
              href={`/trip/${g.tripId}/online/${g.gameId}`}
              className="block rounded-lg border border-brass/30 bg-brass/10 px-4 py-2.5 text-sm text-brass-light"
            >
              🃏 Your move — {g.tripName} →
            </Link>
          ))}
        </div>
      )}

      {myUnpaid.length > 0 && (
        <div className="space-y-2 mb-4">
          {myUnpaid.map(({ trip, oweCents }) => {
            const owerName = oweCents < 0 ? trip.player1?.name : trip.player2?.name;
            const owedToName = oweCents < 0 ? trip.player2?.name : trip.player1?.name;
            return (
              <Link
                key={trip.id}
                href={`/archive/${trip.id}`}
                className="block rounded-lg border border-brass/30 bg-brass/10 px-4 py-2.5 text-sm text-brass-light"
              >
                {owerName} owes {owedToName} {formatCents(Math.abs(oweCents))} for{" "}
                {trip.name} →
              </Link>
            );
          })}
        </div>
      )}

      <InstallPrompt />

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
                  <p className="font-display text-lg text-track flex items-center gap-2">
                    {trip.name}
                    {trip.is_demo && (
                      <span className="text-[10px] uppercase tracking-widest border border-brass/40 text-brass-light/80 rounded px-1.5 py-0.5">
                        Demo
                      </span>
                    )}
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

      <div className="text-center mt-10 space-x-3">
        <Link href="/about" className="text-sm text-brass-light/70 underline underline-offset-4">
          How it works
        </Link>
        <span className="text-track/30">·</span>
        <Link href="/rules" className="text-sm text-brass-light/70 underline underline-offset-4">
          Cribbage rules
        </Link>
        <span className="text-track/30">·</span>
        <Link href="/records" className="text-sm text-brass-light/70 underline underline-offset-4">
          Records
        </Link>
        <span className="text-track/30">·</span>
        <Link href="/archive" className="text-sm text-brass-light/70 underline underline-offset-4">
          View past trips
        </Link>
      </div>
    </main>
    </PullToRefresh>
  );
}
