# Diarium Android — nativní usage-stats sběr (variant A) — FINÁLNÍ ARCHITEKTURA

**Datum:** 2026-08-30 · **Status:** SCHVÁLENO (R1-A, R2-C, R3-A, R4) · **Autor:** Hermes (coding profile)

## Rozhodnutí uživatele
- R1-A: nativní WebView app NAHRADÍ dosavadní PWA/mobil
- R2-C: jen zdrojový kód + build (APK si stáhne sám), Play až později
- R3-A: data jdou přes stávající `/api/save-entry` (cron secret / user JWT)
- R4: samostatný open-source repozitář `diarium-android`; server/PWA zůstává

---

## FINÁLNÍ ARCHITEKTURA

```
┌─────────────────────────────────────────────────────────────┐
│  Android app „Diarium" (Kotlin, open-source)                 │
│                                                             │
│  MainActivity                                                │
│  ├── WebView ──načte──► Diarium web (diarium-two.vercel.app)│
│  │     stejná UI, same auth, Supabase, grafy, check-in       │
│  │                                                           │
│  ├── UsageStatsBridge (JavascriptInterface)                  │
│  │     ├── getUsageAccess() → bool                           │
│  │     ├── openUsageAccessSettings()                         │
│  │     ├── readUsageStats(dateIso) → JSON                   │
│  │     │     • totalTimeInForeground per package ✓           │
│  │     │     • sum = celkový čas (jako Digitální rovnováha)  │
│  │     │     • queryEvents → počet odemknutí                 │
│  │     │     • app label přes PackageManager                 │
│  │     │     • vyřadit launcher/sleep/systémové pkg          │
│  │     └── (vrací {available:false} bez permission)          │
│  │                                                           │
│  ├── Auth: OAuth přes Chrome Custom Tabs                     │
│  │     └── diarium://auth-callback deep link                 │
│  │         → nativně zachytí tokeny → injektuje do           │
│  │           WebView localStorage → reload                   │
│  └── FCM push (později, v1 bez push)                         │
└──────────────┬──────────────────────────────▲────────────────┘
               │ POST /api/save-entry         │
               │ (Bearer user JWT / cron      │  RLS
               ▼ secret; data za VČEREJŠEK)   │  Supabase
        ┌──────────────────────────┐          │
        │ Diarium backend (Vercel) │          │
        │ save-entry, RLS, grafy   │──────────┘
        └──────────────────────────┘
```

## Co se MAZÁ z cesty dat
- ⛔ HA zcela mimo (žádný HA senzor v cestě přesných dat)
- ⛔ `phone_usage.py` + Hermes cron `e8085d86665e` (20:55 denně) — **zastavit**, jinak
  by HA data přepisovala přesná nativní (upsert na user_id+date)

## Klíčové nálezy z kontroly kódu (2026-08-30)

### 1. OAuth — NEJVĚTŠÍ RIZIKO
`AuthScreen.tsx` volá `signInWithOAuth({ redirectTo: "https://diarium-two.vercel.app/auth-callback.html" })`.
Implicit flow → tokeny v URL hash → `auth-callback.html` (statická stránka) je uloží do localStorage → redirect na /.

**Problém ve WebView:** Google blokuje OAuth přihlášení v embedded WebView
(„browser or app may not be secure" / disallowed_useragent). WebView navíc nesdílí
localStorage s Chrome (Custom Tabs/Android Browser).

**Řešení (plán):** Custom Tabs + deep link:
1. Web detekuje nativní most („v app režimu") → místo běžného OAuth volá
   `AndroidBridge.signInWithGoogle()` (nebo web přesměruje na Supabase auth URL s `redirect_to=diarium://auth-callback`).
2. Android otevře Supabase OAuth v **Chrome Custom Tab** (Google to povoluje).
3. Supabase redirect: `diarium://auth-callback#access_token=...` (přidat do
   Supabase Redirect URLs — custom scheme je podporován).
4. Nativ zachytí intent-filter, přečte hash, uloží session do **localStorage WebView**
   (stejný formát `sb-{ref}-auth-token` jako web) přes evaluateJavascript → reload → přihlášeno.
- Fallback pro první test: čistě WebView (bez Custom Tabs) — ověřit, jestli Google
  v embedded WebView vůbec projde; pokud ne → Custom Tabs.

### 2. Push notifikace — V1 BEZ PUSH (důležité!)
Diarium má web push (PushNotificationManager → /api/push/subscribe). **WebView
nepodporuje Web Push API (service worker / FCM web)** — Stack Overflow + Firebase docs
potvrzují: v WebView nelze přijímat web push.
- **V1:** push v nativní app nebude (web push proběhne jen pokud uživatel otevře web v prohlížeči; ve WebView ticho).
- **V2 (doporučeno):** nativní FCM (Firebase) + `/api/push/send` (cron na Vercel už existuje).
  Nativ obdrží FCM notifikaci → zobrazí systémovou notifikaci → klik otevře app.
  (Šablona: danny8002/template-android-webview-notification, ~1h práce.)

### 3. SESSION / STORAGE
WebView má vlastní storage profil → session v localStorage funguje, ale NESDLÍ
se s Chrome. Z toho plyne: po přihlášení přes Custom Tabs musím session injektovat
nativně. Logout: web smaže localStorage — funguje.

### 4. FOTKY / KAMERA (check-in s fotkou?)
Diarium má PhotoGallery + photo_path — foto se nahrává přes input[type=file].
Ve WebView funguje při povoleném FILE oprávnění nativně (WebChromeClient
onShowFileChooser + standardní picker). Zkontrolovat při stavbě; v1 nepovolit
komplikace — standardní WebChromeClient.

### 5. GESTA A NAVIGACE
- **Systémová gesta (Android 10+):** swipe z levého/pravého okraje = ZPĚT —
  funguje na úrovni WebView (onBackPressed → webView.canGoBack() ? goBack() : moveTaskToBack).
- **In-app swipe doleva/doprava (jako iOS edge pop):** Diarium web je SPA
  s tab navigací (Dashboard/Check-in/Statistiky), nemá stránkové routy → „zpět"
  = goBack() v historii WebView. Nativně lze namapovat horizontální edge-swipe
  na goBack() (AndroidX Activity + GestureDetector), s pozor na konflikt
  s webovými horizontálními gesty (kalendář, grafy) → v1: systémová gesta
  nativně (prediktivní back), edge-swipe in-app jako rozšíření = vyhodnotit
  při testech.
- **UX zbytek se NEMĚNÍ:** stejná UI, stejné tabulky, stejné grafy, stejný
  Supabase, stejný check-in.

### 6. ODEMKNUTÍ
- UsageStats `queryEvents(start,end)` → count `EVENT_SCREEN_INTERACTIVE` (API 28+).
- Fallback (API<28): count z interactive historie nelze → v1 předpokládá API 28+ (Pixel 8 = API 35 ✓).

### 7. OPRÁVNĚNÍ (AndroidManifest)
- INTERNET
- PACKAGE_USAGE_STATS (tools:ignore=ProtectedPermissions) → uživatel udělí v
  „Aplikace s přístupem k využití"
- (V2) POST_NOTIFICATIONS + FCM

## REPO / STACK
- Nový repo: `github.com/Vojta01/diarium-android`
- Kotlin, AGP 8.x, minSdk 26, targetSdk 34+, AndroidX WebKit
- Bez vložených secretů: build s `local.properties`/BuildConfig (DIARIUM_URL,
  SUPABASE_URL, SUPABASE_REF pro klíč localStorage, CRON_SECRET pro save-entry)
- Build: `./gradlew assembleDebug` → APK k stažení

## ROZHODNUTÍ UŽIVATELE (2. kolo, 2026-08-30)
- Push: **ANO, nativní FCM** od V1 (ne V2!) — uživatel chce funkční push z nativní app
- AI reflexe (týdenní/měsíční) + večerní připomínka: **server Vercel crony zůstávají**
  (generují obsah), doručení = **FCM nativní notifikace** vedle stávajícího web pushu
- Screen time: **21:00 sync dneška** (WorkManager, konzistentní cutoff) +
  **07:00 backfill včera** (kompletní data, upsert) + zpětný backfill 7 dní po instalaci +
  backfill-při-otevření app jako pojistka

## NOTIFIKACE — FINÁLNÍ ARCHITEKTURA (FCM)

```
Vercel crony (zůstávají): 19:00 připomínka · ne 20:00 týdenní · 1. 8:00 měsíční
   │   generují obsah (ai_reports → Supabase)
   ▼
Server: (a) web push VAPID → PWA (browser) — zůstává
        (b) FCM HTTP v1 (service account) → nativní app → systémová notifikace
             └─ klik → deep link otevře app/report
Push tokeny: nová tabulka Supabase `push_tokens` (user_id, platform, token,
             created_at) — FCM tj. vedle Redis (web push) — subscribe endpoint
             rozšířen o platforma: web|android + token
```

### Externí závislost (uživatel)
- Firebase projekt (console.firebase.google.com, ~3 min) → google-services.json
  (do app) + service account JSON (do Vercel env FIREBASE_SERVICE_ACCOUNT)
- Bez něj FCM nejde — ale vše ostatní (usage-stats, auth, UI) funguje nezávisle

## STAV IMPLEMENTACE (2026-08-30 ~09:20)
### Hotovo ✅
- [x] GitHub repo lokálně + git history (`/root/diarium-android`, remote připraven)
- [x] Kotlin projekt (minSdk 26, targetSdk 34, AGP 8.3.2) — BUILD OK (8.1 MB APK s FCM)
- [x] MainActivity + WebView (JS, DOM storage, file chooser, back gesta)
- [x] UsageStatsBridge — readUsageStats / getUsageAccess / openUsageAccessSettings / getSession
- [x] UsageStatsProvider — per-app foreground time, unlocks (queryEvents), labels přes PackageManager,
      vyřazení launcher/sleep/systém; zdroj = UsageStatsManager (přesně jako Digitální rovnováha)
- [x] Auth: Chrome Custom Tabs + intent-filter diarium:// + session injection do localStorage
      (AuthManager + AuthCallbackActivity + SessionStore)
- [x] WorkManager: 21:00 snapshot, 07:00 backfill, one-time 7-dní backfill po instalaci
- [x] UsageSyncWorker → POST /api/save-entry s user JWT + user_id z JWT sub
- [x] FCM: DiariumFirebaseMessagingService, token registrace do /api/push/subscribe,
      notifikační kanál, ic_stat_diarium, manifest service
- [x] google-services.json vloženo, Firebase dependency aktivní
- [x] Server: push/subscribe (platform android → push_tokens), push/send (FCM v1 + purge dead),
      ai-report (FCM + deep link), lib/fcm.ts (OAuth2 JWT exchange, bez firebase-admin)
- [x] Migrace `push_tokens` spuštěna (přímé DB připojení, MIGRATION OK, REST 200 [])

### Čeká na uživatele 🔴
1. **Založit GitHub repo** `Vojta01/diarium-android` (New repository → Public) →
   pak já pushnu (remote je nastavený na SSH, funguje)
2. **Vercel env:** přidat `FIREBASE_SERVICE_ACCOUNT` = obsah
   `diarium-android-firebase-adminsdk-...json` (Project Settings → Environment Variables
   → Production → Redeploy). Bez něj FCM pošle 0 notifikací; web push běží dál
3. **Supabase Redirect URL:** Authentication → URL Configuration → přidat `diarium://auth-callback`
4. **Po ověření nativní app:** zastavit Hermes cron e8085d86665e (HA sběr) — jinak
   nepřesná HA data přepisují přesná nativní

### Zbývá (po Firebase souborech)
- [ ] Otestovat přihlášení (Custom Tab → deep link → session)
- [ ] Otestovat push včerejška → kontrola dat v Supabase vs Digitální rovnováha
- [ ] README finalizace

## RIZIKA
| Riziko | Dopad | Mitigace |
|---|---|---|
| Google blokuje OAuth ve WebView | HIGH | Custom Tabs + deep link; test na zařízení |
| FCM vyžaduje Firebase projekt (uživatel) | MED | Firebase ~3 min; usage-stats běží bez něj |
| CRON_SECRET v APK (open-source) | MED | primárně user JWT; secret jen volitelný fallback |
| Konflikt edge-swipe s webovými gesty | LOW | V1 jen systémové gesto zpět |
| Storage profil WebView vs Chrome | MED | Session injekce nativně po OAuth |
| WorkManager ~21:00 není přesný na minutu | LOW | backfill 07:00 + při otevření app dorovná |