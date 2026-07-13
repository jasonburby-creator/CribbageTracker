"use client";

import { useEffect, useRef, useState } from "react";
import { sortGamesByPlayedDesc } from "@/lib/scoring";
import type { Game, Trip } from "@/lib/types";

// Full-screen trip review: an auto-advancing slideshow of the trip's photos,
// with an optional map pinning the games that captured a location. The map
// (Leaflet + OpenStreetMap tiles) loads on demand and is online-only, which is
// fine for a post-trip recap.

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const ACCENT = "#F27A21"; // Safety Orange
const ACCENT2 = "#2FA7BE"; // brighter teal for the active pin

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function caption(trip: Trip, g: Game): { title: string; sub: string } {
  const winner = g.winner_player === 1 ? trip.player1?.name : trip.player2?.name;
  const hi = Math.max(g.player1_score, g.player2_score);
  const lo = Math.min(g.player1_score, g.player2_score);
  const badge = g.is_double_skunk ? " · double skunk" : g.is_skunk ? " · skunk" : "";
  const when = g.completed_at
    ? new Date(g.completed_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "";
  return {
    title: `${winner ?? "Winner"} won ${hi}–${lo}${badge}`,
    sub: [when, g.location].filter(Boolean).join(" · "),
  };
}

export default function TripReview({
  trip,
  games,
  onClose,
}: {
  trip: Trip;
  games: Game[];
  onClose: () => void;
}) {
  // Oldest → newest so the slideshow reads as the trip unfolded.
  const photos = sortGamesByPlayedDesc(games.filter((g) => g.photo_url)).reverse();
  const located = photos.filter(
    (g) => g.latitude != null && g.longitude != null
  );

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const indexRef = useRef(0);
  indexRef.current = index;

  // Auto-advance.
  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % photos.length),
      4000
    );
    return () => clearInterval(t);
  }, [playing, photos.length]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  // Build the map once photos with coordinates exist.
  useEffect(() => {
    if (located.length === 0 || !mapRef.current) return;
    let map: any;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current) return;
        map = L.map(mapRef.current, { attributionControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);
        const pts: [number, number][] = [];
        markersRef.current = located.map((g) => {
          const latlng: [number, number] = [g.latitude!, g.longitude!];
          pts.push(latlng);
          const m = L.circleMarker(latlng, {
            radius: 8,
            color: ACCENT,
            weight: 2,
            fillColor: ACCENT,
            fillOpacity: 0.7,
          }).addTo(map);
          m.on("click", () => {
            const i = photos.findIndex((p) => p.id === g.id);
            if (i >= 0) {
              setPlaying(false);
              setIndex(i);
            }
          });
          return { marker: m, gameId: g.id };
        });
        if (pts.length === 1) map.setView(pts[0], 13);
        else map.fitBounds(pts, { padding: [30, 30] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (map) map.remove();
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);

  // Recolor pins as the slideshow moves.
  useEffect(() => {
    const activeId = photos[index]?.id;
    for (const { marker, gameId } of markersRef.current) {
      const active = gameId === activeId;
      marker.setStyle({
        color: active ? ACCENT2 : ACCENT,
        fillColor: active ? ACCENT2 : ACCENT,
        radius: active ? 11 : 8,
      });
    }
  }, [index, photos]);

  const current = photos[index];

  return (
    <div className="fixed inset-0 z-50 bg-walnut-deep/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-display italic text-xl text-track">{trip.name}</p>
        <button
          onClick={onClose}
          aria-label="Close trip review"
          className="h-9 w-9 rounded-full border border-brass/40 text-brass-light text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-track/60">
          No photos in this trip yet. Add a winner&rsquo;s photo to build the
          review.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="max-w-md mx-auto">
            <div className="relative rounded-xl overflow-hidden border border-brass/25 bg-walnut-light/10">
              {current?.photo_url && (
                <img
                  src={current.photo_url}
                  alt=""
                  className="w-full max-h-[55vh] object-contain bg-black/20"
                />
              )}
              <button
                onClick={() => {
                  setPlaying(false);
                  setIndex((i) => (i - 1 + photos.length) % photos.length);
                }}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-walnut-deep/60 text-track text-lg"
              >
                ‹
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setIndex((i) => (i + 1) % photos.length);
                }}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-walnut-deep/60 text-track text-lg"
              >
                ›
              </button>
            </div>

            {current && (
              <div className="text-center mt-3">
                <p className="font-display text-lg text-brass-light">
                  {caption(trip, current).title}
                </p>
                {caption(trip, current).sub && (
                  <p className="text-xs text-track/50 mt-0.5">
                    {caption(trip, current).sub}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="text-sm text-brass-light border border-brass/40 rounded-lg px-4 py-1.5"
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <span className="text-xs text-track/50 font-score">
                {index + 1} / {photos.length}
              </span>
            </div>

            {located.length > 0 && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-widest text-brass-light/60 mb-2">
                  Where you played
                </p>
                <div
                  ref={mapRef}
                  className="w-full h-56 rounded-xl overflow-hidden border border-brass/25"
                />
                <p className="text-[11px] text-track/40 mt-1">
                  Tap a pin to jump to that game&rsquo;s photo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
