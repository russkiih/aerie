import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shared";
import Calculator from "./Calculator";

const SITE = "https://aerie-dashboard-app.web.app";
const URL = `${SITE}/tools/firebase-pricing-calculator/`;

export const metadata: Metadata = {
  title: "Firebase Pricing Calculator | Aerie",
  description:
    "Estimate your monthly Firebase Blaze bill — Firestore, Realtime Database, Cloud Functions and Hosting — free tier subtracted automatically. No signup.",
  alternates: { canonical: "/tools/firebase-pricing-calculator/" },
  openGraph: {
    type: "website",
    url: URL,
    title: "Firebase Pricing Calculator | Aerie",
    description:
      "Estimate your monthly Firebase Blaze bill across every major service, with the free tier subtracted automatically. Free, no signup.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Firebase Pricing Calculator",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: URL,
      description:
        "Estimates a monthly Firebase Blaze bill from Firestore, Realtime Database, Cloud Functions and Hosting usage, subtracting Spark free-tier allowances first.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Does this calculator subtract the Firebase free tier?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes — every line item subtracts the Spark free allowance for that service before pricing the remainder. Skipping that step is the most common mistake in other Firebase cost calculators.",
          },
        },
        {
          "@type": "Question",
          name: "Why is Firestore priced differently depending on region?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Firestore's nam5 (and eur3) multi-region configuration is priced at roughly double the rate of a single region like us-central1. Most projects are created with nam5 by default. See the Firestore Cost Estimator tool for a direct side-by-side comparison.",
          },
        },
        {
          "@type": "Question",
          name: "Does this include Cloud Functions compute time?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Only the per-invocation rate is priced here, because Google's published pricing page used as this tool's source doesn't list a per-GB-second or per-vCPU-second Blaze rate. Invocations are usually the dominant cost anyway for most workloads.",
          },
        },
        {
          "@type": "Question",
          name: "Is this an official Firebase pricing tool?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No — it's an independent, open-source estimator built and maintained by Aerie, cross-checked against Google's published Firebase pricing page. It is not affiliated with Google or Firebase, and it is an estimate, not a quote.",
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
        current="firebase-pricing-calculator"
        eyebrow="Free · no signup · runs entirely in your browser"
        title="Firebase Pricing Calculator"
        intro="Enter your Firestore, Realtime Database, Cloud Functions and Hosting usage and get an estimated monthly Blaze bill — broken down line by line, with the Spark free tier subtracted first."
      >
        <Calculator />
      </ToolShell>
    </>
  );
}
