// Server-only: the actual referee for online cribbage. Every function here
// runs with the Supabase service-role key (see lib/supabaseAdmin.ts) and is
// only ever called from app/api/online/*/route.ts handlers — never from a
// client component. See the plan for why this exists as TypeScript here
// rather than Postgres RLS + PL/pgSQL.

import { supabaseAdmin, getEmailFromAccessToken } from "@/lib/supabaseAdmin";
import { sendPushToPlayer } from "@/lib/push";
import { freshDeck, rankOf, type Card } from "@/lib/cribbage/deck";
import { shuffle } from "@/lib/cribbage/shuffle";
import { nextDealer, poneOf } from "@/lib/cribbage/dealer";
import { scoreHand } from "@/lib/cribbage/scoreHand";
import { scorePeggingPlay, canPlay, pileCount } from "@/lib/cribbage/scorePegging";
import { computeGameResult, WINNING_SCORE } from "@/lib/scoring";
import type { Game, OnlineDeal, OnlineDealView, PeggingLogEntry, Trip } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function bearerFrom(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}

export async function requireEmail(req: Request): Promise<string> {
  const email = await getEmailFromAccessToken(bearerFrom(req));
  if (!email) throw new ApiError(401, "Sign in required.");
  return email;
}

async function loadTripWithPlayers(tripId: string): Promise<Trip> {
  const { data, error } = await supabaseAdmin
    .from("trips")
    .select(
      "*, player1:player1_id(id, name, email, created_at), player2:player2_id(id, name, email, created_at)"
    )
    .eq("id", tripId)
    .single();
  if (error || !data) throw new ApiError(404, "Trip not found.");
  return data as unknown as Trip;
}

function resolvePlayerInTrip(trip: Trip, email: string): { playerId: string; opponentId: string } {
  const p1Email = trip.player1?.email?.toLowerCase();
  const p2Email = trip.player2?.email?.toLowerCase();
  if (email === p1Email) return { playerId: trip.player1_id, opponentId: trip.player2_id };
  if (email === p2Email) return { playerId: trip.player2_id, opponentId: trip.player1_id };
  throw new ApiError(403, "You're not one of this trip's players.");
}

type DealContext = {
  playerId: string;
  opponentId: string;
  trip: Trip;
  game: Game;
  deal: OnlineDeal;
};

async function loadDealContext(email: string, dealId: string): Promise<DealContext> {
  const { data: dealRow, error: dealError } = await supabaseAdmin
    .from("online_deals")
    .select("*")
    .eq("id", dealId)
    .single();
  if (dealError || !dealRow) throw new ApiError(404, "Deal not found.");
  const deal = dealRow as OnlineDeal;

  const { data: gameRow, error: gameError } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("id", deal.game_id)
    .single();
  if (gameError || !gameRow) throw new ApiError(404, "Game not found.");
  const game = gameRow as Game;

  const trip = await loadTripWithPlayers(game.trip_id);
  const { playerId, opponentId } = resolvePlayerInTrip(trip, email);
  return { playerId, opponentId, trip, game, deal };
}

async function getLatestDealForGame(gameId: string): Promise<OnlineDeal> {
  const { data, error } = await supabaseAdmin
    .from("online_deals")
    .select("*")
    .eq("game_id", gameId)
    .order("hand_number", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new ApiError(404, "No deal found for this game.");
  return data as OnlineDeal;
}

export async function buildDealView(
  deal: OnlineDeal,
  game: Game,
  playerId: string,
  opponentId: string
): Promise<OnlineDealView> {
  const { data: handsRaw } = await supabaseAdmin
    .from("online_hands")
    .select("player_id, cards, discarded")
    .eq("deal_id", deal.id);
  const hands = (handsRaw ?? []) as { player_id: string; cards: Card[]; discarded: boolean }[];
  const mine = hands.find((h) => h.player_id === playerId);
  const theirs = hands.find((h) => h.player_id !== playerId);
  const revealed = deal.status === "counting" || deal.status === "completed";

  const isMyTurn =
    deal.status === "discarding" ? !(mine?.discarded ?? false) : deal.turn_player_id === playerId;

  // The crib's actual cards must stay hidden from both players until the
  // show — unlike the starter, which is cut face-up and visible throughout.
  const sanitizedDeal: OnlineDeal = revealed ? deal : { ...deal, crib: [] };

  return {
    deal: sanitizedDeal,
    game,
    playerId,
    opponentId,
    myCards: mine?.cards ?? [],
    opponentCards: revealed ? theirs?.cards ?? [] : null,
    opponentCardCount: theirs?.cards.length ?? 0,
    isDealer: deal.dealer_player_id === playerId,
    isMyTurn,
  };
}

async function playerName(playerId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("players").select("name").eq("id", playerId).single();
  return (data as { name: string } | null)?.name ?? "Your opponent";
}

// ---- dealing ----

async function dealNextHand(
  gameId: string,
  dealerId: string,
  player1Id: string,
  player2Id: string,
  handNumber: number
): Promise<OnlineDeal> {
  const deck = shuffle(freshDeck());
  const otherId = dealerId === player1Id ? player2Id : player1Id;
  const dealerCards = deck.slice(0, 6);
  const otherCards = deck.slice(6, 12);

  const { data: dealRow, error: dealError } = await supabaseAdmin
    .from("online_deals")
    .insert({ game_id: gameId, hand_number: handNumber, dealer_player_id: dealerId, status: "discarding" })
    .select()
    .single();
  if (dealError || !dealRow) throw new ApiError(500, "Couldn't deal the next hand.");
  const deal = dealRow as OnlineDeal;

  const { error: handsError } = await supabaseAdmin.from("online_hands").insert([
    { deal_id: deal.id, player_id: dealerId, cards: dealerCards, discarded: false },
    { deal_id: deal.id, player_id: otherId, cards: otherCards, discarded: false },
  ]);
  if (handsError) throw new ApiError(500, "Couldn't deal the next hand.");

  return deal;
}

export async function startOnlineGame(
  req: Request,
  tripId: string
): Promise<{ view: OnlineDealView }> {
  const email = await requireEmail(req);
  const trip = await loadTripWithPlayers(tripId);
  const { playerId } = resolvePlayerInTrip(trip, email);
  if (!trip.player1?.email || !trip.player2?.email) {
    throw new ApiError(400, "Both players need to sign in and link their profile before playing online.");
  }

  const { data: gameRow, error: gameError } = await supabaseAdmin
    .from("games")
    .insert({ trip_id: tripId, mode: "online", events: [] })
    .select()
    .single();
  if (gameError || !gameRow) throw new ApiError(500, "Couldn't start the game.");
  const game = gameRow as Game;

  const dealerId = shuffle([trip.player1_id, trip.player2_id])[0];
  const deal = await dealNextHand(game.id, dealerId, trip.player1_id, trip.player2_id, 1);

  const opponentId = playerId === trip.player1_id ? trip.player2_id : trip.player1_id;
  const starterName = await playerName(playerId);
  await sendPushToPlayer(opponentId, {
    title: "New online game",
    body: `${starterName} started an online game for ${trip.name} — discard when ready.`,
    url: `/trip/${trip.id}/online/${game.id}`,
  });

  return { view: await buildDealView(deal, game, playerId, opponentId) };
}

// ---- score application (shared by discard-heels, pegging, and counting) ----

async function applyGamePoints(
  game: Game,
  trip: Trip,
  playerId: string,
  points: number
): Promise<{ game: Game; won: boolean }> {
  if (points <= 0) return { game, won: false };
  const isP1 = playerId === trip.player1_id;
  const rawScore = (isP1 ? game.player1_score : game.player2_score) + points;
  const won = rawScore >= WINNING_SCORE;

  if (!won) {
    const fields = isP1 ? { player1_score: rawScore } : { player2_score: rawScore };
    const { data } = await supabaseAdmin.from("games").update(fields).eq("id", game.id).select().single();
    return { game: data as Game, won: false };
  }

  const p1Score = Math.min(WINNING_SCORE, isP1 ? rawScore : game.player1_score);
  const p2Score = Math.min(WINNING_SCORE, isP1 ? game.player2_score : rawScore);
  const result = computeGameResult(p1Score, p2Score, trip.base_amount_cents, false, trip.per_point_cents);
  const { data: deals } = await supabaseAdmin.from("online_deals").select("id").eq("game_id", game.id);
  const handsPlayed = (deals ?? []).length;

  const { data } = await supabaseAdmin
    .from("games")
    .update({
      player1_score: p1Score,
      player2_score: p2Score,
      status: "completed",
      winner_player: result.winnerPlayer,
      is_skunk: result.isSkunk,
      is_double_skunk: result.isDoubleSkunk,
      payout_cents: result.payoutCents,
      win_weight: result.winWeight,
      hands_played: handsPlayed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", game.id)
    .select()
    .single();
  return { game: data as Game, won: true };
}

// ---- discarding ----

export async function submitDiscard(
  req: Request,
  dealId: string,
  cards: [string, string]
): Promise<{ view: OnlineDealView }> {
  const email = await requireEmail(req);
  const { playerId, opponentId, trip, game, deal } = await loadDealContext(email, dealId);
  if (deal.status !== "discarding") throw new ApiError(400, "This deal isn't in the discarding phase.");

  const { data: handRow, error: handError } = await supabaseAdmin
    .from("online_hands")
    .select("cards, discarded")
    .eq("deal_id", dealId)
    .eq("player_id", playerId)
    .single();
  if (handError || !handRow) throw new ApiError(404, "Hand not found.");
  const hand = handRow as { cards: Card[]; discarded: boolean };
  if (hand.discarded) throw new ApiError(400, "You've already discarded for this hand.");
  if (cards.length !== 2 || cards[0] === cards[1] || !cards.every((c) => hand.cards.includes(c))) {
    throw new ApiError(400, "Pick 2 cards from your own hand.");
  }

  const remaining = hand.cards.filter((c) => !cards.includes(c));
  await supabaseAdmin
    .from("online_hands")
    .update({ cards: remaining, discarded: true })
    .eq("deal_id", dealId)
    .eq("player_id", playerId);

  const pendingCrib = [...deal.crib, ...cards];
  const { data: allHands } = await supabaseAdmin
    .from("online_hands")
    .select("player_id, cards, discarded")
    .eq("deal_id", dealId);
  const finalHands = (allHands ?? []) as { player_id: string; cards: Card[]; discarded: boolean }[];
  const bothDiscarded = finalHands.every((h) => h.discarded);

  if (!bothDiscarded) {
    const { data: updated } = await supabaseAdmin
      .from("online_deals")
      .update({ crib: pendingCrib })
      .eq("id", dealId)
      .select()
      .single();
    return { view: await buildDealView(updated as OnlineDeal, game, playerId, opponentId) };
  }

  // Both discarded — cut the starter from whatever's left of the deck.
  const usedCards = [...finalHands.flatMap((h) => h.cards), ...pendingCrib];
  const remainingDeck = freshDeck().filter((c) => !usedCards.includes(c));
  const starter = shuffle(remainingDeck)[0];
  const poneId = poneOf(deal.dealer_player_id, trip.player1_id, trip.player2_id);

  let currentGame = game;
  if (rankOf(starter) === "J") {
    const { game: updatedGame } = await applyGamePoints(currentGame, trip, deal.dealer_player_id, 2);
    currentGame = updatedGame;
  }

  const dealUpdate =
    currentGame.status === "completed"
      ? { crib: pendingCrib, starter_card: starter, status: "completed" as const, turn_player_id: null, completed_at: new Date().toISOString() }
      : { crib: pendingCrib, starter_card: starter, status: "pegging" as const, turn_player_id: poneId };
  const { data: updatedDeal } = await supabaseAdmin
    .from("online_deals")
    .update(dealUpdate)
    .eq("id", dealId)
    .select()
    .single();

  if (currentGame.status === "completed") {
    await sendPushToPlayer(opponentId, {
      title: "Game over",
      body: `The cut was a jack — ${trip.name} is over on his heels.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
  } else if (poneId !== playerId) {
    await sendPushToPlayer(poneId, {
      title: "Your move",
      body: `Both discarded — your turn to peg for ${trip.name}.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
  }

  return { view: await buildDealView(updatedDeal as OnlineDeal, currentGame, playerId, opponentId) };
}

// ---- pegging ----

export async function submitPlay(
  req: Request,
  dealId: string,
  card: string
): Promise<{ view: OnlineDealView }> {
  const email = await requireEmail(req);
  const { playerId, opponentId, trip, game, deal } = await loadDealContext(email, dealId);
  if (deal.status !== "pegging") throw new ApiError(400, "This deal isn't in the pegging phase.");
  if (deal.turn_player_id !== playerId) throw new ApiError(400, "It's not your turn.");

  const { data: hands } = await supabaseAdmin
    .from("online_hands")
    .select("player_id, cards")
    .eq("deal_id", dealId);
  const handRows = (hands ?? []) as { player_id: string; cards: Card[] }[];
  const myHand = handRows.find((h) => h.player_id === playerId);
  const oppHand = handRows.find((h) => h.player_id === opponentId);
  if (!myHand || !oppHand) throw new ApiError(404, "Hand not found.");
  if (!myHand.cards.includes(card)) throw new ApiError(400, "That card isn't in your hand.");

  const pileBefore = deal.pegging_pile.map((p) => p.card);
  if (!canPlay(pileBefore, card)) throw new ApiError(400, "That card would go over 31.");

  const { points } = scorePeggingPlay(pileBefore, card);
  const myHandAfter = myHand.cards.filter((c) => c !== card);
  await supabaseAdmin
    .from("online_hands")
    .update({ cards: myHandAfter })
    .eq("deal_id", dealId)
    .eq("player_id", playerId);

  const now = new Date().toISOString();
  const newPile = [...deal.pegging_pile, { player_id: playerId, card, at: now }];
  const newCount = pileCount(newPile.map((p) => p.card));
  const log: PeggingLogEntry[] = [
    ...deal.pegging_log,
    { player_id: playerId, card, points, note: newCount === 31 ? "thirty_one" : "play", at: now },
  ];

  let currentGame = game;
  if (points > 0) {
    const { game: updatedGame } = await applyGamePoints(currentGame, trip, playerId, points);
    currentGame = updatedGame;
  }

  if (currentGame.status === "completed") {
    const { data: updatedDeal } = await supabaseAdmin
      .from("online_deals")
      .update({ pegging_pile: newPile, pegging_count: newCount, pegging_log: log, status: "completed", turn_player_id: null, completed_at: now })
      .eq("id", dealId)
      .select()
      .single();
    await sendPushToPlayer(opponentId, {
      title: "Game over",
      body: `${await playerName(playerId)} just won ${trip.name}.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
    return { view: await buildDealView(updatedDeal as OnlineDeal, currentGame, playerId, opponentId) };
  }

  const bothHandsEmpty = myHandAfter.length === 0 && oppHand.cards.length === 0;
  let finalPile = newPile;
  let finalCount = newCount;
  let nextStatus: OnlineDeal["status"] = "pegging";
  let nextTurn: string | null = null;

  if (bothHandsEmpty) {
    if (newCount !== 31) {
      const { game: updatedGame } = await applyGamePoints(currentGame, trip, playerId, 1);
      currentGame = updatedGame;
      log.push({ player_id: playerId, card: null, points: 1, note: "go", at: now });
    }
    nextStatus = "counting";
    nextTurn = poneOf(deal.dealer_player_id, trip.player1_id, trip.player2_id);
  } else if (newCount === 31) {
    finalPile = [];
    finalCount = 0;
    nextTurn = oppHand.cards.length > 0 ? opponentId : playerId;
  } else {
    const oppCanPlay = oppHand.cards.some((c) => canPlay(newPile.map((p) => p.card), c));
    if (oppCanPlay) {
      nextTurn = opponentId;
    } else {
      const meCanPlay = myHandAfter.some((c) => canPlay(newPile.map((p) => p.card), c));
      if (meCanPlay) {
        log.push({ player_id: opponentId, card: null, points: 0, note: "go", at: now });
        nextTurn = playerId;
      } else {
        const { game: updatedGame } = await applyGamePoints(currentGame, trip, playerId, 1);
        currentGame = updatedGame;
        log.push({ player_id: playerId, card: null, points: 1, note: "go", at: now });
        if (currentGame.status === "completed") {
          nextStatus = "completed";
        } else {
          finalPile = [];
          finalCount = 0;
          nextTurn = oppHand.cards.length > 0 ? opponentId : playerId;
        }
      }
    }
  }

  if (currentGame.status === "completed" && nextStatus !== "completed") {
    nextStatus = "completed";
  }

  const { data: updatedDeal } = await supabaseAdmin
    .from("online_deals")
    .update({
      pegging_pile: finalPile,
      pegging_count: finalCount,
      pegging_log: log,
      status: nextStatus,
      turn_player_id: nextStatus === "completed" ? null : nextTurn,
      completed_at: nextStatus === "completed" ? now : null,
    })
    .eq("id", dealId)
    .select()
    .single();

  if (nextStatus === "completed") {
    await sendPushToPlayer(opponentId, {
      title: "Game over",
      body: `${await playerName(playerId)} just won ${trip.name}.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
  } else if (nextStatus === "counting" && nextTurn && nextTurn !== playerId) {
    await sendPushToPlayer(nextTurn, {
      title: "Your move",
      body: `Time to count your hand for ${trip.name}.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
  } else if (nextTurn && nextTurn !== playerId) {
    await sendPushToPlayer(nextTurn, {
      title: "Your move",
      body: `${await playerName(playerId)} played — your turn to peg for ${trip.name}.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
  }

  return { view: await buildDealView(updatedDeal as OnlineDeal, currentGame, playerId, opponentId) };
}

// ---- counting ----

type CountPhase = "pone_hand" | "dealer_hand" | "crib";

function currentCountPhase(deal: OnlineDeal): CountPhase | null {
  if (deal.pone_hand_points === null) return "pone_hand";
  if (deal.dealer_hand_points === null) return "dealer_hand";
  if (deal.crib_points === null) return "crib";
  return null;
}

export async function submitCount(
  req: Request,
  dealId: string,
  claimedPoints: number
): Promise<{ view: OnlineDealView }> {
  const email = await requireEmail(req);
  const { playerId, opponentId, trip, game, deal } = await loadDealContext(email, dealId);
  if (deal.status !== "counting") throw new ApiError(400, "This deal isn't in the counting phase.");

  const phase = currentCountPhase(deal);
  if (!phase) throw new ApiError(400, "This deal has already been fully counted.");

  const dealerId = deal.dealer_player_id;
  const poneId = poneOf(dealerId, trip.player1_id, trip.player2_id);
  const expectedCounter = phase === "pone_hand" ? poneId : dealerId;
  if (playerId !== expectedCounter) throw new ApiError(400, "It's not your turn to count.");
  if (!deal.starter_card) throw new ApiError(500, "Missing starter card.");

  const { data: hands } = await supabaseAdmin
    .from("online_hands")
    .select("player_id, cards")
    .eq("deal_id", dealId);
  const handRows = (hands ?? []) as { player_id: string; cards: Card[] }[];

  let cardsToScore: Card[];
  let isCrib = false;
  let scoringPlayerId: string;
  if (phase === "pone_hand") {
    cardsToScore = handRows.find((h) => h.player_id === poneId)?.cards ?? [];
    scoringPlayerId = poneId;
  } else if (phase === "dealer_hand") {
    cardsToScore = handRows.find((h) => h.player_id === dealerId)?.cards ?? [];
    scoringPlayerId = dealerId;
  } else {
    cardsToScore = deal.crib;
    isCrib = true;
    scoringPlayerId = dealerId;
  }

  const trueScore = scoreHand(cardsToScore, deal.starter_card, isCrib).total;
  const applied = Math.max(0, Math.min(claimedPoints, trueScore));

  const columnByPhase = { pone_hand: "pone_hand_points", dealer_hand: "dealer_hand_points", crib: "crib_points" } as const;
  const { game: updatedGame } = await applyGamePoints(game, trip, scoringPlayerId, applied);

  if (updatedGame.status === "completed") {
    const { data: updatedDeal } = await supabaseAdmin
      .from("online_deals")
      .update({ [columnByPhase[phase]]: applied, status: "completed", turn_player_id: null, completed_at: new Date().toISOString() })
      .eq("id", dealId)
      .select()
      .single();
    await sendPushToPlayer(opponentId, {
      title: "Game over",
      body: `${await playerName(scoringPlayerId)} just won ${trip.name}.`,
      url: `/trip/${trip.id}/online/${game.id}`,
    });
    return { view: await buildDealView(updatedDeal as OnlineDeal, updatedGame, playerId, opponentId) };
  }

  if (phase !== "crib") {
    // Dealer counts next either way — their own hand after pone's, or the
    // crib after their own hand.
    const nextTurn = dealerId;
    const { data: updatedDeal } = await supabaseAdmin
      .from("online_deals")
      .update({ [columnByPhase[phase]]: applied, turn_player_id: nextTurn })
      .eq("id", dealId)
      .select()
      .single();
    if (nextTurn !== playerId) {
      await sendPushToPlayer(nextTurn, {
        title: "Your move",
        body: `Your turn to count for ${trip.name}.`,
        url: `/trip/${trip.id}/online/${game.id}`,
      });
    }
    return { view: await buildDealView(updatedDeal as OnlineDeal, updatedGame, playerId, opponentId) };
  }

  // Crib counted, game continues — finish this deal and deal the next hand.
  await supabaseAdmin
    .from("online_deals")
    .update({ crib_points: applied, status: "completed", turn_player_id: null, completed_at: new Date().toISOString() })
    .eq("id", dealId);

  const nextDealerId = nextDealer(dealerId, trip.player1_id, trip.player2_id);
  const newDeal = await dealNextHand(game.id, nextDealerId, trip.player1_id, trip.player2_id, deal.hand_number + 1);

  await Promise.all(
    [trip.player1_id, trip.player2_id]
      .filter((id) => id !== playerId)
      .map((id) =>
        sendPushToPlayer(id, {
          title: "New hand",
          body: `A new hand's been dealt for ${trip.name} — discard when ready.`,
          url: `/trip/${trip.id}/online/${game.id}`,
        })
      )
  );

  return { view: await buildDealView(newDeal, updatedGame, playerId, opponentId) };
}

// ---- state / cancel ----

export async function getOnlineGameState(req: Request, gameId: string): Promise<{ view: OnlineDealView }> {
  const email = await requireEmail(req);
  const { data: gameRow, error: gameError } = await supabaseAdmin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !gameRow) throw new ApiError(404, "Game not found.");
  const game = gameRow as Game;
  const trip = await loadTripWithPlayers(game.trip_id);
  const { playerId, opponentId } = resolvePlayerInTrip(trip, email);
  const deal = await getLatestDealForGame(gameId);
  return { view: await buildDealView(deal, game, playerId, opponentId) };
}

export async function cancelOnlineGame(req: Request, gameId: string): Promise<void> {
  const email = await requireEmail(req);
  const { data: gameRow, error: gameError } = await supabaseAdmin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !gameRow) throw new ApiError(404, "Game not found.");
  const game = gameRow as Game;
  const trip = await loadTripWithPlayers(game.trip_id);
  resolvePlayerInTrip(trip, email); // throws if not a tied player
  const { error } = await supabaseAdmin.from("games").delete().eq("id", gameId);
  if (error) throw new ApiError(500, "Couldn't cancel the game.");
}

export async function subscribeToPush(
  req: Request,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  const email = await requireEmail(req);
  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!player) throw new ApiError(404, "No linked player for this account yet.");
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      player_id: (player as { id: string }).id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new ApiError(500, "Couldn't save that subscription.");
}
