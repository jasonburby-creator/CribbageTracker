"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 64; // px of pull needed to trigger a refresh
const MAX_PULL = 96; // px the content can travel while dragging
const DAMPING = 0.5; // finger travel -> content travel ratio

// Wraps page content and triggers `onRefresh` when the user drags down from
// the very top of the page. Touch-only, so desktop/mouse is unaffected.
export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Refs so the listeners can stay bound once and still see fresh values.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const busy = useRef(false);

  const setPullBoth = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (busy.current) return;
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      active.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (busy.current || startY.current === null) return;
      // If the page scrolled away from the top mid-gesture, abort.
      if (window.scrollY > 0) {
        startY.current = null;
        active.current = false;
        setDragging(false);
        setPullBoth(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        active.current = true;
        setDragging(true);
        setPullBoth(Math.min(MAX_PULL, dy * DAMPING));
        if (e.cancelable) e.preventDefault();
      }
    }

    async function onTouchEnd() {
      if (busy.current || startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (active.current && pullRef.current >= THRESHOLD) {
        busy.current = true;
        setRefreshing(true);
        setPullBoth(THRESHOLD);
        try {
          await onRefreshRef.current();
        } finally {
          busy.current = false;
          setRefreshing(false);
          setPullBoth(0);
          active.current = false;
        }
      } else {
        setPullBoth(0);
        active.current = false;
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const ready = pull >= THRESHOLD;

  return (
    <div className="relative">
      {/* Pull indicator, revealed as the content slides down */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex justify-center"
        style={{
          top: -44,
          height: 44,
          transform: `translateY(${pull}px)`,
          opacity: pull > 4 || refreshing ? 1 : 0,
          transition: dragging ? "none" : "transform 0.2s ease, opacity 0.2s",
        }}
      >
        <div className="flex items-center gap-2 text-brass-light/80 text-xs">
          <span
            className={
              "inline-block h-4 w-4 rounded-full border-2 border-brass/40 border-t-brass " +
              (refreshing ? "animate-spin" : "")
            }
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${Math.min(pull * 3, 270)}deg)` }
            }
          />
          <span>
            {refreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
