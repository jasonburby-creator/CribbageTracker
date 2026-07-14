"use client";

import { useEffect, useState } from "react";

// A photo thumbnail that opens a full-screen lightbox when tapped/clicked.
// `className` styles the inline thumbnail; the enlarged view is fixed-size.
export default function PhotoThumb({
  src,
  className,
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // NOTE: we deliberately do NOT lock document.body.style.overflow here. The
    // fixed full-screen overlay already covers the page, and a leaked lock (if
    // the overlay ever failed to close) froze scrolling until an app restart.
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View photo full size"
        className="block shrink-0 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-brass rounded-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          // Tapping anywhere (image or backdrop) closes it. h-screen is the
          // fallback; the inline 100dvh uses the *visible* viewport so the image
          // isn't cut off behind mobile browser bars. No `bottom`/inset-0
          // constraint, which would override the height.
          className="fixed left-0 right-0 top-0 z-50 h-screen flex items-center justify-center bg-black/90 p-3"
          style={{ height: "100dvh" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl pointer-events-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close photo"
            className="absolute right-4 flex items-center justify-center h-11 w-11 rounded-full bg-black/60 text-white text-3xl leading-none border border-white/40 hover:bg-black/80"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
          >
            ×
          </button>
          <p
            className="absolute left-0 right-0 text-center text-white/70 text-xs"
            style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            Tap anywhere to close
          </p>
        </div>
      )}
    </>
  );
}
