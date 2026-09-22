import { supabase } from "@/lib/supabase";
import type { OnlineDealView } from "@/lib/types";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

export async function startOnlineGame(tripId: string): Promise<{ view: OnlineDealView }> {
  return postJson("/api/online/start", { tripId });
}

export async function fetchOnlineGameState(gameId: string): Promise<{ view: OnlineDealView }> {
  const res = await fetch(`/api/online/state?gameId=${encodeURIComponent(gameId)}`, {
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as { view: OnlineDealView };
}

export async function submitDiscard(
  dealId: string,
  cards: [string, string]
): Promise<{ view: OnlineDealView }> {
  return postJson("/api/online/discard", { dealId, cards });
}

export async function submitPlay(dealId: string, card: string): Promise<{ view: OnlineDealView }> {
  return postJson("/api/online/play", { dealId, card });
}

export async function submitCount(
  dealId: string,
  claimedPoints: number
): Promise<{ view: OnlineDealView }> {
  return postJson("/api/online/submit-count", { dealId, claimedPoints });
}

export async function cancelOnlineGame(gameId: string): Promise<void> {
  await postJson("/api/online/cancel", { gameId });
}

export async function subscribeToPush(subscription: PushSubscriptionJSON): Promise<void> {
  await postJson("/api/push/subscribe", { subscription });
}
