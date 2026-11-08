# Web UI screenshots (synthetic fixtures)

This directory contains viewport screenshots of the real Diarium web UI, captured from the app’s actual components in a local Next.js development server; no screens were assembled or painted as mockups.

## Screenshots

| Scene | Viewport | File |
|---|---:|---|
| Overview — desktop | 1440 × 1375 | [01-overview-desktop.png](01-overview-desktop.png) |
| Overview — mobile | 390 × 1024 | [02-overview-mobile.png](02-overview-mobile.png) |
| Today / check-in — mobile | 390 × 1100 | [03-today-mobile.png](03-today-mobile.png) |
| History calendar — desktop | 1280 × 1024 | [04-history-desktop.png](04-history-desktop.png) |
| Statistics → Year in Pixels — desktop | 1280 × 1470 | [05-year-in-pixels-desktop.png](05-year-in-pixels-desktop.png) |
| About — mobile | 390 × 720 | [06-about-mobile.png](06-about-mobile.png) |

All captures use English and the dark theme. Mobile dimensions were emulated in Chromium with device metrics enabled; desktop captures used desktop metrics. Each PNG is a browser viewport capture, not a fabricated illustration or a full-page render.

## How these were generated

1. A temporary test-only page at `src/app/docs-screenshot/page.tsx` created a local synthetic user in browser storage and rendered the real `AppShell`, using the production navigation parser and components. It did not contain screenshot-specific copies of the UI.
2. A temporary fixture service at `/root/.hermes/profiles/coding/cache/scratch/diarium-web-screenshot-mock.py` listened only on `127.0.0.1:54321`. It returned synthetic auth and Supabase REST responses. The Next.js development server ran on `127.0.0.1:3112` with `NEXT_PUBLIC_FEATURES=core`, and `NEXT_PUBLIC_SUPABASE_URL` pointed at the local fixture service. The auth token/key used for this local mock was synthetic and was not a production credential.
3. The mock used one synthetic account (`Synthetic Demo`, `synthetic-data@example.invalid`, UUID `00000000-0000-4000-8000-000000000001`) and 48 deterministic 2026 entries: four dates per month from January through October, plus November 1–8. Moods, activities, generic notes, habits, one weekly walking goal, and two scales were generated from fixed fixture values. Photos, AI reflections, screen-time values, and unlock counts were absent. No real account, production Supabase service, or personal journal data was used.
4. Browser automation opened the `/docs-screenshot` route with the query values listed below, waited for fixture-backed UI text, selected the real **Pixels** tab for the Year in Pixels capture, and saved the displayed viewport as a PNG at the listed dimensions. The Next.js development-only `nextjs-portal` indicator was removed from the browser DOM before capture; no application UI styles or content were altered.
5. After capture, the temporary route, local fixture service script, and local servers were removed/stopped. Only the screenshots and this documentation were retained; the temporary generator is not part of the repository.

| File | Route and interaction |
|---|---|
| `01-overview-desktop.png`, `02-overview-mobile.png` | `/docs-screenshot?lang=en&view=overview` |
| `03-today-mobile.png` | `/docs-screenshot?lang=en&view=today&edit=2026-11-08` |
| `04-history-desktop.png` | `/docs-screenshot?lang=en&view=history` |
| `05-year-in-pixels-desktop.png` | `/docs-screenshot?lang=en&view=stats`, then select **Pixels** |
| `06-about-mobile.png` | `/docs-screenshot?lang=en&sub=about` |

## Limitations

- These are selected first-viewport scenes, not a full responsive test, full-page capture, or assertion of production data. The fixture set ends on November 8, 2026; the Year in Pixels screenshot shows January–June, while later months continue below the viewport.
- The app’s real fixed bottom navigation remains visible. At the viewport edge it partially covers the next section in the Overview, Today, and Year in Pixels captures; the main content described by each scene remains above the fold. The About capture keeps the parity and web-only copy unobscured; lower About content continues below it.
- Only English, dark mode, these viewport sizes, and the local synthetic account were captured. Authentication, live synchronization, real photos, device permissions, Android-only behavior, light mode, other browsers, and other viewport sizes were not exercised.
- Fixture-derived summaries are illustrative only and must not be treated as expected production statistics. To regenerate them, recreate a temporary local-only fixture server and harness; never point the capture flow at a production or personal account.
