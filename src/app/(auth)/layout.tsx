import HeroGraph from "@/components/HeroGraph";
import Logo from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-ink p-10 text-paper lg:flex">
        <Logo onInk />
        <div>
          <p className="max-w-md text-2xl font-semibold leading-snug tracking-tight">
            See who your suppliers depend on, with a source for every link.
          </p>
          <div className="mt-8 max-w-xl">
            <HeroGraph />
          </div>
        </div>
        <p className="text-xs text-muted-on-ink">Built on Telem and Tavily</p>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-12">{children}</div>
      </main>
    </div>
  );
}
