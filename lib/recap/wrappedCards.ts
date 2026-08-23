import { PALETTE, drawCoverImage, loadImage, roundRectPath, wrapText } from "@/lib/recap/canvas";
import type { RecapData } from "@/lib/recap/data";

// Vertical "story" format — Instagram/Snapchat story dimensions, sized down
// via CSS for on-screen preview but rendered at full resolution for export.
export const WRAPPED_W = 1080;
export const WRAPPED_H = 1920;

export type WrappedCard =
  | { kind: "title"; tripName: string; dateRange: string; players: string }
  | { kind: "tally"; gamesPlayed: number; p1: string; p1Wins: number; p2: string; p2Wins: number; owesLine: string | null }
  | { kind: "stat"; heading: string; big: string; sub: string }
  | { kind: "photo"; photoUrl: string; caption: string };

// The ordered sequence of cards for a trip — same list feeds both the
// swipeable story view and the recorded highlight video, so they always
// match.
export function buildWrappedCards(data: RecapData): WrappedCard[] {
  const cards: WrappedCard[] = [
    {
      kind: "title",
      tripName: data.tripName,
      dateRange: data.dateRange,
      players: `${data.player1Name} vs ${data.player2Name}`,
    },
    {
      kind: "tally",
      gamesPlayed: data.gamesPlayed,
      p1: data.player1Name,
      p1Wins: data.player1Wins,
      p2: data.player2Name,
      p2Wins: data.player2Wins,
      owesLine: data.owesLine,
    },
  ];

  if (data.biggestMargin) {
    const m = data.biggestMargin;
    cards.push({
      kind: "stat",
      heading: "Biggest blowout",
      big: `${m.winnerScore}–${m.loserScore}`,
      sub: `${m.winnerName} over ${m.loserName}`,
    });
  }
  if (data.longestGame) {
    const l = data.longestGame;
    cards.push({
      kind: "stat",
      heading: "Longest game",
      big: `${l.handsPlayed} hand${l.handsPlayed === 1 ? "" : "s"}`,
      sub: `${l.winnerName} beat ${l.loserName}`,
    });
  }
  if (data.skunkCount > 0) {
    cards.push({
      kind: "stat",
      heading: "Skunks this trip",
      big: `${data.skunkCount}`,
      sub: data.skunkCount === 1 ? "one lopsided game" : "lopsided games",
    });
  }
  if (data.heroPhoto) {
    cards.push({ kind: "photo", photoUrl: data.heroPhoto.url, caption: data.heroPhoto.caption });
  }

  return cards;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, WRAPPED_H);
  g.addColorStop(0, PALETTE.bgLight);
  g.addColorStop(1, PALETTE.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WRAPPED_W, WRAPPED_H);
}

function drawWordmark(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = PALETTE.accent;
  ctx.font = "600 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("S K U N K   L I F E", WRAPPED_W / 2, 120);
}

// Renders one card onto the given context. `img`, when the card is a photo
// card, must already be loaded (see loadImage in canvas.ts) — callers own
// fetching it so this stays synchronous and easy to reuse frame-by-frame in
// the video recorder.
export function drawWrappedCard(
  ctx: CanvasRenderingContext2D,
  card: WrappedCard,
  img: HTMLImageElement | null
) {
  ctx.clearRect(0, 0, WRAPPED_W, WRAPPED_H);
  drawBackground(ctx);
  drawWordmark(ctx);

  const cx = WRAPPED_W / 2;

  if (card.kind === "title") {
    ctx.fillStyle = PALETTE.text;
    ctx.font = "italic 700 88px Georgia, serif";
    ctx.textAlign = "center";
    let y = 820;
    y = wrapText(ctx, card.tripName, cx, y, WRAPPED_W - 160, 96, "center");
    ctx.fillStyle = PALETTE.accent2;
    ctx.font = "44px system-ui, sans-serif";
    ctx.fillText(card.players, cx, y + 40);
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText(card.dateRange, cx, y + 100);
    return;
  }

  if (card.kind === "tally") {
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = "36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${card.gamesPlayed} game${card.gamesPlayed === 1 ? "" : "s"} played`,
      cx,
      680
    );

    const colY = 900;
    ctx.font = "600 52px system-ui, sans-serif";
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(card.p1, cx - 220, colY);
    ctx.fillText(card.p2, cx + 220, colY);
    ctx.font = "700 120px system-ui, sans-serif";
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(String(card.p1Wins), cx - 220, colY + 150);
    ctx.fillText(String(card.p2Wins), cx + 220, colY + 150);
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.fillText("wins", cx - 220, colY + 200);
    ctx.fillText("wins", cx + 220, colY + 200);

    if (card.owesLine) {
      ctx.font = "44px system-ui, sans-serif";
      ctx.fillStyle = PALETTE.accent2;
      wrapText(ctx, card.owesLine, cx, colY + 340, WRAPPED_W - 200, 56, "center");
    } else {
      ctx.font = "44px system-ui, sans-serif";
      ctx.fillStyle = PALETTE.accent2;
      ctx.fillText("All square", cx, colY + 340);
    }
    return;
  }

  if (card.kind === "stat") {
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = "40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(card.heading.toUpperCase(), cx, 820);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = "700 140px system-ui, sans-serif";
    ctx.fillText(card.big, cx, 980);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "48px system-ui, sans-serif";
    wrapText(ctx, card.sub, cx, 1080, WRAPPED_W - 200, 60, "center");
    return;
  }

  // Photo card
  const frameX = 90;
  const frameY = 460;
  const frameW = WRAPPED_W - 180;
  const frameH = 1150;
  if (img) {
    drawCoverImage(ctx, img, frameX, frameY, frameW, frameH, 32);
  } else {
    ctx.fillStyle = PALETTE.bgLight;
    roundRectPath(ctx, frameX, frameY, frameW, frameH, 32);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(242, 122, 33, 0.5)";
  ctx.lineWidth = 4;
  roundRectPath(ctx, frameX, frameY, frameW, frameH, 32);
  ctx.stroke();

  ctx.fillStyle = PALETTE.text;
  ctx.font = "600 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  wrapText(ctx, card.caption, cx, frameY + frameH + 100, WRAPPED_W - 160, 54, "center");
}

// Convenience: loads the hero photo if any card needs it (callers can pass
// the result into drawWrappedCard for that specific card).
export async function loadCardImage(card: WrappedCard): Promise<HTMLImageElement | null> {
  if (card.kind !== "photo") return null;
  try {
    return await loadImage(card.photoUrl);
  } catch {
    return null; // export still works, just without the photo filled in
  }
}
