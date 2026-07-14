-- Forward hardening for environments that already applied 0005 before the
-- migration_reports access rules were added there.

alter table if exists public.migration_reports enable row level security;

revoke all on table public.migration_reports from anon, authenticated;
revoke all on sequence public.migration_reports_id_seq from anon, authenticated;

grant select, insert on table public.migration_reports to service_role;
grant usage, select on sequence public.migration_reports_id_seq to service_role;
