-- Cribbage Tracker schema
-- Run this in your Supabase project's SQL editor (safe to run once).

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  board_name text not null,
  board_theme text,
  base_amount_cents integer not null default 100,
  per_point_cents integer not null default 10,
  player1_id uuid not null references players(id),
  player2_id uuid not null references players(id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  winner_player smallint check (winner_player in (1, 2)),
  is_skunk boolean not null default false,
  is_double_skunk boolean not null default false,
  is_tie_flip boolean not null default false,
  location text,
  photo_url text,
  payout_cents integer,
  win_weight smallint,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_games_trip_id on games(trip_id);
create index if not exists idx_trips_status on trips(status);

-- Enable realtime updates for live multi-device score tracking
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table trips;

-- Row Level Security: open policies since this is a private, no-login family app.
-- If you ever make this public-facing, tighten these.
alter table players enable row level security;
alter table trips enable row level security;
alter table games enable row level security;

create policy "public read players" on players for select using (true);
create policy "public write players" on players for insert with check (true);

create policy "public read trips" on trips for select using (true);
create policy "public write trips" on trips for insert with check (true);
create policy "public update trips" on trips for update using (true);

create policy "public read games" on games for select using (true);
create policy "public write games" on games for insert with check (true);
create policy "public update games" on games for update using (true);

-- Safe to re-run: adds tie-flip and location tracking if you already ran
-- an earlier version of this schema.
alter table games add column if not exists is_tie_flip boolean not null default false;
alter table games add column if not exists location text;
alter table games add column if not exists photo_url text;
alter table trips add column if not exists per_point_cents integer not null default 10;

-- Storage bucket for the one winner's-choice photo per game.
insert into storage.buckets (id, name, public)
values ('game-photos', 'game-photos', true)
on conflict (id) do nothing;

create policy "public read game photos" on storage.objects
  for select using (bucket_id = 'game-photos');

create policy "public upload game photos" on storage.objects
  for insert with check (bucket_id = 'game-photos');
