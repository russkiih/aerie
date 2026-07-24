import type { Metadata } from "next";
import {
  PageShell,
  CompareHeader,
  CompareFooter,
  CompareTable,
  Hero,
  ProseSection,
  ReasonList,
  FaqSection,
  ClosingCta,
  CrossLinks,
} from "@/components/compare/shared";

const SITE = "https://aerie-dashboard-app.web.app";
const PATH = "/compare/flame-shield/";

export const metadata: Metadata = {
  title: "Flame Shield vs Aerie: Security or Estate View?",
  description:
    "Flame Shield's kill switch stops runaway spend. Aerie shows what's driving it across your whole estate. Complements, not competitors — an honest look.",
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: `${SITE}${PATH}`,
    title: "Flame Shield vs Aerie: Security or Estate View?",
    description:
      "Flame Shield's kill switch stops runaway spend. Aerie shows what's driving it across your whole estate. Complements, not competitors — an honest look.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Flame Shield a competitor to Aerie?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Only partly, and only on cost. Flame Shield's billing kill switch actively disconnects billing once spend hits a threshold you set — Aerie doesn't do that; it only shows you what's happening. Flame Shield's other features — penetration testing of Firestore rules, Cloud Functions and Auth, and rate limiting — have no equivalent in Aerie at all.",
      },
    },
    {
      "@type": "Question",
      name: "Does Aerie stop a runaway Firebase bill?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Aerie estimates cost across your estate, names the drivers, and flags spikes against each project's own baseline — but it never takes action. If you want something that actively cuts off billing at a threshold, that's Flame Shield's kill switch, not Aerie.",
      },
    },
    {
      "@type": "Question",
      name: "Does Flame Shield show traffic or user analytics?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — Flame Shield doesn't provide traffic analytics, user metrics, or general Firebase analytics. Its focus is security: automated penetration testing, rate limiting, and the billing kill switch.",
      },
    },
    {
      "@type": "Question",
      name: "How much does Flame Shield cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There's a free Spark plan with 3 scans per project, and paid tiers with a 14-day trial. Specific paid prices aren't stated on the page we checked.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Flame Shield and Aerie together?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, and they complement each other well. Flame Shield's kill switch is the safety net that stops a bill before it gets out of hand; Aerie is the view that tells you which project is drifting and why, across your whole estate, alongside the traffic and user numbers that explain it.",
      },
    },
  ],
};

export default function Page() {
  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <CompareHeader />

      <Hero
        eyebrow="Honest comparison · the closest overlap here, and only on cost"
        h1="Flame Shield vs Aerie"
        summary="These solve different problems, and this is the closest overlap of any competitor page here — and only on cost. Flame Shield is a Firebase security platform: automated penetration testing, rate limiting, and a billing kill switch that actively disconnects billing at a threshold you set. Aerie doesn't take action; it shows you what's happening, across your whole estate. If your fear is a runaway bill at 3am, a kill switch is the correct control and you should get one."
      />

      <div className="mx-auto mt-14 max-w-4xl">
        <h2 className="text-xl font-semibold text-ink">At a glance</h2>
        <CompareTable
          competitorName="Flame Shield"
          rows={[
            {
              label: "Platform",
              competitor: "Not stated",
              aerie: "Web",
            },
            {
              label: "Price",
              competitor:
                "Free Spark plan (3 scans/project). Paid tiers with 14-day trial; specific prices not stated",
              aerie: "Free for 3 projects, $9/mo Pro for unlimited",
            },
            {
              label: "What it's for",
              competitor:
                "Automated penetration testing of Firestore rules, Cloud Functions and Auth; app-level rate limiting/DDoS protection; billing kill switch; free no-signup Firestore Rules Checker",
              aerie:
                "A live view across every project: users, traffic, Firestore data, services and cost",
            },
            {
              label: "Multi-project behavior",
              competitor: "Not stated",
              aerie: "Every project you own, side by side, on one page",
            },
            {
              label: "Cost monitoring",
              competitor:
                "Billing kill switch — disconnects billing at a user-set threshold. No traffic or usage analytics",
              aerie:
                "Estimated cost per project, with drivers and spike flags — shows, does not act",
            },
            {
              label: "Open source",
              competitor: "Not stated",
              aerie: "Yes — AGPL-3.0",
            },
          ]}
        />
      </div>

      <ProseSection title="When Flame Shield is the right choice">
        <p>
          If your worry is security or a runaway bill, Flame Shield has
          controls Aerie simply doesn't: it can act, not just report.
        </p>
        <ReasonList
          items={[
            "You want continuous automated penetration testing of your Firestore rules, Cloud Functions and Auth settings — Aerie has no security-scanning feature at all.",
            "You want app-level rate limiting or DDoS protection in front of your Firebase project.",
            "You want a kill switch that actually disconnects billing once spend crosses a threshold you set — Aerie only shows you the number, it never intervenes.",
            "You want a free, no-signup Firestore Rules Checker to sanity-check rules before you ship them.",
          ]}
        />
      </ProseSection>

      <ProseSection title="When Aerie is the right choice">
        <p>
          If you want to understand your traffic, users and cost across
          every project you own — not just be protected from the worst-case
          bill on one — that's the gap Flame Shield's own feature list
          doesn't cover.
        </p>
        <ReasonList
          items={[
            "You want to see traffic and user analytics — Flame Shield doesn't provide traffic analytics, user metrics, or general Firebase analytics.",
            "You want cost visibility across your whole estate, not a single kill-switch threshold on one project.",
            "You want to understand why cost is moving — drivers and spikes against each project's own baseline — not just be cut off after the fact.",
            "You want an open-source, read-only tool with no ability to change anything in your projects.",
          ]}
        />
      </ProseSection>

      <ProseSection title="Can you use both?">
        <p>
          Yes — of everything on this site, this is the pairing that makes
          the most sense. These are complements more than substitutes:
          Flame Shield's kill switch is the safety net that actively stops
          spend; Aerie is the dashboard that tells you which project is
          drifting and why, alongside the traffic and user numbers that
          explain it. Use Flame Shield to set the guardrail. Use Aerie to
          see it coming.
        </p>
      </ProseSection>

      <FaqSection
        items={[
          {
            q: "Is Flame Shield a competitor to Aerie?",
            a: "Only partly, and only on cost. Flame Shield's billing kill switch actively disconnects billing once spend hits a threshold you set — Aerie doesn't do that; it only shows you what's happening. Flame Shield's other features — penetration testing of Firestore rules, Cloud Functions and Auth, and rate limiting — have no equivalent in Aerie at all.",
          },
          {
            q: "Does Aerie stop a runaway Firebase bill?",
            a: "No. Aerie estimates cost across your estate, names the drivers, and flags spikes against each project's own baseline — but it never takes action. If you want something that actively cuts off billing at a threshold, that's Flame Shield's kill switch, not Aerie.",
          },
          {
            q: "Does Flame Shield show traffic or user analytics?",
            a: "No — Flame Shield doesn't provide traffic analytics, user metrics, or general Firebase analytics. Its focus is security: automated penetration testing, rate limiting, and the billing kill switch.",
          },
          {
            q: "How much does Flame Shield cost?",
            a: "There's a free Spark plan with 3 scans per project, and paid tiers with a 14-day trial. Specific paid prices aren't stated on the page we checked.",
          },
          {
            q: "Can I use Flame Shield and Aerie together?",
            a: "Yes, and they complement each other well. Flame Shield's kill switch is the safety net that stops a bill before it gets out of hand; Aerie is the view that tells you which project is drifting and why, across your whole estate, alongside the traffic and user numbers that explain it.",
          },
        ]}
      />

      <ClosingCta />
      <CrossLinks currentSlug="flame-shield" />
      <CompareFooter />
    </PageShell>
  );
}
