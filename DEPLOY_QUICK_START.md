# 🚀 Quick Start: Deploy PausePal to Vercel

The app already ships with `app/vercel.json` (configures the daily reminders
cron at 13:00 UTC). This guide connects the repo to Vercel so every push to
`main` deploys automatically — no CI workflow file needed, Vercel watches
the repo directly via its GitHub integration.

## 1. Import the project (5 minutes)

1. Go to https://vercel.com/new
2. Click **Import Git Repository** and select `adinotices/pause-pal-website-v2`
3. When asked for the **Root Directory**, set it to `app` — the Next.js app
   lives in `app/`, not the repo root (the repo root is the separate static
   marketing site deployed to GitHub Pages)
4. Framework Preset should auto-detect as **Next.js**
5. Leave build/output settings as default (`npm run build`, `.next`)

## 2. Add environment variables (5 minutes)

In the Vercel project → **Settings → Environment Variables**, add (for
Production, and Preview if you want PR previews to work):

- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — shared password for `/admin` login (pick your own)
- `ADMIN_SESSION_SECRET` — random secret for admin session cookies (`openssl rand -hex 32`)
- `PARTICIPANT_SESSION_SECRET` — random secret for participant (magic-link) session cookies, must differ from the one above (`openssl rand -hex 32`)
- `APP_URL` — your production URL, e.g. `https://app.pausepal.co` (used to build absolute links in emails)
- `RESEND_API_KEY` — for sending email
- `RESEND_FROM_EMAIL` — e.g. `PausePal <hello@pausepal.co>`
- `CRON_SECRET` — random secret (`openssl rand -hex 32`) that verifies `/api/cron/reminders` requests actually come from Vercel Cron

Optional, only if those integrations are enabled:
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`

See `app/.env.example` for the full list with comments on each.

## 3. Deploy

Click **Deploy**. Vercel builds and deploys immediately, and from now on:

- Every push to `main` → automatic production deployment
- Every PR → automatic preview deployment with its own URL
- The cron in `app/vercel.json` (`/api/cron/reminders` daily at 13:00 UTC)
  activates automatically once the project is on a plan that supports
  Vercel Cron (Hobby plan allows 1 cron job, which is exactly what this
  needs)

## 4. Run the database migration

Vercel doesn't run migrations for you. From your machine, pointed at the
production database:

```bash
cd app
DATABASE_URL=<production-connection-string> npx drizzle-kit migrate
```

Do this once after the first deploy, and again after any future PR that
adds a new migration file under `app/drizzle/`.

## 5. Point the domain

If `app.pausepal.co` should serve this app:
Vercel project → **Settings → Domains** → add `app.pausepal.co` → follow
the DNS instructions Vercel shows (usually a CNAME record).

## 6. Verify

- Visit `<your-url>/api/health` → should return `{"status":"ok","database":"connected"}`
- Visit the deployed URL → `/admin` should load
- Submit a test signup → confirm it lands in the database
- Check **Vercel → Project → Cron Jobs** shows the reminders job registered

## Ongoing workflow

Once connected, there's nothing else to run — merge to `main`, Vercel
deploys. The only manual step is applying new database migrations after
a deploy that includes one (step 4).
