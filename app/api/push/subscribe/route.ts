import { NextResponse } from "next/server";
import { subscribeToPush } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sub = body.subscription;
    if (
      !sub ||
      typeof sub.endpoint !== "string" ||
      !sub.keys ||
      typeof sub.keys.p256dh !== "string" ||
      typeof sub.keys.auth !== "string"
    ) {
      return NextResponse.json({ error: "Missing subscription." }, { status: 400 });
    }
    await subscribeToPush(req, {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
