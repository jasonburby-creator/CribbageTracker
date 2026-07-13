import { formatCents } from "@/lib/scoring";
import type { HeadToHead } from "@/lib/scoring";

// All-time head-to-head record(s) across every trip. Usually one card
// (the recurring pair), but supports multiple distinct pairings.
export default function HeadToHeadTally({ heads }: { heads: HeadToHead[] }) {
  const withGames = heads.filter((h) => h.gamesPlayed > 0);
  if (withGames.length === 0) return null;

  return (
    <div className="space-y-3 mb-8">
      {withGames.map((h) => {
        const [a, b] = h.players;
        // net from a's perspective: positive means a is up on b.
        const net = a.netCents;
        // All-time tallies: games played and combined win-points.
        const totalPoints = a.winPoints + b.winPoints;
        return (
          <div
            key={h.key}
            className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4"
          >
            <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-3">
              All-time · {a.name} vs {b.name} · {h.gamesPlayed} game
              {h.gamesPlayed === 1 ? "" : "s"} · {totalPoints} pt
              {totalPoints === 1 ? "" : "s"} total
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[a, b].map((p) => {
                const avgMargin = p.wins > 0 ? p.winMarginSum / p.wins : null;
                const hasHands = p.handsTotal > 0;
                return (
                  <div key={p.playerId}>
                    <p className="font-display text-lg text-track">{p.name}</p>
                    <p className="text-sm text-track/70">
                      <span className="font-score text-track">{p.wins}</span> win
                      {p.wins === 1 ? "" : "s"}
                      <span className="text-track/50">
                        {" "}
                        ({p.winPoints} pt{p.winPoints === 1 ? "" : "s"})
                      </span>
                    </p>
                    {(p.skunks > 0 || p.doubleSkunks > 0) && (
                      <p className="text-xs text-skunk">
                        {p.skunks > 0
                          ? `${p.skunks} skunk${p.skunks === 1 ? "" : "s"} `
                          : ""}
                        {p.doubleSkunks > 0
                          ? `${p.doubleSkunks} double skunk${
                              p.doubleSkunks === 1 ? "" : "s"
                            }`
                          : ""}
                      </p>
                    )}
                    <div className="mt-1.5 space-y-0.5 text-xs text-track/50">
                      {avgMargin !== null && (
                        <p>Avg win by {avgMargin.toFixed(1)}</p>
                      )}
                      {hasHands && (
                        <>
                          <p>{(p.pointsInHandGames / p.handsTotal).toFixed(1)} pts/hand</p>
                          <p>{(p.skunksInHandGames / p.handsTotal).toFixed(2)} skunks/hand</p>
                          <p>{(p.doubleSkunksInHandGames / p.handsTotal).toFixed(2)} dbl skunks/hand</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-brass/20 text-center">
              {net === 0 ? (
                <p className="text-track/60 text-sm">All square all-time</p>
              ) : (
                <p className="font-score text-lg text-brass-light">
                  {net > 0 ? b.name : a.name} owes{" "}
                  {net > 0 ? a.name : b.name} {formatCents(Math.abs(net))}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
