import { downstream, type Graph } from "./graph";
import { cacheGet, cacheKeys } from "./store";

export async function findGraph(key: string): Promise<Graph | undefined> {
  return cacheGet<Graph>(`graph:${key}`);
}

/** Every graph a user has searched for, newest first. */
export async function recentGraphs(): Promise<Graph[]> {
  const graphs = await Promise.all((await cacheKeys("graph:")).map((k) => cacheGet<Graph>(k)));
  return graphs.filter((g): g is Graph => !!g).sort((a, b) => (b.builtAt ?? "").localeCompare(a.builtAt ?? ""));
}

/** The plain-language watch instruction a Telem monitor is created with (immutable once created). */
export function monitorQuery(graph: Graph, nodeId: string): string {
  const node = graph.nodes.find((n) => n.id === nodeId)!;
  const affected = downstream(graph, nodeId)
    .map((id) => graph.nodes.find((n) => n.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  // Broad object ("news about X") so Telem tracks and grades every article, but hard criteria only for a real
  // disruption that reaches downstream. Tested variants: "disruption affecting Y" tracked almost nothing;
  // plain "news about X" made good news (orders, awards) qualify as problems.
  return (
    `Track news about ${node.name} (${node.role}). Only count it as a problem when an article reports a disruption at ${node.name} ` +
    `(an outage, shortage, export restriction, delivery delay or capacity shortfall) that affects ${affected || graph.title}. ` +
    `Orders, wins, earnings and expansion are not problems.`
  );
}
