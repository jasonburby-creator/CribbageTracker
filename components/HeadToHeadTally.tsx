"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/scoring";
import type { HeadToHead } from "@/lib/scoring";

const COLLAPSED_KEY = "skunklife-h2h-collapsed-v1";

function readCollapsed(): Record<string, boolean> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

// All-time head-to-head record(s) across every trip. Usually one card (the
// recurring pair), but supports multiple distinct pairings — each can be
// minimized to a single summary line independently, so a pairing you play
// constantly (Blake) can stay fully expanded while an occasional one (Bjorn)
// stays out of the way. The choice is remembered per device, per pairing.
export default function HeadToHeadTally({ heads }: { heads: HeadToHead[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // storage full/unavailable — the toggle still works this session
      }
      return next;
    });
  }

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
        const isCollapsed = !!collapsed[h.key];

        if (isCollapsed) {
          // Leader (more wins) shown first, matching the same convention
          // used on the recap card.
          const [leader, trailer] = a.wins >= b.wins ? [a, b] : [b, a];
          return (
            <button
              key={h.key}
              onClick={() => toggle(h.key)}
              aria-label={`Expand ${a.name} vs ${b.name}`}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-brass/30 bg-walnut-light/10 px-4 py-3 text-left"
            >
              <span className="text-sm text-track truncate">
                <strong className="text-track">
                  {leader.name} {leader.wins} – {trailer.wins} {trailer.name}
                </strong>
                <span className="text-track/50 block sm:inline sm:ml-2 text-xs">
                  {net === 0
                    ? "All square"
                    : `${net > 0 ? a.name : b.name} up ${formatCents(Math.abs(net))}`}
                </span>
              </span>
              <span className="text-brass-light text-lg leading-none shrink-0">⌄</span>
            </button>
          );
        }

        return (
          <div
            key={h.key}
            className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-xs uppercase tracking-widest text-brass-light/60">
                All-time · {a.name} vs {b.name} · {h.gamesPlayed} game
                {h.gamesPlayed === 1 ? "" : "s"} · {totalPoints} pt
                {totalPoints === 1 ? "" : "s"} total
              </p>
              <button
                onClick={() => toggle(h.key)}
                aria-label={`Minimize ${a.name} vs ${b.name}`}
                className="text-brass-light/60 text-lg leading-none shrink-0"
              >
                ⌃
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[a, b].map((p) => {
                const avgMargin = p.wins > 0 ? p.winMarginSum / p.wins : null;
                const hasHands = p.handsTotal > 0;
                return (
                  <div key={p.playerId}>
                    <p className="font-display text-lg text-track">{p.name}</p>
                    <p className="text-sm text-track/70">
                      <span className="font-score text-track">{p.winPoints}</span> pt
                      {p.winPoints === 1 ? "" : "s"}
                      <span className="text-track/50">
                        {" "}
                        ({p.wins} win{p.wins === 1 ? "" : "s"})
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
                        <p>Avg win margin {avgMargin.toFixed(1)} pts</p>
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
                  {net > 0 ? a.name : b.name} is up {formatCents(Math.abs(net))} all-time
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
