import Link from "next/link";

export default function Logo({ onInk = false }: { onInk?: boolean }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 font-mono text-[13px] font-semibold tracking-[0.08em] ${onInk ? "text-white" : "text-ink"}`}
    >
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-amber" />
      DEEPCHAIN
    </Link>
  );
}
