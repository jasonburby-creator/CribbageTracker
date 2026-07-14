"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/uploadQueue";
import { flushGameSnapshots } from "@/lib/gameSync";

// Registers the offline service worker and drains anything queued while offline
// (pending score updates and photo uploads) — once on load and again whenever
// the connection comes back.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const flush = () => {
      flushGameSnapshots().catch(() => {});
      flushQueue().catch(() => {});
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  return null;
}
