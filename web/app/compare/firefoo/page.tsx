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
const PATH = "/compare/firefoo/";

export const metadata: Metadata = {
  title: "Firefoo vs Aerie: Which Firebase Tool Do You Need?",
  description:
    "Firefoo edits Firestore data. Aerie only reads, across every project. Both happen to cost $9/mo — an honest comparison of what each does.",
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: `${SITE}${PATH}`,
    title: "Firefoo vs Aerie: Which Firebase Tool Do You Need?",
    description:
      "Firefoo edits Firestore data. Aerie only reads, across every project. Both happen to cost $9/mo — an honest comparison of what each does.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Can Aerie edit Firestore data like Firefoo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Aerie never writes — it only reads. Firefoo is a desktop GUI built to browse, edit, query and import/export Firestore data: table, tree and JSON views, a JavaScript query shell, CSV/JSON export, auth user management. If you need to work on your data, Firefoo is built for exactly that and Aerie can't do it.",
      },
    },
    {
      "@type": "Question",
      name: "Firefoo and Aerie are both $9 a month — what's the actual difference?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The price is a coincidence, not the decision. Firefoo's $9/mo Solo plan is one seat editing Firestore data on one project at a time. Aerie's $9/mo Pro is unlimited projects, read-only, showing users, traffic and cost across your whole estate. Pick based on whether you need to edit data or see across projects.",
      },
    },
    {
      "@type": "Question",
      name: "Does Firefoo show cost or traffic analytics?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — Firefoo's feature set is data management: browsing, editing, querying, importing and exporting Firestore data, plus auth user management. No analytics, traffic monitoring, cross-project dashboard, or cost/billing monitoring.",
      },
    },
    {
      "@type": "Question",
      name: "Does Firefoo support multiple projects?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — unlimited projects, with per-project colors and read-only marking for safety. But it's oriented to working on one project's data at a time, not an aggregate view across projects, which is what Aerie is for.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Firefoo and Aerie together?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, and it's a natural pairing. Use Aerie to spot which project needs a look, then open Firefoo to actually edit the data. Aerie has no write path at all, so it can't replace Firefoo for that.",
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
        eyebrow="Honest comparison · same price, different job"
        h1="Firefoo vs Aerie"
        summary="These solve different problems. Firefoo is a desktop GUI for working on Firestore data — browsing, editing, querying, importing and exporting. Aerie can't edit a single document; it never writes. Aerie is for seeing across projects — users, traffic and cost on one page. Both happen to cost $9/month, so this is a genuine either/or on what you need, not on price."
      />

      <div className="mx-auto mt-14 max-w-4xl">
        <h2 className="text-xl font-semibold text-ink">At a glance</h2>
        <CompareTable
          competitorName="Firefoo"
          rows={[
            {
              label: "Platform",
              competitor: "Desktop — Mac, Windows, Linux",
              aerie: "Web",
            },
            {
              label: "Price",
              competitor:
                "14-day free trial, no card. Solo $9/mo (1 seat), Team $55/mo (8 seats), Enterprise custom",
              aerie: "Free for 3 projects, $9/mo Pro for unlimited",
            },
            {
              label: "What it's for",
              competitor:
                "Browsing, editing, querying, importing/exporting Firestore data: table/tree/JSON views, JS shell queries, CSV/JSON export, auth user management, geopoint & image preview",
              aerie:
                "A live view across every project: users, traffic, Firestore data, services and cost — read only",
            },
            {
              label: "Multi-project behavior",
              competitor:
                "Unlimited projects with per-project colors and read-only marking, oriented to one project's data at a time",
              aerie: "Every project you own, side by side, on one page",
            },
            {
              label: "Cost monitoring",
              competitor: "None",
              aerie:
                "Estimated cost per project, with drivers and spike flags",
            },
            {
              label: "Open source",
              competitor: "Not stated",
              aerie: "Yes — AGPL-3.0",
            },
            {
              label: "Writes to Firestore",
              competitor: "Yes — that's the product",
              aerie: "Never. Reads only.",
            },
          ]}
        />
      </div>

      <ProseSection title="When Firefoo is the right choice">
        <p>
          If you need to work on your data — not just look at it — buy
          Firefoo. It's built for exactly that, and Aerie genuinely cannot do
          it: Aerie has no write path to any project, full stop.
        </p>
        <ReasonList
          items={[
            "You need to edit, add, or delete Firestore documents — Aerie never writes to your data.",
            "You want a query shell (JavaScript) to run real queries against your data, or to export results to JSON or CSV.",
            "You want to view data as a table, tree, or raw JSON, visualize geopoints, or preview images stored in your documents.",
            "You want to manage auth users directly from the tool, not just view a count of them.",
          ]}
        />
      </ProseSection>

      <ProseSection title="When Aerie is the right choice">
        <p>
          If what you actually want is to see across your projects — not
          into one project's data — that's Aerie. Firefoo's multi-project
          support is about organizing separate projects you open one at a
          time; Aerie's is about seeing them together.
        </p>
        <ReasonList
          items={[
            "You want an aggregate view of users, traffic, and Firestore data across every project, not a workspace for one project's documents.",
            "You want cost and billing signal — Firefoo's feature set has no cost or billing monitoring at all.",
            "You want traffic analytics — Firefoo doesn't do analytics; it does data management.",
            "You'd rather not install a desktop app and want something you can open in a browser tab.",
          ]}
        />
      </ProseSection>

      <ProseSection title="Can you use both?">
        <p>
          Yes — this is the pairing that makes the most sense of any
          competitor here. Let Aerie tell you which project looks off across
          your estate, then open Firefoo to actually get into that project's
          data and fix it. Aerie can point at the problem; only Firefoo (or
          the Firebase Console) can touch it.
        </p>
      </ProseSection>

      <FaqSection
        items={[
          {
            q: "Can Aerie edit Firestore data like Firefoo?",
            a: "No. Aerie never writes — it only reads. Firefoo is a desktop GUI built to browse, edit, query and import/export Firestore data: table, tree and JSON views, a JavaScript query shell, CSV/JSON export, auth user management. If you need to work on your data, Firefoo is built for exactly that and Aerie can't do it.",
          },
          {
            q: "Firefoo and Aerie are both $9 a month — what's the actual difference?",
            a: "The price is a coincidence, not the decision. Firefoo's $9/mo Solo plan is one seat editing Firestore data on one project at a time. Aerie's $9/mo Pro is unlimited projects, read-only, showing users, traffic and cost across your whole estate. Pick based on whether you need to edit data or see across projects.",
          },
          {
            q: "Does Firefoo show cost or traffic analytics?",
            a: "No — Firefoo's feature set is data management: browsing, editing, querying, importing and exporting Firestore data, plus auth user management. No analytics, traffic monitoring, cross-project dashboard, or cost/billing monitoring.",
          },
          {
            q: "Does Firefoo support multiple projects?",
            a: "Yes — unlimited projects, with per-project colors and read-only marking for safety. But it's oriented to working on one project's data at a time, not an aggregate view across projects, which is what Aerie is for.",
          },
          {
            q: "Can I use Firefoo and Aerie together?",
            a: "Yes, and it's a natural pairing. Use Aerie to spot which project needs a look, then open Firefoo to actually edit the data. Aerie has no write path at all, so it can't replace Firefoo for that.",
          },
        ]}
      />

      <ClosingCta />
      <CrossLinks currentSlug="firefoo" />
      <CompareFooter />
    </PageShell>
  );
}
