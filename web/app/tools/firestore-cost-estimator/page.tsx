import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shared";
import Calculator from "./Calculator";

const SITE = "https://aerie-dashboard-app.web.app";
const URL = `${SITE}/tools/firestore-cost-estimator/`;

export const metadata: Metadata = {
  title: "Firestore Cost Estimator | Aerie",
  description:
    "Compare Firestore nam5 multi-region vs us-central1 single-region cost at your read/write/delete volume. See the exact 2x difference, and the annual dollar cost.",
  alternates: { canonical: "/tools/firestore-cost-estimator/" },
  openGraph: {
    type: "website",
    url: URL,
    title: "Firestore Cost Estimator | Aerie",
    description:
      "nam5 vs us-central1, side by side. See exactly how much multi-region Firestore is costing you per year. Free, no signup.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Firestore Cost Estimator",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: URL,
      description:
        "Compares Firestore's nam5 multi-region pricing against us-central1 single-region pricing at a given read/write/delete volume, and states the annual dollar difference.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Why is nam5 Firestore more expensive than us-central1?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "nam5 replicates your data across multiple US regions for higher availability, and Google prices every read, write, delete and GiB of stored data at roughly double the single-region rate to cover that replication.",
          },
        },
        {
          "@type": "Question",
          name: "Is the multi-region markup always exactly 2x?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, at the rates this tool cites: nam5 reads, writes, deletes and storage are each priced at exactly double the equivalent us-central1 rate, so the ratio holds regardless of your usage volume.",
          },
        },
        {
          "@type": "Question",
          name: "Can I switch an existing Firestore database from nam5 to us-central1?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Not in place — Firestore's location is set once, at database creation, and can't be changed afterward. Moving means exporting your data and importing it into a new database in the region you want.",
          },
        },
        {
          "@type": "Question",
          name: "Does the free tier differ between regions?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. The daily Spark free-tier allowance for reads, writes and deletes is the same regardless of region — only the rate charged past that allowance changes.",
          },
        },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <ToolShell
        current="firestore-cost-estimator"
        eyebrow="Free · no signup · runs entirely in your browser"
        title="Firestore Cost Estimator"
        intro="Enter a daily read/write/delete volume and compare nam5 (multi-region) against us-central1 (single region) side by side. The gap is exactly 2x, and most projects pay it without knowing."
      >
        <Calculator />
      </ToolShell>
    </>
  );
}
