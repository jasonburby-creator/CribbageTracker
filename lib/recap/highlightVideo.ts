import { drawWrappedCard, type WrappedCard } from "@/lib/recap/wrappedCards";

// MediaRecorder's supported output format varies a lot by browser — Safari
// (this app's primary platform) has historically only reliably supported
// video/mp4, while Chrome/Android favor WebM. Feature-detect rather than
// hardcoding one, and let the caller treat `null` as "not supported here" —
// there's no way to verify this ahead of time without a real device per
// browser, so the UI needs to degrade gracefully rather than assume it works.
export function getSupportedVideoMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/mp4", "video/webm;codecs=vp9", "video/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function isVideoRecordingSupported(): boolean {
  return (
    getSupportedVideoMimeType() !== null &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype
  );
}

export function fileExtensionFor(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

// Plays through the same card sequence used for the swipeable story view,
// holding each on screen for msPerCard, and records the canvas as a single
// video file. The canvas must already be sized to WRAPPED_W x WRAPPED_H.
export async function recordHighlightVideo(
  canvas: HTMLCanvasElement,
  cards: WrappedCard[],
  images: (HTMLImageElement | null)[],
  opts: { msPerCard?: number; onProgress?: (cardIndex: number) => void } = {}
): Promise<{ blob: Blob; mimeType: string }> {
  const mimeType = getSupportedVideoMimeType();
  if (!mimeType) {
    throw new Error("Video recording isn't supported on this browser.");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't get a drawing context.");
  const captureStream = (
    canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
  ).captureStream;
  if (!captureStream) {
    throw new Error("Video recording isn't supported on this browser.");
  }

  const msPerCard = opts.msPerCard ?? 2600;
  const stream = captureStream.call(canvas, 30);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();
  try {
    for (let i = 0; i < cards.length; i++) {
      opts.onProgress?.(i);
      drawWrappedCard(ctx, cards[i], images[i]);
      await new Promise((r) => setTimeout(r, msPerCard));
    }
  } finally {
    recorder.stop();
  }
  const blob = await done;
  return { blob, mimeType };
}
