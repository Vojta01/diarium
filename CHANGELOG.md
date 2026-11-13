# Changelog

All notable changes to the Diarium web app. The Android app has its own
changelog in the `diarium-android` repository.

## 2.0.0 — 2026-11-12

Compared with the previously deployed build `f10be101`.

### Added

- **Conditional save with revision check.** Each save sends the row ID and
  revision the editor started from. The server rejects a stale write and the
  app shows a conflict instead of silently overwriting newer text. Backed by
  `public.save_daily_entry_v2`.
- **Durable pending save.** A save request is stored locally before the network
  call. It survives reload, reconnect and app restart, and a replay returns the
  original receipt instead of writing twice.
- **Cross-tab draft lock.** Web Locks ensure one tab edits a draft at a time.
  A second tab keeps its own copy and offers recovery instead of overwriting.
- **Draft conflict panels.** A server draft and a local candidate are shown side
  by side. The user chooses explicitly; no automatic merge.
- **Verified session requirement.** Private reads, writes and exports require a
  session confirmed by the auth server, not just a stored token.
- **Offline workspace notice.** The app states when it works from local state.

### Changed

- **Photos are detached, not deleted.** Removing a photo from an entry clears
  the reference in the record and keeps the stored file. The interface explains
  that the file can remain reachable through its original URL.
- **Auth callback.** The PKCE code is exchanged once, errors are shown, and the
  redirect target is `https://diarium.digitalni-vedomi.cz/auth-callback.html`.

### Fixed

- Authenticated API responses are never cached by the service worker, and an
  offline fallback cannot return another account's export.

### Database

Requires migration `database/conditional_save_move_candidate_atomic_2026-11-11.sql`
applied through `database/apply_conditional_save_move_candidate.sh`:
`entries.revision`, `save_daily_entry_v2`, `entry_move_v1_receipts`,
`entry_save_v2_receipts` and the owner-role policies. The legacy
`save_daily_entry(jsonb)` stays callable during the transition.
