// Single source of truth for site-wide navigation.
//
// The footer, the tool cross-links and the comparison cross-links all read
// from here, so adding a page means editing one list and it appears
// everywhere. Every internal link also has to exist in web/public/sitemap.xml
// — a page nothing links to is a page Google is slow to find, and a sitemap
// entry with no inbound link is a weak signal.

export type NavItem = {
  href: string;
  label: string;
  /** Shown on cross-link cards; omitted in the compact footer. */
  blurb?: string;
};

export const TOOLS: NavItem[] = [
  {
    href: "/tools/firebase-pricing-calculator/",
    label: "Firebase Pricing Calculator",
    blurb: "Estimate a monthly Blaze bill, line by line, free tier subtracted.",
  },
  {
    href: "/tools/firestore-cost-estimator/",
    label: "Firestore Cost Estimator",
    blurb: "nam5 vs us-central1, side by side. Multi-region costs exactly 2x.",
  },
  {
    href: "/tools/firebase-free-tier-checker/",
    label: "Free Tier Limits Checker",
    blurb: "Check every Spark limit before Google forces you onto Blaze.",
  },
];

export const COMPARISONS: NavItem[] = [
  {
    href: "/compare/firebase-console/",
    label: "vs Firebase Console",
    blurb: "The official console, and the one question it cannot answer.",
  },
  {
    href: "/compare/firefoo/",
    label: "vs Firefoo",
    blurb: "Editing Firestore data vs seeing across projects.",
  },
  {
    href: "/compare/databeam/",
    label: "vs Databeam",
    blurb: "Mobile project switching vs projects side by side.",
  },
  {
    href: "/compare/flame-shield/",
    label: "vs Flame Shield",
    blurb: "A spend kill switch vs knowing which project is drifting.",
  },
];

// When the blog ships, add it here and it appears in every footer at once:
//   export const POSTS: NavItem[] = [...]
// then add a fourth column in SiteFooter and the URLs to sitemap.xml.

export const GITHUB_URL = "https://github.com/russkiih/aerie";
