import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works — Skunk Life",
  description: "What Skunk Life is and how to use it on a trip.",
};

export default function AboutPage() {
  return (
    <main className="max-w-md mx-auto px-5 py-10">
      <Link href="/" className="text-sm text-brass-light/60">
        ← Trips
      </Link>

      <header className="text-center mt-2 mb-8">
        <p className="uppercase tracking-[0.35em] text-brass-light/70 text-xs mb-2">
          Skunk Life
        </p>
        <h1 className="font-display italic text-3xl text-track">
          How it works
        </h1>
      </header>

      <div className="space-y-8 text-base text-track/80 leading-relaxed">
        <section>
          <h2 className="font-display text-lg text-track mb-2">
            All you need is a deck of cards
          </h2>
          <p>
            Skunk Life is a live scorekeeper and money tracker for cribbage
            trips — the games friends and family play across a whole trip,
            for real stakes. There&rsquo;s no board to pack, no pencil and
            paper to lose. Bring a standard 52-card deck; the app handles the
            pegging board, the math, and the running tab of who owes whom.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Start a trip
          </h2>
          <p>
            Name the trip, give the board a name (and a theme, just for fun —
            it&rsquo;s recorded but not required to mean anything), set a base
            win amount, and pick your two players. Type a name you&rsquo;ve
            used before or a brand-new one — either works.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Deal, and score as you go
          </h2>
          <p>
            Tap <strong className="text-track">Deal a new game</strong> to
            start live scoring. As you peg during play, tap the point buttons
            that match what you counted — there&rsquo;s a custom-number field
            for anything not on the quick list, an undo button for the last
            tap, and an adjust screen if a count needs fixing after the fact.
            The board updates instantly on every phone watching, so whoever&rsquo;s
            keeping score doesn&rsquo;t have to be the only one looking.
          </p>
          <p className="mt-2">
            Played a game already, off the app? Use{" "}
            <strong className="text-track">Log a game already played</strong>{" "}
            to enter the final score directly instead of pegging it live.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Skunks and payouts
          </h2>
          <p>
            The app auto-detects the win at 121 and figures out the payout:
            the winner gets the base amount plus a per-point bonus for the
            score differential. If the loser finishes under 91, that&rsquo;s a{" "}
            <strong className="text-track">skunk</strong> — both the base
            amount and the per-point rate double. Under 61 is a{" "}
            <strong className="text-track">double skunk</strong> — it doubles
            again on top of that. A tied cut for deal doubles the odds for
            that whole game, stacking with any skunk. Full formulas are on
            the{" "}
            <Link href="/rules" className="underline underline-offset-4">
              cribbage rules
            </Link>{" "}
            page.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Photos and memories
          </h2>
          <p>
            After each game, the winner can add one photo — it shows up next
            to that game in the log, and if it has a location baked in (or
            you had location sharing on), it&rsquo;ll show up on the trip&rsquo;s map
            too. Once a trip has photos, a{" "}
            <strong className="text-track">Trip review</strong> button
            appears — a slideshow of every photo from the trip, with a map of
            where you played if any games have a location.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Ending a trip
          </h2>
          <p>
            When the trip&rsquo;s over, <strong className="text-track">End
            trip &amp; archive</strong> moves it to Past Trips — fully
            read-only from then on, for looking back later.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Signing in
          </h2>
          <p>
            Anyone with the link can always view a trip — no login needed to
            watch scores update or browse the archive. Signing in with Google
            personalizes your home screen to show your own trips first, and
            it&rsquo;s what lets you actually score and edit the trips
            you&rsquo;re part of. The first time you sign in, you&rsquo;ll be
            asked which player you are — pick yourself from the list, or add
            yourself if you&rsquo;re new.
          </p>
        </section>

        <section className="text-center pt-2">
          <Link
            href="/rules"
            className="inline-block border border-brass/40 text-brass-light rounded-lg px-5 py-3 text-sm"
          >
            New to cribbage? Read the rules →
          </Link>
        </section>
      </div>
    </main>
  );
}
