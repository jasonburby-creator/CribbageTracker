# Skunk Line — Cribbage Trip Tracker

Live cribbage scoring with a real pegging-board visual, trip winnings, skunks,
and an archive of past trips. Built with Next.js + Supabase, same stack as
your other apps.

## How the scoring works

- Each trip has a base win amount you set at the start (e.g. $1.00).
- Winner of each game gets: `base amount + 10¢ × (winner's score − loser's score)`.
- **Skunk** (loser under 91): base amount AND the 10¢ rate both double.
- **Double skunk** (loser under 61): doubles again on top of that (4× total).
- Win counts: normal win = 1, skunk = 2, double skunk = 4 — shown as "weighted wins."
- Standard 121-point game, scores tracked live as you peg.

## Setup (same drag-and-drop flow as your other apps)

1. **Supabase** — open your existing Supabase project (the same one your
   other apps use), go to the SQL Editor, and run everything in
   `supabase-schema.sql`. This creates the `players`, `trips`, and `games`
   tables and turns on realtime sync so multiple phones see the same live
   score.

2. **GitHub** — create a new repo, drag-and-drop all these files in
   (including the `app`, `components`, `lib`, and `public` folders), and
   commit.

3. **Vercel** — import the repo. In the project's Environment Variables,
   add:
   - `NEXT_PUBLIC_SUPABASE_URL` — same value as your other apps
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same value as your other apps

   Deploy. Vercel builds it automatically — no local `npm install` needed
   on your end.

4. **On your phone** — open the deployed URL, add to home screen. It'll
   install like a normal app (PWA).

## Using it

- **Start a trip**: name it, name the board, optionally describe what it
  looks like (just for fun — it's not rendered, just recorded), set the
  base win amount, and pick the two players (type a new name the first
  time, pick from the list after that).
- **Deal a new game** to start live scoring. Tap point buttons as you peg
  during play; there's a custom-number field for anything not on the quick
  list, and an undo button if you misTap.
- The board auto-detects the win at 121, calculates skunk/double-skunk, and
  logs the payout.
- **Trip totals** update live: weighted wins, skunks, and who owes whom.
- **End trip & archive** once you're done — it moves to Past Trips, fully
  read-only, for looking back later.

- After each game, the winner can add one photo (camera or library). It's
  stored in Supabase Storage and shows up next to that game in the log —
  running the updated `supabase-schema.sql` sets up the storage bucket
  automatically, nothing extra to configure.

## Notes

- No login — this is a private family app. Anyone with the link can view
  and score (matches how you use your other trip apps).
- Currency is USD throughout, regardless of which country you're in.
