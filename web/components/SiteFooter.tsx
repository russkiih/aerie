import Link from "next/link";
import { TOOLS, COMPARISONS, GITHUB_URL } from "@/lib/site-nav";

// One footer for every page — landing, tools and comparisons. It carries the
// full internal link graph on purpose: every page linking to every other page
// is how a small site gets crawled thoroughly, and it is also the only way a
// visitor who landed on a calculator ever discovers the other two.
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line pt-10 sm:mt-32">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-fainter">
            Free tools
          </div>
          <ul className="mt-3 space-y-2">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="text-[13px] text-muted hover:text-ink"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-fainter">
            Compare
          </div>
          <ul className="mt-3 space-y-2">
            {COMPARISONS.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className="text-[13px] text-muted hover:text-ink"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-fainter">
            Project
          </div>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/" className="text-[13px] text-muted hover:text-ink">
                Dashboard
              </Link>
            </li>
            <li>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-muted hover:text-ink"
              >
                Source on GitHub ↗
              </a>
            </li>
            <li>
              <a
                href={`${GITHUB_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-muted hover:text-ink"
              >
                AGPL-3.0 licence ↗
              </a>
            </li>
          </ul>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-md text-center text-[11.5px] leading-relaxed text-faint">
        Aerie reads your Google data directly in your browser and never writes
        to it. Your Google Cloud access token stays in the browser — the hosted
        version sends only a limited identity token to check your subscription,
        and stores nothing but your email and plan. Self-hosted builds contact
        no server at all.
      </p>

      <p className="mt-5 pb-10 text-center text-[11px] text-fainter">
        © {new Date().getFullYear()} Aerie · AGPL-3.0 · built for people with
        more than one Firebase project
      </p>
    </footer>
  );
}
