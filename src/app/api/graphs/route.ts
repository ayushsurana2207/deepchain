import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cacheKeys, cachePut } from "@/lib/store";

/** DELETE ?key=… → removes a saved search (and any monitor links / news checks attached to it) from Recent searches. */
export async function DELETE(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^[A-Z0-9-]{1,40}$/.test(key)) return NextResponse.json({ error: "Bad key" }, { status: 400 });
  // shortcut: leaves any Telem monitors running; they expire on their own (max 7 days). Stop them first if you care.
  for (const k of [`graph:${key}`, ...(await cacheKeys(`tick:${key}:`)), ...(await cacheKeys(`monitor:${key}:`))]) await cachePut(k, undefined);
  return NextResponse.json({ ok: true });
}
