import type { Metadata } from "next";
import Link from "next/link";
import { PostLayout, P, H2, UL, LI, Note, ToolCallout } from "@/components/blog/shared";
import { POSTS } from "@/lib/site-nav";
import { FREE_TIER, VERIFIED_ON } from "@/lib/firebase-pricing";

const SITE = "https://aerie-dashboard-app.web.app";
const POST = POSTS.find((p) => p.href === "/blog/firebase-spark-vs-blaze/")!;

export const metadata: Metadata = {
  title: "Spark vs Blaze: What Actually Forces the Upgrade",
  description:
    "Cloud Functions aren't on the Spark plan at all — that's what forces most upgrades, not a quota. Every Spark limit, walked through honestly.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "Spark vs Blaze: What Actually Forces the Upgrade",
    description:
      "Cloud Functions aren't on the Spark plan at all — that's what forces most upgrades, not a quota. Every Spark limit, walked through honestly.",
  },
};

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        Here is the direct answer, before anything else: Cloud Functions do
        not run on the Spark (free) plan. Not a small allowance, not a
        trial — the product is simply unavailable until you add a billing
        account and move to Blaze. If you came here to find out what forces
        the upgrade, that is almost always it. Not a quota you were
        watching. A single function you tried to deploy.
      </P>
      <Note
        source={{ href: "https://firebase.google.com/pricing", label: "Firebase pricing" }}
      >
        Verified {VERIFIED_ON}. Cloud Functions{" "}
        <code>availableOnSpark: false</code> — there is no free invocation
        count on Spark, because the product isn&apos;t offered on that plan
        at all.
      </Note>
      <P>
        Everything else on Spark is a real quota with a real number attached,
        and most of those numbers are generous. This post walks each service
        so you know which ones you can ignore and which one you&apos;ll hit
        first.
      </P>

      <H2>
        Firestore: {FREE_TIER.firestore.readsPerDay.toLocaleString()} reads a day
        sounds like a lot, until you do the math
      </H2>
      <P>
        Spark gives you {FREE_TIER.firestore.readsPerDay.toLocaleString()}{" "}
        reads, {FREE_TIER.firestore.writesPerDay.toLocaleString()} writes and{" "}
        {FREE_TIER.firestore.deletesPerDay.toLocaleString()} deletes a day,
        plus {FREE_TIER.firestore.storedGiB} GiB stored and{" "}
        {FREE_TIER.firestore.egressGiBPerMonth} GiB of egress a month. Spread
        the read quota evenly across a day and it&apos;s about 35 reads per
        minute, sustained, every minute of every day. That&apos;s comfortable
        for a low-traffic app or a project still in development. It stops
        being comfortable the moment a screen re-reads a collection on every
        render, or a background listener stays open across many simultaneous
        users — Firestore bills per document read, and it doesn&apos;t
        distinguish an efficient query from a wasteful one.
      </P>

      <H2>Realtime Database: smaller, and easy to miss if you use both databases</H2>
      <P>
        Spark&apos;s Realtime Database allowance is separate from
        Firestore&apos;s: {FREE_TIER.realtimeDb.storedGB} GB stored,{" "}
        {FREE_TIER.realtimeDb.downloadedGBPerMonth} GB downloaded a month,
        and {FREE_TIER.realtimeDb.simultaneousConnections} simultaneous
        connections. If your project only uses Firestore, this quota is
        irrelevant. If you use both — a common pattern for presence or
        realtime features layered onto a Firestore-backed app — the download
        allowance is the one to watch, since 10 GB a month disappears fast
        once you&apos;re syncing anything with images or documents attached.
      </P>

      <H2>Cloud Storage: the quietest of the quotas</H2>
      <P>
        {FREE_TIER.storage.storedGB} GB stored,{" "}
        {FREE_TIER.storage.downloadedGBPerMonth} GB downloaded a month,{" "}
        {FREE_TIER.storage.uploadOpsPerMonth.toLocaleString()} upload
        operations and {FREE_TIER.storage.downloadOpsPerMonth.toLocaleString()}{" "}
        download operations a month. For most small projects this is the
        limit you never think about, because file storage volume tends to
        grow slower than database reads.
      </P>

      <H2>Hosting: the one people actually hit, usually with images</H2>
      <P>
        Hosting gives you {FREE_TIER.hosting.storedGB} GB stored but only{" "}
        {FREE_TIER.hosting.transferMBPerDay} MB of transfer a day. That
        second number is small — a handful of unoptimized hero images served
        to a moderate amount of daily traffic can burn through {FREE_TIER.hosting.transferMBPerDay} MB before
        the day is half over. If a Spark project is going to bump into a
        wall, it is more often this one than Firestore&apos;s read quota.
      </P>

      <H2>Auth: genuinely generous</H2>
      <P>
        {FREE_TIER.auth.monthlyActiveUsers.toLocaleString()} monthly active
        users, free, on Spark. Most projects will outgrow every other quota
        on this page before they outgrow this one.
      </P>

      <H2>What actually happens when you move to Blaze</H2>
      <P>
        This is the part that keeps people on Spark longer than they need
        to: Blaze is pay-as-you-go, and it{" "}
        <strong>keeps the same free allowances</strong>. Moving to Blaze does
        not mean your first Firestore read costs money — you still get the{" "}
        {FREE_TIER.firestore.readsPerDay.toLocaleString()} reads a day, the same 1 GiB storage, the same everything
        listed above, for free. Blaze only bills for usage past those free
        quotas. The plan you&apos;re on doesn&apos;t change your free tier;
        it changes whether Cloud Functions exist and whether going over the
        free tier fails a request or gets billed for.
      </P>
      <P>
        The real cost of Blaze isn&apos;t the pricing model — it&apos;s that
        it requires a billing account, and spending is not automatically
        capped. Google gives you budget alerts, not a hard stop, so a bug
        that loops or a bot that hammers an open endpoint can run up a bill
        before anyone notices. If that risk is what&apos;s keeping you on
        Spark, a kill switch is the honest answer, not avoiding Blaze
        forever — see{" "}
        <Link href="/compare/flame-shield/" className="text-accent underline underline-offset-4">
          Flame Shield&apos;s billing kill switch
        </Link>{" "}
        for what that looks like. And if you want to know how close a
        project actually is to its own Spark ceiling before deciding,{" "}
        <Link href="/blog/why-is-my-firebase-bill-so-high/" className="text-accent underline underline-offset-4">
          the billing rules that produce most surprise invoices
        </Link>{" "}
        are worth reading before you flip the switch.
      </P>

      <UL>
        <LI>Need a function — any function, however small? You need Blaze. There is no Spark path around this.</LI>
        <LI>Staying on Spark? Watch Hosting transfer and Firestore reads first — those are the two people hit in practice.</LI>
        <LI>Already on Blaze? You&apos;re still getting the free quotas above; you&apos;re only billed past them.</LI>
      </UL>

      <ToolCallout href="/tools/firebase-free-tier-checker/" />
    </PostLayout>
  );
}
