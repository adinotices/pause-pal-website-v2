# PausePal app (`app.pausepal.co`)

This is the PausePal application: cohort signups, matching, and (eventually)
automated scheduling. It's a separate Next.js app from the static marketing
site at the repo root (`index.html`, deployed to `pausepal.co` via GitHub
Pages) — this one deploys independently to Vercel at `app.pausepal.co`.

**Phase 1** (done): signup form + database + a password-protected admin
list view, replacing the old Formbricks form.

**Phase 2** (done): the matching engine — see "Matching engine" below.
Zoom/Calendar automation (Phase 3) and the participant-facing dashboard
(Phase 4) are still ahead — see the architecture discussion in the repo
history / project notes for the full roadmap.

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

7. **Run the tests**

   ```bash
   npm test
   ```

   Covers the matching engine only (`lib/matching/**/*.test.ts`) — it's the
   part with real logic worth pinning down (timezone/DST math, weekly
   overlap with wraparound, the blossom solver, the odd-person-out trio
   fallback). Nothing else in the app has meaningful non-UI logic to test
   yet.

## Deploying

1. **Vercel project**: import this repo into Vercel, and set the **Root
   Directory** to `app/` in the project settings (this repo also contains
   the unrelated static site at its root, which Vercel should ignore).
2. **Environment variables**: set `DATABASE_URL`, `ADMIN_PASSWORD`, and
   `ADMIN_SESSION_SECRET` in the Vercel project settings (Production and
   Preview).
3. **Database**: point `DATABASE_URL` at your production Neon/Supabase
   instance. Run `npx drizzle-kit migrate` against it (locally, with
   `DATABASE_URL` set to the prod connection string) before or right after
   the first deploy.
4. **DNS**: add `app.pausepal.co` as a domain in the Vercel project, then
   add the CNAME record it gives you wherever `pausepal.co`'s DNS is
   managed. This does not touch the existing `pausepal.co` GitHub Pages
   setup at the repo root.

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
  ignoring someone's stated requirement is not.
- **Admin workflow** (`/admin/matching?cohort=N`): "Generate proposals"
  runs the solver and stores the result as `proposed` matches. Regenerating
  deletes and replaces every proposed match *except* pinned ones, so you
  can lock in a pairing you like and keep iterating on the rest. "Approve
  all" finalizes every proposed match (`status → approved`, member signups
  → `matched`, cohort → `matched`) — approved matches are permanent and
  untouched by future regeneration.

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

- **Zoom + Google Calendar automation** — Phase 3. Approving matches
  finalizes pairings but doesn't create meetings or send invites yet.
- **Participant-facing dashboard, reminder emails, feedback/testimonials** — Phase 4.
- **Cohort auto-close / scheduled jobs** — cohorts are opened and closed
  manually from `/admin` for now.
- **Un-approving a match / handling drop-outs mid-cohort** — not built yet.
  Right now the only way back is direct DB access.
