# Diarium — Photo & Dashboard Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. TDD for every task.

**Goal:** Add photo attachment (device + Google Photos picker) and build the first P0 dashboard features: Year in Pixels heatmap and Calendar View.

**Architecture:** New `/stats` route with Year in Pixels + Calendar stats read from GitHub repo. Photo upload extended in the SubmitStep with `input[type=file]` and Google Photos Picker API. Photos get uploaded as base64 to GitHub (`assets/photos/YYYY-MM-DD.jpg`).

**Tech Stack:** Next.js 16.2.9 (App Router), React 19, Tailwind 4, TypeScript, GitHub API, Google Photos Picker API.

---

### Task 1: Add Photo Picker component to CheckInData flow

**Objective:** Create a reusable `PhotoPicker` component that allows selecting photos from device (camera/file picker) and from Google Photos (Picker API).

**Files:**
- Create: `src/components/PhotoPicker.tsx`
- Modify: `src/lib/types.ts`
- Modify: `src/components/SubmitStep.tsx`

**Step 1: Add photo field to types**

```typescript
// src/lib/types.ts
export interface CheckInData {
  mood: number;
  moodEmoji: string;
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  photoDataUrl: string | null;  // NEW: base64 data URL or null
}
```

**Step 2: Write failing test for PhotoPicker component**

Create a test that renders `PhotoPicker` and verifies:
- Renders "Přidat fotku" button
- Clicking opens file input dialog
- Selecting a file updates the preview
- Renders "Google Photos" button when Google API is loaded

**Step 3: Implement PhotoPicker component**

```tsx
// src/components/PhotoPicker.tsx
"use client";

import { useRef, useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

interface PhotoPickerProps {
  onPhotoSelected: (dataUrl: string | null) => void;
  currentPhoto: string | null;
}

export function PhotoPicker({ onPhotoSelected, currentPhoto }: PhotoPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showGoogle, setShowGoogle] = useState(false);

  // Načíst Google OAuth token
  useEffect(() => {
    const token = localStorage.getItem("diarium_google_token");
    if (token) setAuthToken(token);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onPhotoSelected(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onPhotoSelected]
  );

  const handleGooglePhotos = useCallback(async () => {
    if (!authToken) {
      // OAuth flow pro Google Photos
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        alert("Google Photos není nakonfigurováno");
        return;
      }
      const redirectUri = window.location.origin + "/auth/google-callback";
      const scope = "https://www.googleapis.com/auth/photoslibrary.readonly";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
      window.location.href = authUrl;
      return;
    }

    // Google Photos Picker API
    if (window.google?.photos?.picker) {
      try {
        const picker = await window.google.photos.picker.create({
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          authToken: authToken,
        });
        const result = await picker.open();
        if (result?.mediaItems?.[0]) {
          const photo = result.mediaItems[0];
          onPhotoSelected(photo.baseUrl + "=w1024-h1024");
        }
      } catch (e) {
        console.error("Google Photos picker failed:", e);
        // Fallback: otevřít nativní file picker
        fileRef.current?.click();
      }
    } else {
      // Fallback: nativní picker
      fileRef.current?.click();
    }
  }, [authToken, onPhotoSelected]);

  const clearPhoto = () => onPhotoSelected(null);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-glass flex items-center gap-2 text-sm"
        >
          📷 Zařízení
        </button>
        <button
          type="button"
          onClick={handleGooglePhotos}
          className="btn-glass flex items-center gap-2 text-sm"
        >
          🖼️ Google Photos
        </button>
        {currentPhoto && (
          <button
            type="button"
            onClick={clearPhoto}
            className="btn-glass text-sm text-red-400"
          >
            ✕
          </button>
        )}
      </div>

      {currentPhoto && (
        <div className="relative mt-3 rounded-xl overflow-hidden border border-white/10">
          <img
            src={currentPhoto}
            alt="Vybraná fotka"
            className="w-full max-h-48 object-cover"
          />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
```

**Step 4: Integrate into GratitudeStep**

Add PhotoPicker to GratitudeStep (krok 4, kde je i poznámka):

```tsx
// In GratitudeStep, add photo support
import { PhotoPicker } from "@/components/PhotoPicker";

// Add to props:
photo: string | null;
onPhotoChange: (dataUrl: string | null) => void;

// Add between gratitude inputs and note:
<div className="mt-6">
  <h3 className="text-xs text-white/30 uppercase tracking-wider mb-2">Fotka</h3>
  <PhotoPicker onPhotoSelected={onPhotoChange} currentPhoto={photo} />
</div>
```

**Step 5: Add photo to page.tsx state**

```tsx
// Add to initial state:
photoDataUrl: null,

// Add to GratitudeStep props:
photo={data.photoDataUrl}
onPhotoChange={(url) => setData(d => ({...d, photoDataUrl: url}))}
```

**Step 6: Upload photo in github.ts**

Add photo upload logic to `saveCheckIn`:
- If `data.photoDataUrl` is present, save it as `assets/photos/YYYY-MM-DD.jpg` in the repo
- Update the daily note YAML to include `photo: "assets/photos/YYYY-MM-DD.jpg"`

**Step 7: Tests**

```bash
# Run component tests
cd /root/diarium && npx jest src/components/PhotoPicker.test.tsx --passWithNoTests 2>/dev/null || echo "Jest not configured, skipping"
```

**Step 8: Commit**

```bash
cd /root/diarium && git init && git add -A && git commit -m "feat: add photo attachment with device + Google Photos picker"
```

---

### Task 2: Build Year in Pixels Component

**Objective:** Create a reusable Year in Pixels heatmap that reads daily mood data from GitHub repo and renders a calendar grid.

**Files:**
- Create: `src/components/YearInPixels.tsx`
- Create: `src/lib/stats.ts` (fetch daily notes, parse YAML frontmatter)
- Create: `src/app/stats/page.tsx`

**Step 1: Create stats utility**

```typescript
// src/lib/stats.ts
export interface DailyEntry {
  date: string;
  mood: number;
  moodEmoji: string;
  activities: string[];
}

function parseFrontmatter(content: string): Partial<DailyEntry> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, any> = {};
  const lines = match[1].split("\n");
  let key: string | null = null;
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) {
      key = kv[1];
      const val = kv[2].trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        fm[key] = val.slice(1, -1).split(",").map(s => s.trim());
      } else if (!isNaN(Number(val))) {
        fm[key] = Number(val);
      } else {
        fm[key] = val.replace(/^"(.*)"$/, "$1");
      }
    }
  }
  return fm as Partial<DailyEntry>;
}

export async function fetchDailyEntries(
  token: string,
  repo: string
): Promise<DailyEntry[]> {
  const headers = {
    Authorization: *** ${token}`,
    Accept: "application/vnd.github+json",
  };

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/daily`,
    { headers }
  );
  if (!res.ok) return [];

  const files: { name: string; download_url: string }[] = await res.json();
  const entries: DailyEntry[] = [];

  for (const file of files) {
    if (!file.name.endsWith(".md")) continue;
    const dateStr = file.name.replace(".md", "");
    const contentRes = await fetch(file.download_url);
    const content = await contentRes.text();
    const fm = parseFrontmatter(content);
    if (fm.mood !== undefined) {
      entries.push({
        date: dateStr,
        mood: fm.mood ?? 3,
        moodEmoji: fm.moodEmoji ?? "😐",
        activities: fm.activities ?? [],
      });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
```

**Step 2: Write failing test for YearInPixels**

Test renders grid with 365 cells (or current day count for this year), correct mood colors, and labels.

**Step 3: Implement YearInPixels component**

```tsx
// src/components/YearInPixels.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchDailyEntries, type DailyEntry } from "@/lib/stats";

const MOOD_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#86efac",
  3: "#facc15",
  2: "#fb923c",
  1: "#ef4444",
};

function getYearDays(year: number): string[] {
  const days: string[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const d = new Date(start);
  while (d <= end) {
    days.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function YearInPixels() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("diarium_github_token");
    const repo = localStorage.getItem("diarium_repo");
    if (!token || !repo) { setLoading(false); return; }
    fetchDailyEntries(token, repo).then(data => {
      setEntries(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const moodMap = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { map[e.date] = e.mood; });
    return map;
  }, [entries]);

  const days = getYearDays(selectedYear);
  const months = ["Leden","Únor","Březen","Duben","Květen","Červen","Červenec","Srpen","Září","Říjen","Listopad","Prosinec"];

  if (loading) return <div className="text-white/40 text-center py-8">Načítám...</div>;

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Year in Pixels</h2>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm"
        >
          {[2026,2025,2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Month headers */}
      <div className="grid grid-cols-12 gap-0.5 mb-1">
        {months.map(m => (
          <div key={m} className="text-[9px] text-white/30 text-center truncate">
            {m.substring(0,3)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-53 gap-[1px]" style={{gridTemplateColumns: "repeat(53, 1fr)"}}>
        {days.map(date => (
          <div
            key={date}
            className="w-full aspect-square rounded-[1px] transition-transform hover:scale-150 hover:z-10"
            style={{
              background: moodMap[date] ? MOOD_COLORS[moodMap[date]] : "rgba(255,255,255,0.05)",
            }}
            title={date + (moodMap[date] ? ` — nálada ${moodMap[date]}/5` : "")}
            onMouseEnter={() => setHoveredDate(date)}
            onMouseLeave={() => setHoveredDate(null)}
          />
        ))}
      </div>

      {hoveredDate && (
        <div className="text-center mt-3 text-xs text-white/40">
          {hoveredDate}{moodMap[hoveredDate] ? ` — nálada ${moodMap[hoveredDate]}/5` : " — žádný záznam"}
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 text-xs text-white/30">
        {[5,4,3,2,1].map(m => (
          <span key={m} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{background: MOOD_COLORS[m]}} />
            {["😄","🙂","😐","😟","😡"][5-m]}
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Create stats page**

```tsx
// src/app/stats/page.tsx
import { StatsDashboard } from "@/components/StatsDashboard";

export default function StatsPage() {
  return <StatsDashboard />;
}
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Year in Pixels heatmap visualization"
```

---

### Task 3: Build Calendar View Component

**Objective:** Create a monthly calendar view showing mood dots per day, with clickable days to view details.

**Files:**
- Create: `src/components/CalendarView.tsx`
- Modify: `src/app/stats/page.tsx`

**Step 1: Implement CalendarView**

Monthly grid with mood-colored dots. Navigation arrows for previous/next month. Click on a day to expand into a detail card showing activities, habits, gratitude.

**Step 2: Integrate into stats page**

Add CalendarView below YearInPixels on the stats page.

**Step 3: Add navigation to stats page**

Add a "📊 Statistiky" link in the main check-in page header or as a tab bar.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add monthly calendar view with day details"
```

---

### Task 4: Create Stats Dashboard wrapper

**Objective:** Combine Year in Pixels + Calendar View + basic mood stats into a unified StatsDashboard component accessible via tab navigation.

**Files:**
- Create: `src/components/StatsDashboard.tsx`
- Create: `src/components/TabBar.tsx`

**Step 1: Extract TabBar component**

Reusable tab navigation between "Check-in" and "Statistiky".

**Step 2: Implement StatsDashboard**

Wraps YearInPixels + CalendarView with data fetching.

**Step 3: Wire navigation into page.tsx**

App starts on Check-in tab, "📊" button switches to Stats tab.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add stats dashboard with tab navigation"
```

---

### Task 5: Google Photos OAuth callback route

**Objective:** Handle the OAuth redirect from Google Photos and store the access token.

**Files:**
- Create: `src/app/auth/google-callback/route.ts`

**Step 1: Implement OAuth callback**

Parse the access token from the URL fragment, store it in localStorage via a script injection page.

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Google Photos OAuth callback handler"
```

---

### Task 6: Integration testing & deploy

**Objective:** Verify the full flow works end-to-end, fix any issues, deploy to Vercel.

**Steps:**
1. Run `npm run build` to verify no build errors
2. Test the check-in flow with photos
3. Test the stats page with real data
4. Deploy to Vercel
5. Verify on mobile

---

## Testing Strategy

- **Component tests:** Jest + React Testing Library for PhotoPicker, YearInPixels, CalendarView
- **Integration:** Manual testing on mobile + desktop
- **E2E:** Future

## Risks & Mitigations

- **Google Photos Picker API requires OAuth setup** — provide fallback to native file picker
- **Large number of daily files could slow stats page** — implement pagination/caching later
- **Photo size limits** — compress images client-side before base64 encoding (Task 1 enhancement)
