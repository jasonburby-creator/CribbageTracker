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
    // Stop the page behind the lightbox from scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
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
          // h-screen is the fallback; the inline 100dvh uses the *visible*
          // viewport so the image isn't cut off behind mobile browser bars.
          // No `bottom`/inset-0 constraint, which would override the height.
          className="fixed left-0 right-0 top-0 z-50 h-screen flex items-center justify-center bg-black/90 p-3"
          style={{ height: "100dvh" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-4 text-white/80 hover:text-white text-4xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
