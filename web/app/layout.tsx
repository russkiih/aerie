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

// Site-wide SoftwareApplication only. The FAQPage lives on app/page.tsx, not
// here: Google's structured-data policy forbids marking up content that isn't
// visible on the page, and the landing's FAQ questions do not appear on the
// /tools and /compare routes. Each of those carries its own FAQPage matching
// its own visible questions.
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
    }
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
