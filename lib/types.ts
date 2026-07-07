export type Player = {
  id: string;
  name: string;
  created_at: string;
};

export type Trip = {
  id: string;
  name: string;
  board_name: string;
  board_theme: string | null;
  base_amount_cents: number;
  per_point_cents: number;
  player1_id: string;
  player2_id: string;
  status: "active" | "archived";
  created_at: string;
  ended_at: string | null;
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
  payout_cents: number | null;
  win_weight: number | null;
  events: ScoreEvent[];
  created_at: string;
  completed_at: string | null;
};
