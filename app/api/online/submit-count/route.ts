import { NextResponse } from "next/server";
import { submitCount } from "@/lib/onlineGameServer";
import { handleApiError } from "@/lib/apiRoute";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dealId = typeof body.dealId === "string" ? body.dealId : null;
    const claimedPoints = Number(body.claimedPoints);
    if (!dealId || !Number.isInteger(claimedPoints) || claimedPoints < 0) {
      return NextResponse.json({ error: "Missing dealId or a valid claimedPoints." }, { status: 400 });
    }
    const result = await submitCount(req, dealId, claimedPoints);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
