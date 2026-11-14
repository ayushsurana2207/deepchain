import { test } from "node:test";
import assert from "node:assert/strict";
import { ageInDays, mentions, quoteInText } from "./verify.ts";

const text = "HANMI Semiconductor supplies TC bonder equipment essential for HBM production.\n  A TC bonder stacks DRAM chips.";

test("exact quote matches, ignoring case and whitespace", () => {
  assert.ok(quoteInText("hanmi semiconductor supplies TC bonder equipment", text));
  assert.ok(quoteInText("equipment essential for HBM production. A TC bonder", text));
});

test("curly quotes and surrounding quote marks are tolerated", () => {
  assert.ok(quoteInText("“TC bonder equipment essential for HBM production”", text));
});

test("paraphrase or invented text is rejected", () => {
  assert.equal(quoteInText("Hanmi supplies TC bonders essential for HBM", text), false);
  assert.equal(quoteInText("Hanmi halted TC bonder shipments to Micron", text), false);
});

test("too-short quotes are rejected", () => {
  assert.equal(quoteInText("TC bonder", text), false);
  assert.equal(quoteInText("", text), false);
});

test("ageInDays parses RFC 2822 dates and handles junk", () => {
  const now = Date.parse("Sat, 14 Nov 2026 00:00:00 GMT");
  assert.equal(ageInDays("Thu, 22 Oct 2026 02:46:15 GMT", now), 22);
  assert.equal(ageInDays("2026-11-13", now), 1);
  assert.equal(ageInDays(null, now), null);
  assert.equal(ageInDays("not a date", now), null);
});

test("mentions keeps on-topic headlines and drops unrelated ones", () => {
  assert.ok(mentions("Carl Zeiss SMT GmbH", "ZEISS opens new EUV optics plant"));
  assert.ok(mentions("Hanmi Semiconductor", "Hanmi wins TC bonder order"));
  assert.ok(mentions("TRUMPF", "Trumpf laser division grows"));
  assert.equal(mentions("Carl Zeiss SMT GmbH", "Concrete decks work at Continental Coliseum"), false);
  assert.equal(mentions("Hanmi Semiconductor", "Samsung semiconductor capex rises"), false); // generic word alone doesn't count
});
