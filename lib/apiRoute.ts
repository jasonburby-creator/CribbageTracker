import { NextResponse } from "next/server";
import { ApiError } from "@/lib/onlineGameServer";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
