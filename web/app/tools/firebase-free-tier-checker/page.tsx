import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shared";
import Calculator from "./Calculator";

const SITE = "https://aerie-dashboard-app.web.app";
const URL = `${SITE}/tools/firebase-free-tier-checker/`;

export const metadata: Metadata = {
  title: "Firebase Free Tier Limits Checker | Aerie",
  description:
    "Check your current usage against every Firebase Spark free-tier limit — Firestore, Realtime DB, Storage, Hosting, Auth — and see which one you'll hit first.",
  alternates: { canonical: "/tools/firebase-free-tier-checker/" },
  openGraph: {
    type: "website",
    url: URL,
    title: "Firebase Free Tier Limits Checker | Aerie",
    description:
      "Am I about to need Blaze? Check your usage against every Spark limit and see which service forces the upgrade. Free, no signup.",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Firebase Free Tier Limits Checker",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: URL,
      description:
        "Checks entered usage against every Firebase Spark (free tier) limit across Firestore, Realtime Database, Cloud Storage, Hosting and Authentication, and reports which limit is closest to being exceeded.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I use Cloud Functions on the Spark free plan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Cloud Functions require the Blaze pay-as-you-go plan for any usage at all — there is no free invocation or compute allowance on Spark. This is the single most common reason developers are forced to upgrade.",
          },
        },
        {
          "@type": "Question",
          name: "What happens when I go over a Spark limit?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Firebase requires you to upgrade to the Blaze plan before that service keeps working past its free allowance — Spark projects don't silently overage-bill, they get blocked or the exceeding feature (like Functions) simply isn't available.",
          },
        },
        {
          "@type": "Question",
          name: "Do Firestore free-tier limits reset daily or monthly?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Firestore's reads, writes and deletes allowances reset daily. Storage is a standing limit, not a rate. Most other services' free tiers (bandwidth, operations, MAU) reset monthly.",
          },
        },
        {
          "@type": "Question",
          name: "Does upgrading to Blaze mean I lose the free tier?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No — Blaze still includes the same free monthly allowances for every service. You're only billed for usage past those allowances, the same math this checker and the Firebase Pricing Calculator both use.",
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
        current="firebase-free-tier-checker"
        eyebrow="Free · no signup · runs entirely in your browser"
        title="Firebase Free Tier Limits Checker"
        intro="Enter your current usage and see it checked against every Spark limit — Firestore, Realtime Database, Cloud Storage, Hosting, Authentication — so you know which one you'll blow first, before Google tells you."
      >
        <Calculator />
      </ToolShell>
    </>
  );
}
