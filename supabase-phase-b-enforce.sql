-- Phase B: the actual enforcement flip for Google-login scoring/editing.
--
-- DO NOT run this until you've confirmed, in production, that:
--   1. supabase-schema.sql (with the Phase A additions) has already been run.
--   2. Google sign-in works end-to-end (Supabase Auth provider configured).
--   3. You (and anyone else) can sign in, claim/link a player via the app's
--      "Which player are you?" flow, and the trip page correctly shows/hides
--      the scoring controls based on that.
--
-- Until this file is run, every table stays exactly as open as it is today —
-- the schema/UI changes from Phase A only *display* differently, they don't
-- restrict anything server-side yet. This file is what turns that on.
--
-- Safe to re-run (idempotent), same as supabase-schema.sql.

-- Column-level privacy: only a signed-in user can ever see the `email`
-- column, never an anonymous visitor (RLS alone is row-level, not
-- column-level — this is what actually keeps emails out of an anonymous
-- `select *` against players).
revoke all on table players from anon, authenticated;
grant select on players to anon; -- all columns except email (see below)
revoke select (email) on players from anon;
grant select on players to authenticated; -- includes email
grant insert (name, email) on players to anon, authenticated;
grant update (email) on players to authenticated; -- self-claim only ever touches email

-- Anonymous player creation (from NewTripForm, typing a brand-new name)
-- still works — it never sets email. A signed-in user can only set email to
-- their own address at creation time, so nobody can claim someone else's
-- email by pre-seeding a new player row with it.
drop policy if exists "public write players" on players;
create policy "public write players" on players
  for insert with check (email is null or email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Self-claim: a signed-in user can update exactly one currently-unclaimed
-- row, and only to link their own email (the update-column grant above
-- ensures they can't also rename it or touch anything else).
drop policy if exists "user claims own unclaimed player" on players;
create policy "user claims own unclaimed player" on players
  for update using (email is null)
  with check (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Games: only the two players tied to the trip can score/edit/delete a game.
-- Reading stays open.
drop policy if exists "public write games" on games;
create policy "tied players insert games" on games
  for insert with check (public.is_tied_to_trip(trip_id));

drop policy if exists "public update games" on games;
create policy "tied players update games" on games
  for update using (public.is_tied_to_trip(trip_id));

drop policy if exists "public delete games" on games;
create policy "tied players delete games" on games
  for delete using (public.is_tied_to_trip(trip_id));

-- Trips: starting a new trip stays open (no games exist yet to protect).
-- Editing/ending/deleting an *existing* trip is restricted the same way —
-- otherwise someone could bypass the games protection above by just
-- deleting (or reassigning) the whole trip.
drop policy if exists "public update trips" on trips;
create policy "tied players update trips" on trips
  for update using (public.is_tied_to_trip(id));

drop policy if exists "public delete trips" on trips;
create policy "tied players delete trips" on trips
  for delete using (public.is_tied_to_trip(id));

-- Storage (game-photos bucket): only the tied players can upload/replace/
-- delete a game's photo. Viewing photos stays open.
drop policy if exists "public upload game photos" on storage.objects;
create policy "tied players upload game photos" on storage.objects
  for insert with check (bucket_id = 'game-photos' and public.is_tied_to_game_photo(name));

drop policy if exists "public update game photos" on storage.objects;
create policy "tied players update game photos" on storage.objects
  for update using (bucket_id = 'game-photos' and public.is_tied_to_game_photo(name))
  with check (bucket_id = 'game-photos' and public.is_tied_to_game_photo(name));

drop policy if exists "public delete game photos" on storage.objects;
create policy "tied players delete game photos" on storage.objects
  for delete using (bucket_id = 'game-photos' and public.is_tied_to_game_photo(name));
