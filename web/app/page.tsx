import LiveApp from "@/components/LiveApp";

// FAQPage for the landing only. These six questions mirror the FAQ section
// rendered in LiveApp's Landing component verbatim — structured data must
// match what a visitor can actually see, so if you edit one, edit both.
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Why does it need read and write access to my Google Cloud account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Because the read-only scope doesn't work for the calls Aerie makes — Firestore's listCollectionIds and Identity Toolkit's accounts:query both reject it. Aerie only ever issues reads, but Google's permission model doesn't offer a narrower grant that still works. You can verify that in the source.",
      },
    },
    {
      "@type": "Question",
      name: "Google says this app isn't verified. Should I be worried?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "That screen appears for any app requesting sensitive scopes before Google's verification review completes. Verification is in progress. The code is public, so audit it rather than trusting the label — and if you'd rather not click through a warning, self-hosting avoids it.",
      },
    },
    {
      "@type": "Question",
      name: "What do you store?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your email address and your subscription status. Nothing else. Your project data is read by your browser and never passes through our servers.",
      },
    },
    {
      "@type": "Question",
      name: "Why $9 when I could self-host for free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You're paying to skip creating your own Google OAuth client and hosting the thing. If that's an afternoon you'd rather keep, Pro is worth it. If it isn't, self-host — the feature set is identical and that's deliberate.",
      },
    },
    {
      "@type": "Question",
      name: "Does this work if I only have one Firebase project?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It works, but it's not really for you. Aerie earns its place at three or more projects, which is why the free tier stops there.",
      },
    },
    {
      "@type": "Question",
      name: "What happens to my dashboard if Aerie shuts down?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The repository is AGPL-3.0 and public. Fork it and run it — the self-hosted build has every feature and talks to no server of ours.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      {/* Static constant, no user input — see the note in layout.tsx. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <LiveApp />
    </>
  );
}
