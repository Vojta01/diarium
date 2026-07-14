<div align="center">

  <!-- Project Hero -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://placehold.co/1200x300/0a0a14/ffffff?text=📓+Diarium&font=source-sans-pro">
    <img alt="Diarium — Daily mood & diary tracker" src="https://placehold.co/1200x300/ffffff/0a0a14?text=📓+Diarium&font=source-sans-pro" width="100%">
  </picture>

  <h1>📓 Diarium</h1>
  <p><strong>Your daily mood & diary companion — AI-powered, PWA-first, built with Next.js 16</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#project-structure">Structure</a>
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16">
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
    <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
    <img src="https://img.shields.io/badge/Upstash_Redis-00E9A3?style=for-the-badge&logo=upstash&logoColor=white" alt="Upstash Redis">
    <img src="https://img.shields.io/badge/DeepSeek-4F6BED?style=for-the-badge&logo=deepseek&logoColor=white" alt="DeepSeek AI">
    <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
    <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
  </p>

  <p>
    <img src="https://img.shields.io/github/license/vojtaid/diarium?style=flat-square" alt="MIT License">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
  </p>

</div>

---

## ✨ Overview

**Diarium** is a modern, privacy-respecting daily journaling and mood-tracking progressive web app (PWA). It makes checking in on your mental health effortless — rate your mood, log activities and habits, store photos, and receive AI-generated reflections that help you spot patterns over time.

Built for anyone who wants to understand their emotional well-being through data, Diarium combines the simplicity of a daily diary with the analytical power of AI — all wrapped in an installable, offline-capable PWA.

> **Portfolio note:** This project demonstrates full-stack Next.js development — Supabase Auth & Storage, push notifications, cron jobs, PWA service workers, AI integration, and feature-flag-driven architecture.

---

<a name="features"></a>

## 🚀 Key Features

| Area | Feature |
|------|---------|
| **📝 Daily Check-in** | One-page form for mood (1–5), stress, sleep quality, activities, habits, gratitude entries, notes, and optional photo upload |
| **📊 Dashboard** | Streak counter, weekly mood trend, last 7 days at a glance with emoji row |
| **📅 Stats & Analytics** | Calendar heatmap, **Year in Pixels**, screen-time charts, activity–mood correlations |
| **🤖 AI Reflections** | Daily DeepSeek-powered reflections based on your last 7 days of entries |
| **📄 AI Reports** | Weekly, monthly & yearly AI-generated summaries delivered to your inbox |
| **🔔 Push Notifications** | Daily reminder via Web Push (VAPID) — powered by Upstash Redis + Vercel Cron |
| **📸 Photo Storage** | Diary photos uploaded to Supabase Storage with client-side preview |
| **📱 PWA** | Install on homescreen, works offline, service worker with cache-first strategy |
| **🔐 Google OAuth** | Seamless authentication via Supabase Auth + Google provider |
| **🎛️ Feature Flags** | `core` mode for portfolio; `personal` mode unlocks screen-time and sensitive habits |

---

<a name="tech-stack"></a>

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **UI Library** | [React 19](https://react.dev) |
| **Language** | [TypeScript](https://www.typescriptlang.org) (strict mode) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) |
| **Database & Auth** | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage) |
| **Push Storage** | [Upstash Redis](https://upstash.com) |
| **AI** | [DeepSeek API](https://deepseek.com) (chat completions) |
| **Push Protocol** | [web-push](https://github.com/web-push-libs/web-push) (VAPID) |
| **Hosting** | [Vercel](https://vercel.com) (with Cron Jobs) |
| **Linting** | ESLint 9 + `eslint-config-next` |

---

<a name="architecture"></a>

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                     │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Dashboard  │  │ Check-In │  │ Stats &      │  │ AI Reports  │  │
│  │ Page       │  │ Form     │  │ Analytics    │  │ Page        │  │
│  └─────┬──────┘  └────┬─────┘  └──────┬───────┘  └──────┬──────┘  │
│        └───────────────┴──────────────┴─────────────────┘          │
│                            │                                       │
│                    ┌───────┴────────┐                              │
│                    │ Supabase JS    │                              │
│                    │ Client (anon)  │                              │
│                    └───────┬────────┘                              │
│                            │                                       │
└────────────────────────────┼───────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                   ▼
┌────────────────────┐ ┌──────────┐ ┌──────────────────────┐
│  Next.js API       │ │Supabase  │ │  Service Worker      │
│  Routes            │ │Auth      │ │  (offline cache)     │
│                    │ │(Google   │ │                      │
│  /api/save-entry   │ │ OAuth)   │ │  Cache-first:        │
│  /api/ai/reflect   │ │          │ │  /, /stats, static   │
│  /api/ai/reports   │ │ cookies  │ │                      │
│  /api/ai/periodic  │ │ ↔ JWT   │ └──────────────────────┘
│  /api/push/*       │ │          │
│  /api/cron/*       │ └──────────┘
│                    │
│  (server-side,     │
│   service_role key)│
└────────┬───────────┘
         │
         ├─────────────────────┬────────────────────┐
         ▼                     ▼                    ▼
┌────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│  Supabase      │ │  Upstash Redis     │ │  DeepSeek API      │
│  PostgreSQL    │ │                    │ │                    │
│  ┌────────┐   │ │  Push subscription │ │  Chat completions  │
│  │entries │   │ │  storage by userId  │ │  endpoint          │
│  │habits  │   │ │                    │ │                    │
│  │activities│  │ │  GET /keys/user:*  │ │  POST /v1/chat/    │
│  │ai_reports│  │ │  SET /keys/user:*  │ │  completions       │
│  └────────┘   │ │  DELETE /keys/*     │ │                    │
│               │ │                    │ │  Model: deepseek-  │
│  ┌────────┐   │ │  Used by:          │ │  chat / deepseek-  │
│  │ Storage │   │ │  /api/push/send   │ │  reasoner          │
│  │ diary-  │   │ │                    │ │                    │
│  │ photos  │   │ │  Vercel Cron       │ │  Prompt: 7-day     │
│  └────────┘   │ │  (daily 19:00 UTC)  │ │  history context   │
│               │ └────────────────────┘ └────────────────────┘
│  RLS policies  │
│  per-user data │
└────────────────┘
```

### Data Flow

1. **User authenticates** via Google OAuth → Supabase Auth issues JWT → stored in cookies + localStorage
2. **Daily check-in** data is written client-side via the Supabase JS client (RLS-protected), or server-side via `/api/save-entry`
3. **Dashboard & stats** read from `entries` table, aggregated client-side in `@/lib/stats.ts`
4. **AI reflection** (`/api/ai/reflect`) fetches last 7 days with the `service_role` key, sends to DeepSeek, returns a markdown-formatted insight
5. **AI reports** (`/api/cron/ai-report`) runs on Vercel Cron (daily), generates periodic summaries, stores in `ai_reports` table
6. **Push notifications** (`/api/push/send`) queries Upstash Redis for active subscriptions, sends VAPID-signed pushes daily at 19:00 UTC

---

## 📸 Screenshots

> *Screenshots coming soon — replace these placeholders with your own images.*

| | | |
|:---:|:---:|:---:|
| **Daily Check-in** | **Dashboard** | **Stats & Analytics** |
| ![Check-in](https://placehold.co/400x800/0a0a14/ffffff?text=Check-In+Form) | ![Dashboard](https://placehold.co/400x800/0a0a14/ffffff?text=Dashboard) | ![Stats](https://placehold.co/400x800/0a0a14/ffffff?text=Stats) |
| **Year In Pixels** | **AI Reflection** | **Calendar View** |
| ![Year in Pixels](https://placehold.co/400x800/0a0a14/ffffff?text=Year+In+Pixels) | ![AI Reflection](https://placehold.co/400x800/0a0a14/ffffff?text=AI+Reflection) | ![Calendar](https://placehold.co/400x800/0a0a14/ffffff?text=Calendar+View) |

---

<a name="getting-started"></a>

## 🧪 Getting Started

### Prerequisites

- **Node.js** 20+ (or Bun — any runtime Next.js supports)
- A **Supabase project** ([free tier](https://supabase.com) works great)
- A **DeepSeek API key** ([platform.deepseek.com](https://platform.deepseek.com))
- (Optional) An **Upstash Redis** instance for push notifications
- (Optional) **VAPID keys** generated via `npx web-push generate-vapid-keys`

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/diarium.git
cd diarium

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Fill in your .env.local (see Environment Variables table below)
#    At minimum: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEEPSEEK_API_KEY

# 5. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be prompted to sign in with Google.

> **Database setup:** Diarium expects a `public.entries` table, an `ai_reports` table, and storage buckets for photos. Run the schema migrations under `supabase/` if present, or create them manually in the Supabase dashboard. The app also seeds default activities and habits on first use via `/api/seed-activities` and `/api/seed-habits`.

---

<a name="env-vars"></a>

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL (e.g. `https://abc123.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key (safe for client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase `service_role` key for server-side API routes — **keep secret** |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API key for AI reflections and reports |
| `VAPID_PRIVATE_KEY` | ⚠️ | VAPID private key for Web Push notifications (required for push) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⚠️ | VAPID public key shared with clients (built-in default if omitted) |
| `VAPID_EMAIL` | ⚠️ | Contact email for VAPID push details (e.g. `mailto:you@example.com`) |
| `UPSTASH_REDIS_REST_URL` | ⚠️ | Upstash Redis REST URL for storing push subscriptions |
| `UPSTASH_REDIS_REST_TOKEN` | ⚠️ | Upstash Redis REST token |
| `CRON_SECRET` | ⚠️ | Secret to authenticate Vercel Cron Job requests |
| `NEXT_PUBLIC_FEATURES` | ❌ | Comma-separated feature flags (defaults to `core`) |

> 📄 See [`.env.example`](./.env.example) for a complete template with annotations.

---

<a name="deployment"></a>

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Setting Up Cron Jobs

Diarium includes a daily push notification via Vercel Cron. The schedule is defined in [`vercel.json`](./vercel.json):

```json
{
  "crons": [
    {
      "path": "/api/push/send",
      "schedule": "0 19 * * *"
    }
  ]
}
```

This runs every day at 19:00 UTC. Make sure these env vars are set in your Vercel project:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DEEPSEEK_API_KEY
vercel env add CRON_SECRET
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add VAPID_PRIVATE_KEY
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY
vercel env add VAPID_EMAIL
```

> **Important:** Set `NEXT_PUBLIC_FEATURES=core` in production to keep the portfolio-facing version clean.

---

<a name="project-structure"></a>

## 📁 Project Structure

```
diarium/
├── public/                          # Static assets & PWA files
│   ├── sw.js                        # Service worker (cache-first)
│   ├── manifest.json                # PWA manifest
│   ├── icon-192.png                 # PWA icon (192×192)
│   ├── icon-512.png                 # PWA icon (512×512)
│   └── icon-512-maskable.png        # Maskable PWA icon
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (PWA meta, SW registration)
│   │   ├── globals.css              # Tailwind CSS global styles
│   │   ├── page.tsx                 # Main page (dashboard + check-in)
│   │   ├── favicon.ico
│   │   ├── middleware.ts            # Supabase auth middleware (session refresh)
│   │   │
│   │   ├── stats/
│   │   │   └── page.tsx             # Stats & analytics page
│   │   │
│   │   ├── auth/
│   │   │   ├── callback/page.tsx    # Supabase auth callback handler
│   │   │   └── google-callback/page.tsx  # Google OAuth callback
│   │   │
│   │   └── api/
│   │       ├── save-entry/route.ts      # POST daily entry
│   │       ├── manage-activities/route.ts  # CRUD activities
│   │       ├── manage-habits/route.ts       # CRUD habits
│   │       ├── seed-activities/route.ts     # Seed default activities
│   │       ├── seed-habits/route.ts         # Seed default habits
│   │       ├── fix-vojta-habits/route.ts    # Migration helper
│   │       │
│   │       ├── ai/
│   │       │   ├── reflect/route.ts    # Daily AI reflection (7-day context)
│   │       │   ├── reports/route.ts    # On-demand AI reports
│   │       │   └── periodic/route.ts   # Periodic AI summary
│   │       │
│   │       ├── push/
│   │       │   ├── subscribe/route.ts      # POST push subscription
│   │       │   ├── send/route.ts           # Send push notifications
│   │       │   └── vapid-public-key/route.ts  # GET VAPID public key
│   │       │
│   │       └── cron/
│   │           └── ai-report/route.ts  # Vercel Cron: generate AI reports
│   │
│   ├── components/
│   │   ├── AuthScreen.tsx             # Google OAuth sign-in
│   │   ├── Dashboard.tsx              # Main dashboard (streak, mood, emoji row)
│   │   ├── OnePageCheckIn.tsx         # Daily check-in form
│   │   ├── StatsDashboard.tsx         # Stats container
│   │   ├── CalendarView.tsx           # Calendar heatmap
│   │   ├── YearInPixels.tsx           # Year-in-Pixels grid
│   │   ├── ActivityMoodChart.tsx      # Activity↔mood correlation chart
│   │   ├── ScreenTimeChart.tsx        # Screen time tracking chart
│   │   ├── PeriodicSummary.tsx        # AI summary display
│   │   ├── PhotoPicker.tsx            # Photo upload + preview
│   │   ├── PushNotificationManager.tsx # Push subscription UI
│   │   ├── Markdown.tsx              # Markdown renderer (for AI output)
│   │   └── UpdatePrompt.tsx          # PWA update notification
│   │
│   └── lib/
│       ├── types.ts                   # CheckInData type definition
│       ├── feature-flags.ts           # Feature flag system
│       ├── stats.ts                   # Stats aggregation (mood colors, fetch)
│       ├── redis.ts                   # Upstash Redis client
│       ├── vapid.ts                   # VAPID push helper
│       ├── supabase-ref.ts           # Auth token key helpers
│       └── supabase/
│           ├── client.ts             # Supabase browser client
│           └── db.ts                 # Supabase server-side client
│
├── vercel.json                        # Vercel config + cron schedule
├── next.config.ts                     # Next.js configuration
├── postcss.config.mjs                 # PostCSS config (Tailwind 4)
├── tailwind.config.ts                 # Tailwind CSS configuration
├── tsconfig.json                      # TypeScript strict mode config
├── eslint.config.mjs                  # ESLint flat config
├── .env.example                       # Environment variable template
└── package.json                       # Dependencies & scripts
```

---

<a name="feature-flags"></a>

## 🎛️ Feature Flags

Diarium uses an environment-variable-driven feature flag system to distinguish between a clean **portfolio demo** and the developer's **personal full-featured version**.

| Flag Mode | `NEXT_PUBLIC_FEATURES` | Enabled Features |
|-----------|------------------------|------------------|
| **`core`** (default) | `core` or unset | Mood tracking, check-in, dashboard, stats, calendar, Year in Pixels, AI reflections & reports, habits (non-sensitive), PWA, push notifications |
| **`personal`** | `personal` | Everything in `core` + screen time charts, phone unlock metrics, sensitive habit tracking (e.g. `porno`, `masturbace`), Home Assistant integration |

**How it works:** The [`getFeatureFlags()`](./src/lib/feature-flags.ts) function parses `NEXT_PUBLIC_FEATURES` at runtime. When set to `personal`, flags like `screenTime`, `homeAssistant`, `phoneUnlocks`, and `habitTracking` become `true`. Components use these flags to conditionally render features:

```ts
const flags = getFeatureFlags();
if (flags.screenTime) {
  return <ScreenTimeChart data={entries} />;
}
```

This keeps the demo clean while allowing the full personal setup on a separate deployment with `NEXT_PUBLIC_FEATURES=personal`.

---

## 🤝 Contributing

Contributions are welcome! This project was built as a portfolio piece, but there's always room for improvement:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feat/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feat/amazing-feature`)
5. **Open** a Pull Request

### Suggested improvements

- [ ] End-to-end tests (Playwright or Cypress)
- [ ] Dark/light theme toggle
- [ ] Export data as CSV/PDF
- [ ] Multi-language support
- [ ] Weekly email digest
- [ ] Better offline fallback pages
- [ ] Desktop PWA (wider layout for tablets)

> Please use [Conventional Commits](https://www.conventionalcommits.org) for commit messages.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

---

<div align="center">
  <p>
    Built with ❤️ using <a href="https://nextjs.org">Next.js</a>,
    <a href="https://supabase.com">Supabase</a>,
    and <a href="https://deepseek.com">DeepSeek</a>
  </p>
  <p>
    <sub>If you like this project, consider ⭐ starring the repo!</sub>
  </p>
</div>
