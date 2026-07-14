# GitHub Actions Workflows — Diarium Cron Jobs

This directory contains GitHub Actions workflows that replace Vercel Cron jobs
for generating AI reports. Vercel's Hobby plan is limited to a single cron job,
so the daily push notification cron stays on Vercel while the AI report generation
moves to GitHub Actions (free, unlimited scheduled runs).

## Workflows

| Workflow | File | Schedule | Description |
|---|---|---|---|
| **AI Report - Weekly** | `ai-report-weekly.yml` | Every Sunday at 20:00 UTC | Generates weekly AI summaries for all users with entries |
| **AI Report - Monthly** | `ai-report-monthly.yml` | 1st of each month at 08:00 UTC | Generates monthly AI summaries for all users with entries |

Both workflows also support manual trigger via the **Run workflow** button in the
GitHub Actions UI, useful for testing or on-demand report generation.

## Required GitHub Secrets

These must be configured in your repository's **Settings → Secrets and variables → Actions**.

### `DIARIUM_URL`

The base URL of your deployed Diarium application. Works with both Vercel
deployment URLs and custom domains.

```
https://diarium-two.vercel.app
```

or

```
https://diarium.digitalni-vedomi.cz
```

### `CRON_SECRET`

The same secret token used by the `/api/cron/ai-report` endpoint for authentication.
This must match the `CRON_SECRET` environment variable configured in your Vercel
project settings.

## How to Configure

1. Go to your GitHub repository: **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add `DIARIUM_URL` with your app's base URL (no trailing slash)
4. Add `CRON_SECRET` with the same value as in your Vercel environment variables
5. Verify the workflows appear under the **Actions** tab of your repository

## Verification

To test that everything works:

1. Go to the **Actions** tab in your GitHub repository
2. Select **AI Report - Weekly** (or **AI Report - Monthly**) from the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Check the workflow run logs to confirm the API call succeeded

## Vercel Cron Remaining

The Vercel `vercel.json` still handles one cron job (the daily push notification):

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/push/send` | Daily at 19:00 UTC | Send push notifications |
