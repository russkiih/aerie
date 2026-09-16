---
title: "Firebase Firestore Dashboard App Tutorial: Monitor Usage, Cost & Quotas"
excerpt: "A step-by-step tutorial for setting up a Firestore monitoring dashboard: usage metrics, budget alerts, quota tracking, and multi-project visibility."
date: 2026-09-16
slug: "firebase-firestore-dashboard-app-tutorial-monitor-usage-cost-and-quotas"
tags:
  - "firebase firestore dashboard app tutorial"
  - "firestore usage monitoring"
  - "firebase firestore quotas"
  - "firestore cost tracking"
  - "firebase budget alerts"
  - "multi-project firebase dashboard"
---

Firestore doesn't come with a single screen that shows reads, writes, deletes, storage, and cost together. You have to piece it together from the Firebase console, Cloud Monitoring, and the billing dashboard. This tutorial walks through building that view step by step, using the tools you already have, so you can catch a runaway read loop before it becomes a $400 surprise.

## What a Firestore dashboard actually needs to track

Before opening any console tab, decide what you're watching for. Most Firestore cost and stability problems come from five numbers:

- **Document reads per day** — the most common source of surprise bills
- **Document writes and deletes per day** — cheaper per unit, but easy to spam in loops
- **Stored data (GiB)** — usually stable unless you're storing large blobs in documents
- **Network egress** — often ignored, but adds up if you're returning big query results
- **Composite index count** — not billed directly, but each index adds write overhead

A dashboard that shows only "total cost" hides the cause. You want reads and writes broken out separately, because a spike in reads points to a query problem (missing `.limit()`, a listener re-fetching on every render), while a spike in writes usually points to a loop or a batch job gone wrong.

## Step 1: Check the built-in Firebase usage tab

Start in the Firebase console under **Firestore Database → Usage**. This gives you:

- Reads, writes, and deletes for the last 30 days, in daily buckets
- Storage size over time
- A comparison against your plan's included quota

On the free Spark plan, Firestore includes roughly 50,000 reads, 20,000 writes, and 20,000 deletes per day, plus 1 GiB of stored data. These reset daily around midnight Pacific time. If you're on Blaze (pay-as-you-go), the same daily allowances still apply before you start being billed per operation.

This tab is the fastest way to spot a trend, but it only covers one project at a time and doesn't show cost in dollars — just operation counts.

## Step 2: Turn on budget alerts in Google Cloud Billing

Firestore usage is billed through the linked Google Cloud project, so real cost tracking happens in **Google Cloud Console → Billing → Budgets & alerts**.

1. Create a budget scoped to the project (or a filtered subset of services if you want Firestore specifically).
2. Set a monthly amount based on your typical spend, or start conservative — many small teams set the first budget at whatever their current bill plus 20% is.
3. Add alert thresholds at 50%, 90%, and 100% of budget.
4. Point alerts at an email you actually check, not just the billing admin's inbox.

Budget alerts are reactive — they tell you after spend has already happened — but they're the cheapest safety net you can set up, and it takes about five minutes per project.

## Step 3: Watch quota-specific metrics in Cloud Monitoring

Budget alerts catch dollar amounts, but quota exhaustion can break your app before it costs much money. If you hit Firestore's per-second write limits or run into an unexpected quota ceiling, users see errors, not a bigger bill.

In **Cloud Monitoring → Metrics Explorer**, filter by resource type `firestore_instance` and look at:

- `document/read_count`
- `document/write_count`
- `document/delete_count`

You can build a custom dashboard here with all three plotted together, plus alert policies that fire when reads exceed a threshold within a rolling window (say, a 10x jump over the same hour yesterday). This is more setup work than the Firebase usage tab, but it's the only place to catch a spike in near real time rather than the next morning.

## Step 4: Add index and storage checks

Two things don't show up clearly in either dashboard above:

**Index bloat.** Every composite index you create adds a write cost to every document that matches its fields, even if you never query it again. Go to **Firestore → Indexes** periodically and delete indexes tied to features you've since removed. There's no automated report for "unused indexes" — you have to cross-reference against your query code manually.

**Storage creep.** If you store arrays, embedded objects, or base64-encoded images inside documents, storage can grow faster than document count suggests. The Usage tab shows total GiB, but not which collections are heaviest. For that, you'll need to sample document sizes manually or track it as you add features that write larger payloads.

## Step 5: Repeat across every project

Here's where the built-in tools run out of road. If you run separate Firebase projects for staging, production, and maybe a client's app, you're now doing steps 1 through 4 multiple times, in multiple browser tabs, with no shared view. There's no native way to see "all projects, reads today, sorted by highest" in one screen.

This is the gap a multi-project dashboard is meant to close. Aerie is a free, open-source dashboard built for exactly this — it pulls usage, cost, and quota data across multiple Firebase projects into one view, so you're not reconstructing the same five checks per project every week.

## Comparison: where to watch what

| Task | Firebase Console | Cloud Monitoring | Billing Budgets | Multi-project dashboard |
|---|---|---|---|---|
| Daily read/write/delete counts | Yes, per project | Yes, more granular | No | Yes, across projects |
| Dollar cost tracking | No | No | Yes | Yes |
| Real-time spike alerts | No | Yes, with alert policies | No, reactive | Depends on tool |
| Storage size trends | Yes, per project | Limited | No | Yes, across projects |
| Cross-project view | No | No | Only if projects share a billing account | Yes |
| Setup time | None | 20–40 minutes | 5 minutes per project | One-time connection per project |

No single row here replaces the others. Budget alerts and quota monitoring answer different questions — one is about money, the other is about stability — and you typically want both running.

## Common pitfalls once the dashboard is live

**Treating the daily quota reset as a safety net.** The free tier limits reset every 24 hours, but if your app has real traffic, you'll blow past them regardless — the quota is a Spark-plan ceiling, not a spend limiter on Blaze.

**Ignoring reads from listeners.** A `onSnapshot` listener that re-fires on every keystroke can generate thousands of reads from a single user session. This shows up as a slow, steady climb in the Usage tab rather than a sharp spike, so it's easy to miss for weeks.

**Not separating environments.** If staging and production share a Firebase project, your usage numbers are polluted by test traffic, and you can't tell which environment is actually driving cost. Separate projects per environment make every dashboard step above more useful.

**Checking only once a month.** Firestore cost problems compound daily. A query bug introduced on day one of a billing cycle can run for three weeks before anyone notices in a monthly review. Weekly checks, even quick ones, catch problems while they're still cheap to fix.

## Putting it together

A working Firestore dashboard doesn't require custom tooling from scratch — it requires combining what's already available: the Usage tab for quick counts, Cloud Monitoring for near-real-time alerts, Billing Budgets for dollar thresholds, and a manual index/storage review on a recurring schedule. If you're managing more than one Firebase project, layering in a tool built for cross-project visibility saves you from repeating four separate checks per project every week.

Start with the Usage tab and one budget alert today — that's a ten-minute setup that catches the most common failure mode: a query or loop that reads far more than intended. Add Cloud Monitoring alerts once you know your normal traffic pattern well enough to set a sensible threshold.

## FAQ

**Does Firebase have a built-in Firestore cost dashboard?**

Not exactly. The Firebase console's Usage tab shows read, write, delete, and storage counts against your plan's quota, but it doesn't show dollar cost directly — that lives in Google Cloud Billing, in a separate console.

**How do I get alerted before a Firestore bill spikes?**

Set up a budget alert in Google Cloud Billing with thresholds at 50%, 90%, and 100% of your typical monthly spend. For faster warning on usage spikes specifically, add an alert policy in Cloud Monitoring on document read or write count.

**What's the Firestore free tier quota?**

On the Spark (free) plan, Firestore typically includes around 50,000 reads, 20,000 writes, and 20,000 deletes per day, plus 1 GiB of storage. These daily allowances reset around midnight Pacific time and also apply as the free portion of usage on the pay-as-you-go Blaze plan.

**Why do my Firestore reads keep climbing even though traffic is flat?**

Realtime listeners (onSnapshot) that re-fire on every state change or keystroke are a common cause. Each re-fire counts as a read, so a chat input or live search field without debouncing can generate far more reads than the actual user traffic suggests.

**How do I monitor Firestore usage across multiple Firebase projects at once?**

The native Firebase console and Cloud Monitoring are scoped to one project at a time, so tracking several projects means checking each separately. Tools like Aerie are built specifically to aggregate cost, usage, and quota data across multiple Firebase projects into a single dashboard.
