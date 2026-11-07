"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { AchievementsPanel } from "@/components/AchievementsPanel";
import { Dashboard } from "@/components/Dashboard";
import { ExternalLink } from "@/components/ExternalLink";
import { HistoryView } from "@/components/history/HistoryView";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationSettingsButton } from "@/components/NotificationSettingsButton";
import { OnePageCheckIn } from "@/components/OnePageCheckIn";
import { SettingsView } from "@/components/settings/SettingsView";
import { BottomNav } from "@/components/shell/BottomNav";
import { StatsDashboard } from "@/components/StatsDashboard";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SubScreenChrome } from "@/components/ui/SubScreenChrome";
import { AndroidIcon, GitHubIcon } from "@/components/ui/icons";
import { useTranslation } from "@/lib/i18n";
import { ANDROID_APK_URL, GITHUB_WEB_URL } from "@/lib/links";
import {
  DEFAULT_NAV,
  SUB_LABEL_KEYS,
  TAB_LABEL_KEYS,
  closeSub,
  isMainTab,
  isSubScreen,
  navScrollKey,
  navToSearch,
  openCheckin,
  openSub,
  parseNavFromSearch,
  selectTab,
  type MainTab,
  type NavState,
  type SubScreen,
} from "@/lib/navigation";

/**
 * Sub-screens that have a real implementation today. The navigation model
 * already knows all of them; later phases flip the remaining ones on here.
 */
const IMPLEMENTED_SUBS: readonly SubScreen[] = ["achievements"];

interface AppShellProps {
  user: User;
  initialNav?: NavState;
  onLogout: () => void;
}

function normalizeNav(state: NavState): NavState {
  return state.sub && !IMPLEMENTED_SUBS.includes(state.sub) ? closeSub(state) : state;
}

/**
 * Authenticated app shell: five bottom destinations, Android-beta5 chrome and
 * per-destination scroll memory. Main tabs stay mounted once visited, so
 * switching destinations never refetches or loses a half-written check-in.
 */
export function AppShell({ user, initialNav = DEFAULT_NAV, onLogout }: AppShellProps) {
  const { t, lang } = useTranslation();

  const [nav, setNav] = useState<NavState>(() => normalizeNav(initialNav));
  const [visited, setVisited] = useState<Set<MainTab>>(() => new Set([nav.tab]));
  const [checkinNonce, setCheckinNonce] = useState(0);

  const initialNavRef = useRef(nav);
  const subPushedRef = useRef(false);

  const markVisited = useCallback((tab: MainTab) => {
    setVisited((previous) =>
      previous.has(tab) ? previous : new Set(previous).add(tab)
    );
  }, []);

  const activeKey = navScrollKey(nav);
  const scrollPositions = useRef<Record<string, number>>({});
  const suppressScrollSave = useRef(false);
  const previousKey = useRef(activeKey);

  const urlFor = useCallback(
    (state: NavState) => `${window.location.pathname}${navToSearch(state)}`,
    []
  );

  const writeHistory = useCallback(
    (state: NavState, mode: "push" | "replace") => {
      const method = mode === "push" ? "pushState" : "replaceState";
      window.history[method]({ diariumNav: state }, "", urlFor(state));
    },
    [urlFor]
  );

  // Seed the first history entry so browser back can return to it.
  useEffect(() => {
    const initial = initialNavRef.current;
    window.history.replaceState({ diariumNav: initial }, "", urlFor(initial));
  }, [urlFor]);

  // Browser back/forward: restore the destination stored in the history entry.
  // An open sub-screen must close instead of leaving the app.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const stored = (event.state as { diariumNav?: NavState } | null)?.diariumNav;

      if (
        stored &&
        isMainTab(stored.tab) &&
        (stored.sub === null || isSubScreen(stored.sub))
      ) {
        subPushedRef.current = false;
        markVisited(stored.tab);
        setNav(normalizeNav(stored));
        return;
      }

      const next = nav.sub
        ? closeSub(nav)
        : parseNavFromSearch(window.location.search);
      markVisited(next.tab);
      setNav(next);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [markVisited, nav]);

  // Remember the scroll offset of the destination currently on screen.
  useEffect(() => {
    const key = activeKey;
    const onScroll = () => {
      if (suppressScrollSave.current) return;
      scrollPositions.current[key] = window.scrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [activeKey]);

  // Restore the offset of the destination that just became active.
  useLayoutEffect(() => {
    if (previousKey.current === activeKey) return;
    previousKey.current = activeKey;

    const offset = scrollPositions.current[activeKey] ?? 0;
    suppressScrollSave.current = true;
    window.scrollTo(0, offset);

    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, offset);
      suppressScrollSave.current = false;
    });

    return () => {
      cancelAnimationFrame(frame);
      suppressScrollSave.current = false;
    };
  }, [activeKey]);

  const handleSelectTab = useCallback(
    (tab: MainTab) => {
      const next = selectTab(nav, tab);
      if (next === nav) return;

      subPushedRef.current = false;
      markVisited(next.tab);
      writeHistory(next, "push");
      setNav(next);
    },
    [markVisited, nav, writeHistory]
  );

  const handleNavigateToCheckIn = useCallback(
    (date: string) => {
      const next = openCheckin(nav, date);
      setCheckinNonce((nonce) => nonce + 1);
      markVisited(next.tab);
      writeHistory(next, "push");
      setNav(next);
    },
    [markVisited, nav, writeHistory]
  );

  const handleCheckinSaved = useCallback(() => {
    const next = { ...nav, checkinDate: null };
    writeHistory(next, "replace");
    setNav(next);
  }, [nav, writeHistory]);

  const handleOpenSub = useCallback(
    (sub: SubScreen) => {
      const next = openSub(nav, sub);
      subPushedRef.current = true;
      markVisited(next.tab);
      writeHistory(next, "push");
      setNav(next);
    },
    [markVisited, nav, writeHistory]
  );

  const handleBack = useCallback(() => {
    if (nav.sub && subPushedRef.current) {
      subPushedRef.current = false;
      window.history.back();
      return;
    }

    const next = closeSub(nav);
    writeHistory(next, "replace");
    setNav(next);
  }, [nav, writeHistory]);

  const todayLabel = new Date().toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const subtitle =
    nav.tab === "overview"
      ? todayLabel
      : nav.tab === "settings"
        ? user.email || t("settings.subtitle")
        : t(`${nav.tab}.subtitle`);

  const headerActions = (
    <div className="flex items-center gap-0.5">
      <LanguageSwitcher />
      <NotificationSettingsButton />
      <ExternalLink
        href={GITHUB_WEB_URL}
        label={t("links.github")}
        compact
        showIcon={false}
        className="text-white/45 hover:text-white"
      >
        <GitHubIcon size={19} />
      </ExternalLink>
      <ExternalLink
        href={ANDROID_APK_URL}
        label={t("links.download_apk")}
        compact
        showIcon={false}
        className="text-white/45 hover:text-white"
      >
        <AndroidIcon size={19} />
      </ExternalLink>
    </div>
  );

  const panel = (tab: MainTab, content: ReactNode) => {
    const mounted = visited.has(tab) || nav.tab === tab;
    return (
      <div
        role="tabpanel"
        id={`shell-panel-${tab}`}
        aria-label={t(TAB_LABEL_KEYS[tab])}
        hidden={nav.tab !== tab || nav.sub !== null}
      >
        {mounted ? content : null}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className="mx-auto w-full max-w-[620px] px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-3">
        {nav.sub === null && nav.tab !== "today" ? (
          <ScreenHeader title={t(TAB_LABEL_KEYS[nav.tab])} subtitle={subtitle} trailing={headerActions} />
        ) : null}

        <main className="relative z-[1]">
          {panel(
            "overview",
            <Dashboard
              onNavigateToCheckIn={handleNavigateToCheckIn}
              onNavigateToStats={() => handleSelectTab("stats")}
            />
          )}
          {panel(
            "today",
            <OnePageCheckIn
              key={`checkin-${checkinNonce}-${nav.checkinDate ?? "today"}`}
              initialDate={nav.checkinDate}
              onSaveDone={handleCheckinSaved}
              onBack={() => handleSelectTab("overview")}
            />
          )}
          {panel("history", <HistoryView onNavigateToDate={handleNavigateToCheckIn} />)}
          {panel("stats", <StatsDashboard onNavigateToDate={handleNavigateToCheckIn} />)}
          {panel(
            "settings",
            <SettingsView
              email={user.email}
              onLogout={onLogout}
              onOpenSub={handleOpenSub}
            />
          )}
        </main>

        {nav.sub ? (
          <SubScreenChrome title={t(SUB_LABEL_KEYS[nav.sub])} onBack={handleBack}>
            {nav.sub === "achievements" ? <AchievementsPanel /> : null}
          </SubScreenChrome>
        ) : null}
      </div>

      <BottomNav active={nav.sub ? null : nav.tab} onSelect={handleSelectTab} />
    </div>
  );
}
