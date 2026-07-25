import { SiteFooter } from "@/components/SiteFooter";
import Link from "next/link";
import { Logo } from "@/components/ui";

// Shared building blocks for the /compare/* pages. Kept separate from
// LiveApp.tsx and components/ui.tsx (only importing Logo from the latter)
// so the comparison pages stay independent of the app shell.

export const GITHUB_URL = "https://github.com/russkiih/aerie";

export const COMPARE_PAGES = [
  { slug: "firebase-console", name: "Firebase Console" },
  { slug: "databeam", name: "Databeam" },
  { slug: "firefoo", name: "Firefoo" },
  { slug: "flame-shield", name: "Flame Shield" },
] as const;

export function CompareHeader() {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-[13px]">
        <Logo />
        <div className="leading-none">
          <div className="text-[17px] font-semibold tracking-[-.015em] text-ink">
            Aerie
          </div>
          <div className="mt-[3px] font-mono text-[10.5px] font-medium tracking-[.03em] text-faint">
            open source · your Firebase estate
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-[9px]">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[10px] border border-line bg-panel px-[13px] py-2 text-xs font-medium text-muted transition-colors hover:border-[#4a4239] hover:bg-[#282420] hover:text-ink"
        >
          GitHub ↗
        </a>
        <Link
          href="/"
          className="rounded-[10px] bg-accent px-[13px] py-2 text-xs font-semibold text-paper transition-opacity hover:opacity-90"
        >
          Open Aerie
        </Link>
      </div>
    </header>
  );
}

export function CompareFooter() {
  return <SiteFooter />;
}

export type CompareRow = {
  label: string;
  competitor: string;
  aerie: string;
};

export function CompareTable({
  competitorName,
  rows,
}: {
  competitorName: string;
  rows: CompareRow[];
}) {
  return (
    <div className="mt-8 overflow-x-auto rounded-[15px] border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-panel">
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-faint">
              Attribute
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
              {competitorName}
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
              Aerie
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line2 last:border-0">
              <td className="px-4 py-3 align-top font-medium text-muted">
                {r.label}
              </td>
              <td className="px-4 py-3 align-top text-muted">
                {r.competitor}
              </td>
              <td className="px-4 py-3 align-top text-muted">{r.aerie}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type FaqItem = { q: string; a: string };

export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="mx-auto mt-24 max-w-2xl scroll-mt-6 sm:mt-32">
      <h2 className="text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
        Questions worth asking
      </h2>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {items.map(({ q, a }) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer items-start justify-between gap-4 list-none text-[15.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <span className="mt-1 shrink-0 text-[18px] font-normal text-faint transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="mt-24 border-t border-line pt-16 text-center sm:mt-32">
      <h2 className="text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
        Every project you own, on one page.
      </h2>
      <p className="mt-4 text-[15.5px] text-muted">
        Free for three projects. No card.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2.5 rounded-xl bg-accent px-7 py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
      >
        Open Aerie →
      </Link>
    </section>
  );
}

export function CrossLinks({ currentSlug }: { currentSlug: string }) {
  const others = COMPARE_PAGES.filter((p) => p.slug !== currentSlug);
  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="text-[13px] font-semibold uppercase tracking-[.1em] text-faint">
        Other honest comparisons
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {others.map((p) => (
          <Link
            key={p.slug}
            href={`/compare/${p.slug}/`}
            className="rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:border-[#4a4239] hover:text-ink"
          >
            {p.name} vs Aerie →
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-6 sm:px-8">
      {children}
    </div>
  );
}

export function Hero({
  eyebrow,
  h1,
  summary,
}: {
  eyebrow: string;
  h1: string;
  summary: string;
}) {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="mx-auto max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-.03em] text-ink sm:text-[42px] sm:leading-[1.12]">
          {h1}
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          {summary}
        </p>
      </div>
    </section>
  );
}

export function ProseSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-16 max-w-3xl sm:mt-20">
      <h2 className="text-2xl font-semibold tracking-[-.02em] text-ink sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export function ReasonList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3 text-[14.5px] leading-relaxed text-muted">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
