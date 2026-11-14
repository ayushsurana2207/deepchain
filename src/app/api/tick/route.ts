import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findGraph } from "@/lib/graphs";
import { cacheGet, cachePut } from "@/lib/store";
import { runTick, type TickResult } from "@/lib/tick";

export const maxDuration = 90;

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const graphKey = String(body?.graphKey ?? "");
  const graph = await findGraph(graphKey);
  const node = graph?.nodes.find((n) => n.id === body?.nodeId && n.tier > 0);
  if (!graph || !node) return NextResponse.json({ error: "Unknown graph or node" }, { status: 400 });

  const key = `tick:${graph.key}:${node.id}`;
  try {
    const result = await runTick(graph, node);
    await cachePut(key, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("live tick failed", err);
    const cached = await cacheGet<TickResult>(key);
    if (cached) return NextResponse.json({ ...cached, source: "cached" });
    return NextResponse.json({ error: "The news check couldn't reach its sources. Please try again in a moment." }, { status: 502 });
  }
}
