export const cs = {
  // ── Common ──
  common: {
    loading: 'Načítám...',
    save: 'Uložit',
    saving: 'Ukládám...',
    cancel: 'Zrušit',
    add: 'Přidat',
    close: 'Zavřít',
    edit: 'Upravit',
    remove: 'Odebrat',
    hide: 'Skrýt',
    restore: 'Obnovit',
    save_to_vault: '✓ Uložit do vaultu',
    dashboard: 'Dashboard',
    checkin: 'Check-in',
    stats: 'Statistiky',
    nahled: 'Načítám...',
    logout: 'odhlásit',
    no_data: '—',
  },

  // ── Auth Screen ──
  auth: {
    title: 'Diarium',
    subtitle: 'Tvůj denní check-in — teď s Google účtem',
    subtitle_obsidian: 'Denní check-in do tvého Obsidian vaultu',
    sign_in_google: 'Přihlásit přes Google',
    signing_in: 'Přihlašuji...',
    sign_in_error: 'Nepodařilo se přihlásit',
    data_privacy: 'Po přihlášení se vytvoří tvůj účet. Data jsou jen tvoje.',
  },

  // ── Page / Tab Bar ──
  page: {
    loading: 'Načítám...',
    tab_dashboard: '🏠 Dashboard',
    tab_checkin: '✏️ Check-in',
    tab_stats: '📊 Statistiky',
    logout: 'odhlásit',
  },

  // ── Dashboard ──
  dashboard: {
    title: 'Diarium',
    subtitle: 'Tvůj denní deník',
    today: '📅 Dnes',
    no_checkin_today: 'Dnes ještě nemáš check-in',
    checkin_button: '✏️ Check-in',
    edit_today: '✏️ Upravit dnešní check-in',
    mood_last_7: '🎭 Nálada — posledních 7 dní',
    tooltip_mood: '{mood} — klikni pro check-in',
    tooltip_no_entry: 'Žádný zápis — klikni pro check-in',
    quick_overview: '⚡ Rychlý přehled',
    days_streak: 'dnů v řadě',
    screen_time: 'screen time',
    unlocks: 'odemknutí',
    activities_count: 'aktivity',
    mood_this_week: 'nálada tento týden',
    yesterday_mood: 'včerejší nálada',
    days_this_week: 'dní tento týden',
    sleep_today: 'spánek dnes',
    this_month: 'tento měsíc',
    ai_reflection: '🤖 AI Reflexe',
    last_gratitude: '🙏 Poslední vděčnost',
    mood_that_day: 'nálada toho dne',
    last_entry: '📝 Poslední zápis',
    today_label: 'Dnes',
    day_labels: {
      sun: 'Ne', mon: 'Po', tue: 'Út', wed: 'St', thu: 'Čt', fri: 'Pá', sat: 'So',
    },
  },

  // ── Mood ──
  mood: {
    label: 'Nálada',
    mood_5: 'Skvěle',
    mood_4: 'Dobře',
    mood_3: 'Jde to',
    mood_2: 'Špatně',
    mood_1: 'Hrozně',
    mood_5e: 'Skvěle 😄',
    mood_4e: 'Dobře 🙂',
    mood_3e: 'Jde to 😐',
    mood_2e: 'Špatně 😟',
    mood_1e: 'Hrozně 😡',
    select: 'Nálada',
  },

  // ── Sleep ──
  sleep: {
    label: 'Kvalita spánku',
    sleep_3: 'Skvělý',
    sleep_2: 'Normální',
    sleep_1: 'Špatný',
    sleep_3e: 'Skvělý 😴',
    sleep_2e: 'Normální 🥱',
    sleep_1e: 'Špatný 😪',
  },

  // ── Stress ──
  stress: {
    label: 'Stres',
    stress_1: 'Nízký',
    stress_2: 'Mírný',
    stress_3: 'Střední',
    stress_4: 'Vysoký',
    stress_5: 'Extrémní',
  },

  // ── Activities ──
  activities: {
    label: 'Aktivit',
    none: 'žádné',
    section_title: 'Aktivity',
    add_custom: '➕ Přidat vlastní aktivitu',
    manage: '⚙️ Spravovat',
    your_activities: '📋 Tvoje aktivity',
    activities_summary: '{count} aktivit v {categories} kategoriích. Vlastní můžeš odebrat, výchozí schovat.',
    custom_badge: '· vlastní',
    default_badge: '· výchozí',
    remove_tooltip_custom: 'Odebrat aktivitu',
    remove_tooltip_default: 'Skrýt aktivitu',
    hidden_activities: '🔒 Skryté aktivity ({count})',
    restore_tooltip: 'Kliknutím obnovíš',
    no_activities_yet: 'Zatím žádné. Přidej první tlačítkem níže.',
    add_activity_modal_title: '➕ Přidat aktivitu',
    name_label: 'Název',
    name_placeholder: 'Např. běhání',
    emoji_label: 'Emoji',
    emoji_placeholder: '🏃',
    category_label: 'Kategorie',
    error_empty: 'Zadej název aktivity',
    error_save: 'Nepodařilo se uložit aktivitu: {error}',
    error_network: 'Chyba sítě: {error}',
    error_remove: 'Chyba při odebírání: {error}',
    error_remove_network: 'Chyba sítě při odebírání: {error}',
    error_restore: 'Chyba při obnově: {error}',
    error_restore_network: 'Chyba sítě při obnově: {error}',
  },

  // ── Habits ──
  habits: {
    label: 'Návyky',
    section_title: 'Návyky',
    add_custom: '➕ Přidat vlastní návyk',
    manage: '⚙️ Spravovat',
    your_habits: '🎯 Tvoje návyky',
    add_habit: '➕ Přidat návyk',
    not_today: 'dnes ne',
    negative_badge: '(abstinenční)',
    positive_badge: '(pozitivní)',
    default_badge: ' · výchozí',
    remove_btn: '✕ Odebrat',
    prompt_name: 'Název návyku (např. běhání):',
    prompt_emoji: 'Emoji (např. 🏃):',
    prompt_negative: "Je to 'abstinenční' návyk? (tj. zelená = dnes jsem to NEdělal)\nOK = Ano (např. alkohol, kouření), Zrušit = Ne (např. cvičení)",
  },

  // ── Goals ──
  goals: {
    section_title: 'Cíle {done}/{total}',
    streak: '🔥 {streak}-denní řada',
    add_goal: '+ Přidat cíl',
    prompt_name: 'Název cíle:',
    prompt_emoji: 'Emoji (např. 🏃):',
  },

  // ── Gratitude ──
  gratitude: {
    label: 'Vděčnost',
    title: 'Za co jsi vděčný?',
    placeholder: '{n}. věc...',
  },

  // ── Note ──
  note: {
    label: 'Poznámka',
    title: 'Rychlá poznámka',
    placeholder: 'Co ti dnes běželo hlavou...',
  },

  // ── Photo ──
  photo: {
    label: 'Fotka',
  },

  // ── Add Activity Modal ──
  addActivity: {
    title: '➕ Přidat aktivitu',
    name_label: 'Název',
    name_placeholder: 'Např. běhání',
    emoji_label: 'Emoji',
    emoji_placeholder: '🏃',
    category_label: 'Kategorie',
    cancel: 'Zrušit',
    add: 'Přidat',
  },

  // ── Completed Card ──
  completedCard: {
    great_day: 'Skvělý den!',
    day_recorded: 'Den zapsán',
    it_counts: 'I to se počítá',
    activities_short: 'Aktivit',
    sleep: 'Spánek',
    stress: 'Stres',
    activities: 'Aktivit',
    activities_section: 'Aktivity',
    habits_section: 'Návyky',
    gratitude_section: 'Vděčnost',
    note_section: 'Poznámka',
    ai_reflection: 'AI reflexe',
    edit_record: '✏️ Upravit záznam',
    goals_label: 'Cíle {done}/{total}',
  },

  // ── Check-in ──
  checkin: {
    today: 'Dnes',
    save: '✓ {saving ? "Ukládám..." : "Uložit"}',
    saving: '⏳ Ukládám...',
    save_to_vault: '✓ Uložit do vaultu',
    ai_thinking: '🤖 AI přemýšlí...',
    nav_dashboard: '🏠 Dashboard',
    nav_checkin: '📝 Check-in',
    nav_stats: '📊 Stats',
    mood_label: 'Nálada',
    sleep_label: 'Kvalita spánku',
    stress_label: 'Stres',
    gratitude_title: 'Za co jsi vděčný?',
    gratitude_placeholder: '{n}. věc...',
    note_title: 'Rychlá poznámka',
    note_placeholder: 'Co ti dnes běželo hlavou...',
    photo_title: 'Fotka',
    goals_title: 'Cíle {done}/{total}',
    habits_title: 'Návyky',
    activities_title: 'Aktivity',
    add_activity: '➕ Přidat vlastní aktivitu',
    add_habit: '➕ Přidat vlastní návyk',
    manage: '⚙️ Spravovat',
  },

  // ── Stats Dashboard ──
  statsDashboard: {
    title: 'Diarium',
    subtitle: 'Statistiky',
    loading: 'Načítám statistiky...',
    tab_calendar: '🗓️ Kalendář',
    tab_correlation: '🔗 Korelace',
    tab_screentime: '📱 Screen',
    tab_ai: '🤖 AI',
    tab_pixels: '📅 Pixels',
  },

  // ── ActivityMoodChart (korelace) ──
  correlation: {
    no_data: 'Zatím není dost dat pro korelace. Vyplňuj Diarium a uvidíš, co ovlivňuje tvou náladu.',
    tab_activities: '🎯 Aktivity',
    tab_habits: '✅ Návyky',
    tab_screentime: '📱 Screen time',
    tab_unlocks: '🔓 Odemknutí',
    tab_trends: '📊 Trendy',
    legend_strong: '*** p<0.01 (silné)',
    legend_significant: '** p<0.05 (průkazné)',
    legend_hint: '* p<0.1 (náznak)',
    legend_weak: '~ p<0.2 (slabé)',
    legend_cohens_d: 'd = Cohenovo d (míra účinku)',
    activities_desc: 'Cohenovo d porovnává náladu ve dnech s aktivitou vs bez ní. Kladné d = lepší nálada s aktivitou.',
    habits_desc: 'Cohenovo d porovnává dny s návykem vs bez. <span class="text-emerald-400">Kladné d</span> = lepší nálada, když je hodnota <b>ano</b>.',
    habits_desc_neg: 'U negativních návyků (🍺 alkohol, 🔞 porno apod.) znamená "ano" = narušení. U pozitivních (🧘 meditace, 🏋️ cvičení) "ano" = splněno.',
    habits_with_neg: '⚠️ Narušeno',
    habits_with_pos: '✅ Ano',
    habits_without_neg: '✅ V pořádku',
    habits_without_pos: '❌ Ne',
    effect_label: 'Efekt: {label}',
    effect_negligible: 'zanedbatelný',
    effect_small: 'malý',
    effect_medium: 'střední',
    effect_large: 'velký',
    screentime_title: '📱 Screen time vs nálada',
    screentime_strong: 'Čím víc času na telefonu, tím {direction} nálada ({interpretation} korelace, {n} dní).',
    screentime_medium: 'Mírná souvislost: víc screen timu → {direction} nálada ({n} dní).',
    screentime_weak: 'Slabá nebo žádná souvislost mezi screen timem a náladou ({n} dní).',
    screentime_desc: 'Průměrná nálada v jednotlivých pásmech screen timu. Sloupec ukazuje Ø náladu, pod ním je rozdíl proti celkovému průměru ({mean}).',
    unlocks_desc: 'Průměrná nálada podle počtu odemknutí telefonu za den.',
    trends_title: 'Vývoj nálady',
    trends_subtitle: '7denní klouzavý průměr — {days} dní',
    trends_improving: '↑ zlepšuje se',
    trends_worsening: '↓ zhoršuje se',
    trends_stable: '→ stabilní',
    trends_start: 'Začátek období',
    trends_end: 'Konec období',
    trends_change: 'Změna',
    trends_footer: 'Čára ukazuje 7denní klouzavý průměr nálady. Barva přechází od začátku (vlevo) ke konci (vpravo) období.',
    days_count: '{count} dní',
    cohens_d: 'd = {value}',
    ci: 'CI [{low}; {high}]',
    diff_vs_mean: '{diff} vs Ø',
    sigma: 'σ = {value}',
  },

  // ── ScreenTimeChart ──
  screenTime: {
    title: '📱 Screen Time',
    no_data: 'Zatím žádná data o screen timu.',
    no_data_hint: 'Data se sbírají z Home Assistant — první data budou zítra.',
    last_7_days: 'posledních 7 dní',
    avg_daily: 'průměr denně',
    total: 'celkem',
    max: 'nejvíc',
    screen_time_chart: '⏱️ Čas na obrazovce',
    unlocks_chart: '🔓 Odemknutí telefonu',
    legend: 'Legenda:',
    apps: 'Appky:',
    other: 'Ostatní',
    weekdays: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  },

  // ── CalendarView ──
  calendar: {
    edit_entry: '✏️ Upravit tento záznam',
    gratitude: 'Vděčnost',
    day_names: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
    month_names: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
  },

  // ── YearInPixels ──
  yearInPixels: {
    loading: 'Načítám...',
    title: '🗓️ Rok {year} v pixelech',
    description: 'Každý čtvereček = jeden den. Čím zelenější, tím lepší nálada.',
    avg_mood: 'Průměrná nálada',
    days_tracked: 'Sledovaných dní',
    today: 'dnes',
    mood: 'nálada',
  },

  // ── PhotoPicker ──
  photoPicker: {
    device: 'Zařízení',
    google_photos: 'Google Photos',
    remove: '✕ Odebrat',
    selected_photo_alt: 'Vybraná fotka',
    google_not_configured: 'Google Photos není nakonfigurováno. Použijte prosím nahrání ze zařízení.',
    no_photos_found: 'V Google Photos nebyly nalezeny žádné fotky.',
    connection_error: 'Chyba připojení',
  },

  // ── PeriodicSummary (AI reports) ──
  periodicSummary: {
    title: '🤖 AI Přehledy',
    tab_weekly: '📅 Týdenní',
    tab_monthly: '🗓️ Měsíční',
    tab_yearly: '📆 Roční',
    loading: '⏳ Načítám...',
    weekly: 'Týdenní',
    monthly: 'Měsíční',
    yearly: 'Roční',
    generated_at: 'Vygenerováno {date} · období {start} až {end}',
    just_generated: 'Právě vygenerováno',
    no_report: 'Zatím žádný {period} report',
    generate: '🔄 Znovu vygenerovat {period} přehled',
    generating: '⏳ AI přemýšlí...',
    not_enough_data: 'Zatím není dostatek dat. Potřebuješ alespoň 2 dny záznamů.',
    error_prefix: 'Chyba: {error}',
    error_connection: 'Chyba připojení',
  },

  // ── Push Notification Manager ──
  pushNotification: {
    title: '🔔 Denní připomenutí',
    description: 'Dostávej upozornění ve 21:00, ať nezapomeneš na check-in',
    enable: 'Povolit notifikace',
    dismiss: 'Přeskočit',
    status_active: 'Notifikace aktivní ✅',
    status_inactive: 'Notifikace vypnuté ❌ — pro zapnutí obnov aplikaci',
  },

  // ── Language Switcher ──
  language: {
    cs: '🇨🇿 Čeština',
    en: '🇬🇧 English',
  },

  // ── ActivityMoodChart interpretations (used in screentime tab) ──
  interpretation: {
    none: 'žádná',
    weak: 'slabá',
    medium: 'střední',
    strong: 'silná',
    better: 'lepší',
    worse: 'horší',
    negative: 'negativní',
    direction_more_time_better: '📈 více času → lepší nálada',
    direction_more_time_worse: '📉 více času → horší nálada',
    direction_no_relation: '➡️ žádný vztah',
  },

  // ── Mood quotes ──
  quotes: {
    5: [
      'Dny jako tenhle jsou důvod, proč to celé má smysl. ✨',
      'Když je duše v pohodě, celý svět se usmívá s tebou. 🌟',
      'Tohle si zapiš za uši — dneska jsi vyhrál/a. 🏆',
    ],
    4: [
      'Dobrý den je jako šálek dobré kávy — zahřeje a povzbudí. ☕',
      'Ne každý den je perfektní, ale dnešek byl zatraceně blízko. 🙂',
      'Vděčnost mění obyčejné dny ve výjimečné. 💫',
    ],
    3: [
      'I neutrální dny mají svou hodnotu — jsou to dny klidu. 🌤️',
      'Není to ani kopec, ani údolí. Prostě rovina. A to je v pořádku. 🛤️',
      'Zítra je nový den, nová příležitost. Dnes stačilo být. 🌅',
    ],
    2: [
      'I špatné dny končí. A zítřek začíná znovu. 🌙',
      'Nejsi sám/sama. Každý má někdy den, kdy to nejde. 🫂',
      'Tohle je jen kapitola, ne celá kniha. 📖',
    ],
    1: [
      'Někdy je vítězství jen to, že jsi ten den přežil/a. A to stačí. 💪',
      'Dno je pevný základ, ze kterého se dá odrazit. 🚀',
      'I po nejhorší bouřce vyjde slunce. Vydrž. 🌈',
    ],
  },

  // ── Activity groups (category name translations) ──
  categoryGroups: {
    sociální: 'Společenské',
    'volný čas': 'Záliby',
    jídlo: 'Jídlo',
    sport: 'Zdraví',
    zdraví: 'Zdraví',
    wellness: 'Mé lepší já',
    práce: 'Práce',
    počasí: 'Počasí',
    'domácí práce': 'Domácí práce',
    vlastní: 'Vlastní',
    obecné: 'Ostatní',
  },

  // ── Layout / Metadata ──
  layout: {
    description: 'Denní check-in do tvého Obsidian vaultu',
  },
};

export type CsTranslations = typeof cs;
