# PausePal app (`app.pausepal.co`)

This is the PausePal application: cohort signups, matching, and (eventually)
automated scheduling. It's a separate Next.js app from the static marketing
site at the repo root (`index.html`, deployed to `pausepal.co` via GitHub
Pages) — this one deploys independently to Vercel at `app.pausepal.co`.

**Phase 1** (done): signup form + database + a password-protected admin
list view, replacing the old Formbricks form.

**Phase 2** (done): the matching engine — see "Matching engine" below.

**Phase 3** (done): Zoom + Google Calendar scheduling automation on
approved matches — see "Scheduling engine" below. **Unverified against
live Zoom/Google accounts** — built against their documented APIs and
covered by unit tests for everything that doesn't require real
credentials, but nobody has run it against a real Zoom/Google account yet.
Run it once for real before trusting it with an actual cohort.

**Phase 4** (done): participant magic-link login + dashboard, feedback
collection with admin-moderated public testimonials, and reminder emails
on a scheduled job — see "Participant accounts", "Feedback &
testimonials", and "Reminder emails" below. Like Phase 3's Zoom/Calendar
integrations, actual email delivery (magic links, reminders) is
**unverified against a live Resend account** — the send path degrades to
logging the email content to the console without one, which is how it's
been tested so far.

Phase 0 (the marketing site itself) is a separate, independent piece --
see the repo root README, not this one.

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript
- Tailwind CSS v4
- Postgres via [Drizzle ORM](https://orm.drizzle.team/)
- [`edmonds-blossom`](https://www.npmjs.com/package/edmonds-blossom) for
  weighted general-graph matching (see below)
- [Vitest](https://vitest.dev/) for the matching engine's unit tests
- Deploys to Vercel

> **Note on Next.js 16:** this version renamed `middleware.ts` to
> `proxy.ts` (see `proxy.ts` at the app root, which gates `/admin/*`
> behind the session cookie). If something in this app looks off compared
> to older Next.js knowledge, check `node_modules/next/dist/docs/` before
> assuming it's a bug — several conventions changed in v16.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Get a Postgres database.** For local dev, either:
   - Use a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project (recommended — same as prod), or
   - Run Postgres locally (e.g. `apt install postgresql` / `brew install postgresql`) and create a database.

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in:
   - `DATABASE_URL` — your Postgres connection string. If using Neon or
     Supabase, use the **pooled** connection string (transaction pooler /
     pgbouncer) — the DB client is already configured with `prepare: false`
     to support this.
   - `ADMIN_PASSWORD` — the shared password for `/admin`. Phase 1 has a
     single admin user, so this is a plain shared secret rather than a full
     auth system.
   - `ADMIN_SESSION_SECRET` — random string used to sign the admin session
     cookie. Generate one with `openssl rand -hex 32`.
   - `PARTICIPANT_SESSION_SECRET` — same idea, for participant magic-link
     sessions. Deliberately a separate secret from the admin one.
   - `APP_URL` — this app's own URL, used to build absolute links in
     emails. Defaults to `http://localhost:3000`.

4. **Apply the database schema**

   ```bash
   npx drizzle-kit migrate
   ```

   This runs the migrations in `drizzle/*.sql` against `DATABASE_URL`. If
   you change `lib/db/schema.ts`, generate a new migration with
   `npx drizzle-kit generate` before running `migrate` again.

5. **Open a cohort for signups.** There's no seed script — use the admin
   UI. Start the dev server, log into `/admin` with `ADMIN_PASSWORD`, and
   use the "Open a new cohort" form. Signups only work while a cohort is in
   the `open` state; `/signup` shows a "signups are closed" message
   otherwise. A cohort also needs a start date before matching will run
   (see "Matching engine" below).

6. **Run the dev server**

   ```bash
   npm run dev
   ```

   - `/` — landing page
   - `/signup` — the multi-step signup form (availability, preferences, commitment)
   - `/admin` — cohort management + signup list (password-protected)
   - `/admin/export?cohort=N` — CSV export of a cohort's signups
   - `/admin/matching?cohort=N` — generate/review/approve proposed matches
   - `/admin/scheduling?cohort=N` — preview computed session times, then send
   - `/admin/testimonials` — moderate and publish participant feedback
   - `/login` → `/dashboard` — participant magic-link sign-in and dashboard
   - `/feedback` — participant-facing feedback form (requires sign-in)

7. **Run the tests**

   ```bash
   npm test
   ```

   Covers everything that's pure logic worth pinning down: the matching
   engine (`lib/matching/`), the scheduling engine (`lib/scheduling/`),
   the Zoom/Calendar request payloads and JWT signing
   (`lib/integrations/`), and the participant session cookie
   (`lib/participant-auth.ts`). Nothing else in the app has meaningful
   non-UI/non-DB logic to unit test -- the DB-touching and UI-touching
   paths have instead been exercised end-to-end against a real Postgres DB
   and (for the browser-facing flows) a real headless browser session
   during development, not via an automated E2E suite in this repo yet.

## Deploying

1. **Vercel project**: import this repo into Vercel, and set the **Root
   Directory** to `app/` in the project settings (this repo also contains
   the unrelated static site at its root, which Vercel should ignore).
2. **Environment variables**: set `DATABASE_URL`, `ADMIN_PASSWORD`,
   `ADMIN_SESSION_SECRET`, `PARTICIPANT_SESSION_SECRET`, and `APP_URL`
   (your real `app.pausepal.co` URL) in the Vercel project settings
   (Production and Preview). The Zoom/Google/Resend/`CRON_SECRET` vars
   from `.env.example` are optional — see "Scheduling engine" and
   "Reminder emails" below for how to set those up when you're ready.
3. **Database**: point `DATABASE_URL` at your production Neon/Supabase
   instance. Run `npx drizzle-kit migrate` against it (locally, with
   `DATABASE_URL` set to the prod connection string) before or right after
   the first deploy.
4. **DNS**: add `app.pausepal.co` as a domain in the Vercel project, then
   add the CNAME record it gives you wherever `pausepal.co`'s DNS is
   managed. This does not touch the existing `pausepal.co` GitHub Pages
   setup at the repo root.
5. **Cron**: `vercel.json` at the app root declares the daily reminders
   job (`/api/cron/reminders`) -- Vercel picks this up automatically on
   deploy. Set `CRON_SECRET` (Vercel project settings) so the route can
   verify requests are actually from Vercel Cron and not the open
   internet; see "Reminder emails" below.

## Matching engine

`lib/matching/` is pure, DB-free logic (see the tests in
`lib/matching/__tests__/`); `lib/db/matching-queries.ts` wires it to
Postgres and `app/admin/matching/` is the review UI.

- **Timezone resolution is per-cohort, not "now".** Availability is stored
  in each person's own local time (day-of-week + minute-of-day, from
  Phase 1). To compare two people's schedules, `lib/matching/tz.ts`
  resolves each person's UTC offset **on the cohort's actual start date**
  and `lib/matching/availability.ts` projects everyone's weekly slots onto
  one shared timeline from there. Resolving against the real start date
  (not today) is what makes this correct across a DST transition instead
  of merely correct today.
- **Solver**: `lib/matching/solve.ts` builds a weighted edge for every pair
  that clears the hard constraints (real overlapping time, and any stated
  hard gender requirement), then runs
  [`edmonds-blossom`](https://www.npmjs.com/package/edmonds-blossom) — a
  ported, test-verified implementation of Galil's weighted general-graph
  matching algorithm — with `maxCardinality: true`, so it prioritizes
  matching as many people as possible over squeezing out a slightly higher
  total score. If the candidate count is odd, the leftover person is
  folded into whichever existing pair makes the best *feasible* trio (real
  three-way overlap, not just pairwise); if no trio works, they're
  surfaced as unmatched rather than force-fit.
- **Scoring weights** live in `WEIGHTS` at the top of
  `lib/matching/compatibility.ts` — overlap adequacy, session length/
  frequency closeness, experience level, timezone proximity, a gender
  soft-preference bonus/penalty, and a repeat-pairing penalty (keyed by
  `personId` so it holds across cohorts, since `signupId` is a fresh row
  every cohort). These are the levers to retune if real matches don't feel
  right — nothing else needs to change to adjust them.
- **Gender matching** (`lib/matching/gender.ts`) treats identity/preference
  as free text normalized into a few broad buckets on a best-effort basis.
  A *hard* requirement that can't be confidently verified (e.g. the other
  person's identity is blank, or the text doesn't parse) is treated as
  **not** satisfied — a false block is a minor annoyance, silently
  ignoring someone's stated requirement is not. Negated phrasings ("not a
  man", "anyone but women") are detected specifically, because the
  substring fallback reads them exactly backwards otherwise.
- **Admin workflow** (`/admin/matching?cohort=N`): "Generate proposals"
  runs the solver and stores the result as `proposed` matches. Regenerating
  deletes and replaces every proposed match *except* pinned ones, so you
  can lock in a pairing you like and keep iterating on the rest. "Approve
  all" finalizes every proposed match (`status → approved`, member signups
  → `matched`, cohort → `matched`) — approved matches are permanent and
  untouched by future regeneration.

## Scheduling engine

`lib/scheduling/` is pure logic (tested); `lib/integrations/` talks to
Zoom and Google Calendar; `lib/db/scheduling-queries.ts` wires it together;
`/admin/scheduling` is the review UI.

- **Picking session times** (`lib/scheduling/pick-sessions.ts`): re-derives
  the same weekly overlap the matching engine found for a match (there's no
  persisted "the overlap was X" record -- it's cheap to rederive and keeps
  one source of truth) and greedily picks one session per distinct
  available day before ever repeating a day, up to however many
  sessions/week the pair agreed to.
- **Real calendar dates, still DST-safe** (`lib/scheduling/instants.ts`):
  a chosen weekly slot is still in the matching engine's canonical
  UTC-equivalent timeline, not a real date. `firstOccurrenceUTC` anchors it
  to the cohort's actual `startsOn` date -- the first occurrence always
  lands on or within 6 days after the cohort starts, never before. Later
  weekly occurrences are handled by Google Calendar's own RRULE, not by us
  computing 4 separate dates.
- **One Zoom meeting per match, reused for the whole program**
  (`lib/integrations/zoom.ts`): a Server-to-Server OAuth app (no per-user
  consent flow, since nobody's available to click through one for a server
  automation) creates one recurring, no-fixed-time meeting -- a single
  stable link for all of a match's sessions.
- **Calendar invites via a service account, not user OAuth**
  (`lib/integrations/google-calendar.ts`): same reasoning as Zoom -- no
  interactive consent flow. A Google Cloud service account is shared onto
  the target calendar, authenticates itself with a signed JWT, and creates
  one `RRULE:FREQ=WEEKLY;COUNT=N` event per weekly session with both
  members as attendees (`sendUpdates=all`) and the Zoom link in the
  description/location.
- **Preview before send, always.** `/admin/scheduling` always shows what
  the computed times *would* be, converted into **each member's own local
  time** (`lib/time.ts`'s `formatInstantForTimezone`) -- this is the human
  gate against sending someone a 5am invite, and it's read-only: no
  external API calls happen until you explicitly click send.
- **Idempotent, resumable sending**
  (`lib/db/scheduling-queries.ts#sendScheduleForCohort`): every external
  side effect is gated on DB state that's checked before acting, so
  retrying after a partial failure never double-books. A match already
  marked `scheduledAt` is skipped outright -- confirmed by re-invoking the
  send path a second time and checking no new session rows or Zoom/Calendar
  calls happen. If Zoom succeeded but Calendar then threw, re-running
  reuses the existing Zoom meeting rather than creating a second one, and
  only retries Calendar. If neither Zoom nor Google is configured, sending
  still computes and stores the session times (useful on its own -- you
  can see the schedule and send it manually) and simply skips the external
  calls.

### Setting up Zoom (optional)

1. In the [Zoom App Marketplace](https://marketplace.zoom.us/), **Develop
   → Build App → Server-to-Server OAuth**.
2. Add the `meeting:write:admin` (or `meeting:write`) scope, then activate
   the app.
3. Copy the Account ID, Client ID, and Client Secret into `ZOOM_ACCOUNT_ID`
   / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET`.
4. Set `ZOOM_HOST_EMAIL` to a licensed Zoom user on that account (e.g.
   `hello@pausepal.co`) -- created meetings belong to this user.

### Setting up Google Calendar (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/), enable the
   Calendar API for a project, then create a **Service Account** (IAM &
   Admin → Service Accounts) and generate a JSON key for it.
2. From that JSON key: `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (paste as-is; the
   JSON already escapes its newlines as `\n`, which is what this app
   expects).
3. In the actual Google Calendar UI, share the target calendar (e.g.
   `hello@pausepal.co`'s calendar, or a dedicated calendar) with the
   service account's email, granting **"Make changes to events"**.
4. Set `GOOGLE_CALENDAR_ID` to that calendar's ID (Calendar Settings →
   that calendar → "Integrate calendar" → Calendar ID).

## Participant accounts

Participants (not admins) sign in via magic link, not a password --
`lib/participant-auth.ts` (session cookie), `lib/db/auth-queries.ts`
(token issuance/consumption), `app/login/`, `app/auth/verify/route.ts`,
`app/dashboard/`.

- **Tokens are hashed at rest.** `createMagicLinkToken` returns the raw
  token (emailed once, never persisted) and stores only its SHA-256 hash,
  the same principle as a password hash -- a DB read alone can't be used
  to sign in as anyone. Tokens expire after 30 minutes and are marked
  consumed on first use (`consumeMagicLinkToken`), so a link can't be
  reused, including by an email client that prefetches links.
- **No email enumeration.** `/login` always shows the same "check your
  email" response whether or not the address matched a real person --
  `requestMagicLinkAction` only branches internally.
- **A separate session cookie and secret from admin.** `proxy.ts` gates
  `/admin/*` against the admin cookie and `/dashboard/*` +
  `/feedback/*` against the participant cookie, independently -- an admin
  session can't be replayed as a participant session or vice versa, even
  in principle, since they're signed with different secrets
  (`ADMIN_SESSION_SECRET` vs `PARTICIPANT_SESSION_SECRET`).
- **Dashboard shows your most relevant signup, not just your latest one**
  (`lib/db/participant-queries.ts`): a `matched` signup is preferred over
  a merely `submitted` one even if the submitted one is more recent --
  someone who's matched in an active cohort came here to see that, not
  "your signup is in" for a newer cohort they also happen to be in the
  pool for. Caught by testing against a person who legitimately had
  signups in two cohorts at once, one matched and one not.
- **Absolute link generation never trusts the request's Host header**
  (`lib/site-url.ts`) -- only a fixed `APP_URL` env var. Building an
  emailed link from a client-supplied header would let someone get
  PausePal to email a real user a link pointing at an attacker-controlled
  domain.

## Feedback & testimonials

`lib/db/feedback-queries.ts`; participant-facing form at `app/feedback/`;
admin moderation at `/admin/testimonials`; public read API at
`/api/testimonials`.

- Feedback is scoped to a **signup** (one cohort's participation), not the
  person overall -- `feedback.signup_id` is unique, so re-submitting the
  form for the same cohort updates rather than duplicates, and someone
  doing a second cohort later gets a fresh feedback prompt for that one.
- **Consent to publish is not the same as being published.** Checking the
  box just makes the feedback eligible for an admin to curate at
  `/admin/testimonials` -- set a display name (there's no last name
  collected anywhere in this app, so the suggested default is just their
  first name; admins can edit it to whatever attribution they want, e.g.
  "D. Kim") and explicitly publish before it's public.
- `/api/testimonials` is intentionally open (`Access-Control-Allow-Origin:
  *`, no auth) -- it only ever returns admin-published, consented
  testimonials, which is exactly the content Phase 0's marketing site
  fetches client-side to replace/extend its hardcoded testimonial list.

## Reminder emails

`lib/db/reminder-queries.ts` + `lib/email/`; triggered by
`/api/cron/reminders`, declared in `vercel.json` (daily).

- Three kinds, each independently idempotent: a session reminder the day
  before each weekly occurrence (computed via
  `lib/scheduling/instants.ts`'s `allOccurrences`, so this correctly
  covers week 2, 3, 4... of a recurring session, not just its first
  occurrence), a "your cohort starts tomorrow" nudge, and a feedback
  request the day after a cohort ends.
- **Idempotency is a DB constraint, not an in-memory check** --
  `sent_reminders` has a unique index on `(kind, reference_id,
  occurrence_date)`, and every send goes through `INSERT ... ON CONFLICT
  DO NOTHING`, checking whether the insert actually happened before
  emailing anyone. This makes it safe for the cron route to be invoked
  more than once for the same day (retries, manual re-triggers) without
  double-emailing -- verified directly against the DB by invoking each
  reminder function twice for the same date and confirming zero emails
  sent (and zero new `sent_reminders` rows) the second time.
- The route itself is protected by `CRON_SECRET`
  (`app/api/cron/reminders/route.ts`) using [Vercel's documented
  pattern](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
  -- Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
  once the var is set. The check is skipped in local dev when
  `CRON_SECRET` isn't set, so you can hit the route directly while
  testing; verified that unset/wrong secrets get `401` and the correct
  one gets `200` once `CRON_SECRET` is configured.

## Data model notes

- **Availability is stored in local time**, not UTC — day-of-week +
  minute-of-day, tagged with the person's IANA timezone (e.g.
  `America/New_York`). This is deliberate: a fixed UTC offset captured at
  signup time silently drifts by an hour if a cohort's 4 weeks cross a DST
  transition. See `lib/time.ts` and `lib/db/schema.ts` for details.
- **Re-submitting the signup form for the same email + cohort replaces**
  the previous submission (old availability/preferences are deleted, a new
  signup row is created) rather than erroring or duplicating.
- Gender identity and partner gender preference are free text, not a fixed
  enum, with a separate "is this a hard requirement" flag. This is meant to
  keep matching in Phase 2 flexible (soft-constraint by default) rather
  than assuming a fixed set of categories.

## What's deliberately not here yet

- **Cohort auto-close** — cohorts are opened and closed manually from
  `/admin` for now (the reminder cron job doesn't do this).
- **Un-approving a match, rescheduling, or handling drop-outs mid-cohort** —
  not built yet. Right now the only way back is direct DB access.
- **Live verification of the Zoom/Google/Resend integrations** — see the
  Phase 3 and Phase 4 notes at the top of this file. All three are
  implemented against documented APIs and covered by unit tests for
  everything that doesn't require real credentials, but none have been
  exercised against a live account.
- **Automated end-to-end tests** — every flow in this app (signup,
  matching, scheduling, participant login, feedback) has been manually
  verified against a real Postgres DB and a real headless browser session
  during development, but none of that is captured as a repeatable test
  suite in this repo yet. If this app keeps growing, that's the next
  investment worth making.
