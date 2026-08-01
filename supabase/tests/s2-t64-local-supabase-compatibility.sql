create extension if not exists pgcrypto;

-- The standalone Supabase image includes DDL notification event triggers whose
-- companion GraphQL/PostgREST services are not running in this isolated test.
-- Disable only those notifications; schema, RLS, grants, and functions remain
-- the exact migration-owned objects under test.
do $$
declare
  v_trigger text;
begin
  foreach v_trigger in array array[
    'graphql_watch_ddl',
    'graphql_watch_drop',
    'pgrst_ddl_watch',
    'pgrst_drop_watch'
  ] loop
    if exists (select 1 from pg_event_trigger where evtname = v_trigger) then
      execute format('alter event trigger %I disable', v_trigger);
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
