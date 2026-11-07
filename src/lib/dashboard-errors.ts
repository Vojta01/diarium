/**
 * Semantic failures for the dashboard data layer.
 *
 * The UI phase must be able to tell a signed-out session apart from a failed
 * read without parsing Czech sentences: `kind` drives the "session expired,
 * sign in again" state, `status` mirrors HTTP, and `code` is an i18n key the
 * screen can pass to `t()`. No user-facing copy lives in the data layer.
 */
export type DashboardErrorKind = "signed_out" | "load_failed";

/** Stable i18n keys the dashboard UI maps to `errors.*` translations. */
export type DashboardErrorCode =
  | "errors.signed_out"
  | "errors.entries_load"
  | "errors.goals_load"
  | "errors.scales_load"
  | "errors.habits_load";

export const DASHBOARD_ERROR_CODES = {
  signedOut: "errors.signed_out",
  entries: "errors.entries_load",
  goals: "errors.goals_load",
  scales: "errors.scales_load",
  habits: "errors.habits_load",
} as const satisfies Record<string, DashboardErrorCode>;

/**
 * One coherent dashboard failure.
 *
 * `message` is the semantic code, never a sentence: logging shows the code and
 * the UI renders the translation. `cause` keeps the transport error available
 * for diagnostics.
 */
export class DashboardDataError extends Error {
  readonly kind: DashboardErrorKind;
  readonly code: DashboardErrorCode;
  readonly status: number;

  constructor(
    kind: DashboardErrorKind,
    code: DashboardErrorCode,
    status: number,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = "DashboardDataError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

/** The one signed-out error every dashboard read throws. */
export function signedOutError(): DashboardDataError {
  return new DashboardDataError(
    "signed_out",
    DASHBOARD_ERROR_CODES.signedOut,
    401
  );
}

/** A transport/query failure with a stable code instead of a Czech sentence. */
export function loadFailedError(
  code: DashboardErrorCode,
  cause?: unknown
): DashboardDataError {
  return new DashboardDataError("load_failed", code, 500, { cause });
}

/** Pass an existing dashboard error through; wrap anything else as `fallback`. */
export function toDashboardError(
  error: unknown,
  fallback: DashboardErrorCode
): DashboardDataError {
  return error instanceof DashboardDataError
    ? error
    : loadFailedError(fallback, error);
}

/** The semantic code for a bundle field; unknown errors use the card's code. */
export function dashboardErrorCode(
  error: unknown,
  fallback: DashboardErrorCode
): DashboardErrorCode {
  return error instanceof DashboardDataError ? error.code : fallback;
}

/** True when the failure means "no authenticated user", not "read failed". */
export function isDashboardAuthError(error: unknown): boolean {
  return error instanceof DashboardDataError && error.kind === "signed_out";
}
