// Deterministic checks that keep the LLM honest. Pure functions: no I/O.

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/** True only if `quote` (at least 20 chars) appears word for word in `text`, ignoring case, whitespace and curly quotes. */
export function quoteInText(quote: string, text: string): boolean {
  const q = normalize(quote).replace(/^["']|["']$/g, "");
  return q.length >= 20 && normalize(text).includes(q);
}

/** Whole days between `published` and `now`; null if the date can't be parsed. */
export function ageInDays(published: string | null | undefined, now = Date.now()): number | null {
  if (!published) return null;
  const t = Date.parse(published);
  return Number.isNaN(t) ? null : Math.floor((now - t) / 86_400_000);
}

// Words that don't identify a company on their own ("Carl Zeiss SMT GmbH" → carl, zeiss, smt).
const GENERIC = new Set([
  "gmbh", "corp", "corporation", "inc", "ltd", "llc", "holdings", "holding", "group", "company", "technology", "technologies",
  "semiconductor", "semiconductors", "industries", "chemical", "chemicals", "materials", "electronics", "systems", "the",
]);

/** True if the text mentions the company by a distinctive word of its name (keeps off-topic news out of the pulse). */
export function mentions(name: string, text: string): boolean {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
  const t = text.toLowerCase();
  return words.length > 0 && words.some((w) => t.includes(w));
}
