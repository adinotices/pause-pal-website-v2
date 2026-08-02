# Fly.io Deployment Setup Guide

This guide walks you through setting up automated deployment for PausePal app to Fly.io with a managed PostgreSQL database.

## Prerequisites

- GitHub account with admin access to this repo
- Fly.io account (free tier available at https://fly.io)
- Fly CLI installed locally (`curl https://fly.io/install.sh | sh`)

## Step 1: Create Fly.io Account & Project

```bash
# Login to Fly
fly auth login

# Create the app (from repo root)
cd app
fly launch

# When prompted:
# - App name: pausepal-app (or your preferred name)
# - Region: sjc (San Jose) or closest to your users
# - Would you like to set up a Postgres database? → YES
# - Select development (smallest/cheapest) for now
# - Enable Redis? → NO
```

This creates:
- Fly.io app named `pausepal-app`
- Managed PostgreSQL database (3 shared CPUs, 1GB RAM)
- `fly.toml` config (already in the repo)

## Step 2: Configure Environment Variables

Add secrets to your Fly app:

```bash
fly secrets set \
  DATABASE_URL=<postgres-connection-string> \
  RESEND_API_KEY=<your-resend-key> \
  NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  NEXTAUTH_URL=https://pausepal-app.fly.dev

# Optional: Zoom integration
# fly secrets set ZOOM_CLIENT_ID=<...> ZOOM_CLIENT_SECRET=<...>

# Optional: Google Calendar integration  
# fly secrets set GOOGLE_CALENDAR_CLIENT_ID=<...> GOOGLE_CALENDAR_CLIENT_SECRET=<...>
```

Find `DATABASE_URL` from:
```bash
fly postgres connect
# In psql: SELECT current_database();
# Connection string format: postgres://user:pass@host/dbname
fly apps info pausepal-app
```

Or get it directly:
```bash
fly postgres users create pausepal --admin
# This creates user and outputs the full connection string
```

## Step 3: Add GitHub Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions

Add secret:
- **Name:** `FLY_API_TOKEN`
- **Value:** (from `fly tokens create deploy`)

```bash
# Generate the token
fly tokens create deploy
# Copy the output and paste into GitHub secret
```

## Step 4: Test Deployment Locally

Before pushing to main, test the workflow:

```bash
# Build the Docker image (Fly will do this on deploy)
fly build

# Test migration script
fly ssh console
# Inside console:
cd /app
npm run drizzle:migrate
exit
```

## Step 5: Enable Automated Deployment

Push the workflow files to main:

```bash
git add .github/workflows/deploy-app.yml app/fly.toml FLY_SETUP.md
git commit -m "Add Fly.io deployment configuration"
git push origin main
```

This triggers the GitHub Actions workflow which will:
1. Deploy app to Fly.io
2. Run database migrations
3. Verify deployment health
4. Run scheduled reminder cron job every day at 6 AM UTC

## Step 6: Verify Deployment

Check deployment status:

```bash
# View logs
fly logs

# Check app status
fly status

# SSH into the instance
fly ssh console

# Test the app
curl https://pausepal-app.fly.dev/admin
```

## Monitoring & Troubleshooting

### View logs
```bash
fly logs --follow
```

### Check scheduled jobs
```bash
fly ssh console
# Inside console:
curl http://localhost:3000/api/cron/reminders
```

### Scale up if needed
```bash
fly scale vm shared-cpu-2x
fly scale count 2  # Multiple instances behind load balancer
```

### Database backups
```bash
# Fly Postgres auto-backs up, but you can also:
fly postgres backup
```

### Common issues

**"DATABASE_URL not found"**
- Check secrets were set: `fly secrets list`
- Verify database is running: `fly postgres status`

**"Migration failed"**
- SSH into app: `fly ssh console`
- Run manually: `cd /app && npm run drizzle:migrate`
- Check schema: `fly postgres connect`

**"Cron job not running"**
- Verify endpoint exists: `curl https://pausepal-app.fly.dev/api/cron/reminders`
- Check logs: `fly logs | grep "reminders"`

## Customization

### Change deployment region
Edit `fly.toml`:
```toml
primary_region = "lhr"  # London, Ireland, Frankfurt, etc.
```
Then redeploy: `fly deploy`

### Adjust instance size
```bash
fly scale vm shared-cpu-1x  # Smaller
fly scale vm shared-cpu-2x  # Larger
fly scale vm dedicated-cpu  # High performance
```

### Enable horizontal scaling
```bash
fly scale count 2  # Run 2 instances (costs 2x)
```

## Rollback Deployment

If something breaks:

```bash
# View deployment history
fly releases

# Rollback to previous version
fly releases rollback
```

## Cleanup (if needed)

```bash
# Destroy everything
fly destroy pausepal-app

# Or keep the database, just remove the app
fly apps destroy pausepal-app
```

## Next Steps

1. Test the deployed app at https://pausepal-app.fly.dev
2. Run through signup → matching → scheduling → dashboard flow
3. Verify reminders send at scheduled time
4. Monitor logs for 24 hours after first deployment

---

**Deployment**: Automatic on every push to `main`  
**Scheduled Jobs**: Daily at 6 AM UTC (edit `fly.toml` `[[crons]]` section to change)  
**Database**: Managed PostgreSQL, auto-backed up daily  
**Cost**: ~$5-10/month (depending on usage)
