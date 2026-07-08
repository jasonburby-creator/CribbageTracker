import { computeTripSummary, formatCents } from "@/lib/scoring";
import type { Game, Trip } from "@/lib/types";

export default function TripSummary({ trip, games }: { trip: Trip; games: Game[] }) {
  const summary = computeTripSummary(games);
  const net = summary.player1.netCents; // positive = player1 is up

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4">
      <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-3">
        Trip totals · {summary.gamesPlayed} game{summary.gamesPlayed === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: trip.player1?.name ?? "Player 1", s: summary.player1 },
          { name: trip.player2?.name ?? "Player 2", s: summary.player2 },
        ].map((row) => (
          <div key={row.name}>
            <p className="font-display text-lg text-track">{row.name}</p>
            <p className="text-sm text-track/70">
              <span className="font-score text-track">{row.s.winPoints}</span> Point
              {row.s.winPoints === 1 ? "" : "s"}
              <span className="text-track/50">
                {" "}({row.s.wins} game{row.s.wins === 1 ? "" : "s"})
              </span>
            </p>
            {(row.s.skunks > 0 || row.s.doubleSkunks > 0) && (
              <p className="text-xs text-skunk">
                {row.s.skunks > 0 ? `${row.s.skunks} skunk${row.s.skunks === 1 ? "" : "s"} ` : ""}
                {row.s.doubleSkunks > 0
                  ? `${row.s.doubleSkunks} double skunk${row.s.doubleSkunks === 1 ? "" : "s"}`
                  : ""}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-brass/20 text-center">
        {net === 0 ? (
          <p className="text-track/60 text-sm">Dead even so far</p>
        ) : (
          <p className="font-score text-lg text-brass-light">
            {net > 0 ? trip.player2?.name : trip.player1?.name} owes{" "}
            {net > 0 ? trip.player1?.name : trip.player2?.name}{" "}
            {formatCents(Math.abs(net))}
          </p>
        )}
      </div>
    </div>
  );
}
