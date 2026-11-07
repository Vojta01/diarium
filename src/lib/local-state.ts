/**
 * Per-user local state cleanup on logout.
 *
 * Auth tokens alone are not enough: check-in drafts and locally stored goals
 * would otherwise be visible to the next account on a shared device.
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
    const isUserData = key.startsWith("diarium_draft_") || key === "diarium_goals";
    if (isAuth || isUserData) storage.removeItem(key);
  }
}
