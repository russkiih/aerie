import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// Root is the branded marketing landing (logged-out) and the dashboard
// (logged-in), so the metadata targets the buying search term. Update the
// URLs here when a custom domain lands.
const SITE = "https://aerie-dashboard-app.web.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Firebase Dashboard for Multiple Projects | Aerie",
  description:
    "See every Firebase project's users, traffic, Firestore data and costs in one live dashboard. Open source, reads only, free for 3 projects.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    title: "Firebase Dashboard for Multiple Projects | Aerie",
    description:
      "Stop checking Firebase one project at a time. Every project's users, traffic and costs on one page. Open source, free for 3 projects.",
    images: [{ url: "/shots/overview.png", width: 2880, height: 2546 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Firebase Dashboard for Multiple Projects | Aerie",
    description:
      "Every Firebase project's users, traffic and costs on one page. Open source, free for 3 projects.",
    images: ["/shots/overview.png"],
  },
};

// SoftwareApplication + FAQ structured data for rich results. FAQ mirrors the
// landing's FAQ section verbatim.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Aerie",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "One dashboard for every Firebase project you own. Reads users, traffic, Firestore data, services and cost drivers live in the browser.",
      url: SITE,
      offers: [
        { "@type": "Offer", name: "Cloud Free", price: "0", priceCurrency: "USD" },
        {
          "@type": "Offer",
          name: "Cloud Pro",
          price: "108",
          priceCurrency: "USD",
          description: "$9/mo billed yearly, or $19 month-to-month",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Why does Aerie need read and write access to my Google Cloud account?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Because the read-only scope does not work for the calls Aerie makes. Firestore's listCollectionIds and Identity Toolkit's accounts:query both reject it. Aerie only ever issues read requests, but Google's permission model offers no narrower grant that still works. The source is public, so you can verify that.",
          },
        },
        {
          "@type": "Question",
          name: "Google says this app isn't verified. Should I be worried?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "That screen appears for any app requesting sensitive Google scopes before verification review completes. Verification is in progress. The code is public and AGPL-3.0, so audit it rather than trusting a label — and self-hosting avoids the warning entirely.",
          },
        },
        {
          "@type": "Question",
          name: "What does Aerie store?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your email address and your subscription status. Nothing else. Your project data is read by your browser and never passes through Aerie's servers.",
          },
        },
        {
          "@type": "Question",
          name: "What happens to my dashboard if Aerie shuts down?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The repository is AGPL-3.0 and public. Fork it and run it. The self-hosted build has every feature and contacts no server of ours.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* JSON-LD. Not an XSS vector: JSON_LD is a static constant authored
            here — no user input flows into it — and it contains no </script>
            sequence. This is Next's documented pattern for structured data. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
