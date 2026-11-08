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
| [`database/rpc_business_logic_2026-09-10.sql`](../database/rpc_business_logic_2026-09-10.sql) | Adds SQL functions and triggers for entry-save/achievement logic. The current web save route uses a direct Supabase upsert and does not call `save_daily_entry()`. Apply this only if the client/version being deployed uses these database functions. |

Backup and data-operation SQL files are not schema migrations. Do not use them as part of a fresh setup or run them without understanding their effect.

## Database test SQL

[`database/tests/rpc_business_logic_test_2026-09-10.sql`](../database/tests/rpc_business_logic_test_2026-09-10.sql) is a separate `psql`-based check for the RPC functions. It is not included in `npm test`; review its database assumptions and connection target before running it. The Node tests documented in the [README](../README.md#tests-and-checks) do not require a Supabase connection.

## Practical guidance

For a brand-new Supabase project, the checked-in SQL is not yet a complete, maintained bootstrap sequence. Use the base and feature files above as references, resolve their dependencies against the current source, and validate the result in a disposable project before deployment. For an existing project, apply only the migrations appropriate to its current schema. Keep service-role keys and other credentials in environment settings, never in SQL documentation or source control.
