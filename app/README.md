# PausePal app (`app.pausepal.co`)

This is the PausePal application: cohort signups, matching, and (eventually)
automated scheduling. It's a separate Next.js app from the static marketing
site at the repo root (`index.html`, deployed to `pausepal.co` via GitHub
Pages) — this one deploys independently to Vercel at `app.pausepal.co`.

**Phase 1 scope** (current): signup form + database + a password-protected
admin list view, replacing the old Formbricks form. Matching and
Zoom/Calendar automation are later phases — see the architecture discussion
in the repo history / project notes for the full roadmap.

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript
- Tailwind CSS v4
- Postgres via [Drizzle ORM](https://orm.drizzle.team/)
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

   This runs the migration in `drizzle/0000_workable_champions.sql` against
   `DATABASE_URL`. If you change `lib/db/schema.ts`, generate a new
   migration with `npx drizzle-kit generate` before running `migrate` again.

5. **Open a cohort for signups.** There's no seed script — use the admin
   UI. Start the dev server, log into `/admin` with `ADMIN_PASSWORD`, and
   use the "Open a new cohort" form. Signups only work while a cohort is in
   the `open` state; `/signup` shows a "signups are closed" message
   otherwise.

6. **Run the dev server**

   ```bash
   npm run dev
   ```

   - `/` — landing page
   - `/signup` — the multi-step signup form (availability, preferences, commitment)
   - `/admin` — cohort management + signup list (password-protected)
   - `/admin/export?cohort=N` — CSV export of a cohort's signups

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

- **Matching engine** — Phase 2. The admin view is read-only/manual for now.
- **Zoom + Google Calendar automation** — Phase 3.
- **Participant-facing dashboard, reminder emails, feedback/testimonials** — Phase 4.
- **Cohort auto-close / scheduled jobs** — cohorts are opened and closed
  manually from `/admin` for now.
