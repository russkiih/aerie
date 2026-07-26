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

export type Post = NavItem & {
  blurb: string;
  /** ISO date — feeds <time datetime> and BlogPosting.datePublished. */
  published: string;
  publishedLabel: string;
  readingMinutes?: number;
};

// Posts are ordered newest first; the blog index and the "keep reading"
// cards both read this order. Each post exists to answer one informational
// question and hand the reader the tool that answers it for their own numbers.
export const POSTS: Post[] = [
  {
    href: "/blog/why-is-my-firebase-bill-so-high/",
    label: "Why is my Firebase bill so high?",
    blurb:
      "The five billing rules that produce almost every surprise Firestore invoice — including the two that charge you for reads you never made.",
    published: "2026-07-24",
    publishedLabel: "24 July 2026",
    readingMinutes: 7,
  },
  {
    href: "/blog/firestore-multi-region-costs-double/",
    label: "Firestore multi-region costs exactly double. Most people never chose it.",
    blurb:
      "nam5 bills at twice us-central1 for every read, write and delete — and the choice is made once, at project creation, in a dropdown most developers skim.",
    published: "2026-07-24",
    publishedLabel: "24 July 2026",
    readingMinutes: 5,
  },
  {
    href: "/blog/firebase-spark-vs-blaze/",
    label: "Spark vs Blaze: what actually forces the upgrade",
    blurb:
      "It is rarely the quota you were watching. A walk through every Spark limit, and the one that pushes most projects onto Blaze before they outgrow anything.",
    published: "2026-07-24",
    publishedLabel: "24 July 2026",
    readingMinutes: 6,
  },
  {
    href: "/blog/monitor-multiple-firebase-projects/",
    label: "How to monitor multiple Firebase projects",
    blurb:
      "The console is scoped to one project by design. Here are the four approaches people actually use, and what each one costs in time or money.",
    published: "2026-07-24",
    publishedLabel: "24 July 2026",
    readingMinutes: 6,
  },
];

export const GITHUB_URL = "https://github.com/russkiih/aerie";
