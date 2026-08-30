# Diarium — Lokální notifikace a uživatelské nastavení (hybrid)

**Datum:** 2026-08-30 · **Status:** SCHVÁLENO (varianta A) · **Autor:** Hermes (coding profile)

## Schválená rozhodnutí (30. 8. 2026)
1. Týdenní reflexe: **neděle 20:00** (stejně jako server generuje)
2. Chytrá připomínka: **✅ výchozí zapnuto**, kontrola = skutečný odeslaný záznam
   v Supabase (`entries?date=today`), NE localStorage draft
3. Zvuk notifikace: **✅ výchozí zapnuto**
4. **Varianta A**: FCM pro Android pro tyto 3 typy VYPNUT (web push PWA zůstává);
   FCM infrastruktura zůstává v app pro budoucí typy
5. Nastavení: položka „Notifikace" ve web UI → native settings screen

## 1. Cíl

Přesunout doručování notifikací z externích push kanálů (FCM/web push) **do samotné APK**,
aby si **každý uživatel řídil, KDY a JAKÉ notifikace dostane** — přímo v aplikaci, bez závislosti
na serverovém plánovači. AI reflexe zůstávají generované na serveru (LLM klíč + data), ale
**doručení a načasování řídí telefon**.

## 2. Rozdělení odpovědností (hybrid)

| Komponenta | Odpovědnost | Kde |
|---|---|---|
| **Připomínka check-inu** | celá notifikace + plánování | 📱 APK (WorkManager/AlarmManager) |
| **AI reflexe (obsah)** | generování textu (LLM), uložení do `ai_reports` | 🖥️ server (klíč se nesmí dostat do APK) |
| **AI reflexe (doručení)** | kontrola nové reflexe + lokální notifikace | 📱 APK (poll v uživatelem zvolený čas) |
| **Web push (PWA)** | doplněk pro webové uživatele (beze změny) | 🖥️ server — **FCM větev se pro reminder/reflexe vypne** (žádná duplicita s lokálními notifikacemi) |

**Proč AI reflexe nemůže běžet plně lokálně:** DeepSeek API klíč musí zůstat na serveru —
v open-source APK by ho kdokoliv vytáhl a vyčerpal účet. Data jde číst z telefonu přes uživatelský
JWT (RLS), ale LLM volání patří na server. Alternativa „on-device LLM (Gemini Nano)" je na
Pixelu experimentální, nestabilní kvalita — ne pro produkci.

## 3. Návrh obrazovky „Notifikace" (nativní settings screen v APK)

Otevření: v Diarium webu → Nastavení → „Notifikace" (přes `window.AndroidBridge.openNotificationSettings()`).
Ve webu bez mostu (PWA) se položka skryje.

```
┌─ Notifikace ──────────────────────────────────────┐
│                                                    │
│  ⚠ Systémové notifikace jsou VYPNUTÉ               │
│    [ Povolit v systému ]                           │
│                                                    │
│  ── Připomínka check-inu ───────────────────────── │
│  [✓] Připomínat vyplnění denního záznamu           │
│        Čas                    [19:00 ▾]            │
│        Dny  Po Út St Čt Pá [So][Ne]                │
│      „Připomínat jen pokud dnes ještě nemám         │
│       záznam" [✓]                                  │
│                                                    │
│  ── Týdenní AI reflexe ──────────────────────────── │
│  [✓] Upozornit, když je připravená                 │
│        Den               [Neděle ▾]                │
│        Čas                    [09:00 ▾]            │
│      (server generuje v neděli večer → app to       │
│       zkontroluje a oznámí v nastavený čas)         │
│                                                    │
│  ── Měsíční AI reflexe ──────────────────────────── │
│  [✓] Upozornit, když je připravená                 │
│        Čas                    [09:00 ▾]  (1. den)   │
│                                                    │
│  ── Chování ────────────────────────────────────── │
│  [✓] Kliknutí na notifikaci otevře Diarium         │
│  [ ] Zvuk notifikace                               │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Přepínače a nastavení (úplný seznam)

| # | Přepínač / nastavení | Typ | Výchozí | Poznámka |
|---|---|---|---|---|
| 1 | **Připomínka check-inu** (master) | switch | ✅ zapnuto | |
| 1a | Čas připomínky | time picker | 19:00 | přesný čas (AlarmManager) |
| 1b | Aktivní dny | chips Po–Ne | všechny dny | |
| 1c | „Jen pokud dnes nemám záznam" | switch | ✅ zapnuto | dotaz `entries?date=today` přes JWT; vypnuto = notifikace vždy |
| 2 | **Týdenní AI reflexe** (master) | switch | ✅ zapnuto | |
| 2a | Den oznámení | picker Po–Ne | Neděle | (server generuje v neděli 20:00 → vhodný čas kontroly je pondělí 9:00, výchozí den zvolíme při schválení) |
| 2b | Čas oznámení | time picker | 09:00 | |
| 3 | **Měsíční AI reflexe** (master) | switch | ✅ zapnuto | |
| 3a | Čas oznámení | time picker | 09:00 | vždy 1. den v měsíci |
| 4 | Kliknutí otevře Diarium | switch | ✅ zapnuto | deep link do webu |
| 5 | Zvuk notifikace | switch | ✅ zapnuto | notifikační kanál „default" vs „silent" |

## 4. Technická architektura

```
┌─ Nastavení (SharedPreferences) ────────────────────┐
│ NotificationPrefs { reminderEnabled, reminderTime, │
│   reminderDays, smartReminder, weeklyEnabled,      │
│   weeklyDay, weeklyTime, monthlyEnabled,           │
│   monthlyTime, openAppOnTap, sound }               │
└────────────────────┬───────────────────────────────┘
                     │ při každé změně → přeplánovat
┌────────────────────▼───────────────────────────────┐
│ NotificationScheduler (AlarmManager)               │
│  • Nastaví přesné alarmy (SCHEDULE_EXACT_ALARM)    │
│  • Fallback: WorkManager ±15 min bez oprávnění     │
│  • Replan automaticky po změně nastavení / bootu   │
└────────────────────┬───────────────────────────────┘
                     │ fire
┌────────────────────▼───────────────────────────────┐
│ NotificationWorker                                 │
│  • ReminderWorker: kontrola dne + „mám záznam?"    │
│    (Supabase select date=today přes user JWT)      │
│  • WeeklyWorker: je dnes weeklyDay + čas? →        │
│    select ai_reports type=weekly, order created_at │
│    desc → nový záznam → lokální notifikace         │
│  • MonthlyWorker: 1. den → ai_reports type=monthly │
│  • Uloží „lastNotified" marker (neposílat znovu)   │
└────────────────────┬───────────────────────────────┘
                     │ tap
┌────────────────────▼───────────────────────────────┐
│ MainActivity → diarium://?open=checkin | ?open=... │
└────────────────────────────────────────────────────┘
```

### Klíčová rozhodnutí
1. **AlarmManager + SCHEDULE_EXACT_ALARM** pro přesný čas (uživatel povolí při prvním zapnutí přepínače); bez oprávnění fallback na WorkManager (±15 min).
2. **Jeden notifikační kanál** „diarium_reminders" (důležitost default) + kanál „tichý" pro variantu bez zvuku.
3. **Deduplikace**: Vercel cron `/api/push/send` (19:00) a `ai-report` přestanou posílat FCM notifikace do Android app (web push pro PWA zůstává) — jinak by uživatel dostal každou notifikaci 2× (lokálně + FCM).
4. **Markery**: `lastReminderDate`, `lastWeeklyNotifiedAt`, `lastMonthlyNotifiedAt` v prefs — žádné duplicitní notifikace.
5. **Po restartu telefonu**: BootReceiver znovu naplánuje alarmy.
6. **Force-stop app**: Android pozastaví alarmy (systémové omezení, neřešitelné) — po otevření app se vše obnoví.

## 5. Rozsah serverových změn (minimální)

| Soubor | Změna |
|---|---|
| `src/app/api/push/send/route.ts` | FCM větev přesunout na konfigurovatelný typ; reminder posílat web-push PWA **bez** FCM |
| `src/app/api/cron/ai-report/route.ts` | FCM větev zrušit (obsah zůstává + web push); doručení na Android = lokální poll |
| Supabase | Žádná migrace (ai_reports existuje) |

## 6. Kroky implementace

1. [ ] `NotificationPrefs` + `NotificationSettingsStore` (SharedPreferences)
2. [ ] `NotificationScheduler` (AlarmManager + replan + BootReceiver)
3. [ ] `ReminderWorker` (den, chytrá kontrola záznamu přes Supabase JWT, notifikace)
4. [ ] `WeeklyWorker` / `MonthlyWorker` (poll `ai_reports`, marker, notifikace)
5. [ ] Nativní `NotificationSettingsActivity` — UI dle sekce 3 (switch, time picker, chips)
6. [ ] Bridge: `showNotificationSettings()` do `AndroidBridge`
7. [ ] Web (Diarium): položka „Notifikace" v nastavení → volá bridge (skryje se bez mostu)
8. [ ] Žádost o `SCHEDULE_EXACT_ALARM` při prvním zapnutí
9. [ ] Server: FCM větev z reminder/reflexe odstranit (web push zůstává)
10. [ ] Build, sideload, testy (změna času → notifikace přijde v zvolený čas; reflexe → oznámí jen novou)
11. [ ] README update (sekce Notifikace + nastavení)

## 7. Otázky ke schválení

1. **Výchozí den týdenní reflexe:** neděle 9:00 vs pondělí 9:00? (Server generuje neděli 20:00 — doporučuji **pondělí 9:00**, ať je reflexe kompletní a uživatel ji uvidí ráno)
2. **„Připomínat jen pokud nemám záznam"** — default zapnuto? (doporučuji ✅ ano)
3. **Zvuk notifikace** — default zapnuto? (doporučuji ✅)
4. **Co s FCM větev pro Android** — plně vypnout pro reminder+reflexe (doporučuji) vs nechat jako fallback, když je app force-stopnutá?
5. **Kde otevřít nastavení ve web UI:** nová položka v existující sekci nastavení (doporučuji) vs samostatná stránka?

## 8. Rizika

| Riziko | Dopad | Mitigace |
|---|---|---|
| Přesný alarm vyžaduje oprávnění (A12+) | nízké | fallback WorkManager ±15 min |
| Force-stop zablokuje alarmy | nízké | systémové chování; obnova při otevření |
| Duplicita web push vs lokální | střední | FCM pro Android vypnut, web push jen PWA |
| Poll reflexe „nová?" omyl při blackoutu serveru | nízké | marker lastNotified + porovnání created_at |