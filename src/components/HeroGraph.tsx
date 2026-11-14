"use client";

import { useEffect, useState } from "react";

type Node = { id: string; name: string; sub: string; col: number; row: number; quiet?: boolean };

const W = 132;
const H = 58;
const COL_X = [0, 160, 320, 480];
const ROW_Y = [30, 114, 198];
const COLUMNS = ["MATERIALS", "COMPONENTS", "FACTORY", "PRODUCT"];

// Real supply relationships; the disruption itself is an illustrative example.
const NODES: Node[] = [
  { id: "nittobo", name: "Nittobo", sub: "Glass cloth", col: 0, row: 0, quiet: true },
  { id: "ajinomoto", name: "Ajinomoto", sub: "ABF film", col: 0, row: 1 },
  { id: "skhynix", name: "SK hynix", sub: "HBM memory", col: 1, row: 0, quiet: true },
  { id: "ibiden", name: "Ibiden", sub: "Chip substrates", col: 1, row: 1 },
  { id: "unimicron", name: "Unimicron", sub: "Chip substrates", col: 1, row: 2 },
  { id: "tsmc", name: "TSMC", sub: "Chip packaging", col: 2, row: 1 },
  { id: "nvidia", name: "NVIDIA", sub: "Blackwell GPU", col: 3, row: 1 },
];

const EDGES: [string, string][] = [
  ["nittobo", "ibiden"],
  ["skhynix", "tsmc"],
  ["ajinomoto", "ibiden"],
  ["ajinomoto", "unimicron"],
  ["ibiden", "tsmc"],
  ["unimicron", "tsmc"],
  ["tsmc", "nvidia"],
];

// Step at which each node / edge turns red.
const HIT_AT: Record<string, number> = { ajinomoto: 2, ibiden: 3, unimicron: 3, tsmc: 4, nvidia: 5 };
const EDGE_AT: Record<string, number> = { "ajinomoto-ibiden": 3, "ajinomoto-unimicron": 3, "ibiden-tsmc": 4, "unimicron-tsmc": 4, "tsmc-nvidia": 5 };

const CAPTIONS = [
  "Watching 7 suppliers. All clear.",
  "Checking the latest news on Ajinomoto…",
  "Ajinomoto: production problem confirmed",
  "Spreading to the substrate makers that rely on it",
  "TSMC's packaging line is now exposed",
  "NVIDIA Blackwell at risk, 3 steps from the problem",
];
const LAST = CAPTIONS.length - 1;

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const pos = (n: Node) => ({ x: COL_X[n.col], y: ROW_Y[n.row] });

function curve(a: Node, b: Node) {
  const p = pos(a), q = pos(b);
  const x1 = p.x + W, y1 = p.y + H / 2, x2 = q.x, y2 = q.y + H / 2, mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

export default function HeroGraph() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(LAST);
      return;
    }
    const t = setInterval(() => setStep((s) => (s + 1) % (LAST + 3)), 1500); // two extra beats hold the end state
    return () => clearInterval(t);
  }, []);
  const s = Math.min(step, LAST);
  const alarm = s >= 2;

  return (
    <figure className="m-0 rounded-xl border border-line bg-card p-5 shadow-[0_1px_0_#E6E3DC]">
      <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-muted">
        <span>EXAMPLE ALERT</span>
        <span>NVIDIA · BLACKWELL</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 612 270"
          className="h-auto w-full min-w-[460px]"
          role="img"
          aria-label="Example: a production problem at Ajinomoto, which makes ABF film, spreads through the substrate makers Ibiden and Unimicron to TSMC's packaging line and then to NVIDIA's Blackwell GPU."
        >
          {COLUMNS.map((c, i) => (
            <text key={c} x={COL_X[i]} y={12} fontSize="10" fill="#5C5850" letterSpacing="0.8" className="font-mono">
              {c}
            </text>
          ))}

          {EDGES.map(([a, b]) => {
            const hot = (EDGE_AT[`${a}-${b}`] ?? 99) <= s;
            const quiet = byId[a].quiet;
            return (
              <path
                key={a + b}
                d={curve(byId[a], byId[b])}
                fill="none"
                stroke={hot ? "#C2341F" : "#D6D2C8"}
                strokeWidth={hot ? 2.25 : 1.5}
                opacity={quiet ? 0.5 : 1}
                className={hot ? "flow" : undefined}
                style={{ transition: "stroke 0.4s" }}
              />
            );
          })}

          {NODES.map((n) => {
            const { x, y } = pos(n);
            const hit = (HIT_AT[n.id] ?? 99) <= s;
            const source = n.id === "ajinomoto" && hit;
            const checking = n.id === "ajinomoto" && s === 1;
            const product = n.id === "nvidia";
            const fill = source ? "#FBEDEA" : checking || (product && !hit) ? "#FBF3E2" : "#FFFFFF";
            const stroke = hit ? "#C2341F" : checking || product ? "#C98A1B" : "#E6E3DC";
            const tag = source ? "PROBLEM" : hit ? "AT RISK" : checking ? "CHECKING…" : null;
            return (
              <g key={n.id} opacity={n.quiet && alarm ? 0.45 : 1} className={checking ? "pulse" : undefined} style={{ transition: "opacity 0.4s" }}>
                <rect
                  x={x + 0.75}
                  y={y + 0.75}
                  width={W - 1.5}
                  height={H - 1.5}
                  rx="7"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={hit || checking || product ? 1.5 : 1}
                  strokeDasharray={hit && !source ? "5 3" : undefined}
                  style={{ transition: "fill 0.4s, stroke 0.4s" }}
                />
                <text x={x + 12} y={y + 24} fontSize="13" fontWeight="600" fill="#1C1B18">
                  {n.name}
                </text>
                <text x={x + 12} y={y + 43} fontSize="10.5" className="font-mono" fill={tag ? (hit ? "#A12A18" : "#8A5A00") : "#5C5850"}>
                  {tag ?? n.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption
        aria-hidden="true"
        className={`mt-3 flex items-center gap-2 border-t border-line pt-3 text-[13px] ${alarm ? "text-risk-ink" : "text-muted"}`}
      >
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${alarm ? "bg-risk" : "bg-amber"} ${s === 1 ? "pulse" : ""}`} />
        {CAPTIONS[s]}
      </figcaption>
    </figure>
  );
}
