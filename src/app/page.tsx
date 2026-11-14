import Link from "next/link";
import { demoSignInAction } from "@/app/(auth)/actions";
import ContactForm from "@/components/ContactForm";
import HeroGraph from "@/components/HeroGraph";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";

const FEATURES = [
  {
    tag: "MAP",
    title: "See who supplies your suppliers",
    body: "Type in a chip, a product or a stock ticker. In about a minute you get a map that runs from raw materials all the way up to the finished product.",
    note: "Searches 9+ sources through Telem",
  },
  {
    tag: "SOURCES",
    title: "Check where every link came from",
    body: "Each connection comes with the exact sentence that backs it up and a link to the page. If we can't find that sentence on the page, the connection stays off the map.",
    note: "Word-for-word checking",
  },
  {
    tag: "SINGLE SOURCE",
    title: "Know who can't be replaced",
    body: "We only mark a supplier as a single source when a filing or article actually says so, and we show you the sentence.",
    note: "Never guessed",
  },
  {
    tag: "NEWS CHECK",
    title: "Check the news in one click",
    body: "Pull up the latest news on any supplier. We tell you if it's a real production problem, if the source is trustworthy and if it's recent.",
    note: "Tavily news, read by AI",
  },
  {
    tag: "KNOCK-ON",
    title: "See the knock-on effects",
    body: "When a supplier runs into trouble, the map shows exactly which factories and products sit downstream of it.",
    note: "Follows every link downstream",
  },
  {
    tag: "RELIABLE",
    title: "Works even when the Wi-Fi doesn't",
    body: "We save every result. If a data source is slow or down, you see the last good result, clearly marked as saved.",
    note: "Saved results as a backup",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Search",
    body: "We run three searches at once: company filings, product teardowns and this month's news. Then we search again for every supplier that looks important.",
    meta: ["Telem search", "Telem fetch"],
  },
  {
    n: "02",
    title: "Check",
    body: "Our AI reads the pages and works out who supplies whom. Our code then checks each quote against the original page and drops anything that doesn't match.",
    meta: ["AI extraction", "Quote checking"],
  },
  {
    n: "03",
    title: "Watch",
    body: "Check the news on any supplier whenever you like. If a real problem turns up, that supplier turns red, and so does everything that depends on it.",
    meta: ["Tavily news", "Knock-on map"],
  },
];

const USE_CASES = [
  {
    who: "PROCUREMENT",
    title: "Check a critical part before you commit",
    body: "A memory buyer wants to know what HBM3E depends on before a big supply meeting.",
    input: "Micron HBM3E",
    output: "The bonding machines (Hanmi) and the bonding film (Resonac) each come from a single supplier, and you can read the sentence that says so.",
  },
  {
    who: "INVESTING",
    title: "Look inside a big holding",
    body: "A fund manager who owns NVIDIA wants to know which small suppliers could hurt the stock before everyone else notices.",
    input: "NVIDIA Blackwell",
    output: "Two hidden weak points, ABF film from Ajinomoto and glass cloth from Nittobo, sitting two steps below TSMC.",
  },
  {
    who: "RISK",
    title: "Back up every flag with evidence",
    body: "A risk team has to explain why a supplier is on the watch list, not just say that it is.",
    input: "Any supplier on the map",
    output: "The quote, the link and the news check, ready to drop into a risk report.",
  },
  {
    who: "DEALS",
    title: "Check a company before you buy it",
    body: "A deal team wants to find a target's hidden single-source suppliers in an afternoon, not a month.",
    input: "The company's main product",
    output: "A supplier map with sources, plus a news check on every critical supplier.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <div className="hidden gap-5 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#use-cases" className="hover:text-ink">Who it&apos;s for</a>
            <a href="#contact" className="hover:text-ink">Contact</a>
          </div>
          <div className="flex-1" />
          <Link href="/signin" className="text-sm text-ink hover:text-amber-ink">Sign in</Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-md bg-ink px-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink-2"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:pt-24">
        <Reveal>
          <p className="font-mono text-xs tracking-[0.08em] text-amber-ink">THE SHOCK STARTS THREE TIERS DOWN</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Find the hidden suppliers that can break your supply chain.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Type in a product or a stock ticker. Deepchain maps your suppliers&apos; suppliers, shows you where each link came from, and
            warns you when one of them runs into trouble.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-md bg-amber px-5 font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              Trace your first chain
            </Link>
            <form action={demoSignInAction}>
              <button className="inline-flex h-11 items-center rounded-md border border-line-strong bg-card px-5 font-medium text-ink transition-colors hover:border-ink">
                Try the live demo
              </button>
            </form>
          </div>
          <p className="mt-8 text-xs text-muted">Built on Telem and Tavily</p>
        </Reveal>
        <Reveal delay={150} className="min-w-0">
          <HeroGraph />
        </Reveal>
      </section>

      {/* Problem */}
      <section aria-label="The problem" className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-3">
          {[
            ["You know your big suppliers.", "Everyone keeps an eye on NVIDIA, Micron and TSMC. That's rarely where the trouble starts."],
            ["The trouble is further down.", "One small factory making a special film or a bonding machine can hold up an entire product line."],
            ["Supplier databases go stale.", "Most are updated by hand, cost a fortune, and miss what happened in the news this week."],
          ].map(([h, b], i) => (
            <Reveal key={h} delay={i * 100} className="bg-card px-6 py-8">
              <h2 className="text-base font-semibold">{h}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24 sm:px-6">
        <Reveal>
          <p className="font-mono text-xs tracking-[0.08em] text-amber-ink">FEATURES</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">What you can do with Deepchain</h2>
          <p className="mt-3 max-w-2xl text-muted">Spot the weak points in a supply chain early, and see the evidence for yourself.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.tag} delay={(i % 3) * 100}>
              <article className="flex h-full flex-col rounded-lg border border-line bg-card p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-amber">
                <span className="w-fit rounded-[3px] border border-amber-line bg-amber-tint px-1.5 py-px font-mono text-[10px] tracking-[0.06em] text-amber-ink">
                  {f.tag}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{f.body}</p>
                <p className="mt-5 border-t border-line pt-3 text-xs text-muted">{f.note}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-y border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.08em] text-amber-ink">HOW IT WORKS</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">From a ticker to a map to an alert</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <article className="flex h-full flex-col rounded-lg border border-line bg-paper p-6">
                  <span className="font-mono text-xs text-amber-ink">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.body}</p>
                  <ul className="mt-6 flex flex-wrap gap-1.5">
                    {s.meta.map((m) => (
                      <li key={m} className="rounded-full border border-line bg-card px-2.5 py-0.5 text-xs text-muted">
                        {m}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24 sm:px-6">
        <Reveal>
          <p className="font-mono text-xs tracking-[0.08em] text-amber-ink">WHO IT&apos;S FOR</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">For teams who need to know before the shortage hits</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {USE_CASES.map((u, i) => (
            <Reveal key={u.who} delay={(i % 2) * 120}>
              <article className="flex h-full flex-col rounded-lg border border-line bg-card p-6">
                <span className="font-mono text-[11px] tracking-[0.06em] text-muted">{u.who}</span>
                <h3 className="mt-2 text-xl font-semibold">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{u.body}</p>
                <dl className="mt-5 grid gap-2 rounded-md border border-line bg-paper p-4 text-sm">
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <dt className="text-xs font-medium text-amber-ink">You type</dt>
                    <dd className="font-mono text-[13px]">{u.input}</dd>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <dt className="text-xs font-medium text-amber-ink">You get</dt>
                    <dd className="leading-relaxed text-ink-2">{u.output}</dd>
                  </div>
                </dl>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Evidence */}
      <section id="evidence" className="scroll-mt-16 border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.08em] text-amber-ink">WHY YOU CAN TRUST IT</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Every connection is backed by a real quote</h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted">
              AI tools are known to make things up, so we never take the AI&apos;s word for it. A connection only goes on the map if we can
              find the exact sentence on the page it came from. You can see the ones we threw out, too.
            </p>
          </Reveal>
          <Reveal delay={150} className="flex flex-col gap-3">
            <div className="rounded-lg border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <span>TSMC → NVIDIA Blackwell</span>
                <span className="text-amber-ink">✓ FOUND ON PAGE</span>
              </div>
              <blockquote className="mt-3 text-sm leading-relaxed text-ink-2">
                “The Blackwell package is the first high volume design to be packaged with TSMC’s CoWoS-L technology.”
              </blockquote>
              <a
                href="https://newsletter.semianalysis.com/p/nvidias-blackwell-reworked-shipment"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-full border border-line bg-card px-2.5 py-0.5 font-mono text-[11px] text-muted no-underline hover:border-ink"
              >
                newsletter.semianalysis.com ↗
              </a>
            </div>
            <div className="rounded-lg border border-risk-line bg-risk-tint p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <span className="line-through decoration-risk/60">Supplier X → Factory Y</span>
                <span className="text-risk-ink">✕ NOT ON PAGE</span>
              </div>
              <p className="mt-2 text-sm text-risk-ink">Left off the map. The quote didn&apos;t appear on the page it was supposed to come from.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto grid max-w-6xl scroll-mt-16 gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="font-mono text-xs tracking-[0.08em] text-amber-ink">CONTACT</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Let&apos;s talk</h2>
          <p className="mt-4 leading-relaxed text-muted">
            Want a walkthrough, a trial on your own parts or holdings, or just have a question? Send us a note and we&apos;ll get back to you.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {["A demo on a product you care about", "A trial on your own parts or holdings", "Partnerships and data integrations"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="rounded-lg border border-line bg-card p-6 sm:p-8">
          <ContactForm />
        </Reveal>
      </section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Try it on a product you care about</h2>
            <p className="mt-2 text-muted-on-ink">Start with Micron HBM3E, NVIDIA Blackwell or ASML&apos;s newest chipmaking machine, or type in your own.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-md bg-amber px-5 font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              Create account
            </Link>
            <Link
              href="/signin"
              className="inline-flex h-11 items-center rounded-md border border-ink-line px-5 font-medium text-paper transition-colors hover:border-paper"
            >
              Sign in
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="bg-ink text-muted-on-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-ink-line px-4 py-6 text-xs sm:px-6">
          <Logo onInk />
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <a href="#features" className="hover:text-paper">Features</a>
            <a href="#use-cases" className="hover:text-paper">Who it&apos;s for</a>
            <a href="#contact" className="hover:text-paper">Contact</a>
            <Link href="/signin" className="hover:text-paper">Sign in</Link>
          </nav>
          <span>Built at SearchHack, Sunnyvale, 2026</span>
        </div>
      </footer>
    </div>
  );
}
