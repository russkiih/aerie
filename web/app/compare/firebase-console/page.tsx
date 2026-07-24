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
const PATH = "/compare/firebase-console/";

export const metadata: Metadata = {
  title: "Firebase Console vs Aerie: Which Do You Need?",
  description:
    "The Firebase Console manages one project deeply. Aerie shows your whole estate's users, traffic and cost on one page. Here's when to use each.",
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: `${SITE}${PATH}`,
    title: "Firebase Console vs Aerie: Which Do You Need?",
    description:
      "The Firebase Console manages one project deeply. Aerie shows your whole estate's users, traffic and cost on one page. Here's when to use each.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Aerie replace the Firebase Console?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No, and it isn't trying to. The console is where you edit security rules, deploy, configure products and manage data inside a project — Aerie can't do any of that, because it never writes. Aerie only reads across every project you own and puts the numbers on one page.",
      },
    },
    {
      "@type": "Question",
      name: "Why can't the Firebase Console show all my projects at once?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Its information architecture is per-project by design — you select a project and everything shown is scoped to it. There's no aggregate view across projects, because that isn't what the console is built to do.",
      },
    },
    {
      "@type": "Question",
      name: "Does Aerie use different data than the console?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Aerie reads the same Google APIs the console does, live from your browser, and never writes to them. It's the same data, aggregated across projects instead of scoped to one.",
      },
    },
    {
      "@type": "Question",
      name: "Is the Firebase Console free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Billing is usage-based and reported per project after the fact, the same way it always has been — the console itself carries no separate charge.",
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
        eyebrow="Honest comparison · not a replacement"
        h1="Firebase Console vs Aerie"
        summary="These solve different problems. The Firebase Console is Google's official tool for working inside one project — rules, deploys, config, every product surface. Aerie is a read-only dashboard for the question the console can't answer: how is your whole estate doing, and what is it costing. Most people who use Aerie also live in the console every day."
      />

      <div className="mx-auto mt-14 max-w-4xl">
        <h2 className="text-xl font-semibold text-ink">At a glance</h2>
        <CompareTable
          competitorName="Firebase Console"
          rows={[
            {
              label: "Platform",
              competitor: "Web (Google's official console)",
              aerie: "Web",
            },
            {
              label: "Price",
              competitor: "Free",
              aerie: "Free for 3 projects, $9/mo Pro for unlimited",
            },
            {
              label: "What it's for",
              competitor:
                "Working inside one project — rules, deploys, config, data editing, every product surface",
              aerie:
                "A live view across every project: users, traffic, Firestore data, services and cost",
            },
            {
              label: "Multi-project behavior",
              competitor:
                "None built in — scoped per-project by design, select one project at a time",
              aerie: "Every project you own, side by side, on one page",
            },
            {
              label: "Cost monitoring",
              competitor: "Usage-based billing, reported per project after the fact",
              aerie:
                "Estimated cost per project while it's happening, with drivers and spike flags",
            },
            {
              label: "Open source",
              competitor: "Not stated",
              aerie: "Yes — AGPL-3.0",
            },
            {
              label: "Writes to your project",
              competitor: "Yes — it's the tool you use to change things",
              aerie: "Never. Reads only.",
            },
          ]}
        />
      </div>

      <ProseSection title="When the Firebase Console is the right choice">
        <p>
          If you need to do anything to a project, the console is the tool.
          It's far more capable than Aerie for everything inside one
          project — editing security rules, deploying functions, configuring
          Auth providers, browsing and writing Firestore documents, managing
          Hosting, every product surface Firebase has. Aerie can't touch any
          of that; it only reads.
        </p>
        <ReasonList
          items={[
            "You're actively building or debugging one project and need to change something, not just look at it.",
            "You want to edit security rules, deploy, or configure a product — Aerie has no write path at all.",
            "You only manage a single project. The console's per-project view is exactly the right shape for that, and Aerie's free tier isn't really built for one project either.",
            "You need the full depth of a single product surface — the console covers every corner; Aerie surfaces summaries.",
          ]}
        />
      </ProseSection>

      <ProseSection title="When Aerie is the right choice">
        <p>
          If your real question spans projects, the console makes you answer
          it by hand — opening each project in turn and holding the numbers
          in your head. Aerie asks the same Google APIs the same questions,
          all at once, and puts the answers on one page.
        </p>
        <ReasonList
          items={[
            "You own three or more Firebase projects and want to know how the whole estate is doing without opening each one.",
            "You want to compare projects — which is growing, which is quiet, which just spiked — side by side instead of tab by tab.",
            "You want to see cost building up across projects before the invoice arrives, not a per-project number reported after the fact.",
            "You want a read-only view you can hand to someone without worrying they'll change something.",
          ]}
        />
      </ProseSection>

      <ProseSection title="Can you use both?">
        <p>
          Yes, and that's the normal setup. Aerie tells you which project
          needs attention and why; the console is where you go to actually
          fix it. They aren't competing for the same moment — Aerie is for
          the morning scan across your estate, the console is for the work
          that follows.
        </p>
      </ProseSection>

      <FaqSection
        items={[
          {
            q: "Does Aerie replace the Firebase Console?",
            a: "No, and it isn't trying to. The console is where you edit security rules, deploy, configure products and manage data inside a project — Aerie can't do any of that, because it never writes. Aerie only reads across every project you own and puts the numbers on one page.",
          },
          {
            q: "Why can't the Firebase Console show all my projects at once?",
            a: "Its information architecture is per-project by design — you select a project and everything shown is scoped to it. There's no aggregate view across projects, because that isn't what the console is built to do.",
          },
          {
            q: "Does Aerie use different data than the console?",
            a: "No. Aerie reads the same Google APIs the console does, live from your browser, and never writes to them. It's the same data, aggregated across projects instead of scoped to one.",
          },
          {
            q: "Is the Firebase Console free?",
            a: "Yes. Billing is usage-based and reported per project after the fact, the same way it always has been — the console itself carries no separate charge.",
          },
        ]}
      />

      <ClosingCta />
      <CrossLinks currentSlug="firebase-console" />
      <CompareFooter />
    </PageShell>
  );
}
