import { SiteFooter } from "@/components/SiteFooter";
// Shared chrome for the /tools/* cost calculators: nav, the "estimate, not a
// quote" disclosure, the Aerie CTA, and cross-links that tie the three tools
// into one cluster. Server-renderable — no client state lives here.

import Link from "next/link";
import { Logo } from "@/components/ui";
import { VERIFIED_ON, PRICING_SOURCE } from "@/lib/firebase-pricing";

const GITHUB_URL = "https://github.com/russkiih/aerie";

export const TOOLS = [
  {
    slug: "firebase-pricing-calculator",
    title: "Firebase Pricing Calculator",
    blurb: "The full Blaze bill — Firestore, Realtime DB, Functions, Hosting — in one estimate.",
  },
  {
    slug: "firestore-cost-estimator",
    title: "Firestore Cost Estimator",
    blurb: "nam5 vs us-central1, side by side. Multi-region costs exactly 2x.",
  },
  {
    slug: "firebase-free-tier-checker",
    title: "Firebase Free Tier Limits Checker",
    blurb: "Check every Spark limit before Google forces you onto Blaze.",
  },
] as const;

export type ToolSlug = (typeof TOOLS)[number]["slug"];

function ToolNav() {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-[13px]">
        <Logo />
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-[-.015em] text-ink">
            Aerie
          </div>
          <div className="mt-[3px] font-mono text-[10px] font-medium tracking-[.03em] text-faint">
            free Firebase cost tools
          </div>
        </div>
      </Link>
      <Link
        href="/"
        className="rounded-[10px] border border-line bg-panel px-[13px] py-2 text-xs font-medium text-muted transition-colors hover:border-[#4a4239] hover:bg-[#282420] hover:text-ink"
      >
        Open Aerie ↗
      </Link>
    </header>
  );
}

function SourceNote() {
  return (
    <p className="mt-8 text-[11.5px] leading-relaxed text-fainter">
      Rates verified {VERIFIED_ON} against{" "}
      <a
        href={PRICING_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
        className="text-faint underline decoration-line3 underline-offset-4 hover:text-muted"
      >
        Google&apos;s official Firebase pricing
      </a>
      . This is an estimate, not a quote — Google changes these prices, and
      your real bill depends on your exact usage and any other services you
      run.
    </p>
  );
}

function AerieCta() {
  return (
    <section className="mt-20 rounded-[20px] border border-line bg-gradient-to-b from-panel to-inset p-8 text-center shadow-card sm:mt-24">
      <h2 className="text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
        This answers it once. Aerie watches it continuously.
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
        Punch in numbers here and you get today&apos;s estimate. Aerie reads
        your real usage live, across every Firebase project you own, and
        flags a cost spike before the invoice does.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-2.5 rounded-xl bg-accent px-7 py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
      >
        Watch it automatically with Aerie
      </Link>
      <p className="mt-3 text-[12px] text-faint">Free for 3 projects. No card.</p>
    </section>
  );
}

function CrossLinks({ current }: { current: ToolSlug }) {
  const others = TOOLS.filter((t) => t.slug !== current);
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      {others.map((t) => (
        <Link
          key={t.slug}
          href={`/tools/${t.slug}/`}
          className="group rounded-[15px] border border-line bg-gradient-to-b from-panel to-inset p-5 shadow-card transition-colors hover:border-[#4a4239]"
        >
          <div className="text-[13px] font-semibold text-ink group-hover:text-accent">
            {t.title} →
          </div>
          <div className="mt-1.5 text-[12px] leading-relaxed text-muted">
            {t.blurb}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ToolShell({
  current,
  eyebrow,
  title,
  intro,
  children,
}: {
  current: ToolSlug;
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-6 sm:px-8">
      <ToolNav />

      <section className="mt-12 sm:mt-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </div>
        <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-.02em] text-ink sm:text-4xl sm:leading-[1.1]">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          {intro}
        </p>
      </section>

      <div className="mt-10">{children}</div>

      <SourceNote />
      <AerieCta />
      <CrossLinks current={current} />

      <SiteFooter />
    </div>
  );
}
