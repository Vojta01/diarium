# Diarium — Code Review & Documentation

## 📋 Rychlý přehled

Diarium je denní check-in aplikace (PWA) umožňující uživatelům zaznamenávat náladu, aktivity, návyky, vděčnost a poznámky. Data se ukládají do Supabase (PostgreSQL), autentizace přes Google OAuth. Aplikace nabízí AI reflexi dne (DeepSeek), push notifikace, statistiky a kalendář.

- **URL:** https://diarium-two.vercel.app
- **Stack:** Next.js 16 (Turbopack), React 19, TypeScript, Tailwind v4, Supabase
- **AI:** DeepSeek V4 Pro / DeepSeek Chat
- **Hosting:** Vercel
- **DB:** Supabase PostgreSQL (project: `YOUR_PROJECT_REF`)

---

## 🏗️ Architektura

```
┌──────────────────────────────────────────────────────────┐
│                    UŽIVATEL (Browser)                     │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │  Login   │  │  Check-in  │  │  Statistiky          │ │
│  │ (Google  │  │ OnePage    │  │ (Grafy, Kalendář,    │ │
│  │  OAuth)  │  │ CheckIn    │  │  Year in Pixels)     │ │
│  └────┬─────┘  └─────┬──────┘  └──────────┬───────────┘ │
│       │              │                     │             │
│       │    localStorage (auth token)       │             │
│       └──────────────┼─────────────────────┘             │
└──────────────────────┼───────────────────────────────────┘
                       │
              ┌────────┴────────┐
              │   VERCEL CDN    │
              │  (Next.js 16)   │
              └────────┬────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
  ┌────┴────┐   ┌──────┴──────┐  ┌────┴─────┐
  │Supabase │   │  DeepSeek   │  │  Web     │
  │  (DB +  │   │    AI       │  │  Push    │
  │  Auth)  │   │  Reflexe    │  │  (VAPID) │
  └─────────┘   └─────────────┘  └──────────┘
```

### Endpointy (API Routes)

| Cesta | Metoda | Popis |
|-------|--------|-------|
| `/api/save-entry` | POST | Uloží/updatuje záznam (service_role key) |
| `/api/ai/reflect` | POST | AI reflexe dne (DeepSeek) |
| `/api/ai/periodic` | GET | Týdenní/měsíční/roční AI souhrny |
| `/api/manage-activities` | POST | Přidat/odebrat/obnovit aktivitu |
| `/api/manage-habits` | POST | Přidat/odebrat návyk |
| `/api/seed-activities` | POST | Seed 46 výchozích aktivit do DB |
| `/api/seed-habits` | POST | Seed výchozích návyků (jen alkohol) |
| `/api/fix-vojta-habits` | GET | Debug/fix pro Vojtovy návyky |
| `/api/push/subscribe` | POST | Registrace push notifikace |
| `/api/push/send` | POST | Odeslání push notifikace |
| `/api/push/vapid-public-key` | GET | VAPID veřejný klíč |

### Databázové tabulky

| Tabulka | Popis |
|---------|-------|
| `profiles` | Uživatelské profily (napojeno na auth.users) |
| `entries` | Denní záznamy (nálada, aktivity, návyky, vděčnost) |
| `activity_catalog` | 46 výchozích aktivit v 7 kategoriích |
| `habit_catalog` | Výchozí návyky (jen alkohol) |
| `user_activities` | Uživatelské aktivity (vlastní + skryté) |
| `user_habits` | Uživatelské návyky (vlastní + skryté) |

### Kategorie aktivit (46 položek)

- **Společenské** — Rodina, Přátelé, Rande, Párty, Office
- **Záliby** — Filmy/TV, Čtení, Hraní her, Sport, Relax, Hudba
- **Jídlo** — Zdravě, Fast food, Domácí výroba, Restaurace, Donáška, Bez masa, Bez sladkostí, Bez limonád
- **Zdraví** — Trénink, Voda, Chůze, Kolo, Plavání, Paddleboard, Snooker
- **Mé lepší já** — Meditace, Laskavost, Naslouchání, Dárcovství, Dárek, Terapie, Integrita
- **Domácí práce** — Nákup, Úklid, Vaření, Praní, Žehlení
- **Počasí** — Slunečno, Zataženo, Déšť, Sníh, Mráz, Horko, Bouřka, Vítr

---

## 🔍 Code Review — Nálezy

### 🔴 Mrtvý kód (doporučeno smazat)

| Soubor | Důvod |
|--------|-------|
| `src/lib/github.ts` (386 řádků) | Původní GitHub/Obsidian sync — nahrazen Supabase |
| `src/components/SetupScreen.tsx` | GitHub token setup — nahrazen AuthScreen (Google OAuth) |
| `src/components/MoodStep.tsx` | Starý multi-step wizard — nahrazen OnePageCheckIn |
| `src/components/ActivityStep.tsx` | Starý multi-step wizard |
| `src/components/GratitudeStep.tsx` | Starý multi-step wizard |
| `src/components/HabitsStep.tsx` | Starý multi-step wizard |
| `src/components/SubmitStep.tsx` | Starý multi-step wizard (volá github.ts) |
| `src/components/StepIndicator.tsx` | Starý multi-step wizard |
| `src/lib/supabase/server.ts` | Nepoužívá se (middleware jde přímo přes @supabase/ssr) |

**Celkem ~700 řádků mrtvého kódu.**

### 🟡 Duplicity

| Problem | Soubory |
|---------|---------|
| `MOOD_LABELS`, `MOOD_COLORS`, `MOOD_EMOJIS` definovány 2× | `lib/stats.ts` + `OnePageCheckIn.tsx` |
| `SLEEP_QUALITY`, `STRESS_LEVELS` definovány v každém stepu zvlášť | `MoodStep.tsx` (mrtvý), `OnePageCheckIn.tsx` |

### 🟡 Drobné problémy

1. **`page.tsx`** — `AuthScreen onSignedIn={() => {}}` — prázdný callback, nikdy se nevolá
2. **`middleware.ts`** — Next.js 16 varuje: `middleware` → `proxy` (deprecated konvence)
3. **`layout.tsx`** — Service Worker se registruje přes `dangerouslySetInnerHTML` — lepší použít `<Script>`
4. **`save-entry/route.ts`** — Nevaliduje `user_id` oproti session (používá service_role, takže kdokoli s user_id může zapisovat)
5. **`globals.css`** — Obsahuje staré CSS třídy z multi-step wizardu (`.btn-mood`, `.btn-primary`, `.habit-toggle`), které se už nepoužívají

### 🟢 Co funguje dobře

- Dynamické načítání aktivit a návyků z DB s fallbackem
- AI reflexe s personalizací (jméno, mužský rod)
- Obnovení skrytých aktivit jedním klikem
- Perzistence vlastních aktivit a návyků do DB
- Auto-seed DB při prvním spuštění
- Responsivní dark-mode UI

---

## 🚀 Doporučená vylepšení

### Priorita 1 — Rychlé výhry
- [x] Smazat mrtvý kód (~700 řádků)
- [x] Odstranit duplicitní konstanty
- [x] Vyčistit `globals.css` od nepoužívaných tříd
- [x] Opravit `middleware.ts` → `proxy.ts`

### Priorita 2 — UX
- [ ] **Offline režim** — ukládat záznamy do localStorage při výpadku, sync po připojení
- [ ] **Našeptávač aktivit** — při psaní vlastní aktivity nabízet existující
- [ ] **Drag & drop** pro přeuspořádání aktivit v panelu správy
- [ ] **Barevné kategorie** — různé barvy pro kategorie aktivit

### Priorita 3 — Technické
- [ ] Migrace `middleware` → `proxy` (Next.js 16)
- [ ] Přidat `zod` validaci na API endpointy
- [ ] Rate limiting na AI endpointy
- [ ] Testování (alespoň základní smoke testy)

---

*Vygenerováno: 4. 7. 2026 · Hermes Agent · https://diarium-two.vercel.app*
