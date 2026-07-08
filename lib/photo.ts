import { supabase } from "@/lib/supabase";

// Client-side image handling shared by live games and manually-logged games:
// compress a selected photo well under budget, then upload it to the game's
// storage slot and return a cache-busted public URL.

const MAX_PHOTO_BYTES = 1_000_000; // 1MB

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function drawAtSize(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas context");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("compression failed"))),
      "image/jpeg",
      quality
    );
  });
}

// Compresses to under MAX_PHOTO_BYTES: first steps quality down at a fixed
// size, then shrinks dimensions further and repeats, until under budget
// or we hit a sane floor.
export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const dims = [1600, 1200, 1000, 800, 600, 400];
  let lastBlob: Blob | null = null;
  for (const maxDim of dims) {
    const canvas = drawAtSize(img, maxDim);
    for (const quality of [0.8, 0.65, 0.5, 0.35, 0.2]) {
      const blob = await canvasToBlob(canvas, quality);
      lastBlob = blob;
      if (blob.size <= MAX_PHOTO_BYTES) {
        return blob;
      }
    }
  }
  // Fell through every step — return the smallest we managed.
  return lastBlob as Blob;
}

// Compresses and uploads a photo for a game, returning its public URL.
export async function uploadGamePhoto(gameId: string, file: File): Promise<string> {
  const compressed = await compressImage(file);
  const path = `${gameId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("game-photos")
    .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("game-photos").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
