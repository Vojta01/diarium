export const en = {
  // ── Common ──
  common: {
    loading: 'Loading...',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    add: 'Add',
    close: 'Close',
    edit: 'Edit',
    remove: 'Remove',
    hide: 'Hide',
    restore: 'Restore',
    save_to_vault: '✓ Save to vault',
    dashboard: 'Dashboard',
    checkin: 'Check-in',
    stats: 'Stats',
    nahled: 'Loading...',
    logout: 'log out',
    no_data: '—',
  },

  // ── Auth Screen ──
  auth: {
    title: 'Diarium',
    subtitle: 'Your daily check-in — now with Google account',
    subtitle_obsidian: 'Daily check-in for your Obsidian vault',
    sign_in_google: 'Sign in with Google',
    signing_in: 'Signing in...',
    sign_in_error: 'Failed to sign in',
    data_privacy: 'By signing in, your account will be created. Your data is yours only.',
  },

  // ── Page / Tab Bar ──
  page: {
    loading: 'Loading...',
    tab_dashboard: '🏠 Dashboard',
    tab_checkin: '✏️ Check-in',
    tab_stats: '📊 Stats',
    logout: 'log out',
  },

  // ── Dashboard ──
  dashboard: {
    title: 'Diarium',
    subtitle: 'Your daily journal',
    today: '📅 Today',
    no_checkin_today: "No check-in yet today",
    checkin_button: '✏️ Check-in',
    edit_today: '✏️ Edit today\'s check-in',
    mood_last_7: '🎭 Mood — last 7 days',
    tooltip_mood: '{mood} — click to check in',
    tooltip_no_entry: 'No entry — click to check in',
    quick_overview: '⚡ Quick overview',
    days_streak: 'days streak',
    screen_time: 'screen time',
    unlocks: 'unlocks',
    activities_count: 'activities',
    mood_this_week: 'mood this week',
    yesterday_mood: "yesterday's mood",
    days_this_week: 'days this week',
    sleep_today: 'sleep today',
    this_month: 'this month',
    ai_reflection: '🤖 AI Reflection',
    last_gratitude: '🙏 Last gratitude',
    mood_that_day: 'mood that day',
    last_entry: '📝 Last entry',
    today_label: 'Today',
    day_labels: {
      sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
    },
  },

  // ── Mood ──
  mood: {
    label: 'Mood',
    mood_5: 'Great',
    mood_4: 'Good',
    mood_3: 'Okay',
    mood_2: 'Bad',
    mood_1: 'Awful',
    mood_5e: 'Great 😄',
    mood_4e: 'Good 🙂',
    mood_3e: 'Okay 😐',
    mood_2e: 'Bad 😟',
    mood_1e: 'Awful 😡',
    select: 'Mood',
  },

  // ── Sleep ──
  sleep: {
    label: 'Sleep quality',
    sleep_3: 'Great',
    sleep_2: 'Normal',
    sleep_1: 'Poor',
    sleep_3e: 'Great 😴',
    sleep_2e: 'Normal 🥱',
    sleep_1e: 'Poor 😪',
  },

  // ── Stress ──
  stress: {
    label: 'Stress',
    stress_1: 'Low',
    stress_2: 'Mild',
    stress_3: 'Moderate',
    stress_4: 'High',
    stress_5: 'Extreme',
  },

  // ── Activities ──
  activities: {
    label: 'Activities',
    none: 'none',
    section_title: 'Activities',
    add_custom: '➕ Add custom activity',
    manage: '⚙️ Manage',
    your_activities: '📋 Your activities',
    activities_summary: '{count} activities in {categories} categories. Custom ones can be removed, defaults hidden.',
    custom_badge: '· custom',
    default_badge: '· default',
    remove_tooltip_custom: 'Remove activity',
    remove_tooltip_default: 'Hide activity',
    hidden_activities: '🔒 Hidden activities ({count})',
    restore_tooltip: 'Click to restore',
    no_activities_yet: 'None yet. Add one with the button below.',
    add_activity_modal_title: '➕ Add activity',
    name_label: 'Name',
    name_placeholder: 'e.g. running',
    emoji_label: 'Emoji',
    emoji_placeholder: '🏃',
    category_label: 'Category',
    error_empty: 'Enter an activity name',
    error_save: 'Failed to save activity: {error}',
    error_network: 'Network error: {error}',
    error_remove: 'Error removing: {error}',
    error_remove_network: 'Network error while removing: {error}',
    error_restore: 'Error restoring: {error}',
    error_restore_network: 'Network error while restoring: {error}',
  },

  // ── Habits ──
  habits: {
    label: 'Habits',
    section_title: 'Habits',
    add_custom: '➕ Add custom habit',
    manage: '⚙️ Manage',
    your_habits: '🎯 Your habits',
    add_habit: '➕ Add habit',
    not_today: 'not today',
    negative_badge: '(abstinence)',
    positive_badge: '(positive)',
    default_badge: ' · default',
    remove_btn: '✕ Remove',
    prompt_name: 'Habit name (e.g. running):',
    prompt_emoji: 'Emoji (e.g. 🏃):',
    prompt_negative: "Is it an 'abstinence' habit? (i.e. green = I did NOT do it today)\nOK = Yes (e.g. alcohol, smoking), Cancel = No (e.g. exercise)",
  },

  // ── Goals ──
  goals: {
    section_title: 'Goals {done}/{total}',
    streak: '🔥 {streak}-day streak',
    add_goal: '+ Add goal',
    prompt_name: 'Goal name:',
    prompt_emoji: 'Emoji (e.g. 🏃):',
  },

  // ── Gratitude ──
  gratitude: {
    label: 'Gratitude',
    title: 'What are you grateful for?',
    placeholder: '{n}. thing...',
  },

  // ── Note ──
  note: {
    label: 'Note',
    title: 'Quick note',
    placeholder: 'What was on your mind today...',
  },

  // ── Photo ──
  photo: {
    label: 'Photo',
  },

  // ── Add Activity Modal ──
  addActivity: {
    title: '➕ Add activity',
    name_label: 'Name',
    name_placeholder: 'e.g. running',
    emoji_label: 'Emoji',
    emoji_placeholder: '🏃',
    category_label: 'Category',
    cancel: 'Cancel',
    add: 'Add',
  },

  // ── Completed Card ──
  completedCard: {
    great_day: 'Great day!',
    day_recorded: 'Day recorded',
    it_counts: 'It counts too',
    activities_short: 'Activities',
    sleep: 'Sleep',
    stress: 'Stress',
    activities: 'Activities',
    activities_section: 'Activities',
    habits_section: 'Habits',
    gratitude_section: 'Gratitude',
    note_section: 'Note',
    ai_reflection: 'AI reflection',
    edit_record: '✏️ Edit record',
    goals_label: 'Goals {done}/{total}',
  },

  // ── Check-in ──
  checkin: {
    today: 'Today',
    save: '✓ {saving ? "Saving..." : "Save"}',
    saving: '⏳ Saving...',
    save_to_vault: '✓ Save to vault',
    ai_thinking: '🤖 AI is thinking...',
    nav_dashboard: '🏠 Dashboard',
    nav_checkin: '📝 Check-in',
    nav_stats: '📊 Stats',
    mood_label: 'Mood',
    sleep_label: 'Sleep quality',
    stress_label: 'Stress',
    gratitude_title: 'What are you grateful for?',
    gratitude_placeholder: '{n}. thing...',
    note_title: 'Quick note',
    note_placeholder: 'What was on your mind today...',
    photo_title: 'Photo',
    goals_title: 'Goals {done}/{total}',
    habits_title: 'Habits',
    activities_title: 'Activities',
    add_activity: '➕ Add custom activity',
    add_habit: '➕ Add custom habit',
    manage: '⚙️ Manage',
  },

  // ── Stats Dashboard ──
  statsDashboard: {
    title: 'Diarium',
    subtitle: 'Statistics',
    loading: 'Loading statistics...',
    tab_calendar: '🗓️ Calendar',
    tab_correlation: '🔗 Correlation',
    tab_screentime: '📱 Screen',
    tab_ai: '🤖 AI',
    tab_pixels: '📅 Pixels',
  },

  // ── ActivityMoodChart (correlation) ──
  correlation: {
    no_data: 'Not enough data for correlations yet. Keep using Diarium to see what affects your mood.',
    tab_activities: '🎯 Activities',
    tab_habits: '✅ Habits',
    tab_screentime: '📱 Screen time',
    tab_unlocks: '🔓 Unlocks',
    tab_trends: '📊 Trends',
    legend_strong: '*** p<0.01 (strong)',
    legend_significant: '** p<0.05 (significant)',
    legend_hint: '* p<0.1 (hint)',
    legend_weak: '~ p<0.2 (weak)',
    legend_cohens_d: 'd = Cohen\'s d (effect size)',
    activities_desc: 'Cohen\'s d compares mood on days with vs without the activity. Positive d = better mood with activity.',
    habits_desc: 'Cohen\'s d compares days with vs without the habit. <span class="text-emerald-400">Positive d</span> = better mood when value is <b>yes</b>.',
    habits_desc_neg: 'For negative habits (🍺 alcohol, 🔞 porn, etc.) "yes" means abstinence broken. For positive (🧘 meditation, 🏋️ exercise) "yes" means completed.',
    habits_with_neg: '⚠️ Broken',
    habits_with_pos: '✅ Yes',
    habits_without_neg: '✅ Okay',
    habits_without_pos: '❌ No',
    effect_label: 'Effect: {label}',
    effect_negligible: 'negligible',
    effect_small: 'small',
    effect_medium: 'medium',
    effect_large: 'large',
    screentime_title: '📱 Screen time vs mood',
    screentime_strong: 'More phone time → {direction} mood ({interpretation} correlation, {n} days).',
    screentime_medium: 'Mild association: more screen time → {direction} mood ({n} days).',
    screentime_weak: 'Weak or no association between screen time and mood ({n} days).',
    screentime_desc: 'Average mood by screen time bracket. Bar shows Ø mood, below is difference from overall average ({mean}).',
    unlocks_desc: 'Average mood by number of phone unlocks per day.',
    trends_title: 'Mood trend',
    trends_subtitle: '7-day rolling average — {days} days',
    trends_improving: '↑ improving',
    trends_worsening: '↓ worsening',
    trends_stable: '→ stable',
    trends_start: 'Start of period',
    trends_end: 'End of period',
    trends_change: 'Change',
    trends_footer: 'Line shows 7-day rolling average of mood. Color transitions from start (left) to end (right) of period.',
    days_count: '{count} days',
    cohens_d: 'd = {value}',
    ci: 'CI [{low}; {high}]',
    diff_vs_mean: '{diff} vs Ø',
    sigma: 'σ = {value}',
  },

  // ── ScreenTimeChart ──
  screenTime: {
    title: '📱 Screen Time',
    no_data: 'No screen time data yet.',
    no_data_hint: 'Data is collected from Home Assistant — first data will be available tomorrow.',
    last_7_days: 'last 7 days',
    avg_daily: 'avg daily',
    total: 'total',
    max: 'max',
    screen_time_chart: '⏱️ Screen Time',
    unlocks_chart: '🔓 Phone Unlocks',
    legend: 'Legend:',
    apps: 'Apps:',
    other: 'Other',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },

  // ── CalendarView ──
  calendar: {
    edit_entry: '✏️ Edit this entry',
    gratitude: 'Gratitude',
    day_names: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    month_names: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },

  // ── YearInPixels ──
  yearInPixels: {
    loading: 'Loading...',
    title: '🗓️ Year {year} in pixels',
    description: 'Each square = one day. Greener means better mood.',
    avg_mood: 'Average mood',
    days_tracked: 'Days tracked',
    today: 'today',
    mood: 'mood',
  },

  // ── PhotoPicker ──
  photoPicker: {
    device: 'Device',
    google_photos: 'Google Photos',
    remove: '✕ Remove',
    selected_photo_alt: 'Selected photo',
    google_not_configured: 'Google Photos is not configured. Please use device upload.',
    no_photos_found: 'No photos found in Google Photos.',
    connection_error: 'Connection error',
  },

  // ── PeriodicSummary (AI reports) ──
  periodicSummary: {
    title: '🤖 AI Reports',
    tab_weekly: '📅 Weekly',
    tab_monthly: '🗓️ Monthly',
    tab_yearly: '📆 Yearly',
    loading: '⏳ Loading...',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    generated_at: 'Generated {date} · period {start} to {end}',
    just_generated: 'Just generated',
    no_report: 'No {period} report yet',
    generate: '🔄 Regenerate {period} report',
    generating: '⏳ AI is thinking...',
    not_enough_data: 'Not enough data yet. You need at least 2 days of entries.',
    error_prefix: 'Error: {error}',
    error_connection: 'Connection error',
  },

  // ── Push Notification Manager ──
  pushNotification: {
    title: '🔔 Daily reminder',
    description: 'Get notified at 9 PM so you don\'t forget your check-in',
    enable: 'Enable notifications',
    dismiss: 'Skip',
    status_active: 'Notifications active ✅',
    status_inactive: 'Notifications off ❌ — restart the app to enable',
  },

  // ── Update Prompt (PWA) ──
  updatePrompt: {
    title: 'New version available',
    description: 'Update for the latest features',
    update: 'Update',
  },

  // ── Language Switcher ──
  language: {
    cs: '🇨🇿 Čeština',
    en: '🇬🇧 English',
    switch_to_cs: 'Switch to Czech',
    switch_to_en: 'Switch to English',
  },

  // ── ActivityMoodChart interpretations ──
  interpretation: {
    none: 'none',
    weak: 'weak',
    medium: 'medium',
    strong: 'strong',
    better: 'better',
    worse: 'worse',
    negative: 'negative',
    direction_more_time_better: '📈 more time → better mood',
    direction_more_time_worse: '📉 more time → worse mood',
    direction_no_relation: '➡️ no relationship',
  },

  // ── Mood quotes ──
  quotes: {
    5: [
      'Days like this are why it all matters. ✨',
      'When the soul is at peace, the whole world smiles with you. 🌟',
      'Remember this — today you won. 🏆',
    ],
    4: [
      'A good day is like a good cup of coffee — warms and uplifts. ☕',
      'Not every day is perfect, but today came pretty close. 🙂',
      'Gratitude turns ordinary days into extraordinary ones. 💫',
    ],
    3: [
      'Even neutral days have their value — they are days of rest. 🌤️',
      'It\'s neither a peak nor a valley. Just a plain. And that\'s okay. 🛤️',
      'Tomorrow is a new day, a new chance. Today, it was enough to just be. 🌅',
    ],
    2: [
      'Even bad days end. And tomorrow starts anew. 🌙',
      'You\'re not alone. Everyone has a rough day sometimes. 🫂',
      'This is just a chapter, not the whole book. 📖',
    ],
    1: [
      'Sometimes winning is just making it through the day. And that\'s enough. 💪',
      'Rock bottom is a solid foundation to build on. 🚀',
      'Even after the worst storm, the sun comes out. Hang in there. 🌈',
    ],
  },

  // ── Activity groups (category name translations) ──
  categoryGroups: {
    sociální: 'Social',
    'volný čas': 'Hobbies',
    jídlo: 'Food',
    sport: 'Fitness',
    zdraví: 'Health',
    wellness: 'Wellness',
    práce: 'Work',
    počasí: 'Weather',
    'domácí práce': 'Chores',
    vlastní: 'Custom',
    obecné: 'Other',
  },

  // ── Layout / Metadata ──
  layout: {
    description: 'Daily check-in for your Obsidian vault',
  },
};

export type EnTranslations = typeof en;
