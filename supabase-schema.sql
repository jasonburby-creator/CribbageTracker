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
  latitude double precision,
  longitude double precision,
  payout_cents integer,
  win_weight smallint,
  hands_played integer,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- In case you're re-running this after an earlier version of the schema:
alter table games add column if not exists is_tie_flip boolean not null default false;
alter table games add column if not exists location text;
alter table games add column if not exists photo_url text;
alter table games add column if not exists hands_played integer;
alter table games add column if not exists latitude double precision;
alter table games add column if not exists longitude double precision;
alter table trips add column if not exists per_point_cents integer not null default 10;

-- Scores can never exceed 121 (the winning score). Cap any legacy rows first,
-- then hard-guarantee it at the database level so no path can ever store more.
update games set player1_score = 121 where player1_score > 121;
update games set player2_score = 121 where player2_score > 121;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_scores_max_121'
  ) then
    alter table games add constraint games_scores_max_121
      check (player1_score <= 121 and player2_score <= 121);
  end if;
end $$;

create index if not exists idx_games_trip_id on games(trip_id);
create index if not exists idx_trips_status on trips(status);

-- Google login (Phase A — additive only, nothing is restricted by this
-- section). Links a player to the Google account that's allowed to score and
-- edit trips they're part of. Nullable: most rows won't have one until that
-- person signs in and claims it (see the app's "claim your player" flow).
alter table players add column if not exists email text unique;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'players_email_lowercase'
  ) then
    alter table players add constraint players_email_lowercase
      check (email = lower(email));
  end if;
end $$;

-- Returns whether the currently-authenticated request's Google email matches
-- either player on the given trip. security definer so it can read
-- players.email regardless of the caller's own column privileges (see the
-- Phase B column grants below) — the check itself still only ever returns a
-- boolean, so callers (including anonymous ones, via RPC) never learn any
-- player's actual email address.
create or replace function public.is_tied_to_trip(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    join players p1 on p1.id = t.player1_id
    join players p2 on p2.id = t.player2_id
    where t.id = p_trip_id
      and (p1.email = lower(coalesce(auth.jwt() ->> 'email', ''))
           or p2.email = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;
grant execute on function public.is_tied_to_trip(uuid) to anon, authenticated;

-- Same idea for a game photo's storage object name (stored as `${gameId}.jpg`).
create or replace function public.is_tied_to_game_photo(object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  begin
    gid := split_part(object_name, '.', 1)::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from games g where g.id = gid and public.is_tied_to_trip(g.trip_id)
  );
end;
$$;
grant execute on function public.is_tied_to_game_photo(text) to anon, authenticated;

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

-- Needed to REPLACE a photo: uploading over an existing file (upsert) is an
-- update on storage.objects, so without this, replacing a game's photo fails.
drop policy if exists "public update game photos" on storage.objects;
create policy "public update game photos" on storage.objects
  for update using (bucket_id = 'game-photos') with check (bucket_id = 'game-photos');

-- Needed to clean up photos when a game or trip is deleted.
drop policy if exists "public delete game photos" on storage.objects;
create policy "public delete game photos" on storage.objects
  for delete using (bucket_id = 'game-photos');
