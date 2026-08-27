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
import { FIRESTORE, VERIFIED_ON, usd } from "@/lib/firebase-pricing";

const SITE = "https://aerie-dashboard-app.web.app";
const POST = POSTS.find((p) => p.href === "/blog/reduce-firestore-reads/")!;

export const metadata: Metadata = {
  title: "How to Reduce Firestore Reads | Aerie",
  description:
    "Six patterns that cut real Firestore bills — result limits, listeners instead of polling, offline persistence, aggregation queries, counter documents — priced at Google's published rates.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "How to reduce Firestore reads",
    description:
      "Six patterns that cut real Firestore bills, each priced at Google's published rates.",
  },
};

// Worked examples at the single-region rate; nam5 doubles every figure.
const RATE = FIRESTORE["us-central1"];
const costOf = (reads: number) => usd((reads / 100_000) * RATE.readsPer100k);

// Pattern 1 — limit the result set.
const unboundedDocs = 2_000;
const limitedDocs = 25;
const feedLoadsPerMonth = 30_000;
const unboundedReads = unboundedDocs * feedLoadsPerMonth;
const limitedReads = limitedDocs * feedLoadsPerMonth;

// Pattern 2 — polling pays the minimum charge around the clock.
const pollSeconds = 15;
const pollQueriesPerMonth = Math.round((86_400 / pollSeconds) * 30);

// Pattern 5 — counter document vs counting a collection by reading it.
const collectionSize = 10_000;
const statLoadsPerMonth = 20_000;
const naiveCountReads = collectionSize * statLoadsPerMonth;
const aggregateReadsPerCount = Math.ceil(collectionSize / 1_000);
const aggregateCountReads = aggregateReadsPerCount * statLoadsPerMonth;
const counterDocReads = statLoadsPerMonth;

const SOURCE = {
  href: "https://firebase.google.com/docs/firestore/pricing",
  label: "Firestore billing docs",
};

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        Firestore bills are rarely large because everything is slightly
        expensive. They are large because a small number of call sites read
        far more documents than the feature they power actually needs. That
        is good news: cutting a read bill is not a rewrite, it is finding
        the two or three hot paths and applying the right pattern to each.
        These are the six that pay for themselves, with the arithmetic at
        Google&apos;s published single-region rate ({usd(RATE.readsPer100k)}{" "}
        per 100,000 reads, verified {VERIFIED_ON}). If your database is
        multi-region,{" "}
        <Link
          href="/blog/firestore-multi-region-costs-double/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          double every figure below
        </Link>
        .
      </P>

      <H2>1. Put a limit on every query that renders a screen</H2>
      <P>
        A query bills one read per document returned, whether or not the
        screen shows it. A feed backed by an unbounded query over a{" "}
        {unboundedDocs.toLocaleString()}-document collection bills{" "}
        {unboundedDocs.toLocaleString()} reads per load; the same feed with{" "}
        <code>.limit({limitedDocs})</code> and pagination bills{" "}
        {limitedDocs}. At {feedLoadsPerMonth.toLocaleString()} loads a
        month, that is {costOf(unboundedReads)} against{" "}
        {costOf(limitedReads)} — an {Math.round(unboundedDocs / limitedDocs)}
        x difference for a one-line change. This is the single most common
        fix, because an unbounded query is invisible while the collection is
        small and expensive precisely when the app succeeds.
      </P>

      <H2>2. Stop polling; that is what listeners are for</H2>
      <P>
        A query that finds nothing still bills a minimum of one read. A
        client polling every {pollSeconds} seconds &ldquo;just to
        check&rdquo; runs about {pollQueriesPerMonth.toLocaleString()}{" "}
        queries a month <em>per user</em>, paying the minimum charge nearly
        every time. A snapshot listener inverts the cost: after its initial
        snapshot, it bills only when a document in its result set actually
        changes. For data that changes occasionally, a listener costs a
        fraction of a poll loop; the poll loop&apos;s cost is set by your
        timer, not your data.
      </P>
      <Note source={SOURCE}>
        Verified against the billing docs: every query bills at least one
        read even with zero results, and an open listener bills reads only
        for documents added or updated in its result set — not per unit of
        time.
      </Note>

      <H2>3. Turn on offline persistence for mobile clients</H2>
      <P>
        Without offline persistence, a listener that reconnects after a
        network drop — or anything past 30 minutes offline — re-runs its
        query and re-bills the entire result set as if it were new. Mobile
        clients reconnect constantly, so this quietly multiplies every
        listener&apos;s cost by the reconnect count. With persistence
        enabled, a reconnect resumes from cache and bills only what
        changed. If your bill has a large listener component and a mobile
        audience, this switch is often the difference —{" "}
        <Link
          href="/blog/why-is-my-firebase-bill-so-high/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          rule five of the five billing rules
        </Link>{" "}
        walks the arithmetic.
      </P>

      <H2>4. Count with aggregation queries, not by reading the collection</H2>
      <P>
        Fetching {collectionSize.toLocaleString()} documents to display
        &ldquo;{collectionSize.toLocaleString()} items&rdquo; bills{" "}
        {collectionSize.toLocaleString()} reads. An aggregation query like{" "}
        <code>count()</code> bills one read per batch of up to 1,000 index
        entries matched — {aggregateReadsPerCount} reads for the same
        answer.
      </P>
      <Note source={SOURCE}>
        Aggregation queries (<code>count()</code>, <code>sum()</code>,{" "}
        <code>average()</code>) are billed at one document read per batch
        of up to 1,000 index entries scanned, not per document counted.
      </Note>
      <P>
        On a stats panel loaded {statLoadsPerMonth.toLocaleString()} times a
        month, counting by fetching bills{" "}
        {naiveCountReads.toLocaleString()} reads ({costOf(naiveCountReads)});
        the aggregation bills {aggregateCountReads.toLocaleString()} (
        {costOf(aggregateCountReads)}).
      </P>

      <H2>5. Keep a counter document for numbers you show constantly</H2>
      <P>
        Even {aggregateReadsPerCount} reads per view is unnecessary for a
        number every visitor sees. Maintain a single summary document —
        incremented on write, by the client or a function — and the stats
        panel above becomes {counterDocReads.toLocaleString()} reads a month
        ({costOf(counterDocReads)}): one per load, regardless of how large
        the counted collection grows. The trade is write-side complexity
        and eventual consistency, which is why this pattern is for the
        handful of numbers on your highest-traffic screens, not for
        everything.
      </P>

      <H2>6. Find the hot path before optimizing anything</H2>
      <P>
        Every pattern above is cheap to apply and pointless to apply in the
        wrong place. Reads concentrate: one screen, one loop, one listener
        usually accounts for most of the bill. Before touching code, look
        at the read curve — a day-over-day usage graph makes the hot path
        obvious, and a week-over-week jump tells you exactly when it
        shipped. That visibility is what Aerie&apos;s Billing Watchdog
        provides across every project you own; the console can show you the
        same curve one project at a time.
      </P>
      <P>
        Then measure the fix the same way you found the problem. A pattern
        that should have cut reads and didn&apos;t means the hot path is
        not where you thought — which is itself the most useful thing a
        usage graph can tell you.
      </P>

      <UL>
        <LI>
          Limits and pagination first — highest impact per line of code
          changed.
        </LI>
        <LI>
          Replace timers with listeners, and give mobile listeners offline
          persistence.
        </LI>
        <LI>
          Aggregations for counts; counter documents for the numbers on
          screens you cannot make cheaper any other way.
        </LI>
      </UL>

      <ToolCallout href="/tools/firestore-cost-estimator/" />
    </PostLayout>
  );
}
