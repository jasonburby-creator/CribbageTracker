import { NextResponse } from "next/server";
import { submitPlay } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dealId = typeof body.dealId === "string" ? body.dealId : null;
    const card = typeof body.card === "string" ? body.card : null;
    if (!dealId || !card) return NextResponse.json({ error: "Missing dealId or card." }, { status: 400 });
    const result = await submitPlay(req, dealId, card);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
