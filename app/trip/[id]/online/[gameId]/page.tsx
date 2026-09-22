"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PeggingBoard from "@/components/PeggingBoard";
import {
  fetchOnlineGameState,
  submitDiscard,
  submitPlay,
  submitCount,
  cancelOnlineGame,
} from "@/lib/onlineGameClient";
import { enablePushNotifications, pushNotificationsSupported } from "@/lib/pushClient";
import { canPlay } from "@/lib/cribbage/scorePegging";
import { rankOf, suitOf } from "@/lib/cribbage/deck";
import { formatCents } from "@/lib/scoring";
import type { OnlineDeal, OnlineDealView, Trip } from "@/lib/types";

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RANK_LABEL: Record<string, string> = { T: "10" };

function CardFace({
  card,
  selected = false,
  disabled = false,
  onClick,
}: {
  card: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const rank = rankOf(card);
  const suit = suitOf(card);
  const red = suit === "H" || suit === "D";
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`inline-flex flex-col items-center justify-center w-12 h-16 rounded-md border font-score leading-none transition-transform ${
        selected ? "border-brass bg-brass/20 -translate-y-1.5" : "border-brass/40 bg-walnut-deep"
      } ${disabled ? "opacity-30" : ""} ${red ? "text-skunk" : "text-track"}`}
    >
      <span className="text-base">{RANK_LABEL[rank] ?? rank}</span>
      <span className="text-xl">{SUIT_SYMBOL[suit]}</span>
    </button>
  );
}

function CardBack() {
  return (
    <span className="inline-flex items-center justify-center w-12 h-16 rounded-md border border-brass/20 bg-walnut-light/20 text-brass-light/40 text-xl">
      ?
    </span>
  );
}

function currentCountPhase(deal: OnlineDeal): "pone_hand" | "dealer_hand" | "crib" | null {
  if (deal.pone_hand_points === null) return "pone_hand";
  if (deal.dealer_hand_points === null) return "dealer_hand";
  if (deal.crib_points === null) return "crib";
  return null;
}

const QUICK_COUNTS = [0, 1, 2, 4, 6, 8, 12];

export default function OnlineGamePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const gameId = params.gameId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [view, setView] = useState<OnlineDealView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);
  const [claimedInput, setClaimedInput] = useState("0");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelInput, setCancelInput] = useState("");
  const [pushState, setPushState] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTrip = useCallback(async () => {
    const { data } = await supabase
      .from("trips")
      .select("*, player1:player1_id(id, name, created_at), player2:player2_id(id, name, created_at)")
      .eq("id", tripId)
      .single();
    if (data) setTrip(data as unknown as Trip);
  }, [tripId]);

  const loadState = useCallback(async () => {
    try {
      const { view: v } = await fetchOnlineGameState(gameId);
      setView(v);
      setSelectedDiscards([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this game.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadTrip();
    loadState();
  }, [loadTrip, loadState]);

  // Async play, not live sync — this poll is just a convenience for whoever
  // happens to have the screen open right now. Push notifications (see
  // lib/pushClient.ts) are what actually prompts a response later.
  useEffect(() => {
    if (!view || view.deal.status === "completed") return;
    pollRef.current = setInterval(loadState, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [view, loadState]);

  useEffect(() => {
    setPushState(pushNotificationsSupported() ? "idle" : "unsupported");
  }, []);

  async function handleEnablePush() {
    setPushState(await enablePushNotifications());
  }

  function nameOf(playerId: string | null): string {
    if (!trip || !playerId) return "your opponent";
    if (playerId === trip.player1_id) return trip.player1?.name ?? "Player 1";
    if (playerId === trip.player2_id) return trip.player2?.name ?? "Player 2";
    return "your opponent";
  }

  function toggleDiscard(card: string) {
    setSelectedDiscards((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (prev.length >= 2) return prev;
      return [...prev, card];
    });
  }

  async function handleDiscard() {
    if (!view || selectedDiscards.length !== 2) return;
    setBusy(true);
    setError(null);
    try {
      const { view: v } = await submitDiscard(view.deal.id, [selectedDiscards[0], selectedDiscards[1]]);
      setView(v);
      setSelectedDiscards([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't discard.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlayCard(card: string) {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const { view: v } = await submitPlay(view.deal.id, card);
      setView(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't play that card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitCount() {
    if (!view) return;
    const n = parseInt(claimedInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setBusy(true);
    setError(null);
    try {
      const { view: v } = await submitCount(view.deal.id, n);
      setView(v);
      setClaimedInput("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit that count.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelOnlineGame(gameId);
      router.push(`/trip/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel this game.");
      setBusy(false);
    }
  }

  if (loading || !trip || !view) {
    return (
      <main className="max-w-md mx-auto px-5 py-10 text-center text-track/50">
        {error ?? "Loading…"}
      </main>
    );
  }

  const { deal, game } = view;
  const p1Name = trip.player1?.name ?? "Player 1";
  const p2Name = trip.player2?.name ?? "Player 2";
  const opponentName = nameOf(view.opponentId);
  const pileCards = deal.pegging_pile.map((p) => p.card);
  const pileTotal = deal.pegging_count;

  return (
    <main className="max-w-md mx-auto px-5 py-8">
      <Link href={`/trip/${tripId}`} className="text-sm text-brass-light/60">
        ← {trip.name}
      </Link>
      <header className="text-center mt-2 mb-6">
        <h1 className="font-display italic text-2xl text-track">Online game</h1>
        <p className="text-xs text-track/50 mt-1">
          Hand {deal.hand_number} · {nameOf(deal.dealer_player_id)} dealing
        </p>
      </header>

      {error && (
        <p className="text-center text-xs rounded-lg py-1.5 mb-4 border border-skunk/30 bg-skunk/10 text-skunk">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { name: p1Name, score: game.player1_score },
          { name: p2Name, score: game.player2_score },
        ].map((s) => (
          <div key={s.name} className="rounded-2xl border border-brass/25 bg-walnut-light/10 px-2 pt-3 pb-2.5 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-brass-light/80">{s.name}</p>
            <p className="font-score text-5xl leading-none mt-1 text-track">{s.score}</p>
          </div>
        ))}
      </div>

      <PeggingBoard
        player1Name={p1Name}
        player2Name={p2Name}
        player1Score={game.player1_score}
        player2Score={game.player2_score}
        player1Prev={game.player1_score}
        player2Prev={game.player2_score}
        boardName={trip.board_name}
      />

      {pushState === "idle" && (
        <button
          onClick={handleEnablePush}
          className="w-full mt-4 text-xs border border-brass/30 text-brass-light rounded-lg py-2"
        >
          🔔 Enable notifications for your turn
        </button>
      )}
      {pushState === "denied" && (
        <p className="text-center text-xs text-track/40 mt-4">
          Notifications are blocked for this site — you can still check back here.
        </p>
      )}

      {game.status === "completed" ? (
        <div className="text-center rounded-xl border-2 border-brass/40 bg-walnut-light/10 py-5 px-4 mt-6">
          <p className="text-xs uppercase tracking-[0.3em] text-brass-light/70">Game over</p>
          <p className="font-display text-3xl leading-tight mt-1 text-track">
            🏆 {game.winner_player === 1 ? p1Name : p2Name} wins
          </p>
          <p className="font-score text-2xl text-track mt-1">
            {Math.max(game.player1_score, game.player2_score)}–
            {Math.min(game.player1_score, game.player2_score)}
          </p>
          {(game.is_double_skunk || game.is_skunk) && (
            <p className="text-sm text-skunk font-semibold mt-1">
              {game.is_double_skunk ? "DOUBLE SKUNK" : "SKUNK"}
            </p>
          )}
          <p className="text-track/60 text-sm mt-2">{formatCents(game.payout_cents ?? 0)}</p>
          <Link
            href={`/trip/${tripId}`}
            className="inline-block mt-4 bg-brass text-ink font-display font-semibold rounded-lg px-5 py-2.5"
          >
            Back to trip
          </Link>
        </div>
      ) : (
        <>
          {deal.status === "discarding" && (
            <section className="mt-6">
              <p className="text-center text-sm text-track/70 mb-3">
                {view.isMyTurn
                  ? "Pick 2 cards to send to the crib"
                  : `Waiting for ${opponentName} to discard…`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {view.myCards.map((c) => (
                  <CardFace
                    key={c}
                    card={c}
                    selected={selectedDiscards.includes(c)}
                    disabled={!view.isMyTurn}
                    onClick={view.isMyTurn ? () => toggleDiscard(c) : undefined}
                  />
                ))}
              </div>
              {view.isMyTurn && (
                <button
                  onClick={handleDiscard}
                  disabled={selectedDiscards.length !== 2 || busy}
                  className="w-full mt-4 bg-brass text-ink font-display font-semibold rounded-lg py-2.5 disabled:opacity-40"
                >
                  Send to crib
                </button>
              )}
            </section>
          )}

          {deal.status === "pegging" && (
            <section className="mt-6">
              <p className="text-center text-sm text-track/70 mb-2">
                {view.isMyTurn ? "Your turn to play" : `Waiting for ${opponentName}…`}
              </p>
              <div className="text-center mb-3">
                <span className="font-score text-3xl text-brass-light">{pileTotal}</span>
                <span className="text-track/40 text-sm"> / 31</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 mb-4 min-h-[4rem]">
                {pileCards.length === 0 ? (
                  <p className="text-track/30 text-xs self-center">No cards played yet this count</p>
                ) : (
                  pileCards.map((c, i) => <CardFace key={`${c}-${i}`} card={c} />)
                )}
              </div>
              <p className="text-center text-xs text-track/50 mb-2">{opponentName}&rsquo;s hand</p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {Array.from({ length: view.opponentCardCount }).map((_, i) => (
                  <CardBack key={i} />
                ))}
              </div>
              <p className="text-center text-xs text-track/50 mb-2">Your hand</p>
              <div className="flex flex-wrap justify-center gap-2">
                {view.myCards.map((c) => (
                  <CardFace
                    key={c}
                    card={c}
                    disabled={!view.isMyTurn || !canPlay(pileCards, c) || busy}
                    onClick={
                      view.isMyTurn && canPlay(pileCards, c) ? () => handlePlayCard(c) : undefined
                    }
                  />
                ))}
              </div>
              {deal.pegging_log.length > 0 && (
                <div className="mt-4 space-y-0.5 text-xs text-track/50">
                  {deal.pegging_log
                    .slice(-6)
                    .reverse()
                    .map((entry, i) => (
                      <p key={i}>
                        {nameOf(entry.player_id)}
                        {entry.card ? ` played ${RANK_LABEL[rankOf(entry.card)] ?? rankOf(entry.card)}${SUIT_SYMBOL[suitOf(entry.card)]}` : " said go"}
                        {entry.points > 0 ? ` — ${entry.points} pt${entry.points === 1 ? "" : "s"}` : ""}
                      </p>
                    ))}
                </div>
              )}
            </section>
          )}

          {deal.status === "counting" && (
            <CountingSection
              deal={deal}
              view={view}
              nameOf={nameOf}
              claimedInput={claimedInput}
              setClaimedInput={setClaimedInput}
              onSubmit={handleSubmitCount}
              busy={busy}
            />
          )}
        </>
      )}

      {game.status !== "completed" && (
        <div className="mt-8">
          {!showCancelConfirm ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full text-sm text-skunk/70 border border-skunk/20 rounded-lg py-2"
            >
              Cancel this game
            </button>
          ) : (
            <div className="rounded-lg border border-skunk/40 bg-skunk/5 p-3 space-y-2">
              <p className="text-sm text-skunk">
                This deletes the game entirely and can&rsquo;t be undone. Type{" "}
                <strong>cancel</strong> below to confirm.
              </p>
              <input
                value={cancelInput}
                onChange={(e) => setCancelInput(e.target.value)}
                placeholder="Type CANCEL"
                autoCapitalize="none"
                className="w-full bg-walnut-deep border border-skunk/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelInput("");
                  }}
                  className="flex-1 border border-brass/30 text-track/60 rounded-lg py-2 text-sm"
                >
                  Never mind
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelInput.trim().toLowerCase() !== "cancel" || busy}
                  className="flex-1 bg-skunk text-ink font-display font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
                >
                  Confirm cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function CountingSection({
  deal,
  view,
  nameOf,
  claimedInput,
  setClaimedInput,
  onSubmit,
  busy,
}: {
  deal: OnlineDeal;
  view: OnlineDealView;
  nameOf: (id: string | null) => string;
  claimedInput: string;
  setClaimedInput: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const phase = currentCountPhase(deal);
  if (!phase) return null; // shouldn't happen while status is "counting"

  // Whoever this phase belongs to (pone counts first, then dealer counts
  // their own hand, then dealer counts the crib) — with only 2 players,
  // "not me" always means the opponent.
  const phaseIsMine = phase === "pone_hand" ? !view.isDealer : view.isDealer;

  let cardsShown: string[];
  let label: string;
  if (phase === "crib") {
    cardsShown = deal.crib;
    label = "The crib";
  } else {
    cardsShown = phaseIsMine ? view.myCards : view.opponentCards ?? [];
    label = phaseIsMine ? "Your hand" : `${nameOf(view.opponentId)}'s hand`;
  }

  return (
    <section className="mt-6">
      <p className="text-center text-sm text-track/70 mb-3">
        Starter: <CardFace card={deal.starter_card ?? "AS"} /> — counting {label}
      </p>
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {cardsShown.map((c, i) => (
          <CardFace key={`${c}-${i}`} card={c} />
        ))}
      </div>
      {view.isMyTurn ? (
        <div className="space-y-3">
          <p className="text-center text-sm text-track/70">How many did you count?</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {QUICK_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setClaimedInput(String(n))}
                className={`w-10 h-10 rounded-md border text-sm font-score ${
                  claimedInput === String(n)
                    ? "border-brass bg-brass/20 text-brass-light"
                    : "border-brass/30 text-track/70"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              inputMode="numeric"
              value={claimedInput}
              onChange={(e) => setClaimedInput(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-14 h-10 bg-walnut-deep border border-brass/30 rounded-md text-center font-score text-track"
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="w-full bg-brass text-ink font-display font-semibold rounded-lg py-2.5 disabled:opacity-40"
          >
            Submit count
          </button>
        </div>
      ) : (
        <p className="text-center text-sm text-track/60">Waiting for {nameOf(view.opponentId)} to count…</p>
      )}
    </section>
  );
}
