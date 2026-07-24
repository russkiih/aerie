# Landing Page Brief — Aerie

> Status: **awaiting approval**. No code gets written until you sign off on this.

## The one thing

**A visitor clicks "Continue with Google" and connects their Firebase estate.**

Every CTA on the page is this action. "Self-host on GitHub" is demoted from a
button to a text link — it currently competes with the conversion action and
sends your best-fit visitors to the one outcome that never produces revenue.

## Visitor state

- **Who they are:** a developer who owns or maintains more than one Firebase
  project — their own apps, side projects, or client work. They open the
  Firebase console often enough to resent it.
- **What they believe when they arrive:** that checking on several Firebase
  projects means opening several tabs, because that is simply how Firebase
  works. Most have never looked for a fix, because it doesn't occur to them
  that one could exist.
- **What they must believe to convert:** (1) this really does show every
  project in one view, (2) granting Google Cloud access to it is safe, and
  (3) finding out costs nothing.
- **The gap:** from *"this is just how Firebase is"* to *"someone fixed this,
  and I can verify for myself that it's safe."* Belief (2) is the hard one —
  the ask is unusually large, and the page has to earn it explicitly rather
  than hope nobody notices.

## The villain

**The Firebase console is built for one project at a time.**

This is structural, not incidental. The console's entire information
architecture is per-project: you select a project, then everything you see is
scoped to it. There is no aggregate view, no cross-project comparison, and no
combined picture of what the whole estate is doing or costing. So any question
that spans projects — *which app is actually growing?*, *what am I spending in
total?*, *did something break last night?* — is answered by opening N tabs and
holding N numbers in your head.

That is the external system to name. Not the developer's disorganisation.
Nobody is bad at this; the tool was never designed to answer the question.

**Second front, used in the Catch section:** Firebase billing is usage-based
and reported per project, after the fact. The console shows you what you spent
once you've spent it. Cost surprises are a well-known Firebase experience, and
the estate-wide watchdog is the direct counter.

**Substantiation:** both claims are verifiable by anyone with a console open.
Neither is manufactured.

## Proof inventory

| Claim we want to make | Evidence we actually have | Verdict |
|---|---|---|
| Shows every project in one view | The working product; three real screenshots in `web/public/shots/` | **USE** |
| Reads live in the browser, nothing stored | True and architecturally enforced; readable in the source | **USE** |
| Open source, AGPL-3.0 | Public repo | **USE** |
| Never writes to your projects | True — Aerie only ever issues read requests | **USE** |
| Built by someone running a real multi-project estate | True; the screenshots are your own live 12-project estate | **USE** |
| Self-hosting is free forever, no caps | True | **USE** — doubles as risk reversal |
| Billing watchdog surfaces cost drivers and spikes | Feature exists and works | **USE the capability, claim no outcomes** — no case study of it having saved anyone money yet |
| Founder: 3 years on Firebase, 12 projects of their own | Confirmed by owner; screenshots are that estate | **USE** — estate leads, years support |
| Trusted by N developers / N teams | None | **CUT** |
| Testimonials, ratings, customer logos | None | **CUT** — no Wall of Love, no credibility strip, no hard-numbers band |
| "Saves you X hours a week" | No measurement | **CUT** |

Zero paying users today. The page reflects that: it leans on a working product
you can see, a licence you can audit, and an architecture you can verify —
not on borrowed credibility.

## Search targeting

- **Primary term:** `firebase dashboard for multiple projects`
- **Secondary:** `firebase multi-project dashboard`, `firebase cost monitoring`,
  `firebase project overview`, `firebase billing alerts`
- **Honest assessment:** this page will **not rank on `aerie-dashboard-app.web.app`.**
  `web.app` is a Public Suffix List domain with effectively no transferable
  authority, and a subdomain on it is close to unrankable for commercial terms.
  The page will be built correctly — title, `h1`, first 100 words, JSON-LD,
  sitemap — so it is ready the day the real domain lands. Until then, treat
  traffic as coming from Reddit, Hacker News, GitHub, and direct. Nothing in
  the copy depends on search working first.

## Section plan

Stage is *launched, no users yet*, so the credibility strip, hard-numbers band,
scattered testimonials, and wall of love are all **cut** — padding those with
invented proof would discredit the true parts of the page.

1. **Hero** — outcome headline, subhead carrying the honest proof, one CTA,
   one trust line.
2. **Zero-friction action** — annotated real screenshots. Aerie can't offer an
   interactive demo without OAuth, so screenshots are the floor: show the
   actual product before asking for anything.
3. **The villain** — the console is built for one project at a time.
4. **Three verbs** — Connect / Compare / Catch.
5. **Deep feature blocks** — estate coverage, traffic depth, billing watchdog,
   AI analyst.
6. **Trust** *(custom section, load-bearing)* — exactly what Aerie reads, what
   it never does, and a direct answer to the "Google hasn't verified this app"
   screen the visitor is about to hit. This section exists because the
   conversion action has an unusually large ask attached, and ambushing people
   with it converts worse than naming it first.
7. **Pricing** — free tier with real limits, annual anchored against monthly,
   self-host as risk reversal.
8. **Objection FAQ** — six questions, including two uncomfortable ones.
9. **Closing CTA** — same action, one line.

---

## Copy

### 1. Hero

**Eyebrow:** Open source · reads only, never writes · your data stays in your browser

**Headline:**
> Stop checking Firebase one project at a time.

**Subhead:**
> Aerie reads your whole Firebase estate live in your browser — every project's
> users, traffic, Firestore data and costs in a single view. Open source, and
> free for your first three projects.

**CTA:** `Continue with Google` — *Free for 3 projects. No card.*

**Secondary (text link, not a button):** Or self-host it free forever ↗

---

### 2. Zero-friction action — see it before signing in

**Heading:** This is the whole product. No signup to look.

Three real screenshots, captioned:

- **`overview.png`** — "Every project you own, ranked. Users, traffic and
  Firestore documents side by side."
- **`breakdowns.png`** — "Where the traffic actually comes from — pages,
  sources, countries, devices — per project."
- **`modal.png`** — "One project, opened up: services, sign-in methods, cost
  drivers, and the AI analyst's read on it."

*Note: these are screenshots of a real 12-project estate, not mockups.*

---

### 3. The villain

**Heading:**
> The console was built for one project at a time.

**Body:**
> That's not an oversight, it's the architecture. Everything in the Firebase
> console is scoped to whichever project you selected — which is fine when you
> have one, and quietly awful when you have six.
>
> So the questions that actually matter span projects and the console can't
> answer any of them. Which app is growing? What am I spending in total? Did
> something break last night? Each one means opening every project in turn and
> holding the numbers in your head.
>
> Aerie asks Google the same questions the console does — all of them at once,
> from your browser — and puts the answers on one page.

---

### 4. Three verbs

**Connect**
> One Google sign-in and every project you can reach appears. No config file,
> no service account, no per-project setup.

**Compare**
> Every project on one page, ranked by whatever matters — users, traffic,
> documents. The comparison the console can't make.

**Catch**
> The billing watchdog scans the estate for cost drivers and usage spikes, so
> a bill surprises you before it arrives, not after.

---

### 5. Deep feature blocks

**Your whole estate, not just the parts that fit on a card**
> Auth users, Firestore documents and collections, GA4 traffic, Hosting sites,
> Cloud Functions, Storage buckets and Realtime Database instances — read live,
> per project. If it's in your estate, it's on the page.

**Traffic with a memory**
> 7, 28 and 90-day windows with the previous period drawn alongside, so you can
> see whether this week is actually better. Broken down by page, source,
> country, device and OS.

**Know what it costs before the invoice does**
> The watchdog estimates usage cost across every project, names the drivers, and
> flags spikes against each project's own baseline. Firebase bills you after the
> fact; this is the part that runs before.

**An analyst that reads your numbers**
> Get insights and next moves grounded in your real data — what's working, what
> looks like a problem, and what's bot traffic rather than users. Included with
> Pro; self-hosted and free users can bring their own API key.

---

### 6. Trust — the section that earns the click

**Heading:**
> You're about to give a dashboard access to your Google Cloud account.

**Body:**
> That's a real ask, so here's exactly what happens.
>
> **Aerie only ever reads.** It never writes, deletes, or modifies anything in
> your projects.
>
> **Your data never reaches our servers.** Your browser talks straight to
> Google's APIs and renders the result. There's no backend holding your project
> data, because there's no backend in that path at all.
>
> **Your Google Cloud token stays in your browser.** The hosted version sends
> only a limited identity token — enough to check your subscription, and useless
> for anything else. Self-hosted builds contact no server whatsoever.
>
> **We store one thing:** your email address and which plan you're on. That's
> the entire database.
>
> **You'll see a warning from Google that says this app isn't verified.** That's
> accurate — verification is in progress. It appears because Aerie requests
> broad Google Cloud scopes, which it needs because the read-only variants of
> those APIs reject the calls Aerie makes. Click *Advanced → Continue* if you're
> comfortable; if you'd rather not be, self-host it instead and the question
> disappears.
>
> **And you don't have to take any of this on faith.** Every line is AGPL-3.0
> and public.

**CTA:** `Read the source ↗`

**Founder note (first person — it's a founder claim, so it shouldn't hide in
brand voice):**
> I built Aerie because I was opening twelve Firebase consoles every morning to
> answer one question. Three years on Firebase, twelve projects of my own, and
> this is the tool I wanted to exist. Every screenshot on this page is my real
> estate.

*Framing note: the twelve-project estate is doing more work here than the three
years, because running a multi-project estate is precisely the credential this
product needs. Both are true; the estate leads.*

---

### 7. Pricing

**Section heading:** Free for three projects. Free forever if you self-host.

| | **Self-hosted** | **Cloud Free** | **Cloud Pro** |
|---|---|---|---|
| | $0, forever | $0 | **$9**/mo billed yearly · or $19 monthly |
| | Everything, no caps | Up to 3 projects | Unlimited projects |
| | Your own OAuth client | 28-day traffic window | 7 / 28 / 90-day windows |
| | Bring your own AI key | AI analyst on Pro | Billing watchdog |
| | AGPL-3.0 | Zero setup | AI analyst included |
| | | | 7-day free trial on annual |

**Under the table:**
> No lock-in by construction: if you ever stop wanting to pay, take the code and
> run it yourself. That's what the licence is for.

---

### 8. Objection FAQ

**Why does it need read *and* write access to my Google Cloud account?**
> Because the read-only scope doesn't work for the calls Aerie makes — Firestore's
> `listCollectionIds` and Identity Toolkit's `accounts:query` both reject it.
> Aerie only ever issues reads, but Google's permission model doesn't offer a
> narrower grant that still works. You can verify that claim in the source, and
> it's the reason the trust section above exists.

**Google says this app isn't verified. Should I be worried?**
> That screen appears for any app requesting sensitive scopes before Google's
> verification review completes. Verification is in progress. In the meantime the
> honest answer is: the code is public, so audit it rather than trusting the
> label — and if you'd rather not click through a warning, self-hosting avoids it.

**What do you store?**
> Your email address and your subscription status. Nothing else. Your project
> data is read by your browser and never passes through our servers.

**Why $9 when I could self-host for free?**
> You're paying to skip creating your own Google OAuth client and hosting the
> thing. If that's an afternoon you'd rather keep, Pro is worth it. If it isn't,
> self-host — the feature set is identical and that's deliberate.

**Does this work if I only have one Firebase project?**
> It works, but it's not really for you. Aerie earns its place at three or more
> projects, which is why the free tier stops there.

**What happens to my dashboard if Aerie shuts down?**
> The repository is AGPL-3.0 and public. Fork it and run it — the self-hosted
> build has every feature and talks to no server of ours.

---

### 9. Closing CTA

> **Every project you own, on one page.**
> Free for three. Two minutes to find out.

**CTA:** `Continue with Google`

---

## What we are NOT claiming

- No user counts, no "trusted by N developers", no growth numbers.
- No testimonials, reviews, ratings, or customer logos.
- No claim the watchdog has saved anyone money — only that it estimates costs
  and flags spikes.
- No time-saved or money-saved figures. No "10x", no "hours a week".
- No founder credentials beyond what you confirm with a real number.
- No press mentions, awards, or funding.
- Not claiming "read-only scopes" — the grant permits writes and the page says
  so plainly. Aerie's *behaviour* is read-only; its *permission* is not.
- Not claiming alerts or the weekly digest exist. They're roadmap, and the page
  won't sell them.
- Not implying the visitor is disorganised. The villain is the console.

---

## Open decisions for you

1. **Founder credibility slot** — supply a real number or it stays cut.
2. **A guarantee would strengthen pricing.** The playbook puts risk reversal
   above the price, and right now the annual trial is doing that work alone. A
   plain "cancel any time, full refund in the first 30 days" would be stronger —
   but that's your commercial call and I won't write it as fact without your
   say-so.
3. **Screenshots** — the three in `web/public/shots/` are real and current. Say
   if you'd rather shoot fresh ones showing the watchdog and analyst, which are
   the strongest Pro features and are currently under-represented.
