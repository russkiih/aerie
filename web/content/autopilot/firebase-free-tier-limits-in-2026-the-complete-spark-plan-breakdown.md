---
title: "Firebase Free Tier Limits in 2026: The Complete Spark Plan Breakdown"
excerpt: "A full rundown of Firebase's Spark (free tier) and Blaze no-cost quotas for 2026, including Firestore, Storage, Hosting, Functions and Auth limits."
date: 2026-11-20
slug: "firebase-free-tier-limits-in-2026-the-complete-spark-plan-breakdown"
tags:
  - "firebase free tier limits 2026"
  - "firebase spark plan limits"
  - "firebase firestore free quota"
  - "firebase blaze plan free tier"
  - "firebase hosting free limits"
  - "firebase cloud functions free tier"
coverImage: "https://blogkeeping.com/api/v1/card/W07nGnioenpWN7UFrlPW/pxVVYSFkc3WiUUMqWBUW.png?v=14ktrgv"
---

Firebase's free tier hasn't changed dramatically in structure over the past few years, but the exact numbers, eligibility rules, and which services even qualify for "free" shift often enough that it's easy to plan around stale information. This post walks through the actual Spark plan limits as they stand in 2026, plus the no-cost quotas that still apply once you move to Blaze.

## Spark vs. Blaze: What "Free Tier" Actually Means

Firebase has two plans: Spark (free, hard-capped) and Blaze (pay-as-you-go). A common misconception is that Blaze means you pay for everything from the first request. In reality, Blaze includes the same no-cost quotas as Spark for most services — you only pay once usage exceeds those thresholds. The real difference is that Spark enforces hard stops when you hit a limit, while Blaze lets traffic continue and bills you for the overage.

This matters because several services — most notably Cloud Functions (2nd gen) and some Vertex AI/Extensions features — require a Blaze plan to deploy at all, even if your actual usage stays inside the free allowance. You're not paying more on Blaze for typical small-app traffic, but you do need a billing account attached.

## Core Spark Plan Limits (2026)

These are the headline numbers most indie developers and small teams run into first.

### Cloud Firestore
- 50,000 document reads per day
- 20,000 document writes per day
- 20,000 document deletes per day
- 1 GiB total stored data
- 10 GiB network egress per month

Quotas reset daily at midnight Pacific time, which catches out teams in other time zones who assume a UTC reset.

### Realtime Database
- 1 GB stored data
- 10 GB/month downloaded (simultaneous connections also capped around 100)

Realtime Database's free tier is noticeably smaller than Firestore's, which is part of why most new projects default to Firestore unless they need the specific real-time sync behavior.

### Cloud Storage for Firebase
- 5 GB stored
- 1 GB/day downloaded
- 20,000 upload operations/day
- 50,000 download operations/day

If you're serving user-uploaded images or video thumbnails at any real volume, the 1 GB/day download cap is usually the first wall you hit — not the storage amount itself.

### Firebase Hosting
- 10 GB stored
- 360 MB/day data transfer

That transfer limit sounds generous until you have a single-page app serving a few MB of JS bundle to a modest number of daily visitors. A few hundred visits a day on an unoptimized bundle can quietly eat the whole daily allowance.

### Cloud Functions
Functions technically sit outside Spark now — you need Blaze to deploy 2nd-gen functions. But the *no-cost* usage tier that applies on Blaze is:
- 2,000,000 invocations/month
- 400,000 GB-seconds of compute/month
- 200,000 CPU-seconds/month
- 5 GB outbound networking/month

For a typical small app with a handful of triggers and callable functions, this tier covers normal usage comfortably. Where teams get surprised is with functions that fan out — a Firestore trigger that fires on every write in a busy collection can rack up invocations far faster than expected.

### Authentication
Email/password, Google, and most OAuth providers are free with no cap. Phone authentication is the exception: it's free up to a limited number of verifications per month depending on country, after which it's billed per verification. SMS costs are often the first real line item teams see on a Blaze bill, even when everything else stays under free quotas.

### Cloud Messaging (FCM)
Unlimited and free, with no meaningful quota ceiling for typical push notification volume.

## Quick Reference Table

| Service | Spark free limit | Resets |
|---|---|---|
| Firestore reads | 50,000/day | Daily (Pacific time) |
| Firestore writes | 20,000/day | Daily |
| Firestore deletes | 20,000/day | Daily |
| Firestore storage | 1 GiB | — |
| Realtime DB storage | 1 GB | — |
| Realtime DB download | 10 GB/month | Monthly |
| Cloud Storage | 5 GB stored, 1 GB/day download | Daily/— |
| Hosting | 10 GB stored, 360 MB/day transfer | Daily |
| Functions invocations | 2,000,000/month (Blaze no-cost tier) | Monthly |
| Functions compute | 400,000 GB-seconds/month | Monthly |
| Auth (email/OAuth) | Unlimited | — |
| FCM | Unlimited | — |

## Where Teams Actually Hit Limits

In practice, the Spark plan ceiling isn't usually hit by raw user count — it's hit by inefficient reads. A few patterns show up repeatedly:

**Re-fetching full collections on every page load.** A dashboard that queries an entire collection instead of paginating can burn through 50,000 daily reads with only a few dozen active users.

**Realtime listeners left open.** Firestore snapshot listeners that stay subscribed longer than needed count against read quotas every time the underlying document changes, not just on initial load.

**Cloud Functions triggered in loops.** A Firestore-triggered function that writes back to the same collection it's listening to can create a feedback loop that consumes the entire monthly invocation allowance in hours.

**Hosting bundles that aren't optimized.** An unminified or unsplit JS bundle served to even a small number of daily visitors can exceed the 360 MB/day Hosting transfer cap faster than storage or database usage ever would.

## What Happens When You Exceed the Spark Limit

On Spark, once you hit a daily or monthly cap, further requests for that service are rejected until the quota resets — your app effectively goes read-only or stops writing new data for that window. There's no overage billing because there's no billing account attached.

On Blaze, the same usage simply starts accruing cost per unit over the free allowance. Firestore overage, for example, is billed per 100,000 reads/writes/deletes beyond the free quota, and Storage egress is billed per GB beyond the free 10 GB/month on Firestore or 1 GB/day on Cloud Storage.

## Planning Around the Limits

If you're building on Spark and expect to stay there, design your data access patterns around the daily reset cycle. Batch reads where possible, paginate lists instead of loading full collections, and avoid Firestore listeners on documents that update frequently if you don't need live updates.

If you're already on Blaze, set a budget alert in Google Cloud Billing at a low threshold (even $1–5) so a runaway function or an unbounded read loop surfaces immediately rather than at the end of the month. Budget alerts are a notification, not a hard stop — Firebase doesn't auto-pause billing when a budget is exceeded, so the alert is only useful if someone actually checks it.

For teams running more than one Firebase project — a staging and production pair, or several client apps — tracking free tier consumption project by project in the Firebase console gets tedious fast, since each project's usage page only shows that one project in isolation. This is one of the reasons tools like Aerie exist: it pulls cost, usage, and quota data from multiple Firebase projects into a single dashboard so you can spot which project is closest to its Spark limits or driving unexpected Blaze charges without opening each console separately.

## Spark or Blaze: Which Should You Start On?

For a side project, prototype, or app still validating an idea, Spark is almost always the right starting point. The limits are generous enough for low-traffic apps, and there's zero risk of a surprise bill.

Move to Blaze when you need Cloud Functions (2nd gen), when you're close to a Spark ceiling on a production app, or when you need services Spark doesn't support at all, like scheduled functions or certain Extensions. Moving to Blaze doesn't mean you'll pay anything immediately — it just removes the hard stop and attaches a billing account as a safety net.

The practical move for most small teams: start on Spark, watch usage patterns during development, and switch to Blaze with a tight budget alert in place before launch rather than after an outage from hitting a quota in production.

## FAQ

**Do Firebase free tier limits reset daily or monthly?**

It depends on the service. Firestore reads, writes, and deletes, plus Cloud Storage downloads and Hosting transfer, reset daily at midnight Pacific time. Realtime Database downloads and Cloud Functions invocations reset monthly.

**Can I use Cloud Functions on the free Spark plan in 2026?**

Not for 2nd-gen functions — they require a Blaze (pay-as-you-go) billing account. However, the free monthly allowance (2,000,000 invocations, 400,000 GB-seconds) still applies on Blaze, so typical small-app usage usually costs nothing.

**What happens if I exceed Firestore's free quota on Spark?**

Further reads, writes, or deletes for that resource are rejected until the daily quota resets. There's no overage billing on Spark since no billing account is attached — the app simply stops being able to perform that operation until the next reset.

**Does Blaze mean I automatically get billed?**

No. Blaze includes the same no-cost quotas as Spark for most services. You're only billed for usage above those free thresholds, so a small app can run on Blaze and still cost nothing most months.

**Is Firebase Authentication free on the Spark plan?**

Email/password and most OAuth providers are free with no cap. Phone (SMS) authentication has a limited free monthly allowance that varies by country, after which each verification is billed.
