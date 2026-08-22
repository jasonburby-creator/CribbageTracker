"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "skunklife-install-dismissed";

// beforeinstallprompt isn't in the standard DOM lib types.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag for "already added to home screen".
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Nudges first-time visitors to install the app — the PWA plumbing
// (manifest, service worker, icons) already exists, nothing in the UI ever
// offered it. iOS has no programmatic install trigger at all, so it gets
// instructions instead of a button; Android/desktop Chrome gets a real
// one-tap install via the browser's own beforeinstallprompt event.
export default function InstallPrompt() {
  const [dismissed, setDismissed] = useState(true); // default hidden until checked
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setDismissed(false);

    if (isIOS()) {
      setShowIOSHint(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed) return null;
  if (!showIOSHint && !deferredPrompt) return null;

  return (
    <div className="rounded-xl border border-brass/30 bg-walnut-light/10 p-4 mb-6 flex items-start gap-3">
      <span className="text-xl leading-none">📲</span>
      <div className="flex-1 text-sm text-track/80">
        {showIOSHint ? (
          <p>
            Add Skunk Life to your home screen: tap the{" "}
            <strong className="text-track">Share</strong> icon, then{" "}
            <strong className="text-track">&ldquo;Add to Home Screen.&rdquo;</strong>{" "}
            Opens full-screen next time, no browser bar.
          </p>
        ) : (
          <p>Install Skunk Life for a faster, full-screen app on your phone.</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          {deferredPrompt && (
            <button
              onClick={install}
              className="text-xs border border-brass/40 text-brass-light rounded-lg px-3 py-1.5"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-xs text-track/50 underline underline-offset-4"
          >
            {showIOSHint ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}
