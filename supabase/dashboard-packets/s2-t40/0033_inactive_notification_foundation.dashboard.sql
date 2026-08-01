-- S2-T40 Dashboard packet: 0033
-- Approved staging ref: bmqhwofmdgebpcihjlnb
-- Exact source: supabase/migrations/0033_inactive_notification_foundation.sql
-- Source SHA-256: 0996ecd9fcf6e4fb2b083d980e69a0c2dd042107bc8e753fdd43f79d0bcb0a1d
-- STATUS: BLOCKED_SOURCE_PREPARATION_ONLY
-- This packet must not be executed until the authorized read-only history
-- shape/parity inspection and a separately reviewed history insert are complete.

begin;

do $s2_t40_history_gate$
begin
  raise exception 'S2_T40_STOP_HISTORY_SHAPE_NOT_CONFIRMED'
    using errcode = 'P0001';
end
$s2_t40_history_gate$;

-- S2_T40_EXACT_MIGRATION_BODY_BEGIN
-- S2-T04: inactive shared notification data and registration foundation.
--
-- This migration creates no provider integration, permission prompt, send
-- function, delivery queue, or scheduler. The two approved Care Circle types
-- are registered but cannot be enabled by this schema.
--
-- Forward-only recovery:
--   1. keep the release Notifications and Care Circle screens in preview mode;
--   2. do not deploy the notification-device Edge Function;
--   3. leave all registry rows disabled;
--   4. repair schema defects with a later corrective migration.

-- Retire participant access to the legacy message-body scaffold. Existing rows
-- are preserved for a later privacy-reviewed migration; no new caller is added.
drop policy if exists "users can read own notifications"
  on public.notifications;
drop policy if exists "users can update own notification read state"
  on public.notifications;
revoke all on table public.notifications from anon, authenticated;
grant all on table public.notifications to service_role;

comment on table public.notifications is
  'Legacy inactive scaffold. Participant access is disabled by migration 0033; do not use for push delivery.';

create table public.notification_type_registry (
  notification_type text primary key,
  enabled boolean not null default false
    check (enabled = false),
  purpose text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_type_registry_allowlist_check check (
    notification_type in (
      'care_circle_check_in',
      'care_circle_reminder'
    )
  )
);

insert into public.notification_type_registry (
  notification_type,
  enabled,
  purpose
) values
  (
    'care_circle_check_in',
    false,
    'Inactive Care Circle check-in notification foundation'
  ),
  (
    'care_circle_reminder',
    false,
    'Inactive Care Circle reminder notification foundation'
  );

create table public.notification_account_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications_enabled boolean not null default false
    check (notifications_enabled = false),
  updated_at timestamptz not null default now()
);

create table public.notification_type_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null
    references public.notification_type_registry(notification_type),
  enabled boolean not null default false
    check (enabled = false),
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_type)
);

-- Tokens are encrypted by the backend before this table is called. The raw
-- provider token must never be sent as an RPC argument or stored in Postgres.
create table public.notification_device_endpoints (
  endpoint_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  installation_id uuid not null,
  platform text not null check (platform in ('ios', 'android')),
  provider text not null check (provider in ('expo', 'apns', 'fcm')),
  token_fingerprint text not null,
  token_ciphertext text not null,
  permission_status text not null check (
    permission_status in ('granted', 'provisional')
  ),
  app_version text,
  device_locale text,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_device_endpoint_fingerprint_check check (
    token_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint notification_device_endpoint_ciphertext_check check (
    length(token_ciphertext) between 32 and 8192
  ),
  constraint notification_device_endpoint_app_version_check check (
    app_version is null or length(app_version) <= 64
  ),
  constraint notification_device_endpoint_locale_check check (
    device_locale is null or length(device_locale) <= 32
  ),
  unique (user_id, installation_id),
  unique (provider, token_fingerprint)
);

create index notification_device_endpoints_inactive_idx
  on public.notification_device_endpoints (last_seen_at);

create table public.notification_registration_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in (
    'register',
    'unregister',
    'permission_revoked',
    'provider_invalid',
    'account_deleted',
    'inactive_pruned'
  )),
  request_digest text not null,
  endpoint_id uuid references public.notification_device_endpoints(endpoint_id)
    on delete set null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create index notification_registration_requests_created_idx
  on public.notification_registration_requests (created_at);

-- Audit metadata is deliberately content-free. user_id becomes null on account
-- deletion, while the minimal operational event remains for at most 90 days.
create table public.notification_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  endpoint_id uuid,
  event_type text not null check (event_type in (
    'device_registered',
    'device_rotated',
    'device_unregistered',
    'permission_revoked',
    'provider_token_invalidated',
    'account_devices_removed',
    'inactive_device_pruned',
    'preference_disabled'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '90 days'),
  constraint notification_audit_retention_check check (
    retention_until > created_at
    and retention_until <= created_at + interval '90 days'
  )
);

create index notification_audit_events_retention_idx
  on public.notification_audit_events (retention_until);

create or replace function public.notification_audit_metadata_is_safe(
  p_metadata jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
    and pg_column_size(coalesce(p_metadata, '{}'::jsonb)) <= 2048
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(p_metadata, '{}'::jsonb)) as key_name
      where key_name not in (
        'reason',
        'platform',
        'provider',
        'permission_status',
        'request_id',
        'endpoint_id',
        'removed_count'
      )
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'reason')
      or p_metadata->>'reason' in (
        'logout',
        'permission_revoked',
        'provider_invalid',
        'account_deleted',
        'inactive_90_days',
        'user_opt_out'
      )
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'platform')
      or p_metadata->>'platform' in ('ios', 'android')
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'provider')
      or p_metadata->>'provider' in ('expo', 'apns', 'fcm')
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'permission_status')
      or p_metadata->>'permission_status' in ('granted', 'provisional')
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'request_id')
      or p_metadata->>'request_id'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'endpoint_id')
      or p_metadata->>'endpoint_id'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    and (
      not (coalesce(p_metadata, '{}'::jsonb) ? 'removed_count')
      or (
        jsonb_typeof(p_metadata->'removed_count') = 'number'
        and p_metadata->>'removed_count' ~ '^[0-9]{1,3}$'
        and (p_metadata->>'removed_count')::integer between 0 and 100
      )
    );
$$;

alter table public.notification_audit_events
  add constraint notification_audit_metadata_safe_check
  check (public.notification_audit_metadata_is_safe(metadata));

alter table public.notification_type_registry enable row level security;
alter table public.notification_account_preferences enable row level security;
alter table public.notification_type_preferences enable row level security;
alter table public.notification_device_endpoints enable row level security;
alter table public.notification_registration_requests enable row level security;
alter table public.notification_audit_events enable row level security;

revoke all on table public.notification_type_registry from anon, authenticated;
revoke all on table public.notification_account_preferences from anon, authenticated;
revoke all on table public.notification_type_preferences from anon, authenticated;
revoke all on table public.notification_device_endpoints from anon, authenticated;
revoke all on table public.notification_registration_requests from anon, authenticated;
revoke all on table public.notification_audit_events from anon, authenticated;

grant select on table public.notification_type_registry to service_role;
grant all on table public.notification_account_preferences to service_role;
grant all on table public.notification_type_preferences to service_role;
grant all on table public.notification_device_endpoints to service_role;
grant all on table public.notification_registration_requests to service_role;
grant all on table public.notification_audit_events to service_role;

create or replace function public.register_notification_device_endpoint(
  p_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_installation_id uuid,
  p_platform text,
  p_provider text,
  p_token_fingerprint text,
  p_token_ciphertext text,
  p_permission_status text,
  p_app_version text default null,
  p_device_locale text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_request public.notification_registration_requests%rowtype;
  v_existing_endpoint public.notification_device_endpoints%rowtype;
  v_endpoint_id uuid;
  v_event_type text;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOTIFICATION_SERVICE_REQUIRED' using errcode = '42501';
  end if;

  if p_user_id is null
    or p_request_id is null
    or p_installation_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null
    or p_platform not in ('ios', 'android')
    or p_provider not in ('expo', 'apns', 'fcm')
    or p_permission_status not in ('granted', 'provisional')
    or coalesce(p_token_fingerprint, '') !~ '^[a-f0-9]{64}$'
    or length(coalesce(p_token_ciphertext, '')) not between 32 and 8192 then
    raise exception 'NOTIFICATION_REGISTRATION_INVALID' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_user_id
      and deleted_at is null
  ) then
    raise exception 'NOTIFICATION_ACCOUNT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'notification-request:' || p_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing_request
  from public.notification_registration_requests
  where user_id = p_user_id
    and request_id = p_request_id;

  if found then
    if v_existing_request.operation <> 'register'
      or v_existing_request.request_digest <> trim(p_request_digest) then
      raise exception 'NOTIFICATION_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing_request.response_json;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('notification-installation:' || p_installation_id::text, 0)
  );

  select *
  into v_existing_endpoint
  from public.notification_device_endpoints
  where user_id = p_user_id
    and installation_id = p_installation_id
  for update;

  v_event_type := case
    when found then 'device_rotated'
    else 'device_registered'
  end;

  -- A provider token belongs to one current installation/account. This permits
  -- a device to change accounts only through authenticated backend registration.
  delete from public.notification_device_endpoints
  where provider = p_provider
    and token_fingerprint = p_token_fingerprint
    and (
      user_id <> p_user_id
      or installation_id <> p_installation_id
    );

  insert into public.notification_device_endpoints (
    user_id,
    installation_id,
    platform,
    provider,
    token_fingerprint,
    token_ciphertext,
    permission_status,
    app_version,
    device_locale,
    registered_at,
    last_seen_at,
    updated_at
  ) values (
    p_user_id,
    p_installation_id,
    p_platform,
    p_provider,
    p_token_fingerprint,
    p_token_ciphertext,
    p_permission_status,
    nullif(trim(coalesce(p_app_version, '')), ''),
    nullif(trim(coalesce(p_device_locale, '')), ''),
    now(),
    now(),
    now()
  )
  on conflict (user_id, installation_id) do update
  set
    platform = excluded.platform,
    provider = excluded.provider,
    token_fingerprint = excluded.token_fingerprint,
    token_ciphertext = excluded.token_ciphertext,
    permission_status = excluded.permission_status,
    app_version = excluded.app_version,
    device_locale = excluded.device_locale,
    last_seen_at = now(),
    updated_at = now()
  returning endpoint_id into v_endpoint_id;

  v_result := jsonb_build_object(
    'ok', true,
    'endpoint_id', v_endpoint_id,
    'registered', true
  );

  insert into public.notification_registration_requests (
    user_id,
    request_id,
    operation,
    request_digest,
    endpoint_id,
    response_json
  ) values (
    p_user_id,
    p_request_id,
    'register',
    trim(p_request_digest),
    v_endpoint_id,
    v_result
  );

  insert into public.notification_audit_events (
    user_id,
    endpoint_id,
    event_type,
    metadata
  ) values (
    p_user_id,
    v_endpoint_id,
    v_event_type,
    jsonb_build_object(
      'platform', p_platform,
      'provider', p_provider,
      'permission_status', p_permission_status,
      'request_id', p_request_id,
      'endpoint_id', v_endpoint_id
    )
  );

  return v_result;
end;
$$;

create or replace function public.unregister_notification_device_endpoint(
  p_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_installation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_request public.notification_registration_requests%rowtype;
  v_endpoint_id uuid;
  v_removed_count integer;
  v_operation text;
  v_event_type text;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOTIFICATION_SERVICE_REQUIRED' using errcode = '42501';
  end if;

  if p_user_id is null
    or p_request_id is null
    or p_installation_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null
    or p_reason not in (
      'logout',
      'permission_revoked',
      'provider_invalid',
      'account_deleted'
    ) then
    raise exception 'NOTIFICATION_UNREGISTER_INVALID' using errcode = '22023';
  end if;

  v_operation := case p_reason
    when 'permission_revoked' then 'permission_revoked'
    when 'provider_invalid' then 'provider_invalid'
    when 'account_deleted' then 'account_deleted'
    else 'unregister'
  end;

  v_event_type := case p_reason
    when 'permission_revoked' then 'permission_revoked'
    when 'provider_invalid' then 'provider_token_invalidated'
    when 'account_deleted' then 'account_devices_removed'
    else 'device_unregistered'
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'notification-request:' || p_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing_request
  from public.notification_registration_requests
  where user_id = p_user_id
    and request_id = p_request_id;

  if found then
    if v_existing_request.operation <> v_operation
      or v_existing_request.request_digest <> trim(p_request_digest) then
      raise exception 'NOTIFICATION_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing_request.response_json;
  end if;

  delete from public.notification_device_endpoints
  where user_id = p_user_id
    and installation_id = p_installation_id
  returning endpoint_id into v_endpoint_id;

  get diagnostics v_removed_count = row_count;

  v_result := jsonb_build_object(
    'ok', true,
    'removed', v_removed_count > 0
  );

  insert into public.notification_registration_requests (
    user_id,
    request_id,
    operation,
    request_digest,
    response_json
  ) values (
    p_user_id,
    p_request_id,
    v_operation,
    trim(p_request_digest),
    v_result
  );

  insert into public.notification_audit_events (
    user_id,
    endpoint_id,
    event_type,
    metadata
  ) values (
    p_user_id,
    v_endpoint_id,
    v_event_type,
    jsonb_build_object(
      'reason', p_reason,
      'request_id', p_request_id,
      'removed_count', v_removed_count
    )
  );

  return v_result;
end;
$$;

-- Account deletion may call this before the user row is deleted. The FK cascade
-- remains a fail-safe for any endpoint that reaches account deletion.
create or replace function public.remove_notification_devices_for_account(
  p_user_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_request public.notification_registration_requests%rowtype;
  v_removed_count integer;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOTIFICATION_SERVICE_REQUIRED' using errcode = '42501';
  end if;

  if p_user_id is null
    or p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception 'NOTIFICATION_UNREGISTER_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'notification-request:' || p_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing_request
  from public.notification_registration_requests
  where user_id = p_user_id
    and request_id = p_request_id;

  if found then
    if v_existing_request.operation <> 'account_deleted'
      or v_existing_request.request_digest <> trim(p_request_digest) then
      raise exception 'NOTIFICATION_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing_request.response_json;
  end if;

  delete from public.notification_device_endpoints
  where user_id = p_user_id;

  get diagnostics v_removed_count = row_count;

  v_result := jsonb_build_object(
    'ok', true,
    'removed_count', v_removed_count
  );

  insert into public.notification_registration_requests (
    user_id,
    request_id,
    operation,
    request_digest,
    response_json
  ) values (
    p_user_id,
    p_request_id,
    'account_deleted',
    trim(p_request_digest),
    v_result
  );

  insert into public.notification_audit_events (
    user_id,
    event_type,
    metadata
  ) values (
    p_user_id,
    'account_devices_removed',
    jsonb_build_object(
      'reason', 'account_deleted',
      'request_id', p_request_id,
      'removed_count', v_removed_count
    )
  );

  return v_result;
end;
$$;

-- This is a callable maintenance primitive only. No cron/scheduler is created.
create or replace function public.prune_inactive_notification_foundation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pruned_endpoints integer;
  v_pruned_audit integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOTIFICATION_SERVICE_REQUIRED' using errcode = '42501';
  end if;

  with removed as (
    delete from public.notification_device_endpoints
    where last_seen_at <= now() - interval '90 days'
    returning endpoint_id
  )
  select count(*) into v_pruned_endpoints from removed;

  insert into public.notification_audit_events (
    event_type,
    metadata
  ) values (
    'inactive_device_pruned',
    jsonb_build_object(
      'reason', 'inactive_90_days',
      'removed_count', v_pruned_endpoints
    )
  );

  with removed as (
    delete from public.notification_audit_events
    where retention_until <= now()
    returning event_id
  )
  select count(*) into v_pruned_audit from removed;

  delete from public.notification_registration_requests
  where created_at <= now() - interval '90 days';

  return jsonb_build_object(
    'ok', true,
    'pruned_endpoints', v_pruned_endpoints,
    'pruned_audit_events', v_pruned_audit
  );
end;
$$;

-- Preferences remain opt-out-only while the registry is inactive.
create or replace function public.disable_notification_preferences(
  p_notification_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_notification_type is not null
    and p_notification_type not in (
      'care_circle_check_in',
      'care_circle_reminder'
    ) then
    raise exception 'NOTIFICATION_TYPE_REJECTED' using errcode = '22023';
  end if;

  insert into public.notification_account_preferences (
    user_id,
    notifications_enabled,
    updated_at
  ) values (
    v_actor,
    false,
    now()
  )
  on conflict (user_id) do update
  set
    notifications_enabled = false,
    updated_at = now();

  if p_notification_type is not null then
    insert into public.notification_type_preferences (
      user_id,
      notification_type,
      enabled,
      updated_at
    ) values (
      v_actor,
      p_notification_type,
      false,
      now()
    )
    on conflict (user_id, notification_type) do update
    set
      enabled = false,
      updated_at = now();
  end if;

  insert into public.notification_audit_events (
    user_id,
    event_type,
    metadata
  ) values (
    v_actor,
    'preference_disabled',
    jsonb_build_object('reason', 'user_opt_out')
  );

  return jsonb_build_object(
    'ok', true,
    'notifications_enabled', false
  );
end;
$$;

revoke all on function public.register_notification_device_endpoint(
  uuid, uuid, text, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.unregister_notification_device_endpoint(
  uuid, uuid, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.remove_notification_devices_for_account(
  uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.prune_inactive_notification_foundation()
  from public, anon, authenticated;
revoke all on function public.disable_notification_preferences(text)
  from public, anon;

grant execute on function public.register_notification_device_endpoint(
  uuid, uuid, text, uuid, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.unregister_notification_device_endpoint(
  uuid, uuid, text, uuid, text
) to service_role;
grant execute on function public.remove_notification_devices_for_account(
  uuid, uuid, text
) to service_role;
grant execute on function public.prune_inactive_notification_foundation()
  to service_role;
grant execute on function public.disable_notification_preferences(text)
  to authenticated;

comment on table public.notification_type_registry is
  'Closed inactive registry. Only two Care Circle types exist and the enabled constraint is false.';
comment on table public.notification_device_endpoints is
  'Backend-only encrypted provider token storage. No delivery path is created by migration 0033.';
comment on table public.notification_audit_events is
  'Content-free operational metadata retained for at most 90 days.';
comment on function public.prune_inactive_notification_foundation() is
  'Inactive maintenance primitive. Migration 0033 creates no scheduler.';
-- S2_T40_EXACT_MIGRATION_BODY_END

-- S2_T40_MIGRATION_HISTORY_RECORD_BLOCKED_BEGIN
-- Required version: 0033
-- Required name: inactive_notification_foundation
-- No INSERT is authored here because the live schema_migrations columns
-- have not been confirmed. Guessing that shape is prohibited.
-- S2_T40_MIGRATION_HISTORY_RECORD_BLOCKED_END

rollback;
