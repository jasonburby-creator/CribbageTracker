import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cribbage rules — Skunk Life",
  description: "How to play two-player cribbage, and how Skunk Life scores it.",
};

type Suit = "♠" | "♥" | "♦" | "♣";

// A small stand-in for a real playing card — fixed cream/ivory face regardless
// of the app's light/dark theme, same as a photo of an actual card would be.
function Card({ rank, suit }: { rank: string; suit: Suit }) {
  const red = suit === "♥" || suit === "♦";
  return (
    <div
      className={`w-11 h-14 shrink-0 rounded-md border border-black/15 bg-[#F7F3E9] flex flex-col items-center justify-center leading-none ${
        red ? "text-skunk" : "text-ink"
      }`}
    >
      <span className="font-score text-sm">{rank}</span>
      <span className="text-lg mt-0.5">{suit}</span>
    </div>
  );
}

function CardExample({
  cards,
  label,
}: {
  cards: { rank: string; suit: Suit }[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {cards.map((c, i) => (
          <Card key={i} rank={c.rank} suit={c.suit} />
        ))}
      </div>
      <p className="text-sm text-track/70">{label}</p>
    </div>
  );
}

export default function RulesPage() {
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
          Cribbage Rules
        </h1>
        <p className="text-xs text-track/50 mt-2">Two-player, straight through</p>
      </header>

      <a
        href="https://www.youtube.com/watch?v=YrUYQ-AhLpI"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center border border-brass/40 text-brass-light rounded-lg px-5 py-3 text-sm mb-8"
      >
        ▶ Prefer watching? Full how-to-play video on YouTube
      </a>

      <div className="space-y-8 text-base text-track/80 leading-relaxed">
        <section>
          <h2 className="font-display text-lg text-track mb-2">Object</h2>
          <p>
            First player to score 121 points wins. Points come from two
            places every hand: pegging points during the play, and counting
            points when hands are shown afterward.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Deal and the crib
          </h2>
          <p>
            Cut for first deal — lower card deals. The dealer shuffles and
            deals 6 cards to each player. Each player looks at their 6 and
            discards 2, face down, into a shared pile called{" "}
            <strong className="text-track">the crib</strong>. The crib
            belongs to the dealer and gets counted at the end of the hand
            like a third hand — so the dealer usually wants to keep good cards
            and stick their opponent with awkward discards, while the
            non-dealer often keeps their best 4 and discards cards least
            likely to help the dealer.
          </p>
          <p className="mt-2">
            The deal rotates after every hand, so the dealer&rsquo;s edge
            (the crib) evens out over a game.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">The cut</h2>
          <p>
            After discarding, the non-dealer cuts the remaining deck. The
            dealer turns over the top card of the bottom half — this is the{" "}
            <strong className="text-track">starter</strong>, and it counts as
            a 5th card for every hand (and the crib) when they&rsquo;re
            counted later. If the starter is a Jack, the dealer immediately
            pegs 2 points, traditionally called{" "}
            <strong className="text-track">&ldquo;his heels.&rdquo;</strong>
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            The play (pegging)
          </h2>
          <p>
            Starting with the non-dealer, players take turns placing one card
            face-up in front of them, calling out the running total of all
            cards played so far (face cards count 10, Ace counts 1). The
            total can never exceed 31. If you can&rsquo;t play a card without
            going over, you say{" "}
            <strong className="text-track">&ldquo;go&rdquo;</strong> and your
            opponent keeps playing (scoring a point for the go, or 2 if they
            hit exactly 31) until they can&rsquo;t either. Then the count
            resets to zero and the person who called go leads next.
          </p>
          <p className="mt-2">Points during the play:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-1 marker:text-brass-light/50">
            <li>Bringing the count to exactly 15 — 2 points</li>
            <li>Bringing the count to exactly 31 — 2 points</li>
            <li>Pair (matching rank as the card just played) — 2 points</li>
            <li>Three of a kind in a row — 6 points</li>
            <li>Four of a kind in a row — 12 points</li>
            <li>
              A run of 3+ in a row, any order (e.g. 4-2-3) — 1 point per card
            </li>
            <li>Last card played when neither can go further — 1 point</li>
          </ul>

          <div className="mt-4 rounded-lg border border-brass/25 bg-walnut-light/10 p-3 space-y-3">
            <p className="text-xs uppercase tracking-widest text-brass-light/60">
              Fifteens, shown
            </p>
            <p className="text-xs text-track/50 -mt-2">
              Face cards always count as 10 — any cards adding up to 15
              score 2 points, no matter how many cards it takes.
            </p>
            <CardExample
              cards={[
                { rank: "9", suit: "♠" },
                { rank: "6", suit: "♥" },
              ]}
              label="9 + 6 = 15 → 2 points"
            />
            <CardExample
              cards={[
                { rank: "K", suit: "♦" },
                { rank: "5", suit: "♣" },
              ]}
              label="K (=10) + 5 = 15 → 2 points"
            />
            <CardExample
              cards={[
                { rank: "8", suit: "♥" },
                { rank: "4", suit: "♠" },
                { rank: "3", suit: "♦" },
              ]}
              label="8 + 4 + 3 = 15 → 2 points"
            />
          </div>

          <div className="mt-4 rounded-lg border border-brass/25 bg-walnut-light/10 p-3 space-y-3">
            <p className="text-xs uppercase tracking-widest text-brass-light/60">
              Runs count in any order
            </p>
            <CardExample
              cards={[
                { rank: "6", suit: "♠" },
                { rank: "4", suit: "♥" },
                { rank: "5", suit: "♦" },
              ]}
              label="Played in this order…"
            />
            <CardExample
              cards={[
                { rank: "4", suit: "♥" },
                { rank: "5", suit: "♦" },
                { rank: "6", suit: "♠" },
              ]}
              label="…is still a run of 3 → 3 points"
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            The show (counting hands)
          </h2>
          <p>
            Once all cards are played, each hand is counted with the starter
            card added in — non-dealer&rsquo;s hand first, then the
            dealer&rsquo;s, then the dealer counts the crib (also with the
            starter). Every scoring combination found in the 5 cards counts,
            and combinations can overlap and stack.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-1 marker:text-brass-light/50">
            <li>Every combination of cards adding to 15 — 2 points each</li>
            <li>Pair — 2 points; three of a kind — 6; four of a kind — 12</li>
            <li>Run of 3, 4, or 5 — 1 point per card in the run</li>
            <li>
              Flush: all 4 hand cards the same suit — 4 points, plus 1 more
              if the starter matches too (5 points). The crib only counts a
              flush if all 5 cards, starter included, match.
            </li>
            <li>
              &ldquo;His nobs&rdquo;: a Jack in hand matching the
              starter&rsquo;s suit — 1 point
            </li>
          </ul>
          <p className="mt-2 text-xs text-track/50">
            A hand with nothing scoring is called{" "}
            <strong className="text-track/70">&ldquo;19,&rdquo;</strong> a bit
            of cribbage tradition — 19 isn&rsquo;t reachable as an actual hand
            score, so it&rsquo;s shorthand for zero.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg text-track mb-2">
            Winning — and skunks
          </h2>
          <p>
            First to 121 wins outright. Traditionally, if the loser hasn&rsquo;t
            reached 91 points, that&rsquo;s a{" "}
            <strong className="text-track">skunk</strong> — a bigger win. Under
            61 is a <strong className="text-track">double skunk</strong> —
            bigger still.
          </p>
          <p className="mt-2">
            Skunk Life bakes this straight into the payout: the winner gets
            the trip&rsquo;s base stake plus a per-point bonus for the score
            differential, and a skunk doubles both the base and the per-point
            rate — a double skunk doubles it again. If the cut for deal was
            tied at the start of the game, that doubles the whole payout too,
            stacking with any skunk. Score it live and the app works all of
            this out for you automatically.
          </p>
        </section>

        <section className="text-center pt-2">
          <Link
            href="/about"
            className="inline-block border border-brass/40 text-brass-light rounded-lg px-5 py-3 text-sm"
          >
            ← How Skunk Life works
          </Link>
        </section>
      </div>
    </main>
  );
}
