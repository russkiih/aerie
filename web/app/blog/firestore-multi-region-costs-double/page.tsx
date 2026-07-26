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
const POST = POSTS[1];

export const metadata: Metadata = {
  title: "Firestore multi-region costs exactly double | Aerie",
  description:
    "nam5 bills 2x us-central1 on every read, write and delete. The choice is made once at project creation and can't be changed without a new database.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "Firestore multi-region costs exactly double. Most people never chose it.",
    description:
      "nam5 bills 2x us-central1 on every read, write and delete — a choice made once, in a dropdown, at project creation.",
  },
};

const NAM5 = FIRESTORE.nam5;
const SINGLE = FIRESTORE["us-central1"];

// Derived, not typed — if either rate ever changes in firebase-pricing.ts,
// this number moves with it instead of quietly going stale.
const readMultiplier = NAM5.readsPer100k / SINGLE.readsPer100k;
const writeMultiplier = NAM5.writesPer100k / SINGLE.writesPer100k;
const deleteMultiplier = NAM5.deletesPer100k / SINGLE.deletesPer100k;
const storageMultiplier = NAM5.storagePerGiBMonth / SINGLE.storagePerGiBMonth;

// A realistic mid-size workload: 10M reads, 2M writes, 500K deletes a month.
const monthlyReads = 10_000_000;
const monthlyWrites = 2_000_000;
const monthlyDeletes = 500_000;

function monthlyCost(rates: {
  readsPer100k: number;
  writesPer100k: number;
  deletesPer100k: number;
}) {
  return (
    (monthlyReads / 100_000) * rates.readsPer100k +
    (monthlyWrites / 100_000) * rates.writesPer100k +
    (monthlyDeletes / 100_000) * rates.deletesPer100k
  );
}

const nam5Monthly = monthlyCost(NAM5);
const singleMonthly = monthlyCost(SINGLE);
const monthlyDifference = nam5Monthly - singleMonthly;
const annualDifference = monthlyDifference * 12;

const SOURCE = {
  href: "https://firebase.google.com/docs/firestore/pricing",
  label: "Firestore billing docs",
};

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        Say this plainly first: multi-region Firestore is not a rip-off.
        A database in <code>nam5</code> replicates your data across
        multiple regions, and that buys real availability guarantees you
        don&apos;t get from a single region. For some workloads that is
        exactly the right thing to pay for.
      </P>
      <P>
        The problem isn&apos;t the price. It&apos;s that the choice gets
        made once, in a dropdown, when you create the database — and most
        people creating a Firebase project are not thinking about regional
        replication at that moment. They&apos;re thinking about the app
        they&apos;re about to build. The dropdown defaults to a multi-region
        option, it gets clicked through, and the cost consequence shows up
        months later on an invoice with no obvious cause.
      </P>

      <H2>The rates, and the multiplier</H2>
      <P>
        These are Google&apos;s published Firestore rates, verified on{" "}
        {VERIFIED_ON}.
      </P>
      <Note source={SOURCE}>
        {NAM5.label}: {usd(NAM5.readsPer100k)} per 100,000 reads,{" "}
        {usd(NAM5.writesPer100k)} per 100,000 writes,{" "}
        {usd(NAM5.deletesPer100k)} per 100,000 deletes.
        <br />
        {SINGLE.label}: {usd(SINGLE.readsPer100k)} per 100,000 reads,{" "}
        {usd(SINGLE.writesPer100k)} per 100,000 writes,{" "}
        {usd(SINGLE.deletesPer100k)} per 100,000 deletes.
      </Note>
      <P>
        Divide one set by the other and every operation comes out the same:
        reads bill at {readMultiplier}x, writes at {writeMultiplier}x,
        deletes at {deleteMultiplier}x, and stored data at{" "}
        {storageMultiplier}x. Not roughly double. Exactly double, on every
        line of the bill that Firestore charges for.
      </P>

      <H2>What that costs at a real volume</H2>
      <P>
        Take a workload doing {monthlyReads.toLocaleString()} reads,{" "}
        {monthlyWrites.toLocaleString()} writes and{" "}
        {monthlyDeletes.toLocaleString()} deletes in a month — a mid-size
        app, not an outlier. On {SINGLE.label} that&apos;s{" "}
        {usd(singleMonthly)}. On {NAM5.label}, the same operations, same
        volume, are {usd(nam5Monthly)}.
      </P>
      <P>
        The gap is {usd(monthlyDifference)} a month for identical usage.
        Over a year that&apos;s {usd(annualDifference)} — paid not because
        the app grew or the workload changed, but because of which option
        was selected in a dropdown before the first document was ever
        written.
      </P>

      <H2>How to check which one you have</H2>
      <P>
        Open the Firebase console, go to Firestore, and the location is
        shown on the database&apos;s overview. That field is
        display-only — it cannot be edited from the console, and there is
        no setting anywhere in Firebase that converts an existing database
        from one to the other. The location is fixed at the moment the
        database is created.
      </P>
      <P>
        Changing it means creating a new database in the location you want
        and moving your data into it. That&apos;s a real migration, with
        real risk to get wrong, and it&apos;s out of scope for this post —
        there&apos;s no shortcut, and anyone telling you otherwise is
        skipping the hard part. What this post can do is help you find out
        what you&apos;re actually paying for, so that decision, if you make
        it, is deliberate rather than a reaction to a confusing bill.
      </P>

      <H2>What the decision should actually turn on</H2>
      <P>
        Not price alone. The question is whether your app needs the
        availability guarantees multi-region buys.
      </P>
      <UL>
        <LI>
          If losing an entire GCP region would take your app down, and you
          need it to keep serving reads and writes through that, multi-region
          is what you&apos;re paying for and it&apos;s doing its job.
        </LI>
        <LI>
          If your users and your other infrastructure are concentrated in
          one region already, single-region Firestore gets you lower
          latency to that region as well as half the operation cost.
        </LI>
        <LI>
          If you genuinely don&apos;t know which one you picked, that
          itself is the answer worth acting on: you accepted a default, not
          a requirement, and it&apos;s worth finding out what it&apos;s
          costing you before deciding whether to keep it.
        </LI>
      </UL>
      <P>
        Region choice compounds with the read and write patterns covered in{" "}
        <Link
          href="/blog/why-is-my-firebase-bill-so-high/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          why Firestore bills add up the way they do
        </Link>{" "}
        — a listener or an unbounded query costs twice as much again if it&apos;s
        running against a multi-region database. And if you&apos;re
        estimating a new project rather than auditing an existing one, the{" "}
        <Link
          href="/tools/firebase-pricing-calculator/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          Firebase Pricing Calculator
        </Link>{" "}
        covers the rest of the bill beyond Firestore.
      </P>

      <ToolCallout href="/tools/firestore-cost-estimator/" />
    </PostLayout>
  );
}
