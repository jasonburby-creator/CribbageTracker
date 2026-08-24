import { PALETTE, drawCoverImage, roundRectPath } from "@/lib/recap/canvas";
import { sortGamesByPlayedDesc } from "@/lib/scoring";
import type { Game } from "@/lib/types";

// Square, deliberately different from the landscape recap card (1200x630)
// and the vertical story cards (1080x1920) — a grid of photos reads best
// roughly square regardless of how many go in it.
export const COLLAGE_W = 1200;
export const COLLAGE_H = 1200;

const MAX_PHOTOS = 12;

// Every completed game's photo, oldest first. If there are more than
// MAX_PHOTOS, samples evenly across the whole trip so the collage represents
// the full arc instead of just the earliest games.
export function pickCollagePhotos(games: Game[]): string[] {
  const chronological = sortGamesByPlayedDesc(games)
    .reverse()
    .map((g) => g.photo_url)
    .filter((url): url is string => !!url);

  if (chronological.length <= MAX_PHOTOS) return chronological;

  const stride = chronological.length / MAX_PHOTOS;
  const sampled: string[] = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    sampled.push(chronological[Math.floor(i * stride)]);
  }
  return sampled;
}

function computeGridDims(n: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

// Draws the collage. `images` must be the same length/order as `photoUrls` —
// a null entry (a photo that failed to load, e.g. a network hiccup) just
// leaves that cell blank instead of failing the whole thing.
export function drawCollage(
  ctx: CanvasRenderingContext2D,
  photoUrls: string[],
  images: (HTMLImageElement | null)[],
  tripName: string
) {
  ctx.clearRect(0, 0, COLLAGE_W, COLLAGE_H);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, COLLAGE_W, COLLAGE_H);

  ctx.textAlign = "center";
  ctx.fillStyle = PALETTE.accent;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("S K U N K   L I F E", COLLAGE_W / 2, 55);
  ctx.fillStyle = PALETTE.text;
  ctx.font = "italic 700 40px Georgia, serif";
  ctx.fillText(tripName, COLLAGE_W / 2, 105);

  if (photoUrls.length === 0) return;

  const { cols, rows } = computeGridDims(photoUrls.length);
  const gutter = 10;
  const gridX = 40;
  const gridY = 150;
  const gridW = COLLAGE_W - gridX * 2;
  const gridH = COLLAGE_H - gridY - 40;
  const cellW = (gridW - gutter * (cols - 1)) / cols;
  const cellH = (gridH - gutter * (rows - 1)) / rows;

  photoUrls.forEach((_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (cellW + gutter);
    const y = gridY + row * (cellH + gutter);
    const img = images[i];
    if (img) {
      drawCoverImage(ctx, img, x, y, cellW, cellH, 12);
    } else {
      ctx.fillStyle = PALETTE.bgLight;
      roundRectPath(ctx, x, y, cellW, cellH, 12);
      ctx.fill();
    }
  });
}
