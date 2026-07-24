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
const PATH = "/compare/databeam/";

export const metadata: Metadata = {
  title: "Databeam vs Aerie: Mobile App or Web Dashboard?",
  description:
    "Databeam is a mobile app for switching between Firebase projects. Aerie is a browser dashboard for seeing them side by side, with cost. Compare honestly.",
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: `${SITE}${PATH}`,
    title: "Databeam vs Aerie: Mobile App or Web Dashboard?",
    description:
      "Databeam is a mobile app for switching between Firebase projects. Aerie is a browser dashboard for seeing them side by side, with cost. Compare honestly.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What's the real difference between Databeam and Aerie?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Databeam is a mobile app — iOS and Android — that lets you switch between Firebase projects and monitor each one: analytics, users, Cloud Functions. Aerie is a browser dashboard with no mobile app, that shows every project side by side on one page and adds cost monitoring, which Databeam doesn't mention.",
      },
    },
    {
      "@type": "Question",
      name: "Does Aerie have a mobile app?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Aerie is a web app you open in a browser, on desktop or mobile. If you specifically want Firebase monitoring on your phone as a native app, Databeam covers iOS and Android and Aerie doesn't compete there.",
      },
    },
    {
      "@type": "Question",
      name: "Does Databeam show cost or billing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not stated on their site. Databeam's listed features cover an analytics dashboard, user account browsing, user property management and Cloud Functions monitoring — no cost or billing monitoring is mentioned.",
      },
    },
    {
      "@type": "Question",
      name: "Is Databeam free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It's free to download; no other pricing is stated on their site.",
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
        eyebrow="Honest comparison · different platforms, different jobs"
        h1="Databeam vs Aerie"
        summary="These solve different problems. Databeam puts Firebase monitoring on your phone — you switch between projects and check each one on the go. Aerie is a browser dashboard with no mobile app, built to show every project at once instead of one at a time, with cost monitoring on top. If you want Firebase in your pocket, Databeam does that and Aerie doesn't."
      />

      <div className="mx-auto mt-14 max-w-4xl">
        <h2 className="text-xl font-semibold text-ink">At a glance</h2>
        <CompareTable
          competitorName="Databeam"
          rows={[
            {
              label: "Platform",
              competitor: "iOS and Android only — no web or desktop",
              aerie: "Web (desktop or mobile browser)",
            },
            {
              label: "Price",
              competitor: "Free to download; no other pricing stated",
              aerie: "Free for 3 projects, $9/mo Pro for unlimited",
            },
            {
              label: "What it's for",
              competitor:
                "Analytics dashboard, user account browsing, user property management, Cloud Functions monitoring (execution tracking, error logging)",
              aerie:
                "A live view across every project: users, traffic, Firestore data, services and cost",
            },
            {
              label: "Multi-project behavior",
              competitor:
                "Switches between projects — \"manage development, staging and production from one app\"",
              aerie: "Every project you own, side by side, on one page",
            },
            {
              label: "Cost monitoring",
              competitor: "Not mentioned on their site",
              aerie:
                "Estimated cost per project, with drivers and spike flags",
            },
            {
              label: "Open source",
              competitor: "Not stated — no indication it is open source",
              aerie: "Yes — AGPL-3.0",
            },
          ]}
        />
      </div>

      <ProseSection title="When Databeam is the right choice">
        <p>
          If the thing you actually want is Firebase on your phone, Databeam
          does that and Aerie simply doesn't have a mobile app. Its feature
          set is built for checking in from wherever you are.
        </p>
        <ReasonList
          items={[
            "You want native iOS or Android access — Aerie is web-only and has no app in either store.",
            "You mainly need to switch between a handful of projects (dev, staging, prod) and check each one in turn, which is exactly how Databeam is built to work.",
            "You want to browse user accounts and manage user properties from your phone.",
            "You want Cloud Functions execution tracking and error logging on the go.",
          ]}
        />
      </ProseSection>

      <ProseSection title="When Aerie is the right choice">
        <p>
          If you want to see every project at once instead of switching
          between them, and you want cost in the picture, that's the gap
          Aerie fills. Databeam's own description is about moving between
          projects one at a time — Aerie's whole point is not having to.
        </p>
        <ReasonList
          items={[
            "You own three or more projects and want them compared side by side, not switched between one at a time.",
            "You want cost and billing signal in the same view as usage — Databeam's listed features don't mention cost monitoring at all.",
            "You work at a desk and want a browser dashboard rather than a phone app.",
            "You want the source open and auditable — Aerie is AGPL-3.0; Databeam's site gives no indication either way.",
          ]}
        />
      </ProseSection>

      <ProseSection title="Can you use both?">
        <p>
          Sure — they don't conflict. Databeam for a quick phone check
          between projects, Aerie for the estate-wide view with cost when
          you're at a desk. Neither one replaces the other's platform.
        </p>
      </ProseSection>

      <FaqSection
        items={[
          {
            q: "What's the real difference between Databeam and Aerie?",
            a: "Databeam is a mobile app — iOS and Android — that lets you switch between Firebase projects and monitor each one: analytics, users, Cloud Functions. Aerie is a browser dashboard with no mobile app, that shows every project side by side on one page and adds cost monitoring, which Databeam doesn't mention.",
          },
          {
            q: "Does Aerie have a mobile app?",
            a: "No. Aerie is a web app you open in a browser, on desktop or mobile. If you specifically want Firebase monitoring on your phone as a native app, Databeam covers iOS and Android and Aerie doesn't compete there.",
          },
          {
            q: "Does Databeam show cost or billing?",
            a: "Not stated on their site. Databeam's listed features cover an analytics dashboard, user account browsing, user property management and Cloud Functions monitoring — no cost or billing monitoring is mentioned.",
          },
          {
            q: "Is Databeam free?",
            a: "It's free to download; no other pricing is stated on their site.",
          },
        ]}
      />

      <ClosingCta />
      <CrossLinks currentSlug="databeam" />
      <CompareFooter />
    </PageShell>
  );
}
