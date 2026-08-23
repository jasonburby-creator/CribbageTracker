"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRecapData } from "@/lib/recap/data";
import { drawRecapCard, loadRecapHeroImage, RECAP_CARD_H, RECAP_CARD_W } from "@/lib/recap/recapCard";
import {
  buildWrappedCards,
  drawWrappedCard,
  loadCardImage,
  WRAPPED_H,
  WRAPPED_W,
  type WrappedCard,
} from "@/lib/recap/wrappedCards";
import {
  fileExtensionFor,
  isVideoRecordingSupported,
  recordHighlightVideo,
} from "@/lib/recap/highlightVideo";
import { canvasToPngBlob, downloadBlob } from "@/lib/recap/canvas";
import type { Game, Trip } from "@/lib/types";

type Tab = "card" | "story" | "video";

export default function TripRecap({
  trip,
  games,
  onClose,
}: {
  trip: Trip;
  games: Game[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("card");
  const data = useMemo(() => buildRecapData(trip, games), [trip, games]);
  const cards = useMemo(() => buildWrappedCards(data), [data]);

  return (
    <div className="fixed inset-0 z-50 bg-walnut-deep/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-display italic text-xl text-track">Trip recap</p>
        <button
          onClick={onClose}
          aria-label="Close trip recap"
          className="h-9 w-9 rounded-full border border-brass/40 text-brass-light text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex justify-center gap-2 pb-3">
        {(["card", "story", "video"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "text-sm rounded-lg px-4 py-1.5 border " +
              (tab === t
                ? "bg-brass text-ink border-brass font-semibold"
                : "border-brass/30 text-brass-light")
            }
          >
            {t === "card" ? "Recap card" : t === "story" ? "Story" : "Video"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="max-w-md mx-auto">
          {tab === "card" && <RecapCardPanel data={data} />}
          {tab === "story" && <StoryPanel cards={cards} />}
          {tab === "video" && <VideoPanel cards={cards} />}
        </div>
      </div>
    </div>
  );
}

function RecapCardPanel({ data }: { data: ReturnType<typeof buildRecapData> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const img = await loadRecapHeroImage(data);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        drawRecapCard(ctx, data, img);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, `${slug(data.tripName)}-recap.png`);
  }

  return (
    <div className="text-center">
      <div className="rounded-xl overflow-hidden border border-brass/25">
        <canvas
          ref={canvasRef}
          width={RECAP_CARD_W}
          height={RECAP_CARD_H}
          className="w-full h-auto block"
        />
      </div>
      <button
        onClick={download}
        disabled={!ready}
        className="mt-4 bg-brass text-ink font-display font-semibold rounded-lg px-5 py-2.5 disabled:opacity-40"
      >
        ⬇ Download PNG
      </button>
    </div>
  );
}

function StoryPanel({ cards }: { cards: WrappedCard[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const card = cards[index];
      const img = await loadCardImage(card);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        drawWrappedCard(ctx, card, img);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cards, index]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToPngBlob(canvas);
    downloadBlob(blob, `skunklife-story-${index + 1}.png`);
  }

  if (cards.length === 0) {
    return <p className="text-center text-track/50 text-sm">Nothing to show yet.</p>;
  }

  return (
    <div className="text-center">
      <div className="relative rounded-xl overflow-hidden border border-brass/25 mx-auto" style={{ maxWidth: 340 }}>
        <canvas
          ref={canvasRef}
          width={WRAPPED_W}
          height={WRAPPED_H}
          className="w-full h-auto block"
        />
        {cards.length > 1 && (
          <>
            <button
              onClick={() => setIndex((i) => (i - 1 + cards.length) % cards.length)}
              aria-label="Previous card"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-walnut-deep/60 text-track text-lg"
            >
              ‹
            </button>
            <button
              onClick={() => setIndex((i) => (i + 1) % cards.length)}
              aria-label="Next card"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-walnut-deep/60 text-track text-lg"
            >
              ›
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-track/50 font-score mt-2">
        {index + 1} / {cards.length}
      </p>
      <button
        onClick={download}
        disabled={!ready}
        className="mt-3 bg-brass text-ink font-display font-semibold rounded-lg px-5 py-2.5 disabled:opacity-40"
      >
        ⬇ Download this card
      </button>
    </div>
  );
}

function VideoPanel({ cards }: { cards: WrappedCard[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported] = useState(() => isVideoRecordingSupported());
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<{ blob: Blob; ext: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRecording(true);
    setError(null);
    setVideoUrl(null);
    setDownloadInfo(null);
    try {
      const images = await Promise.all(cards.map(loadCardImage));
      const { blob, mimeType } = await recordHighlightVideo(canvas, cards, images, {
        onProgress: (i) => setProgress(i + 1),
      });
      setVideoUrl(URL.createObjectURL(blob));
      setDownloadInfo({ blob, ext: fileExtensionFor(mimeType) });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't record a video on this device — try the recap card or story cards instead."
      );
    } finally {
      setRecording(false);
    }
  }

  function download() {
    if (!downloadInfo) return;
    downloadBlob(downloadInfo.blob, `skunklife-highlights.${downloadInfo.ext}`);
  }

  return (
    <div className="text-center">
      <div className="rounded-xl overflow-hidden border border-brass/25 mx-auto" style={{ maxWidth: 340 }}>
        <canvas
          ref={canvasRef}
          width={WRAPPED_W}
          height={WRAPPED_H}
          className="w-full h-auto block"
        />
      </div>

      {!supported ? (
        <p className="text-xs text-track/50 mt-4">
          Video export isn&rsquo;t supported on this browser — try the recap
          card or story cards instead.
        </p>
      ) : (
        <>
          {!videoUrl && (
            <button
              onClick={generate}
              disabled={recording}
              className="mt-4 bg-brass text-ink font-display font-semibold rounded-lg px-5 py-2.5 disabled:opacity-50"
            >
              {recording ? `Rendering ${progress} / ${cards.length}…` : "▶ Generate video"}
            </button>
          )}
          {error && <p className="text-skunk text-sm mt-2">{error}</p>}
          {videoUrl && (
            <div className="mt-4 space-y-3">
              <video src={videoUrl} controls playsInline className="w-full rounded-lg" style={{ maxWidth: 340, margin: "0 auto" }} />
              <button
                onClick={download}
                className="bg-brass text-ink font-display font-semibold rounded-lg px-5 py-2.5"
              >
                ⬇ Download video
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "trip";
}
