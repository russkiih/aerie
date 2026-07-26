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
const POST = POSTS[0];

export const metadata: Metadata = {
  title: "Why is my Firebase bill so high? | Aerie",
  description:
    "Five Firestore billing rules, verified against Google's docs, that explain almost every surprise invoice — including reads you never intended to make.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "Why is my Firebase bill so high?",
    description:
      "Five Firestore billing rules, verified against Google's docs, that explain almost every surprise invoice.",
  },
};

// All worked examples below use the single-region rate. Multi-region (nam5)
// bills exactly double every one of these numbers — see the companion post.
const RATE = FIRESTORE["us-central1"];

// Rule 1 — one read per document returned.
const tableRowsPerQuery = 1_000;
const tableLoadsPerMonth = 50_000;
const tableReads = tableRowsPerQuery * tableLoadsPerMonth;
const tableCost = usd((tableReads / 100_000) * RATE.readsPer100k);

// Rule 2 — a minimum of one read per query, even on zero results.
const pollIntervalSeconds = 10;
const pollsPerUserPerMonth = (86_400 / pollIntervalSeconds) * 30;
const usersPolling = 1_000;
const emptyPollReads = pollsPerUserPerMonth * usersPolling;
const emptyPollCost = usd((emptyPollReads / 100_000) * RATE.readsPer100k);

// Rule 3 — index entries scanned are charged separately from documents
// returned, one read per batch of up to 1,000 index entries.
const indexEntriesScanned = 12_000;
const docsReturnedPerQuery = 40;
const indexReadBatches = Math.ceil(indexEntriesScanned / 1_000);
const queriesPerMonth = 100_000;
const naiveMonthlyReads = docsReturnedPerQuery * queriesPerMonth;
const actualMonthlyReads =
  (docsReturnedPerQuery + indexReadBatches) * queriesPerMonth;
const naiveCost = usd((naiveMonthlyReads / 100_000) * RATE.readsPer100k);
const actualCost = usd((actualMonthlyReads / 100_000) * RATE.readsPer100k);

// Rule 4 — a snapshot listener is charged a read for every add/update to a
// document already in its result set, for as long as it stays open.
const writesPerDayToCollection = 20_000;
const openListeners = 30;
const daysInMonth = 30;
const listenerUpdateReads =
  writesPerDayToCollection * openListeners * daysInMonth;
const listenerUpdateCost = usd(
  (listenerUpdateReads / 100_000) * RATE.readsPer100k,
);

// Rule 5 — without offline persistence, a listener reconnect re-runs the
// whole query and is billed as if it were new.
const listenerResultSize = 500;
const reconnectsPerDayPerUser = 15;
const mobileUsers = 5_000;
const reconnectReads =
  listenerResultSize * reconnectsPerDayPerUser * mobileUsers * daysInMonth;
const reconnectCost = usd((reconnectReads / 100_000) * RATE.readsPer100k);

const SOURCE = {
  href: "https://firebase.google.com/docs/firestore/pricing",
  label: "Firestore billing docs",
};

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        The bill arrives and it is higher than last month. You did not add a
        feature. You did not get more users, or not enough more to explain
        it. Nothing in the console looks obviously wrong. This is the normal
        experience of a Firestore bill, because Firestore charges for
        operations, not for outcomes, and the mapping between what your code
        does and what gets billed is not what most people assume it is.
      </P>
      <P>
        There is no single cause worth chasing. There are five billing rules,
        all documented, all verifiable against the page linked below, and
        between them they explain almost every invoice that looks wrong but
        isn&apos;t. Rates below are as verified on {VERIFIED_ON}.
      </P>

      <H2>Rule 1: one read per document returned</H2>
      <P>
        A query does not cost one read. It costs one read per document it
        returns. A query that returns 1,000 documents costs 1,000 reads,
        whether you asked for one field or the whole document, and whether
        you needed all 1,000 rows or only rendered the first ten.
      </P>
      <Note source={SOURCE}>
        Every document included in a query result is billed as a read.
        Returning {tableRowsPerQuery.toLocaleString()} documents from a
        single query bills {tableRowsPerQuery.toLocaleString()} reads, not
        one.
      </Note>
      <P>
        Say a dashboard page runs an unbounded query over a{" "}
        {tableRowsPerQuery.toLocaleString()}-document collection, and that
        page loads {tableLoadsPerMonth.toLocaleString()} times a month. That
        alone is {tableReads.toLocaleString()} reads, which bills{" "}
        {tableCost} at the single-region rate of {usd(RATE.readsPer100k)}{" "}
        per 100,000 reads. Nothing else on the page has to be expensive for
        that number to show up on the invoice.
      </P>

      <H2>Rule 2: a query still costs a read when it finds nothing</H2>
      <P>
        This is the one that catches polling loops. A query that matches
        zero documents is not free.
      </P>
      <Note source={SOURCE}>
        &ldquo;There is a minimum charge of one document read for each query
        that you perform, even if the query returns no results.&rdquo;
      </Note>
      <P>
        A client polling every {pollIntervalSeconds} seconds for new records
        that usually aren&apos;t there runs{" "}
        {Math.round(pollsPerUserPerMonth).toLocaleString()} queries a month
        per user, whether or not it ever finds anything. Across{" "}
        {usersPolling.toLocaleString()} users that is{" "}
        {emptyPollReads.toLocaleString()} billed reads, or {emptyPollCost}{" "}
        a month, for a feature that from the outside looks like it does
        nothing at all.
      </P>

      <H2>Rule 3: index entries are billed separately from documents</H2>
      <P>
        A query has to scan index entries to find the documents it returns,
        and that scan is billed on top of the document reads, not folded
        into them. Google bills one read per batch of up to 1,000 index
        entries scanned.
      </P>
      <Note source={SOURCE}>
        Index entries scanned to execute a query are charged as reads,
        separately from the documents the query returns, at one read per
        batch of up to 1,000 index entries.
      </Note>
      <P>
        A query that scans {indexEntriesScanned.toLocaleString()} index
        entries to find {docsReturnedPerQuery} matching documents adds{" "}
        {indexReadBatches} index-read batches on top of the{" "}
        {docsReturnedPerQuery} document reads — {indexReadBatches +
          docsReturnedPerQuery}{" "}
        reads total for a {docsReturnedPerQuery}-row result. Run that query{" "}
        {queriesPerMonth.toLocaleString()} times a month and the naive
        estimate of {naiveCost} (counting only documents returned) undercounts
        the real bill of {actualCost}. The gap is the index scan, and it
        doesn&apos;t show up if you only count rows in your head.
      </P>

      <H2>Rule 4: a snapshot listener bills a read on every update, for as long as it&apos;s open</H2>
      <P>
        A listener doesn&apos;t bill once for its initial snapshot and then
        go quiet. Every time a document already in its result set is added
        or updated, that&apos;s a fresh read, charged to every listener
        watching it.
      </P>
      <Note source={SOURCE}>
        A listener is billed for a document read every time a document in
        its result set is added or updated while the listener is active —
        continuously, not once at open time.
      </Note>
      <P>
        A collection that receives{" "}
        {writesPerDayToCollection.toLocaleString()} writes a day, watched by
        a live dashboard that {openListeners} people keep open all month,
        bills {listenerUpdateReads.toLocaleString()} reads from updates
        alone — {listenerUpdateCost} — on top of whatever the initial
        snapshot cost each of them. The listener isn&apos;t doing anything
        unusual. It&apos;s doing exactly what it was built for, on a
        collection that&apos;s busier than it looks from the code.
      </P>

      <H2>Rule 5: a reconnecting listener can re-bill as a whole new query</H2>
      <P>
        This is the least visible of the five. If offline persistence is
        disabled, or the client has been offline for more than 30 minutes,
        a listener that reconnects doesn&apos;t resume where it left off —
        it re-runs its query and is billed for the full result set again,
        exactly as if it had just opened for the first time. Mobile clients
        reconnect constantly: backgrounding the app, switching from wifi to
        cellular, a dropped signal in an elevator.
      </P>
      <Note source={SOURCE}>
        Without offline persistence enabled, or after more than 30 minutes
        offline, a listener reconnect is billed as a new query over its
        entire result set, not as a resume.
      </Note>
      <P>
        A listener whose result set is {listenerResultSize.toLocaleString()}{" "}
        documents, reconnecting {reconnectsPerDayPerUser} times a day per
        user across {mobileUsers.toLocaleString()} mobile users, bills{" "}
        {reconnectReads.toLocaleString()} reads a month from reconnects
        alone — {reconnectCost}. None of those reads came from a document
        actually changing. They came from the network dropping and picking
        the query back up.
      </P>

      <H2>What to actually do about it</H2>
      <P>
        None of this means Firestore is priced unfairly. It means the cost
        of a query depends on things the query&apos;s code doesn&apos;t
        show you. A few changes address most of it:
      </P>
      <UL>
        <LI>
          Put <code>.limit()</code> on queries that don&apos;t need every
          matching document. Rule 1 only bites as hard as the result set
          you actually ask for.
        </LI>
        <LI>
          Don&apos;t attach a snapshot listener to an unbounded or
          fast-moving collection. Query down to the range you actually need
          to watch, and let a one-time <code>get()</code> stand in
          wherever you don&apos;t need live updates.
        </LI>
        <LI>
          Enable offline persistence on clients that reconnect often. It
          turns rule 5 from a full re-query into an actual resume.
        </LI>
        <LI>
          Before assuming a bill is broadly wrong, check whether the reads
          are concentrated in one hot path — one dashboard, one polling
          loop, one listener. Firestore bills are usually explained by a
          small number of expensive call sites, not by everything being
          slightly overpriced.
        </LI>
      </UL>
      <P>
        If you want to see how these rules compound at your own numbers
        rather than the illustrative ones above, the{" "}
        <Link
          href="/tools/firebase-pricing-calculator/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          Firebase Pricing Calculator
        </Link>{" "}
        does the arithmetic for you, free-tier subtracted. And if the
        surprise came from a project you didn&apos;t set up, or one you
        inherited, it&apos;s worth checking{" "}
        <Link
          href="/blog/firestore-multi-region-costs-double/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          which Firestore location it&apos;s running in
        </Link>{" "}
        — every read and write above is billed at exactly double if the
        database is multi-region.
      </P>

      <ToolCallout href="/tools/firebase-pricing-calculator/" />
    </PostLayout>
  );
}
