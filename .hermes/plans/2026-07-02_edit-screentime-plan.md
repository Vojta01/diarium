# Diarium — Editace & Screen Time Plan

> **Goal:** Průběžné ukládání během dne + načítání existujících záznamů + screen time vizualizace.

**Architecture:** 
- `loadTodayEntry()` v github.ts načte existující daily note → předvyplní stav
- `savePartialCheckIn()` ukládá průběžně s debounce 2s
- Step indicator se stane klikacím → volná navigace
- Screen time graf v dashboardu čte `phone_screen_time` z YAML

---

### Task 1: loadTodayEntry + savePartialCheckIn v github.ts

Do `src/lib/github.ts` přidat:

- `loadTodayEntry(token, repo): Promise<CheckInData | null>` — fetchem daily/{today}.md, naparsuje YAML
- `savePartialCheckIn(token, repo, data): Promise<void>` — stejné jako saveCheckIn ale s prefixem "✏️"

---

### Task 2: Auto-load + auto-save v page.tsx

- `useEffect` při mountu zavolá `loadTodayEntry`, pokud vrátí data → předvyplní state + nastaví `isExisting = true`
- Každá změna dat → `useEffect` s debounce 2s zavolá `savePartialCheckIn`
- Header ukazuje "Pokračuješ v dnešním zápise" nebo "Nový zápis"
- Step indicator: zelené tečky = krok má data (umožňuje kliknutí)

---

### Task 3: Volná navigace mezi kroky

- Step indicator tečky jsou tlačítka → `onClick={() => setStep(i)}`
- Aktivní tečka = aktuální krok, zelená = hotovo, šedá = prázdné

---

### Task 4: Editace z kalendáře

- CalendarView: tlačítko "Upravit" v day detailu → `onEdit(entry)` callback
- StatsDashboard: při kliknutí na "Upravit" přepne na check-in view s předvyplněnými daty pro daný den

---

### Task 5: Screen time graf

- Nový `ScreenTimeChart` — čte `phone_screen_time` z entries
- Sloupcový graf za posledních 30 dní
- Barevné pásmo: zelená (<2h), oranžová (2-4h), červená (>4h)
- Přidat jako třetí tab do StatsDashboard

---

### Task 6: Build & deploy
