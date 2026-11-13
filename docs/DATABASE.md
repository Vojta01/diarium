# Supabase database setup and SQL inventory

The web app uses Supabase Auth, Postgres and Storage. SQL scripts live in [`database/`](../database/), not in a `supabase/migrations/` directory. This repository does not include a migration runner, schema-version table or a single, tested sequence for creating a fresh project.

Treat these files as manual, project-specific SQL—not as a set to execute blindly. Review the target schema and each script before applying it, preferably against a non-production project first. Some scripts make targeted data changes or assume tables and policies already exist.

## Base and feature schema files

| File | Purpose |
|---|---|
| [`database/supabase_schema.sql`](../database/supabase_schema.sql) | Older base schema for profiles, entries, activity/habit catalogs and per-user activity/habit rows. This file alone does not include all columns and tables used by the current app. |
| [`database/supabase_schema_update.sql`](../database/supabase_schema_update.sql) | Adds `entries.ai_reflection` and creates `ai_reports`. |
| [`database/migration_daylio_expansion.sql`](../database/migration_daylio_expansion.sql) | Adds goals, scales, scale entries, templates and achievements, plus `entries.scale_values`. |
| [`database/storage_migration.sql`](../database/storage_migration.sql) | Creates/configures the `diary-photos` bucket and its object policies. The script marks the bucket **public**; do not assume photo URLs are private. Review this choice before using it for a new deployment. |

The web app also reads other schema objects for optional or later-added behavior. The scripts below are not a guaranteed fresh-install order:

| File | Purpose and scope |
|---|---|
| [`database/ai_settings_2026-09-10.sql`](../database/ai_settings_2026-09-10.sql) | Creates `app_settings` and seeds the runtime DeepSeek model setting. Used only when this optional database setting is present; the app has an environment/default fallback. |
| [`database/security_hardening_2026-09-10.sql`](../database/security_hardening_2026-09-10.sql) | Adjusts policies for `ai_reports` and the activity/habit catalogs. It assumes those tables and relevant policies already exist. |
| [`database/activities_label_dedupe_2026-09-11.sql`](../database/activities_label_dedupe_2026-09-11.sql) | A targeted activity/habit cleanup plus indexes and triggers. It includes a data-changing `DELETE`; inspect the target data and script before applying. |
| [`database/migration_push_tokens.sql`](../database/migration_push_tokens.sql) | Creates an Android/FCM `push_tokens` table. This is separate from browser Web Push, whose subscriptions are stored in Upstash Redis; this table is not required for the web push path. |
| [`database/rpc_business_logic_2026-09-10.sql`](../database/rpc_business_logic_2026-09-10.sql) | Adds SQL functions and triggers for entry-save/achievement logic. The deployed web save route calls `save_daily_entry_v2`, not the legacy `save_daily_entry()`; keep this file for the achievement and trigger functions that the current schema still relies on. |

Backup and data-operation SQL files are not schema migrations. Do not use them as part of a fresh setup or run them without understanding their effect.

## Database test SQL

[`database/tests/rpc_business_logic_test_2026-09-10.sql`](../database/tests/rpc_business_logic_test_2026-09-10.sql) is a separate `psql`-based check for the RPC functions. It is not included in `npm test`; review its database assumptions and connection target before running it. The Node tests documented in the [README](../README.md#tests-and-checks) do not require a Supabase connection.

## Conditional saves and atomic date moves (deployed 2026-11-13)

The deployed web app saves through `public.save_daily_entry_v2(jsonb, boolean, uuid, bigint, uuid)`.
It sends the row ID and revision the editor started from and receives either a saved
entry or a conflict envelope. The legacy `public.save_daily_entry(jsonb)` stays
callable during the transition, so an older client can still write until a
separately approved cutoff.

| File | Purpose |
|---|---|
| [`database/conditional_save_move_candidate_atomic_2026-11-11.sql`](../database/conditional_save_move_candidate_atomic_2026-11-11.sql) | Single transaction that applies all three fragments below. Run it only through the shell runner. |
| [`database/apply_conditional_save_move_candidate.sh`](../database/apply_conditional_save_move_candidate.sh) | Fail-closed runner: verifies the target database, role, TLS mode, passfile permissions, backup reference and change window, then applies the atomic file. |
| [`database/save_daily_entry_v2_2026-11-10.sql`](../database/save_daily_entry_v2_2026-11-10.sql) | Adds `entries.revision` with a monotonic trigger, `entry_save_v2_receipts`, the owner role and `save_daily_entry_v2`. |
| [`database/entry_date_move_v1_2026-11-10.sql`](../database/entry_date_move_v1_2026-11-10.sql) | Adds `move_daily_entry_v1`, `entry_move_v1_receipts` and its owner role. |
| [`database/android_move_capability_v1_2026-11-11.sql`](../database/android_move_capability_v1_2026-11-11.sql) | Read-only capability check used by the Android client to show the date-move action only when the server supports it. |
| [`database/verify_conditional_save_move_candidate.sql`](../database/verify_conditional_save_move_candidate.sql) | Read-only post-migration verification. Fails when a column, function, role, grant or revision backfill is missing. |
| [`database/rollback_conditional_save_move_candidate.sql`](../database/rollback_conditional_save_move_candidate.sql) | Emergency rollback of exactly the objects created by the migration. |

Two operational rules apply to this migration:

- **Owner roles cannot read the `auth` schema.** On Supabase the `postgres` role cannot
  grant `USAGE` on `auth`, so `auth.uid()` and `auth.jwt()` are unreachable from a
  `SECURITY DEFINER` owner role. The migration therefore defines
  `public.diarium_auth_uid()` and `public.diarium_auth_jwt()`, which read the same
  `request.jwt.*` settings without touching that schema. Policies call those helpers.
- **Role membership is needed before the migration runs.** `postgres` is not a
  superuser on Supabase and cannot transfer table ownership to a role it is not a
  member of. Create both `diarium_entry_*_owner` roles and grant them to `postgres`
  first, otherwise the transaction stops at `ALTER TABLE ... OWNER TO` and rolls back.

## Practical guidance

For a brand-new Supabase project, the checked-in SQL is not yet a complete, maintained bootstrap sequence. Use the base and feature files above as references, resolve their dependencies against the current source, and validate the result in a disposable project before deployment. For an existing project, apply only the migrations appropriate to its current schema. Keep service-role keys and other credentials in environment settings, never in SQL documentation or source control.
