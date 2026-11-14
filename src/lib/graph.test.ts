// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { downstream, layout, propagate, type Graph } from "./graph.ts";

const g: Graph = {
  key: "T", label: "T", title: "T", source: "sample",
  nodes: [
    { id: "chem", name: "Chem", tier: 3, country: "JP", role: "" },
    { id: "tool", name: "Tool", tier: 2, country: "KR", role: "" },
    { id: "fabA", name: "Fab A", tier: 1, country: "TW", role: "" },
    { id: "fabB", name: "Fab B", tier: 1, country: "JP", role: "" },
    { id: "target", name: "Target", tier: 0, country: "US", role: "" },
  ],
  edges: [
    { from: "chem", to: "fabA" },
    { from: "tool", to: "fabA" },
    { from: "fabA", to: "target" },
    { from: "fabB", to: "target" },
  ],
};

test("no breach: everything nominal, target stays target", () => {
  const { status, hotEdges } = propagate(g, []);
  assert.equal(status.chem, "nominal");
  assert.equal(status.target, "target");
  assert.equal(hotEdges.size, 0);
});

test("breach spreads downstream only", () => {
  const { status, hotEdges } = propagate(g, ["tool"]);
  assert.equal(status.tool, "breach");
  assert.equal(status.fabA, "contagion");
  assert.equal(status.target, "atrisk");
  assert.equal(status.chem, "nominal"); // upstream sibling untouched
  assert.equal(status.fabB, "nominal"); // parallel branch untouched
  assert.deepEqual([...hotEdges].sort(), ["fabA->target", "tool->fabA"]);
});

test("watch is overridden by contagion, kept otherwise", () => {
  const { status } = propagate(g, ["tool"], ["fabA", "fabB"]);
  assert.equal(status.fabA, "contagion");
  assert.equal(status.fabB, "watch");
});

test("two breaches on one path keep both as breach", () => {
  const { status } = propagate(g, ["tool", "fabA"]);
  assert.equal(status.fabA, "breach");
  assert.equal(status.target, "atrisk");
});

test("unknown ids and cycles don't hang", () => {
  const cyc: Graph = { ...g, edges: [...g.edges, { from: "target", to: "fabA" }] };
  const { status } = propagate(cyc, ["nope", "tool"]);
  assert.equal(status.fabA, "contagion");
});

test("downstream excludes self", () => {
  assert.deepEqual(downstream(g, "chem").sort(), ["fabA", "target"]);
});

test("layout puts tiers in fixed columns", () => {
  const { pos } = layout(g);
  assert.equal(pos.chem.x, 0);
  assert.equal(pos.tool.x, 240);
  assert.equal(pos.fabA.x, 480);
  assert.equal(pos.target.x, 720);
});
