import { test } from "node:test";
import assert from "node:assert/strict";
import { assemble } from "./assemble.ts";

const pages = [
  { url: "https://a.com/1", content: "Micron Taichung packages HBM3E stacks for Micron. Hanmi Semiconductor supplies TC bonders to Micron Taichung." },
  { url: "https://b.com/2", content: "Resonac is the sole supplier of NCF film to Hanmi customers. Resonac provides NCF film used by Hanmi bonders." },
];
const node = (id: string, tier: number, extra = {}) => ({
  id, name: id.toUpperCase(), tier, country: "jp", role: "x", ticker: "", spof: false, spof_quote: "", spof_page_id: -1, ...extra,
});

test("keeps verified edges, rejects invented quotes, tier violations and orphans", () => {
  const events: unknown[] = [];
  const g = assemble("MU HBM3E", "K", "MU", {
    nodes: [
      node("taichung", 1),
      node("hanmi", 2),
      node("resonac", 3, { spof: true, spof_quote: "Resonac is the sole supplier of NCF film", spof_page_id: 1 }),
      node("ghost", 3),
      node("backwards", 3),
    ],
    edges: [
      { from: "taichung", to: "target", page_id: 0, quote: "Micron Taichung packages HBM3E stacks for Micron." },
      { from: "hanmi", to: "taichung", page_id: 0, quote: "Hanmi Semiconductor supplies TC bonders to Micron Taichung." },
      { from: "resonac", to: "hanmi", page_id: 1, quote: "Resonac provides NCF film used by Hanmi bonders." },
      { from: "ghost", to: "hanmi", page_id: 1, quote: "Ghost Corp supplies Hanmi with critical parts." }, // invented
      { from: "taichung", to: "backwards", page_id: 0, quote: "Micron Taichung packages HBM3E stacks for Micron." }, // tier order
    ],
  }, pages, (e) => events.push(e));

  assert.deepEqual(g.nodes.map((n) => n.id).sort(), ["hanmi", "resonac", "taichung", "target"]);
  assert.equal(g.edges.length, 3);
  assert.ok(g.edges.every((e) => e.evidence?.verified && e.evidence.url.startsWith("https://")));
  assert.equal(g.nodes.find((n) => n.id === "resonac")?.spof, true);
  assert.equal(g.nodes.find((n) => n.id === "taichung")?.country, "JP");
  const rejected = events.filter((e) => (e as { verdict?: string }).verdict === "rejected").map((e) => (e as { reason: string }).reason);
  assert.deepEqual(rejected.sort(), ["quote not in source", "tier order"]);
});

test("spof claim without a matching quote is dropped", () => {
  const g = assemble("T", "K", "T", {
    nodes: [node("taichung", 1, { spof: true, spof_quote: "Taichung is the only site in the world", spof_page_id: 0 })],
    edges: [{ from: "taichung", to: "target", page_id: 0, quote: "Micron Taichung packages HBM3E stacks for Micron." }],
  }, pages);
  assert.equal(g.nodes.find((n) => n.id === "taichung")?.spof, false);
});
