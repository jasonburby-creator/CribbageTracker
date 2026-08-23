// Shared drawing primitives for trip recap exports (the recap card, the
// Wrapped-style story cards, and the highlight video all reuse these).
//
// These render a fixed, poster-style dark look on purpose — a downloaded
// PNG or video shouldn't change appearance based on the device it's opened
// on later, the way the app's own light/dark theme does. Colors below are
// literal, not the app's CSS variable tokens.

export const PALETTE = {
  bg: "#2B2D2F", // Coal
  bgLight: "#3a3d40",
  text: "#F4F4F1", // Camp White
  textMuted: "rgba(244, 244, 241, 0.6)",
  accent: "#F27A21", // Safety Orange
  accent2: "#61B0B1", // Lake Teal
  danger: "#D65A3E",
};

// Loads an image with CORS enabled so it can later be read back out of a
// canvas (toBlob/toDataURL, or captureStream for video) without throwing a
// "tainted canvas" security error. Supabase's public storage URLs send
// permissive CORS headers, so this works for game photos; if a photo host
// ever doesn't, the image still *displays* fine, it just can't be exported —
// callers should catch that and fall back to a photo-less layout.
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws an image cropped (not squashed) to cover the given rect, optionally
// clipped to rounded corners.
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  if (radius > 0) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

// Wraps text within maxWidth, drawing each line, and returns the y position
// just after the last line (so callers can stack more content below it).
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: "left" | "center" = "left"
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  ctx.textAlign = align;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't render an image from this canvas."));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
