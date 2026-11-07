/**
 * Per-user local state cleanup on logout.
 *
 * Auth tokens alone are not enough: check-in drafts, locally stored goals and
 * the Google Photos access token would otherwise be visible to (or usable by)
 * the next account on a shared device.
 */

export interface RemovableStorage {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export function clearUserLocalState(storage: RemovableStorage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }

  for (const key of keys) {
    const isAuth = key.startsWith("sb-") || key.includes("supabase");
    const isUserData =
      key.startsWith("diarium_draft_") ||
      key === "diarium_goals" ||
      key === "diarium_google_token" ||
      key === "diarium_google_token_expires_at";
    if (isAuth || isUserData) storage.removeItem(key);
  }
}
