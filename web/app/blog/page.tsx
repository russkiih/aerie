import type { Metadata } from "next";
import Link from "next/link";
import { BlogHeader } from "@/components/blog/shared";
import { SiteFooter } from "@/components/SiteFooter";
import { POSTS } from "@/lib/site-nav";

export const metadata: Metadata = {
  title: "Firebase Cost & Monitoring Notes | Aerie Blog",
  description:
    "Plain explanations of how Firebase actually bills you, what forces a Blaze upgrade, and how to watch more than one project at a time.",
  alternates: { canonical: "/blog/" },
  openGraph: {
    type: "website",
    url: "https://aerie-dashboard-app.web.app/blog/",
    title: "Firebase Cost & Monitoring Notes | Aerie Blog",
    description:
      "How Firebase actually bills you, what forces a Blaze upgrade, and how to watch more than one project at a time.",
  },
};

const LD = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Aerie Blog",
  description:
    "Notes on Firebase cost, billing mechanics and multi-project monitoring.",
  url: "https://aerie-dashboard-app.web.app/blog/",
  blogPost: POSTS.map((p) => ({
    "@type": "BlogPosting",
    headline: p.label,
    description: p.blurb,
    datePublished: p.published,
    url: `https://aerie-dashboard-app.web.app${p.href}`,
  })),
};

export default function BlogIndex() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6 sm:px-8">
      {/* Static constant, no user input — same pattern as layout.tsx. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }}
      />
      <BlogHeader />

      <section className="mt-14">
        <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-.03em] text-ink sm:text-[40px]">
          Notes on Firebase cost and monitoring
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
          Every post here exists because the answer was hard to find and the
          documentation was scattered across three pages. Rates and quotas are
          quoted from Google&apos;s own docs and linked, so you can check them
          rather than trust us.
        </p>
      </section>

      <div className="mt-12 divide-y divide-line border-y border-line">
        {POSTS.map((p) => (
          <article key={p.href} className="py-7">
            <div className="text-[12px] font-medium text-faint">
              <time dateTime={p.published}>{p.publishedLabel}</time>
              {p.readingMinutes ? ` · ${p.readingMinutes} min read` : null}
            </div>
            <h2 className="mt-2 text-[19px] font-semibold leading-snug tracking-[-.01em] text-ink sm:text-[21px]">
              <Link href={p.href} className="hover:underline">
                {p.label}
              </Link>
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
              {p.blurb}
            </p>
            <Link
              href={p.href}
              className="mt-3 inline-block text-[13px] font-semibold text-accent hover:underline"
            >
              Read →
            </Link>
          </article>
        ))}
      </div>

      <SiteFooter />
    </div>
  );
}
