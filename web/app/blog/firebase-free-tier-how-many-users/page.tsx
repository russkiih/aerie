import type { Metadata } from "next";
import Link from "next/link";
import {
  PostLayout,
  P,
  H2,
  UL,
  LI,
  Note,
  ToolCallout,
} from "@/components/blog/shared";
import { POSTS } from "@/lib/site-nav";
import { FREE_TIER, VERIFIED_ON } from "@/lib/firebase-pricing";

const SITE = "https://aerie-dashboard-app.web.app";
const POST = POSTS.find(
  (p) => p.href === "/blog/firebase-free-tier-how-many-users/"
)!;

export const metadata: Metadata = {
  title: "How Many Users Can the Firebase Free Tier Handle?",
  description:
    "Firebase quotas are per operation, not per user. The real ceiling is usually Firestore's daily reads — here's the arithmetic, from 100 to a few thousand daily users.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "How many users can the Firebase free tier handle?",
    description:
      "The quotas are per operation, not per user. The real ceiling is usually Firestore's daily reads — here's the arithmetic.",
  },
};

// Capacity arithmetic, derived entirely from the verified Spark quotas in
// lib/firebase-pricing.ts. The scenarios are illustrative; the quotas are not.
const READS = FREE_TIER.firestore.readsPerDay;
const lightReadsPerUser = 50;
const mediumReadsPerUser = 200;
const heavyReadsPerUser = 500;
const lightUsers = Math.floor(READS / lightReadsPerUser);
const mediumUsers = Math.floor(READS / mediumReadsPerUser);
const heavyUsers = Math.floor(READS / heavyReadsPerUser);

const WRITES = FREE_TIER.firestore.writesPerDay;
const writesPerActiveUser = 20;
const writeCeilingUsers = Math.floor(WRITES / writesPerActiveUser);

const pageWeightMB = 1.2;
const hostingVisitsPerDay = Math.floor(
  FREE_TIER.hosting.transferMBPerDay / pageWeightMB
);

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        The question everyone asks is &ldquo;how many users,&rdquo; and the
        honest first answer is that Firebase doesn&apos;t meter users. It
        meters operations: Firestore reads per day, MB of hosting transfer
        per day, writes, downloads. Two apps with identical user counts can
        sit at opposite ends of the free tier because one reads 30 documents
        per session and the other reads 600. So the useful question is:
        given how <em>your</em> app behaves per user, where do the quotas
        put your ceiling? That arithmetic is short, and this post does it.
        All quotas below are Google&apos;s published Spark limits, verified{" "}
        {VERIFIED_ON}.
      </P>

      <H2>
        The quota that decides it: {READS.toLocaleString()} Firestore reads a
        day
      </H2>
      <P>
        For a typical CRUD app, Firestore reads are the binding constraint —
        every other quota is either more generous or easier to control. The
        division is simple:
      </P>
      <UL>
        <LI>
          A light app — {lightReadsPerUser} reads per active user per day, a
          few small screens with <code>.limit()</code> on the queries —
          supports about <strong>{lightUsers.toLocaleString()} daily
          active users</strong> inside the free tier.
        </LI>
        <LI>
          A medium app — {mediumReadsPerUser} reads per user per day, list
          views that pull real collections — supports about{" "}
          <strong>{mediumUsers.toLocaleString()} daily active users</strong>.
        </LI>
        <LI>
          A read-heavy app — {heavyReadsPerUser} reads per user per day,
          feeds, dashboards, unbounded queries — supports about{" "}
          <strong>{heavyUsers} daily active users</strong> before the quota
          runs out mid-afternoon.
        </LI>
      </UL>
      <P>
        Note those are <em>daily active</em> users. If a tenth of your
        signed-up users open the app on a given day, multiply each ceiling
        by ten to get registered accounts. That is how a free-tier app
        honestly claims &ldquo;thousands of users&rdquo; — and why the claim
        collapses the week engagement improves.
      </P>
      <Note
        source={{
          href: "https://firebase.google.com/pricing",
          label: "Firebase pricing",
        }}
      >
        Where the reads actually go is rarely evenly spread. One unbounded
        query on a popular screen can consume more quota than every other
        feature combined — the{" "}
        <Link
          href="/blog/why-is-my-firebase-bill-so-high/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          five billing rules
        </Link>{" "}
        that inflate paid bills deplete free quotas the same way.
      </Note>

      <H2>Writes: {WRITES.toLocaleString()} a day, and usually not the problem</H2>
      <P>
        At {writesPerActiveUser} writes per active user per day — a
        reasonable figure for an app where users create and edit things —
        the write quota supports about{" "}
        {writeCeilingUsers.toLocaleString()} daily active users, comfortably
        above the read ceiling for the same app. Write-heavy exceptions
        exist (chat, collaborative editing, anything logging events per
        keystroke), and those apps hit the write quota first. If that is
        you, you already know.
      </P>

      <H2>
        Hosting: {FREE_TIER.hosting.transferMBPerDay} MB a day is the quota
        people underestimate
      </H2>
      <P>
        Auth allows {FREE_TIER.auth.monthlyActiveUsers.toLocaleString()}{" "}
        monthly active users free, so identity is effectively never your
        ceiling. Hosting transfer is: at a {pageWeightMB} MB first-load page
        weight — modest for a JavaScript app with a couple of images — the{" "}
        {FREE_TIER.hosting.transferMBPerDay} MB daily allowance serves about{" "}
        {hostingVisitsPerDay} fresh visits a day. Aggressive caching and
        small bundles stretch it; a single uncompressed hero image collapses
        it. Projects that &ldquo;mysteriously&rdquo; exhaust the free tier
        with almost no users usually did it here, not in the database.
      </P>

      <H2>So what is the honest answer?</H2>
      <P>
        For a typical app with typical engagement:{" "}
        <strong>
          a few hundred daily active users, i.e. a few thousand registered
          users, fits inside the free tier
        </strong>{" "}
        — if queries are limited, images are compressed, and nothing polls.
        A read-heavy app hits the wall at around {heavyUsers} daily actives.
        A disciplined light app can genuinely run{" "}
        {lightUsers.toLocaleString()} people a day for free. The spread is
        wide because the quotas measure your engineering, not your user
        count.
      </P>
      <P>
        Two things change the picture entirely. Cloud Functions are not on
        the free plan at all — needing one function moves you to Blaze
        regardless of user count, though{" "}
        <Link
          href="/blog/firebase-spark-vs-blaze/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          Blaze keeps every free allowance above
        </Link>
        , so the move costs nothing until you exceed them. And on Spark,
        hitting a quota doesn&apos;t bill you — it fails your requests until
        the quota resets, which for a live app is usually worse.
      </P>

      <ToolCallout href="/tools/firebase-free-tier-checker/" />
    </PostLayout>
  );
}
