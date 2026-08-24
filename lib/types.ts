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
};
