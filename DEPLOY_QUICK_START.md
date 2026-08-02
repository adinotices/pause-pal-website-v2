# 🚀 Quick Start: Deploy PausePal to Production

**TL;DR** — Set up automated deployment in 10 minutes:

## 1. Create Fly.io App (5 minutes)

```bash
# Install CLI
curl https://fly.io/install.sh | sh

# Login & create app
fly auth login
cd app
fly launch
# Choose: pausepal-app, sjc region, YES for Postgres, development size
```

## 2. Add GitHub Secret (2 minutes)

```bash
# Create deploy token
fly tokens create deploy
# Copy the output

# Go to GitHub → Settings → Secrets → New secret
# Name: FLY_API_TOKEN
# Value: <paste the token>
```

## 3. Add Environment Variables (2 minutes)

```bash
# Set database URL (from fly launch output)
fly secrets set DATABASE_URL=postgres://...

# Set required secrets
fly secrets set \
  RESEND_API_KEY=re_xxxxx \
  NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  NEXTAUTH_URL=https://pausepal-app.fly.dev

# Optional: Add Zoom/Google Calendar if configured
fly secrets set ZOOM_CLIENT_ID=xxx ZOOM_CLIENT_SECRET=xxx
```

## 4. Deploy (1 minute)

```bash
git add .github/workflows/deploy-app.yml app/fly.toml
git commit -m "Enable Fly.io deployment"
git push origin main
# → Automatic deployment starts!
```

## 5. Verify (1 minute)

```bash
# Check status
fly status

# View logs
fly logs

# Test the app
open https://pausepal-app.fly.dev/admin
```

## ✅ Done!

Your app now deploys automatically on every push to main:
- Code pushed → GitHub Actions builds & deploys → Database migrations run → App live
- Reminders run automatically every day at 6 AM UTC
- Database backed up automatically

## Need Help?

See **FLY_SETUP.md** for detailed setup, troubleshooting, and customization.

## Key Files

- `.github/workflows/deploy-app.yml` — Automated deployment workflow
- `app/fly.toml` — Fly.io configuration (resource specs, cron jobs)
- `FLY_SETUP.md` — Complete setup guide with troubleshooting
