import { NextResponse } from "next/server";
import { submitDiscard } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dealId = typeof body.dealId === "string" ? body.dealId : null;
    const cards = Array.isArray(body.cards) ? body.cards : null;
    if (!dealId || !cards || cards.length !== 2 || !cards.every((c: unknown) => typeof c === "string")) {
      return NextResponse.json({ error: "Missing dealId or 2 cards." }, { status: 400 });
    }
    const result = await submitDiscard(req, dealId, cards as [string, string]);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
