import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { discover, type BuildEvent } from "@/lib/discover";
import type { Graph } from "@/lib/graph";
import { cacheGet, cachePut } from "@/lib/store";

export const maxDuration = 300;

const keyOf = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Streams build progress as NDJSON: one BuildEvent per line, ending in "graph" or "error". */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const target = String(body?.target ?? "").trim();
  if (target.length < 2 || target.length > 120) {
    return NextResponse.json({ error: "Enter a target between 2 and 120 characters." }, { status: 400 });
  }
  const key = typeof body?.key === "string" && body.key ? keyOf(body.key) : keyOf(target);
  const label = String(body?.label ?? target).slice(0, 40);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: BuildEvent) => controller.enqueue(new TextEncoder().encode(JSON.stringify(e) + "\n"));
      try {
        const graph = await discover(target, key, label, send);
        await cachePut(`graph:${key}`, graph);
      } catch (err) {
        console.error("discover failed", err);
        const cached = await cacheGet<Graph>(`graph:${key}`);
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
          cached,
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
