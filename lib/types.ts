export type Player = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
};

export type Trip = {
  id: string;
  name: string;
  board_name: string;
  base_amount_cents: number;
  per_point_cents: number;
  player1_id: string;
  player2_id: string;
  status: "active" | "archived";
  created_at: string;
  ended_at: string | null;
  is_demo: boolean;
  paid_at: string | null;
  paid_on: string | null;
  paid_method: string | null;
  paid_by_player_id: string | null;
  // joined
  player1?: Player;
  player2?: Player;
};

export type ScoreEvent = {
  player: 1 | 2;
  points: number;
  at: string;
};

export type Game = {
  id: string;
  trip_id: string;
  player1_score: number;
  player2_score: number;
  status: "in_progress" | "completed";
  winner_player: 1 | 2 | null;
  is_skunk: boolean;
  is_double_skunk: boolean;
  is_tie_flip: boolean;
  location: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  payout_cents: number | null;
  win_weight: number | null;
  hands_played: number | null;
  events: ScoreEvent[];
  created_at: string;
  completed_at: string | null;
  // "online" games are dealt and refereed by the server (see app/api/online/*)
  // instead of tapped in manually — everything else about the row is identical.
  mode: "manual" | "online";
};

// One deal (hand) of an online game — see supabase-schema.sql. Card = a
// 2-character string like "AS"/"TH"/"JD" (see lib/cribbage/deck.ts).
export type OnlineDealStatus = "discarding" | "pegging" | "counting" | "completed";

export type PeggingPlay = { player_id: string; card: string; at: string };
// One line of the play-by-play log — a real play (points may be 0), or a
// synthetic "go"/reset marker (card is null for those).
export type PeggingLogEntry = {
  player_id: string;
  card: string | null;
  points: number;
  note: "play" | "go" | "thirty_one" | "reset";
  at: string;
};

export type OnlineDeal = {
  id: string;
  game_id: string;
  hand_number: number;
  dealer_player_id: string;
  turn_player_id: string | null;
  status: OnlineDealStatus;
  starter_card: string | null;
  crib: string[];
  pegging_pile: PeggingPlay[];
  pegging_count: number;
  pegging_log: PeggingLogEntry[];
  pone_hand_points: number | null;
  dealer_hand_points: number | null;
  crib_points: number | null;
  created_at: string;
  completed_at: string | null;
};

// The tailored, per-player view returned by GET /api/online/state — never the
// raw table rows (see lib/permissions and the API routes for why).
export type OnlineDealView = {
  deal: OnlineDeal;
  game: Game;
  playerId: string;
  opponentId: string;
  // Your own cards. Populated for the requesting player only; during
  // discarding/pegging this is your hand, during counting/completed it's
  // whatever you held into the show (still 4 cards).
  myCards: string[];
  // Opponent's cards — null (hidden) during discarding/pegging, revealed
  // once status is "counting" or "completed".
  opponentCards: string[] | null;
  opponentCardCount: number;
  isDealer: boolean;
  isMyTurn: boolean;
};
