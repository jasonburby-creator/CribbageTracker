"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/uploadQueue";
import { flushGameSnapshots } from "@/lib/gameSync";
import { supabase } from "@/lib/supabase";

// Registers the offline service worker and drains anything queued while offline
// (pending score updates and photo uploads) — once on load and again whenever
// the connection comes back.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const flush = async () => {
      // Force a token refresh if the session's access token expired while
      // offline, so queued writes land as the right signed-in player instead
      // of failing on an auth technicality.
      await supabase.auth.getSession().catch(() => {});
      flushGameSnapshots().catch(() => {});
      flushQueue().catch(() => {});
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  return null;
}
