import Link from "next/link";
import { Logo } from "@/components/ui";
import { SiteFooter } from "@/components/SiteFooter";
import { POSTS, TOOLS, GITHUB_URL, type Post } from "@/lib/site-nav";

// Shared shell for /blog and /blog/*. Every post uses PostLayout so the
// header, prose rhythm, schema and footer can only be defined once.

export function BlogHeader() {
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
        <Link
          href="/blog/"
          className="rounded-[10px] border border-line bg-panel px-[13px] py-2 text-xs font-medium text-muted transition-colors hover:border-[#4a4239] hover:text-ink"
        >
          All posts
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[10px] border border-line bg-panel px-[13px] py-2 text-xs font-medium text-muted transition-colors hover:border-[#4a4239] hover:text-ink"
        >
          GitHub ↗
        </a>
      </div>
    </header>
  );
}

/** Prose primitives. Deliberately small — a post is text, not a component zoo. */
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-[15.5px] leading-[1.75] text-muted">{children}</p>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-14 text-[22px] font-semibold leading-tight tracking-[-.02em] text-ink sm:text-[26px]">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-9 text-[17px] font-semibold tracking-[-.01em] text-ink">
      {children}
    </h3>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-5 space-y-2.5 text-[15.5px] leading-[1.7] text-muted">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}

/** A pulled-out fact, used for the checkable billing rules. */
export function Note({
  children,
  source,
}: {
  children: React.ReactNode;
  source?: { href: string; label: string };
}) {
  return (
    <aside className="mt-7 rounded-[13px] border border-line3 bg-panel p-5">
      <div className="text-[14.5px] leading-relaxed text-ink">{children}</div>
      {source && (
        <a
          href={source.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-[12.5px] text-faint underline decoration-line3 underline-offset-4 hover:text-muted"
        >
          {source.label} ↗
        </a>
      )}
    </aside>
  );
}

/** Inline pointer to whichever free tool answers the question being discussed. */
export function ToolCallout({ href }: { href: string }) {
  const tool = TOOLS.find((t) => t.href === href);
  if (!tool) return null;
  return (
    <div className="mt-7 rounded-[13px] border border-accent/40 bg-panel p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-accent">
        Free tool
      </div>
      <Link
        href={tool.href}
        className="mt-2 block text-[16px] font-semibold text-ink hover:underline"
      >
        {tool.label} →
      </Link>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        {tool.blurb}
      </p>
    </div>
  );
}

function OtherPosts({ current }: { current: string }) {
  const others = POSTS.filter((p) => p.href !== current).slice(0, 3);
  if (!others.length) return null;
  return (
    <section className="mt-16 border-t border-line pt-8">
      <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-fainter">
        Keep reading
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {others.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-[13px] border border-line bg-panel p-4 transition-colors hover:border-line3"
          >
            <div className="text-[14px] font-semibold leading-snug text-ink">
              {p.label}
            </div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              {p.blurb}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PostLayout({
  post,
  children,
}: {
  post: Post;
  children: React.ReactNode;
}) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.label,
    description: post.blurb,
    datePublished: post.published,
    dateModified: post.published,
    author: { "@type": "Organization", name: "Aerie" },
    publisher: { "@type": "Organization", name: "Aerie" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://aerie-dashboard-app.web.app${post.href}`,
    },
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6 sm:px-8">
      {/* Static constant, no user input — same pattern as layout.tsx. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <BlogHeader />

      <article className="mt-14">
        <div className="text-[12px] font-medium text-faint">
          <time dateTime={post.published}>{post.publishedLabel}</time>
          {post.readingMinutes ? ` · ${post.readingMinutes} min read` : null}
        </div>
        <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-.03em] text-ink sm:text-[40px]">
          {post.label}
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted">
          {post.blurb}
        </p>
        <div className="mt-10 border-t border-line pt-2">{children}</div>
      </article>

      <OtherPosts current={post.href} />
      <SiteFooter />
    </div>
  );
}
