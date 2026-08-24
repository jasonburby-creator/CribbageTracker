import { PALETTE, drawCoverImage, loadImage, wrapText } from "@/lib/recap/canvas";
import type { RecapData } from "@/lib/recap/data";

// Landscape, link-preview-friendly dimensions — the "text this to the group"
// format, denser than a single Wrapped card since it's meant to stand alone.
export const RECAP_CARD_W = 1200;
export const RECAP_CARD_H = 630;

export async function loadRecapHeroImage(data: RecapData): Promise<HTMLImageElement | null> {
  if (!data.heroPhoto) return null;
  try {
    return await loadImage(data.heroPhoto.url);
  } catch {
    return null;
  }
}

export function drawRecapCard(
  ctx: CanvasRenderingContext2D,
  data: RecapData,
  heroImg: HTMLImageElement | null
) {
  ctx.clearRect(0, 0, RECAP_CARD_W, RECAP_CARD_H);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, RECAP_CARD_W, RECAP_CARD_H);

  const textW = heroImg ? 660 : RECAP_CARD_W - 100;
  const padX = 60;

  // Photo fills the right side, full-bleed, with a dark gradient fade into
  // the text side so the copy stays legible over any photo.
  if (heroImg) {
    drawCoverImage(ctx, heroImg, 660, 0, RECAP_CARD_W - 660, RECAP_CARD_H);
    const fade = ctx.createLinearGradient(600, 0, 780, 0);
    fade.addColorStop(0, PALETTE.bg);
    fade.addColorStop(1, "rgba(43, 45, 47, 0)");
    ctx.fillStyle = fade;
    ctx.fillRect(600, 0, 180, RECAP_CARD_H);
  }

  ctx.textAlign = "left";
  ctx.fillStyle = PALETTE.accent;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText("S K U N K   L I F E", padX, 70);

  ctx.fillStyle = PALETTE.text;
  ctx.font = "italic 700 56px Georgia, serif";
  let y = wrapText(ctx, data.tripName, padX, 150, textW - padX, 60, "left");

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText(data.dateRange, padX, y + 10);
  y += 60;

  // Leader (more trip wins) listed first, not just trip.player1 positionally.
  const [leader, trailer] =
    data.player1Wins >= data.player2Wins
      ? [
          { name: data.player1Name, wins: data.player1Wins },
          { name: data.player2Name, wins: data.player2Wins },
        ]
      : [
          { name: data.player2Name, wins: data.player2Wins },
          { name: data.player1Name, wins: data.player1Wins },
        ];

  ctx.fillStyle = PALETTE.accent2;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(`${leader.name} ${leader.wins} – ${trailer.wins} ${trailer.name}`, padX, y + 20);
  y += 60;

  ctx.fillStyle = PALETTE.text;
  ctx.font = "700 42px system-ui, sans-serif";
  ctx.fillText(data.owesLine ?? "All square", padX, y + 30);
  y += 80;

  const bits: string[] = [];
  if (data.biggestMargin) {
    bits.push(
      `Biggest win: ${data.biggestMargin.winnerName} ${data.biggestMargin.winnerScore}–${data.biggestMargin.loserScore}`
    );
  }
  if (data.skunkCount > 0) {
    bits.push(`${data.skunkCount} skunk${data.skunkCount === 1 ? "" : "s"}`);
  }
  if (bits.length) {
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = "24px system-ui, sans-serif";
    wrapText(ctx, bits.join("  ·  "), padX, y + 10, textW - padX, 34, "left");
  }
}
