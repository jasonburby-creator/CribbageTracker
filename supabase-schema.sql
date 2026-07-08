-- Cribbage Tracker schema
-- Safe to run this whole file top-to-bottom any number of times —
-- every statement either checks first or replaces cleanly, so re-running
-- it after an update (or after a partial/failed run) won't error out.

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

-- In case you're re-running this after an earlier version of the schema:
alter table games add column if not exists is_tie_flip boolean not null default false;
alter table games add column if not exists location text;
alter table games add column if not exists photo_url text;
alter table trips add column if not exists per_point_cents integer not null default 10;

create index if not exists idx_games_trip_id on games(trip_id);
create index if not exists idx_trips_status on trips(status);

-- Enable realtime updates for live multi-device score tracking.
-- Guarded because Supabase sometimes auto-enrolls new tables in this
-- publication, which makes a plain "alter publication ... add table" error
-- on a second run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table trips;
  end if;
end $$;

-- Row Level Security: open policies since this is a private, no-login family app.
-- If you ever make this public-facing, tighten these.
alter table players enable row level security;
alter table trips enable row level security;
alter table games enable row level security;

drop policy if exists "public read players" on players;
create policy "public read players" on players for select using (true);
drop policy if exists "public write players" on players;
create policy "public write players" on players for insert with check (true);

drop policy if exists "public read trips" on trips;
create policy "public read trips" on trips for select using (true);
drop policy if exists "public write trips" on trips;
create policy "public write trips" on trips for insert with check (true);
drop policy if exists "public update trips" on trips;
create policy "public update trips" on trips for update using (true);
drop policy if exists "public delete trips" on trips;
create policy "public delete trips" on trips for delete using (true);

drop policy if exists "public read games" on games;
create policy "public read games" on games for select using (true);
drop policy if exists "public write games" on games;
create policy "public write games" on games for insert with check (true);
drop policy if exists "public update games" on games;
create policy "public update games" on games for update using (true);
drop policy if exists "public delete games" on games;
create policy "public delete games" on games for delete using (true);

-- Storage bucket for the one winner's-choice photo per game.
insert into storage.buckets (id, name, public)
values ('game-photos', 'game-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read game photos" on storage.objects;
create policy "public read game photos" on storage.objects
  for select using (bucket_id = 'game-photos');

drop policy if exists "public upload game photos" on storage.objects;
create policy "public upload game photos" on storage.objects
  for insert with check (bucket_id = 'game-photos');
