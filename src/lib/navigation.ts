/**
 * Shell navigation model for the web app.
 *
 * Mirrors the Android `TopLevelDestination` set: five main destinations plus
 * sub-screens that live outside the bottom bar. Everything here is pure so the
 * transitions can be unit-tested without a browser.
 */

export const MAIN_TABS = ["overview", "today", "history", "stats", "settings"] as const;
export type MainTab = (typeof MAIN_TABS)[number];

export const SUB_SCREENS = [
  "goals",
  "scales",
  "templates",
  "achievements",
  "reports",
  "export",
] as const;
export type SubScreen = (typeof SUB_SCREENS)[number];

export interface NavState {
  tab: MainTab;
  /** Sub-screen rendered on top of its parent tab, or null for the tab itself. */
  sub: SubScreen | null;
  /** Date the Today tab should open (`?edit=YYYY-MM-DD`), null = today. */
  checkinDate: string | null;
}

export const DEFAULT_NAV: NavState = { tab: "overview", sub: null, checkinDate: null };

/** i18n keys for the five bottom destinations (cs/en both define them). */
export const TAB_LABEL_KEYS: Record<MainTab, string> = {
  overview: "nav.overview",
  today: "nav.today",
  history: "nav.history",
  stats: "nav.stats",
  settings: "nav.settings",
};

export const SUB_LABEL_KEYS: Record<SubScreen, string> = {
  goals: "nav.goals",
  scales: "nav.scales",
  templates: "nav.templates",
  achievements: "nav.achievements",
  reports: "nav.reports",
  export: "nav.export",
};

/**
 * Tab a sub-screen belongs to. Back from a sub-screen returns here, and a
 * `?sub=` deep link opens the parent tab behind the chrome.
 */
export const SUB_PARENT_TAB: Record<SubScreen, MainTab> = {
  goals: "overview",
  scales: "overview",
  templates: "overview",
  achievements: "overview",
  reports: "stats",
  export: "settings",
};

export function isMainTab(value: string | null | undefined): value is MainTab {
  return value != null && (MAIN_TABS as readonly string[]).includes(value);
}

export function isSubScreen(value: string | null | undefined): value is SubScreen {
  return value != null && (SUB_SCREENS as readonly string[]).includes(value);
}

/** Strict `YYYY-MM-DD` check that rejects impossible dates such as 2026-02-31. */
export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parentTabForSub(sub: SubScreen): MainTab {
  return SUB_PARENT_TAB[sub];
}

/**
 * Parse the shell state from a location search string.
 * Unknown values fall back to the default destination instead of throwing, so a
 * stale bookmarked link never breaks the app.
 */
export function parseNavFromSearch(search: string): NavState {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);

  const subParam = params.get("sub");
  const sub = isSubScreen(subParam) ? subParam : null;

  const editParam = params.get("edit");
  const checkinDate = isValidIsoDate(editParam) ? editParam : null;

  const viewParam = params.get("view");
  const explicitTab = isMainTab(viewParam) ? viewParam : null;

  // `?edit=` alone means "open Today on that date", matching the old deep link.
  // An explicit `?view=` wins, so `?view=settings&sub=achievements` reopens the
  // same stack the user was on before a reload.
  const tab = explicitTab ?? (sub ? parentTabForSub(sub) : checkinDate ? "today" : "overview");

  return { tab, sub, checkinDate };
}

/**
 * Serialize shell state into a location search string.
 * The default destination serializes to an empty string (clean `/` URL).
 */
export function navToSearch(nav: NavState): string {
  const params = new URLSearchParams();
  if (nav.tab !== "overview") params.set("view", nav.tab);
  if (nav.sub) params.set("sub", nav.sub);
  if (nav.tab === "today" && nav.checkinDate) params.set("edit", nav.checkinDate);

  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Switch bottom destination; any open sub-screen closes with it. */
export function selectTab(nav: NavState, tab: MainTab): NavState {
  if (nav.tab === tab && nav.sub === null) return nav;
  return {
    tab,
    sub: null,
    checkinDate: tab === "today" ? nav.checkinDate : null,
  };
}

/** Open the Today tab on a specific date (dashboard day tap, calendar day tap). */
export function openCheckin(nav: NavState, date: string | null): NavState {
  return { tab: "today", sub: null, checkinDate: isValidIsoDate(date) ? date : null };
}

export function openSub(nav: NavState, sub: SubScreen): NavState {
  return { ...nav, sub };
}

export function closeSub(nav: NavState): NavState {
  return nav.sub === null ? nav : { ...nav, sub: null };
}

/** Stable key for per-destination scroll memory. */
export function navScrollKey(nav: NavState): string {
  return nav.sub ? `sub:${nav.sub}` : `tab:${nav.tab}`;
}
