import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findGraph, monitorQuery } from "@/lib/graphs";
import {
  createMonitor, deleteMonitor, getJob, getMonitorView, MAX_MONITORS_PER_GRAPH, MonitorError, runTickNow, steer, type MonitorView,
} from "@/lib/monitors";
import { cacheGet, cacheKeys, cachePut } from "@/lib/store";

type Link = { id: string; query: string; createdAt: string };
const linkKey = (graphKey: string, nodeId: string) => `monitor:${graphKey}:${nodeId}`;

const fail = (e: unknown) => {
  const status = e instanceof MonitorError ? (e.status === 404 ? 404 : e.status === 409 ? 409 : 502) : 502;
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
};

async function guard(body: { graphKey?: unknown; nodeId?: unknown }) {
  if (!(await getCurrentUser())) return { err: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const graph = await findGraph(String(body.graphKey ?? ""));
  const node = graph?.nodes.find((n) => n.id === body.nodeId && n.tier > 0);
  if (!graph || !node) return { err: NextResponse.json({ error: "Unknown graph or supplier" }, { status: 400 }) };
  return { graph, node };
}

/** GET ?graphKey=… → live status of every monitor attached to that graph, keyed by node id. */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const graphKey = new URL(req.url).searchParams.get("graphKey") ?? "";
  const keys = await cacheKeys(`monitor:${graphKey}:`);
  const out: Record<string, MonitorView | { error: string }> = {};
  await Promise.all(
    keys.map(async (k) => {
      const nodeId = k.slice(`monitor:${graphKey}:`.length);
      const link = await cacheGet<Link>(k);
      if (!link) return;
      try {
        out[nodeId] = await getMonitorView(link.id);
      } catch (e) {
        if (e instanceof MonitorError && e.status === 404) await cachePut(k, undefined); // deleted or expired in Telem
        else out[nodeId] = { error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return NextResponse.json(out);
}

/** POST { graphKey, nodeId, action: "create" | "tick" | "steer" | "job", message?, jobId? } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body);
  if ("err" in g) return g.err;
  const key = linkKey(g.graph.key, g.node.id);
  const link = await cacheGet<Link>(key);

  try {
    if (body.action === "create") {
      if (link) return NextResponse.json({ error: "This supplier already has a monitor." }, { status: 409 });
      const count = (await cacheKeys(`monitor:${g.graph.key}:`)).length;
      if (count >= MAX_MONITORS_PER_GRAPH) {
        return NextResponse.json({ error: `Limit reached: ${MAX_MONITORS_PER_GRAPH} monitors per graph. Stop one first.` }, { status: 409 });
      }
      const query = monitorQuery(g.graph, g.node.id);
      const id = await createMonitor(query);
      await cachePut(key, { id, query, createdAt: new Date().toISOString() } satisfies Link);
      return NextResponse.json(await getMonitorView(id));
    }
    if (!link) return NextResponse.json({ error: "No monitor on this supplier." }, { status: 404 });
    if (body.action === "tick") return NextResponse.json(await runTickNow(link.id));
    if (body.action === "steer") {
      const message = String(body.message ?? "").trim();
      if (message.length < 3 || message.length > 500) return NextResponse.json({ error: "Write 3 to 500 characters." }, { status: 400 });
      return NextResponse.json(await steer(link.id, message));
    }
    if (body.action === "job") return NextResponse.json(await getJob(link.id, String(body.jobId ?? "")));
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE { graphKey, nodeId } → stops the monitor in Telem (ends billing) and forgets it. */
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(body);
  if ("err" in g) return g.err;
  const key = linkKey(g.graph.key, g.node.id);
  const link = await cacheGet<Link>(key);
  if (!link) return NextResponse.json({ ok: true });
  try {
    await deleteMonitor(link.id);
  } catch (e) {
    if (!(e instanceof MonitorError && e.status === 404)) return fail(e);
  }
  await cachePut(key, undefined);
  return NextResponse.json({ ok: true });
}
