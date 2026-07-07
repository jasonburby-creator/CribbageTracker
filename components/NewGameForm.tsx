"use client";

import { useState } from "react";

export default function NewGameForm({
  onStart,
  onCancel,
}: {
  onStart: (opts: { isTieFlip: boolean; location: string }) => void;
  onCancel: () => void;
}) {
  const [isTieFlip, setIsTieFlip] = useState(false);
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  async function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`
          );
          const data = await res.json();
          const addr = data?.address ?? {};
          const place =
            addr.attraction ||
            addr.tourism ||
            addr.suburb ||
            addr.village ||
            addr.town ||
            addr.city ||
            data?.display_name?.split(",")[0];
          const region = addr.state || addr.country;
          setLocation([place, region].filter(Boolean).join(", "));
        } catch {
          setLocateError("Couldn't look up that location — type it in instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocateError("Couldn't get your location — type it in instead.");
        setLocating(false);
      }
    );
  }

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-5 space-y-4">
      <h2 className="font-display text-xl">Deal a new game</h2>

      <div>
        <label className="block text-xs uppercase tracking-widest text-brass-light/70 mb-1">
          Where are you playing?
        </label>
        <div className="flex gap-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="The finca terrace"
            className="flex-1 bg-walnut-deep border border-brass/40 rounded-lg px-3 py-2 text-track placeholder:text-track/30 focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="px-3 rounded-lg border border-brass/40 text-brass-light text-sm disabled:opacity-40"
          >
            {locating ? "Locating…" : "📍 Use here"}
          </button>
        </div>
        {locateError && <p className="text-xs text-skunk mt-1">{locateError}</p>}
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isTieFlip}
            onChange={(e) => setIsTieFlip(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[#B08D57]"
          />
          <span className="text-sm text-track">
            <span className="block">Cut for deal was a tie — double odds</span>
            <span className="block text-track/50 text-xs mt-0.5">
              Doubles the payout and win count for this game. Stacks with
              skunks (skunk = 4x, double skunk = 8x).
            </span>
          </span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-brass/30 text-track/60 rounded-lg py-2.5 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => onStart({ isTieFlip, location: location.trim() })}
          className="flex-1 bg-brass text-walnut-deep font-display font-semibold rounded-lg py-2.5"
        >
          Deal
        </button>
      </div>
    </div>
  );
}
