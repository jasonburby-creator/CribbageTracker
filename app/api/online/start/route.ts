import { NextResponse } from "next/server";
import { startOnlineGame } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tripId = typeof body.tripId === "string" ? body.tripId : null;
    if (!tripId) return NextResponse.json({ error: "Missing tripId." }, { status: 400 });
    const result = await startOnlineGame(req, tripId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
