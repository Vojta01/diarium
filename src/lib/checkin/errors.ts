/**
 * Semantic check-in failures.
 *
 * The data layer never invents user-facing prose: every failure carries a
 * stable i18n key (`code`) and a `kind` that tells the screen whether to show a
 * retry, keep the form editable, or offer the photo picker again. This is what
 * replaces the old `catch {}` blocks that made a failed load look like an empty
 * day and a failed save look like a successful one.
 */
import { isUnauthorizedRead } from "../dashboard-errors.ts";

export type CheckInErrorKind =
  | "signed_out"
  | "load_failed"
  | "save_failed"
  | "photo_failed"
  | "ai_failed";

export type CheckInErrorCode =
  | "checkin.error_load"
  | "checkin.error_save_auth"
  | "checkin.error_save_forbidden"
  | "checkin.error_save_validation"
  | "checkin.error_save_server"
  | "checkin.error_save_network"
  | "checkin.error_save_generic"
  | "checkin.photo_error_type"
  | "checkin.photo_error_size"
  | "checkin.photo_error_read"
  | "checkin.photo_error_upload"
  | "checkin.reflection_error_auth"
  | "checkin.reflection_error_restricted"
  | "checkin.reflection_error_cooldown"
  | "checkin.reflection_error_server"
  | "checkin.reflection_error_empty"
  | "checkin.reflection_error_network"
  | "checkin.reflection_error_save"
  | "checkin.reflection_error_generic";

/** One coherent check-in failure. `message` is the code, never a sentence. */
export class CheckInError extends Error {
  readonly kind: CheckInErrorKind;
  readonly code: CheckInErrorCode;
  readonly status: number;

  constructor(
    kind: CheckInErrorKind,
    code: CheckInErrorCode,
    status = 0,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = "CheckInError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export function isCheckInError(error: unknown): error is CheckInError {
  return error instanceof CheckInError;
}

/** A failed read. A 401 is surfaced as signed out so retry copy can differ. */
export function loadFailedError(cause?: unknown, status?: number): CheckInError {
  return isUnauthorizedRead(cause, status)
    ? new CheckInError("signed_out", "checkin.error_load", 401, { cause })
    : new CheckInError("load_failed", "checkin.error_load", status ?? 500, {
        cause,
      });
}

/** A failed save, mapped from the route's HTTP status. */
export function saveFailedError(status: number, cause?: unknown): CheckInError {
  const code: CheckInErrorCode =
    status === 401
      ? "checkin.error_save_auth"
      : status === 403
        ? "checkin.error_save_forbidden"
        : status === 400 || status === 422
          ? "checkin.error_save_validation"
          : status >= 500
            ? "checkin.error_save_server"
            : "checkin.error_save_generic";

  return new CheckInError(
    status === 401 ? "signed_out" : "save_failed",
    code,
    status,
    { cause }
  );
}

export function saveNetworkError(cause?: unknown): CheckInError {
  return new CheckInError("save_failed", "checkin.error_save_network", 0, {
    cause,
  });
}

export function photoError(
  code:
    | "checkin.photo_error_type"
    | "checkin.photo_error_size"
    | "checkin.photo_error_read"
    | "checkin.photo_error_upload",
  cause?: unknown
): CheckInError {
  return new CheckInError("photo_failed", code, 0, { cause });
}

/** AI route status mapping, mirroring Android's AiReflectionRepository. */
export function aiFailedError(status: number, cause?: unknown): CheckInError {
  const code: CheckInErrorCode =
    status === 401
      ? "checkin.reflection_error_auth"
      : status === 403
        ? "checkin.reflection_error_restricted"
        : status === 429
          ? "checkin.reflection_error_cooldown"
          : status === 502 || status >= 500
            ? "checkin.reflection_error_server"
            : "checkin.reflection_error_generic";

  return new CheckInError(
    status === 401 ? "signed_out" : "ai_failed",
    code,
    status,
    { cause }
  );
}

export function aiEmptyError(): CheckInError {
  return new CheckInError(
    "ai_failed",
    "checkin.reflection_error_empty",
    200
  );
}

export function aiNetworkError(cause?: unknown): CheckInError {
  return new CheckInError(
    "ai_failed",
    "checkin.reflection_error_network",
    0,
    { cause }
  );
}

export function aiPersistError(cause?: unknown): CheckInError {
  return new CheckInError(
    "ai_failed",
    "checkin.reflection_error_save",
    0,
    { cause }
  );
}

/**
 * Pass a check-in error through; wrap anything else with the caller's fallback.
 * A raw `TypeError` from `fetch` is a network failure, not a validation one.
 */
export function toCheckInError(
  error: unknown,
  fallback: CheckInErrorCode = "checkin.error_save_generic"
): CheckInError {
  if (isCheckInError(error)) return error;
  if (error instanceof TypeError) {
    return new CheckInError("save_failed", "checkin.error_save_network", 0, {
      cause: error,
    });
  }
  const kind: CheckInErrorKind = fallback.startsWith("checkin.photo")
    ? "photo_failed"
    : fallback.startsWith("checkin.reflection")
      ? "ai_failed"
      : "save_failed";
  return new CheckInError(kind, fallback, 0, { cause: error });
}
