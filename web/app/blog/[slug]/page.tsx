import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayout } from "@/components/blog/shared";
import autopilotRaw from "@/lib/blog-autopilot.json";
import type { Post } from "@/lib/site-nav";

// Posts committed by the Blog Autopilot (content/autopilot/*.md → lib/blog-autopilot.json at
// build). Hand-written posts keep their own folders; this route only serves the generated ones.

type AutopilotPost = Post & { slug: string; html: string };
const POSTS = autopilotRaw as AutopilotPost[];
const SITE = "https://aerie-dashboard-app.web.app";

export const dynamicParams = false;

// `output: export` refuses an empty param list, so with no posts yet we emit one unlinked,
// noindex placeholder page instead of failing the build.
const PLACEHOLDER = "coming-soon";

export function generateStaticParams(): { slug: string }[] {
  return POSTS.length ? POSTS.map((p) => ({ slug: p.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return { title: "Coming soon | Aerie Blog", robots: { index: false, follow: false } };
  return {
    title: `${post.label} | Aerie Blog`,
    description: post.blurb,
    alternates: { canonical: post.href },
    openGraph: { type: "article", url: `${SITE}${post.href}`, title: post.label, description: post.blurb },
  };
}

export default function AutopilotPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post && params.slug === PLACEHOLDER) {
    return (
      <PostLayout post={{ href: `/blog/${PLACEHOLDER}/`, label: "More posts are on the way.", blurb: "New notes on Firebase cost and monitoring publish here on a schedule.", published: "2026-08-27", publishedLabel: "27 August 2026" }}>
        <p className="mt-5 text-[15.5px] leading-[1.75] text-muted">Check the <a className="underline text-ink" href="/blog/">blog index</a> for everything published so far.</p>
      </PostLayout>
    );
  }
  if (!post) notFound();
  return (
    <PostLayout post={post}>
      {/* Build-time HTML from our own markdown (marked), not user input. */}
      <div
        className="[&_p]:mt-5 [&_p]:text-[15.5px] [&_p]:leading-[1.75] [&_p]:text-muted [&_h2]:mt-14 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-[-.02em] [&_h2]:text-ink sm:[&_h2]:text-[26px] [&_h3]:mt-9 [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:mt-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-2 [&_li]:text-[15.5px] [&_li]:leading-[1.7] [&_li]:text-muted [&_a]:underline [&_a]:text-ink [&_strong]:text-ink [&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px] [&_th]:border-b [&_th]:border-line [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12px] [&_th]:uppercase [&_th]:tracking-[.06em] [&_th]:text-faint [&_td]:border-b [&_td]:border-line [&_td]:py-2 [&_td]:pr-4 [&_td]:text-muted [&_blockquote]:mt-5 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-panel [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13.5px]"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </PostLayout>
  );
}
