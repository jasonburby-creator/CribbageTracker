"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "skunklife-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag for "already added to home screen".
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// iPhone/iPad only, on purpose — this is the one platform with no
// programmatic install trigger at all (no beforeinstallprompt), so it's the
// one place a manual nudge actually helps. Everyone in this app is on iOS;
// showing this on desktop Chrome (which also fires beforeinstallprompt) was
// just noise for a "faster app on your phone" pitch that doesn't apply there.
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (!isIOS()) return;
    setShow(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4 mb-6 flex items-start gap-3">
      <span className="text-xl leading-none">📲</span>
      <div className="flex-1 text-sm text-track/80">
        <p>
          Add Skunk Life to your home screen: tap the{" "}
          <strong className="text-track">Share</strong> icon, then{" "}
          <strong className="text-track">&ldquo;Add to Home Screen.&rdquo;</strong>{" "}
          Opens full-screen next time, no browser bar.
        </p>
        <button
          onClick={dismiss}
          className="text-xs text-track/50 underline underline-offset-4 mt-2"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
