import { NextResponse } from "next/server";
import { cancelOnlineGame } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const gameId = typeof body.gameId === "string" ? body.gameId : null;
    if (!gameId) return NextResponse.json({ error: "Missing gameId." }, { status: 400 });
    await cancelOnlineGame(req, gameId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
