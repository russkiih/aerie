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

const SITE = "https://aerie-dashboard-app.web.app";
const POST = POSTS.find((p) => p.href === "/blog/firebase-spending-limit/")!;

export const metadata: Metadata = {
  title: "Firebase Has No Spending Limit — Here's the Closest You Can Get",
  description:
    "Blaze has no hard spend cap. Budget alerts notify, they don't stop anything, and they lag real usage. What actually protects you, walked through honestly.",
  alternates: { canonical: POST.href },
  openGraph: {
    type: "article",
    url: `${SITE}${POST.href}`,
    title: "Firebase has no spending limit. Here's the closest you can get.",
    description:
      "Blaze has no hard spend cap. Budget alerts notify, they don't stop anything, and they lag real usage. What actually protects you.",
  },
};

export default function Page() {
  return (
    <PostLayout post={POST}>
      <P>
        The direct answer first: there is no setting anywhere in Firebase or
        Google Cloud that stops your project when spending reaches a number
        you chose. On the Blaze plan, usage is billed as it happens, without
        a ceiling. The thing that looks like a spending limit — a budget —
        is a notification system. It emails you. It does not stop anything.
      </P>
      <Note
        source={{
          href: "https://cloud.google.com/billing/docs/how-to/budgets",
          label: "Cloud Billing: create and manage budgets",
        }}
      >
        Google&apos;s own documentation says it plainly: setting a budget
        does not cap usage or spending. A budget exists to trigger alerts,
        by default as you cross 50%, 90% and 100% of the amount you set.
      </Note>
      <P>
        If you came here because you want the equivalent of &ldquo;never
        charge me more than $50 a month,&rdquo; that product does not exist
        on Firebase. What exists is a set of partial protections, each with
        a sharp edge. This post walks through all of them, from weakest to
        strongest, so you can decide how much protection your project
        actually needs.
      </P>

      <H2>Option 1: stay on Spark, where the limit is the plan itself</H2>
      <P>
        The Spark plan is the only true spending cap Firebase offers,
        because there is no billing account to charge. When you hit a free
        quota, requests fail instead of billing. That is a real guarantee —
        and a real outage, because &ldquo;requests fail&rdquo; means your
        app stops working for the rest of the day or month. Spark also
        rules out Cloud Functions entirely, which is{" "}
        <Link
          href="/blog/firebase-spark-vs-blaze/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          what forces most projects onto Blaze
        </Link>{" "}
        in the first place. If Spark covers your needs, the spending-limit
        question answers itself. This post is for everyone who had to leave.
      </P>

      <H2>Option 2: budget alerts — necessary, slow, and toothless</H2>
      <P>
        On Blaze, the first thing to do is create a budget in the Google
        Cloud console with an amount that would make you wince. This takes
        five minutes and there is no reason not to do it. But be clear
        about what you bought: an email, sent to billing admins, after a
        threshold is crossed.
      </P>
      <P>
        The sharper problem is <em>when</em> it is sent. Billing data is
        not realtime — Google documents a reporting delay between usage
        happening and that usage appearing in billing, and budget alerts
        fire on the billing data, not on the traffic. A runaway loop that
        burns through your budget in an hour can be well past it before
        the 50% email arrives. Budget alerts catch slow drifts. They are
        structurally late to spikes, which are exactly the bills people
        fear.
      </P>

      <H2>Option 3: the documented kill switch — automatic, and brutal</H2>
      <P>
        Budgets can do one thing beyond email: publish their state to a
        Pub/Sub topic. Google&apos;s documentation includes a worked
        example that takes this all the way — a Cloud Function subscribed
        to that topic which, when the budget is exceeded,{" "}
        <strong>disables billing on the project entirely</strong>.
      </P>
      <Note
        source={{
          href: "https://cloud.google.com/billing/docs/how-to/notify",
          label: "Cloud Billing: programmatic budget notifications",
        }}
      >
        This is Google&apos;s own example of an automated cost-control
        response, and it ships with Google&apos;s own warning: removing
        billing from a project shuts down its services abruptly, and can
        result in data loss. It is a fire axe, not a thermostat.
      </Note>
      <P>
        The kill switch is the only self-hosted mechanism that actually
        stops spending without a human awake and watching. But it inherits
        the billing-data delay from option 2 — it fires when the budget
        data says so, not when the traffic happened — and when it fires,
        your app goes down hard: Firestore, Hosting, Functions, all of it,
        for every user, until you manually re-attach billing. For a hobby
        project, that trade is often right. For anything with real users,
        turning a cost incident into a total outage is a decision to make
        deliberately, not a default. Products like Flame Shield build a
        managed version of this pattern —{" "}
        <Link
          href="/compare/flame-shield/"
          className="text-ink underline decoration-line3 underline-offset-4 hover:text-accent"
        >
          our honest comparison covers where it fits
        </Link>
        .
      </P>

      <H2>Option 4: catch the spike while it is still cheap</H2>
      <P>
        Every mechanism above reacts to billing data. The earlier signal
        is usage itself — reads, writes, invocations and bandwidth are
        visible in monitoring APIs close to realtime, long before they
        become line items. A week-over-week jump in Firestore reads on a
        project that normally idles is the whole story of most surprise
        bills, visible days before the invoice.
      </P>
      <P>
        That is the layer Aerie&apos;s Billing Watchdog works at: it reads
        the billable usage meters for every one of your projects and flags
        the ones that jumped, so the project you forgot about is the one
        you hear about. It is an early-warning system, not a cap — the
        honest framing is that nothing in this post is a cap except the
        fire axe.
      </P>

      <H2>What to actually set up</H2>
      <UL>
        <LI>
          A budget with alerts on every Blaze project, today. It is free
          and takes minutes. Treat the emails as a smoke alarm, not a
          sprinkler.
        </LI>
        <LI>
          The Pub/Sub kill switch on projects where sudden downtime is
          acceptable and an unbounded bill is not — side projects, demos,
          anything with a card attached and no revenue.
        </LI>
        <LI>
          Usage-level monitoring on projects where downtime is not
          acceptable, so a spike is a Tuesday-morning fix instead of an
          end-of-month letter.
        </LI>
        <LI>
          And before any of it: know what your normal month should cost,
          so an abnormal one is recognizable. The calculator below does
          that arithmetic with the free tier subtracted.
        </LI>
      </UL>

      <ToolCallout href="/tools/firebase-pricing-calculator/" />
    </PostLayout>
  );
}
