# Web ↔ Android feature comparison

This matrix compares the web implementation in this repository with the separately maintained [native Android project](https://github.com/Vojta01/diarium-android). Web details are checked against the current source here; Android details use that project's public README and the current platform notes in the web app. Confirm release-specific details in the Android repository because it evolves independently.

| Area | Web app | Native Android |
|---|---|---|
| Platform | Next.js 16 installable PWA | Kotlin/Jetpack Compose app; not a WebView wrapper |
| Sign-in and account | Google sign-in through Supabase Auth; web uses the Diarium Supabase account | Google login to the Diarium account; journal data syncs to the account |
| Check-in | Mood, stress, sleep, activities, habits, gratitude, notes, weather, custom scales and photos | Mood, activities and habits; optional stress, sleep, gratitude and notes; scales, templates and photos |
| History and analysis | Dashboard, history/calendar, Year in Pixels, goals, achievements, mood/activity/habit analysis and photo gallery | Mood trends, activity/habit correlations, screen-time insights and yearly pixel calendar |
| Phone usage data | Does not collect device usage. In `personal` mode it can display phone-usage data synced from Android. | Reads usage statistics on-device through `UsageStatsManager`; Usage Access permission is required for those statistics. |
| AI reflections/reports | Daily reflection and on-demand weekly, monthly and yearly summaries use server-side DeepSeek routes. | The Android app can schedule weekly/monthly report requests locally. Android also has an encrypted, device-local BYOK AI-key option; the web app has no BYOK setting. |
| Notifications and scheduling | Browser Web Push can deliver messages to subscribed browsers, but the web app does not schedule reminders. | Schedules reminders and screen-time sync locally; weekly/monthly report requests can run on a local schedule. |
| Export | CSV plus a reduced-summary PDF. The CSV compatibility test checks the Android column order and formatting. | CSV export; the web test documents and checks its compatibility format. |
| Photos | Browser camera/file selection and Supabase Storage upload. No Google Photos picker is implemented. | The native project lists photos as a check-in feature; see its repository for storage details. |
| Profile and first-run setup | Google account sign-in; no web profile form or four-step onboarding flow. | Profile and first-run onboarding are Android-only; the name and birth year are kept on the phone according to the app's platform notes. |

## Web-specific behavior

- `NEXT_PUBLIC_FEATURES` defaults to `core`. Setting it to `personal` enables the web-only display flags for synced screen time, phone unlocks and sensitive habits; it does not make the browser collect phone-usage data. See [`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts).
- The web service worker uses a network-first strategy for GET requests, with a timeout and cache fallback. It does not provide an offline write queue.
- Web Push is a delivery mechanism, not a reminder scheduler. The web UI lets users manage a browser subscription; `vercel.json` currently declares no scheduled jobs.
- The web PDF is explicitly a reduced summary; do not describe it as a full journal backup. CSV is available separately.

## Source references

- [Android app README](https://github.com/Vojta01/diarium-android) — current native-app requirements and feature overview.
- [`tests/export-csv-parity.test.ts`](../tests/export-csv-parity.test.ts) — web CSV header/order and formatting compatibility checks.
- [`src/components/checkin/sections/PhotoSection.tsx`](../src/components/checkin/sections/PhotoSection.tsx) — web camera/gallery file selection and upload behavior.
- [`src/components/settings/NativeOnlyCard.tsx`](../src/components/settings/NativeOnlyCard.tsx) — platform-specific features the web app does not provide.
- [`src/components/settings/NotificationsCard.tsx`](../src/components/settings/NotificationsCard.tsx) — web push subscription behavior and lack of a web scheduler.

## Rendered web screenshots

See [English web UI screenshots](screenshots/web/README.md) for desktop and mobile captures rendered from the app's actual components with synthetic local fixtures. The linked page documents the capture method, seed-data scope, and viewport limitations.
