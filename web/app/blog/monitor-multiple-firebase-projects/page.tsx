import type { Metadata } from "next";
import Link from "next/link";
import { PostLayout, P, H2, H3, UL, LI, ToolCallout } from "@/components/blog/shared";
import { POSTS } from "@/lib/site-nav";

const SITE = "https://aerie-dashboard-app.web.app";
const POST = POSTS.find((p) => p.href === "/blog/monitor-multiple-firebase-projects/")!;

export const metadata: Metadata = {
  title: "How to Monitor Multiple Firebase Projects",
  description:
    "The console is scoped to one project by design. Four approaches people actually use to watch several Firebase projects, and what each costs.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "How to Monitor Multiple Firebase Projects",
    description:
      "The console is scoped to one project by design. Four approaches people actually use to watch several Firebase projects, and what each costs.",
  },
};

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        The Firebase Console shows you one project at a time. That&apos;s not
        an oversight — its information architecture is per-project by
        design, and there is no aggregate view across projects because
        that&apos;s not what the console is built to do. If you own more
        than one project, the question &quot;how is my whole estate
        doing&quot; has no single screen that answers it. Here are the four
        approaches people actually use, with an honest cost for each.
      </P>

      <H2>1. Browser tabs, switching in the console</H2>
      <P>
        Free, zero setup, and genuinely fine if you have one or two
        projects. Open a tab per project, check each in turn. The cost is
        linear: every question that spans projects — which one is growing,
        which one just spiked, what changed since last week — means opening
        each project and holding the comparison in your head. That cost
        scales with the number of projects, not with how often you check, so
        it stays invisible right up until it doesn&apos;t.
      </P>

      <H2>2. Google Cloud Monitoring dashboards</H2>
      <P>
        Real, powerful, and the correct answer if your team already runs GCP
        observability. You can build cross-project dashboards, set alerting
        policies, and get metrics with far more depth than the Firebase
        Console exposes. The cost is setup time and a learning curve —
        Cloud Monitoring is oriented to metrics and alerting, not a
        product-level overview of what a project is doing, so getting to
        &quot;here&apos;s the state of my estate&quot; takes deliberate
        dashboard-building rather than being the default view.
      </P>

      <H2>3. Scripting it yourself</H2>
      <P>
        The Firebase Admin SDK or the CLI can pull whatever numbers you want
        from every project you manage. Total control, no per-seat cost, and
        you own the result forever. The cost is that you&apos;re now
        maintaining an internal tool: someone has to keep it running, and the
        underlying APIs change over time, which means the script that works
        today needs occasional upkeep to keep working next year.
      </P>

      <H2>4. A third-party dashboard</H2>
      <P>
        Fastest to a working view, and it costs money or trust or both —
        you&apos;re handing read access to your projects to someone
        else&apos;s product. Aerie is one option in this category: it reads
        the same Google APIs the console does, live from your browser, and
        shows every project you own side by side with usage and estimated
        cost. It doesn&apos;t write to anything.
      </P>
      <P>
        It&apos;s worth being specific about what else lives in this
        category, because they don&apos;t all do the same job. Databeam is a
        mobile app — iOS and Android — that switches between Firebase
        projects; it&apos;s free to download and doesn&apos;t mention cost
        monitoring. Firefoo is a desktop GUI for editing Firestore data
        directly — table, tree and JSON views, a query shell — priced at
        $9/mo for a solo seat; it&apos;s a data editor, not a monitoring
        tool, and has no analytics. Neither is a like-for-like substitute for
        the others, and neither is a substitute for the console itself. See{" "}
        <Link href="/compare/databeam/" className="text-accent underline underline-offset-4">
          Databeam
        </Link>
        ,{" "}
        <Link href="/compare/firefoo/" className="text-accent underline underline-offset-4">
          Firefoo
        </Link>{" "}
        and{" "}
        <Link href="/compare/firebase-console/" className="text-accent underline underline-offset-4">
          the Firebase Console
        </Link>{" "}
        comparisons for the specifics, and judge for yourself which one
        actually matches what you need.
      </P>

      <H2>Pick by your situation</H2>
      <UL>
        <LI>One or two projects — the console is fine, genuinely. Don&apos;t add a tool to solve a problem you don&apos;t have yet.</LI>
        <LI>Three or more projects, or client work — the tab-switching cost compounds fast enough that a cross-project view starts paying for itself.</LI>
        <LI>Already running GCP observability — build it in Cloud Monitoring; you have the infrastructure and the team habit already.</LI>
        <LI>Very specific internal needs — script it against the Admin SDK or CLI, and budget time to maintain it.</LI>
      </UL>

      <H3>What this means in practice</H3>
      <P>
        None of these four is wrong. They trade off differently between
        setup time, ongoing maintenance, and money, and the right one
        depends on how many projects you have and how often the question
        &quot;how&apos;s everything doing&quot; actually comes up. Aerie
        exists as one answer to that question, and it&apos;s free for three
        projects.
      </P>

      <ToolCallout href="/tools/firebase-pricing-calculator/" />
    </PostLayout>
  );
}
