-- Diarium — runtime AI settings
-- 2026-09-10
--
-- Goal: the DeepSeek model ID must be changeable from the database, without a
-- redeploy of the Next.js app. Vojta switches model here when a new one ships.
--
-- Verified against DeepSeek's own /models endpoint on 2026-09-10:
--   available : deepseek-flash (V4.1 Flash), deepseek-v4-pro (V4 Pro)
--   legacy    : deepseek-v4-flash is an ALIAS DeepSeek maps to deepseek-flash
--               (a request for it answers with "model":"deepseek-flash")
--   therefore switching deepseek-v4-flash -> deepseek-flash changes nothing
--   functionally; it only canonicalises the ID.
--
-- To change the model later, run:
--   update public.app_settings
--      set value = 'deepseek-v4-pro', updated_at = now()
--    where key = 'deepseek_model';
-- The app picks it up within 60 seconds (in-process cache TTL).

create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is
  'Runtime configuration for Diarium. Read by server routes via service_role. Change values here to reconfigure the app without redeploying.';

-- Server-only table: RLS enabled with NO policies, so anon/authenticated
-- clients can read nothing. The API routes use the service_role key, which
-- bypasses RLS, so they keep working.
alter table public.app_settings enable row level security;

-- Seed. On re-run, only the description is refreshed so a value Vojta has
-- changed by hand is never silently reverted.
insert into public.app_settings (key, value, description) values
  ('deepseek_model',
   'deepseek-flash',
   'DeepSeek model for AI reflections (ai/reflect), periodic reports (ai/periodic) and cron reports (cron/ai-report). Canonical IDs: deepseek-flash (V4.1 Flash), deepseek-v4-pro (V4 Pro). Change the value to switch model — no redeploy needed, takes effect within 60s.')
on conflict (key) do update set description = excluded.description;

-- Verify
select key, value, updated_at from public.app_settings order by key;
