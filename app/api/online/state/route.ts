import { NextResponse } from "next/server";
import { getOnlineGameState } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("gameId");
    if (!gameId) return NextResponse.json({ error: "Missing gameId." }, { status: 400 });
    const result = await getOnlineGameState(req, gameId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
