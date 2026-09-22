import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The public key also needs to reach the browser (to call
// PushManager.subscribe()), so it's NEXT_PUBLIC_-prefixed — being public is
// fine, that's the point of a VAPID *public* key. The private key and
// subject stay server-only.
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    // eslint-disable-next-line no-console
    console.warn("Missing VAPID_* env vars — push notifications are disabled.");
    return false;
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string; // opened on notificationclick, see public/sw.js
};

// Best-effort: a missing VAPID config, an expired subscription, or a failed
// send never throws — this always runs alongside the real game action
// (discard/play/count), and a notification failing shouldn't roll that back.
export async function sendPushToPlayer(playerId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("player_id", playerId);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // Gone/expired — clean it up so we stop trying it.
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}
