-- S2-T40 Dashboard rollback rehearsal: 0032
-- Approved staging ref: bmqhwofmdgebpcihjlnb
-- Exact source: supabase/migrations/0032_care_circle_backend_foundation.sql
-- Source SHA-256: 9d5dfdeab0975c9c8d923495bd5a17fa26ea5c26ef05ba4f036ac506b087a79e
-- STATUS: SOURCE_ONLY_UNRUN_REQUIRES_SEPARATE_MANUAL_AUTHORIZATION
-- The SQL transaction cannot prove the Dashboard project ref. The operator
-- must visually confirm the exact approved ref before opening this packet.

begin;

do $s2_t40_preflight$
declare
  v_columns jsonb;
  v_history jsonb;
begin
  select jsonb_agg(jsonb_build_object(
      'column_name', column_name, 'data_type', data_type,
      'udt_name', udt_name, 'is_nullable', is_nullable,
      'column_default', column_default, 'ordinal_position', ordinal_position
    ) order by ordinal_position)
    into v_columns
    from information_schema.columns
   where table_schema = 'supabase_migrations'
     and table_name = 'schema_migrations';
  if v_columns is distinct from '[{"column_name":"version","data_type":"text","udt_name":"text","is_nullable":"NO","column_default":null,"ordinal_position":1},{"column_name":"statements","data_type":"ARRAY","udt_name":"_text","is_nullable":"YES","column_default":null,"ordinal_position":2},{"column_name":"name","data_type":"text","udt_name":"text","is_nullable":"YES","column_default":null,"ordinal_position":3}]'::jsonb then
    raise exception 'S2_T40_STOP_HISTORY_SHAPE_MISMATCH' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(version, name) order by version), '[]'::jsonb)
    into v_history
    from supabase_migrations.schema_migrations;
  if v_history is distinct from '[["0001","initial_schema"],["0002","profile_chat_persistence"],["0003","care_notifications_usage"],["0004","birth_details_change_policy"],["0005","starter_grant_guard"],["0006","profile_onboarding_transaction"],["0007","lock_migration_reports_access"],["0008","onboarding_chart_history"],["0009","chat_turn_persistence_rpc"],["0010","strip_legacy_raw_provider_response"],["0011","explicit_reflection_thread"],["0012","external_sync_delivery_ledger"],["0013","account_deletion_external_sync"],["0014","authoritative_account_entitlements"],["0015","entitlement_provider_privacy"],["0016","trusted_birth_location_resolver"],["0017","persona_policy_and_entitlement_events"],["0018","remove_misleading_care_max_index"],["0019","dice_throws"],["0020","backend_runtime_guardrails"],["0021","runtime_observability_and_schedules"],["0022","chat_idempotency_context"],["0023","strict_sync_retention_and_provider_attempts"],["0024","provider_attempt_concurrency_and_payload_allowlist"],["0025","runtime_scheduler_status"],["0026","birth_details_regeneration"],["0027","entitlement_event_integrity_repair"],["0028","safe_account_deletion_status_refresh"],["0029","safe_account_deletion_enqueue_result"],["0030","safe_salesforce_deletion_subject_json"]]'::jsonb then
    raise exception 'S2_T40_STOP_REMOTE_PARITY_MISMATCH' using errcode = 'P0001';
  end if;
end
$s2_t40_preflight$;

-- S2_T40_EXACT_MIGRATION_BODY_BEGIN
-- S2-T03: inactive Care Circle backend foundation.
--
-- This migration corrects the consent direction and provides backend-owned
-- schema/RPC foundations. It does not activate Care Circle, linking UI,
-- reminders, notification delivery, QR scanning, or scheduling.
--
-- Forward-only recovery:
--   1. keep the release UI on the static preview;
--   2. do not deploy callers for these RPCs;
--   3. repair defects with a later corrective migration;
--   4. never restore the reversed consent vocabulary or the misleading
--      maximum-five index.
--
-- Migration number 0031 remains reserved by the unapproved DEL-1 draft under
-- supabase/migration-drafts. This deployable sequence therefore starts at 0032.

alter table public.users
  add column if not exists account_mode text not null default 'standard';

alter table public.users
  drop constraint if exists users_account_mode_check;

alter table public.users
  add constraint users_account_mode_check
  check (account_mode in ('standard', 'carer_only', 'pending_intent'));

comment on column public.users.account_mode is
  'Backend-owned Care Circle account mode. Mobile must not grant Caree or Carer capability.';

-- Old revoked rows do not identify the actor. Stop rather than inventing
-- removed_by_caree/removed_by_carer history.
do $$
begin
  if exists (
    select 1
    from public.care_relationships
    where status = 'revoked'
  ) then
    raise exception 'CARE_LEGACY_REVOKED_ROWS_REQUIRE_REVIEW'
      using errcode = 'P0001';
  end if;
end;
$$;

drop policy if exists "care participants can read relationships"
  on public.care_relationships;
drop policy if exists "care participants can read relationship events"
  on public.care_relationship_events;

drop index if exists public.care_relationships_active_pair_idx;

alter table public.care_relationships
  drop constraint if exists care_relationships_status_check;

alter table public.care_relationships
  alter column status type text;

update public.care_relationships
set status = case status
  when 'pending_caree_confirmation' then 'pending_caree_acceptance'
  when 'pending_carer_acceptance' then 'pending_caree_acceptance'
  else status
end;

alter table public.care_relationships
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by_user_id uuid
    references public.users(id) on delete set null,
  add column if not exists request_expires_at timestamptz,
  add column if not exists last_operation_request_id uuid;

update public.care_relationships
set
  accepted_at = case
    when status = 'active'
      then coalesce(accepted_at, caree_confirmed_at, carer_accepted_at, updated_at)
    else accepted_at
  end,
  declined_at = case
    when status = 'declined'
      then coalesce(declined_at, updated_at)
    else declined_at
  end,
  removed_at = coalesce(removed_at, revoked_at)
where accepted_at is null
   or declined_at is null
   or removed_at is null;

alter table public.care_relationships
  add constraint care_relationships_status_check
  check (status in (
    'pending_caree_acceptance',
    'active',
    'declined',
    'removed_by_caree',
    'removed_by_carer',
    'expired'
  ));

alter table public.care_relationships
  add constraint care_relationships_removed_actor_check
  check (
    (
      status = 'removed_by_caree'
      and removed_by_user_id = caree_user_id
      and removed_at is not null
    )
    or (
      status = 'removed_by_carer'
      and removed_by_user_id = carer_user_id
      and removed_at is not null
    )
    or (
      status not in ('removed_by_caree', 'removed_by_carer')
      and removed_by_user_id is null
    )
  );

alter table public.care_relationships
  add constraint care_relationships_terminal_timestamp_check
  check (
    (status <> 'active' or accepted_at is not null)
    and (status <> 'declined' or declined_at is not null)
  );

create unique index care_relationships_active_pair_idx
  on public.care_relationships (caree_user_id, carer_user_id)
  where status in ('pending_caree_acceptance', 'active');

create index if not exists care_relationships_active_capacity_idx
  on public.care_relationships (caree_user_id, accepted_at desc)
  where status = 'active';

comment on index public.care_relationships_active_capacity_idx is
  'Supports the transactional active-carer count. It does not itself enforce the maximum of five.';

-- Backend-only code material. code_hash must be a keyed fingerprint created
-- outside the database; raw codes and QR URLs are never stored.
create table if not exists public.care_link_codes (
  code_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null,
  status text not null default 'active'
    check (status in ('active', 'consumed', 'revoked', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_user_id uuid references public.users(id) on delete set null,
  relationship_id uuid references public.care_relationships(id) on delete set null,
  revoked_at timestamptz,
  retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_link_codes_window_check check (
    expires_at > issued_at
    and expires_at <= issued_at + interval '1 hour'
  ),
  constraint care_link_codes_consumption_check check (
    (
      status = 'consumed'
      and consumed_at is not null
      and consumed_by_user_id is not null
      and relationship_id is not null
    )
    or (
      status <> 'consumed'
      and consumed_at is null
      and consumed_by_user_id is null
    )
  ),
  constraint care_link_codes_revocation_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create or replace function public.set_care_link_code_retention_until()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.retention_until := new.expires_at + interval '90 days';
  return new;
end;
$$;

drop trigger if exists set_care_link_code_retention_until_trigger
  on public.care_link_codes;
create trigger set_care_link_code_retention_until_trigger
before insert or update of expires_at on public.care_link_codes
for each row execute function public.set_care_link_code_retention_until();

create unique index if not exists care_link_codes_hash_idx
  on public.care_link_codes (code_hash);

create unique index if not exists care_link_codes_one_active_per_caree_idx
  on public.care_link_codes (caree_user_id)
  where status = 'active';

create index if not exists care_link_codes_retention_idx
  on public.care_link_codes (retention_until)
  where status in ('consumed', 'revoked', 'expired');

-- Preserve any legacy invitation fingerprint as consumed backend-only evidence
-- before removing it from participant-readable relationship storage.
insert into public.care_link_codes (
  caree_user_id,
  code_hash,
  status,
  issued_at,
  expires_at,
  consumed_at,
  consumed_by_user_id,
  relationship_id,
  created_at,
  updated_at
)
select
  relationship.caree_user_id,
  relationship.invitation_token_hash,
  'consumed',
  relationship.requested_at,
  relationship.requested_at + interval '1 hour',
  coalesce(relationship.accepted_at, relationship.requested_at),
  relationship.carer_user_id,
  relationship.id,
  relationship.created_at,
  relationship.updated_at
from public.care_relationships relationship
where nullif(trim(relationship.invitation_token_hash), '') is not null
on conflict (code_hash) do nothing;

alter table public.care_relationships
  drop column if exists invitation_token_hash,
  drop column if exists caree_confirmed_at,
  drop column if exists carer_accepted_at,
  drop column if exists revoked_at;

-- Caree-owned pause/cadence state. This migration creates no scheduler.
create table if not exists public.care_check_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default false,
  cadence_days integer not null default 2
    check (cadence_days in (1, 2, 3, 7)),
  grace_hours integer not null default 24
    check (grace_hours = 24),
  timezone text not null,
  quiet_hours_start time,
  quiet_hours_end time,
  next_checkin_at timestamptz,
  paused_at timestamptz,
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_check_settings_pause_window_check check (
    (paused_at is null and paused_until is null)
    or (
      paused_at is not null
      and paused_until is not null
      and paused_until > paused_at
    )
  )
);

-- Grace-period state is round-owned, not a second relationship state machine.
create table if not exists public.care_checkin_rounds (
  round_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'open'
    check (status in (
      'open',
      'grace_period',
      'responded',
      'snoozed',
      'exhausted',
      'cancelled'
    )),
  opened_at timestamptz not null default now(),
  grace_started_at timestamptz,
  next_grace_at timestamptz,
  closed_at timestamptz,
  close_reason text check (close_reason in (
    'caree_ok',
    'need_help',
    'snoozed',
    'passive_signin',
    'escalation_exhausted',
    'relationship_removed',
    'account_deleted'
  )),
  carer_notice_count integer not null default 0
    check (carer_notice_count between 0 and 3),
  caree_reask_count integer not null default 0
    check (caree_reask_count between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_checkin_rounds_state_check check (
    (
      status in ('open', 'grace_period')
      and closed_at is null
      and close_reason is null
    )
    or (
      status in ('responded', 'snoozed', 'exhausted', 'cancelled')
      and closed_at is not null
      and close_reason is not null
    )
  ),
  constraint care_checkin_rounds_grace_check check (
    (status <> 'grace_period')
    or (
      grace_started_at is not null
      and next_grace_at is not null
      and next_grace_at > grace_started_at
    )
  )
);

create unique index if not exists care_checkin_rounds_one_open_idx
  on public.care_checkin_rounds (caree_user_id)
  where status in ('open', 'grace_period');

create index if not exists care_checkin_rounds_grace_idx
  on public.care_checkin_rounds (next_grace_at)
  where status = 'grace_period';

-- Mutation idempotency evidence remains backend-only.
create table if not exists public.care_operation_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in (
    'relationship_accept',
    'relationship_remove',
    'code_create',
    'code_consume',
    'settings_update',
    'checkin_respond'
  )),
  resource_id uuid,
  request_digest text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create index if not exists care_operation_requests_created_idx
  on public.care_operation_requests (created_at);

-- Correct the append-only event vocabulary. Existing events are retained and
-- mapped without exposing them directly to participants.
alter table public.care_relationship_events
  drop constraint if exists care_relationship_events_event_type_check;

alter table public.care_relationship_events
  alter column event_type type text;

update public.care_relationship_events
set event_type = case event_type
  when 'qr_created' then 'code_issued'
  when 'qr_scanned' then 'code_consumed'
  when 'caree_confirmed' then 'request_accepted'
  when 'carer_accepted' then 'request_accepted'
  when 'carer_declined' then 'request_declined'
  when 'relationship_activated' then 'relationship_activated'
  when 'relationship_revoked' then 'relationship_removed'
  when 'check_in_completed' then 'checkin_responded'
  when 'missed_check_in' then 'grace_notice_recorded'
  when 'need_help_tapped' then 'help_requested'
  when 'push_alert_sent' then 'notification_delivery_recorded'
  when 'push_alert_failed' then 'notification_delivery_failed'
  else 'legacy_migrated'
end;

alter table public.care_relationship_events
  add column if not exists event_idempotency_key text,
  add constraint care_relationship_events_event_type_check
  check (event_type in (
    'code_issued',
    'code_revoked',
    'code_consumed',
    'code_expired_purged',
    'request_created',
    'request_accepted',
    'request_declined',
    'request_expired',
    'relationship_activated',
    'relationship_removed',
    'settings_updated',
    'round_opened',
    'grace_started',
    'grace_notice_recorded',
    'checkin_responded',
    'help_requested',
    'round_closed',
    'notification_delivery_recorded',
    'notification_delivery_failed',
    'legacy_migrated'
  ));

create unique index if not exists care_relationship_events_idempotency_idx
  on public.care_relationship_events (event_idempotency_key)
  where event_idempotency_key is not null;

-- Approved backend error map. This is not user-facing copy and does not
-- activate any endpoint.
create table if not exists public.care_error_code_registry (
  error_code text primary key,
  http_status integer not null,
  condition_key text not null,
  retry_mode text not null check (retry_mode in (
    'not_retryable',
    'idempotent_existing',
    'informational',
    'retry_after_profile'
  )),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint care_error_code_registry_range_check check (
    error_code in (
      '48004', '48005', '48006', '48007', '48008',
      '48009', '48010', '48011', '48012', '48013'
    )
  )
);

insert into public.care_error_code_registry (
  error_code,
  http_status,
  condition_key,
  retry_mode
) values
  ('48004', 410, 'code_unavailable', 'not_retryable'),
  ('48005', 409, 'relationship_already_exists', 'idempotent_existing'),
  ('48006', 400, 'self_link_forbidden', 'not_retryable'),
  ('48007', 404, 'relationship_unavailable', 'not_retryable'),
  ('48008', 200, 'push_unavailable_operation_succeeded', 'informational'),
  ('48009', 410, 'relationship_ended', 'not_retryable'),
  ('48010', 200, 'help_requested_event', 'informational'),
  ('48011', 200, 'missed_checkin_event', 'informational'),
  ('48012', 409, 'acceptance_state_changed', 'not_retryable'),
  ('48013', 428, 'carer_profile_incomplete', 'retry_after_profile')
on conflict (error_code) do update
set
  http_status = excluded.http_status,
  condition_key = excluded.condition_key,
  retry_mode = excluded.retry_mode;

-- RLS and grants: sensitive storage is service-only. Caree settings are the
-- sole direct owner-readable Care Circle table.
alter table public.care_relationships enable row level security;
alter table public.care_relationship_events enable row level security;
alter table public.care_link_codes enable row level security;
alter table public.care_check_settings enable row level security;
alter table public.care_checkin_rounds enable row level security;
alter table public.care_operation_requests enable row level security;
alter table public.care_error_code_registry enable row level security;

revoke all on table public.care_relationships from anon, authenticated;
revoke all on table public.care_relationship_events from anon, authenticated;
revoke all on table public.care_link_codes from anon, authenticated;
revoke all on table public.care_check_settings from anon, authenticated;
revoke all on table public.care_checkin_rounds from anon, authenticated;
revoke all on table public.care_operation_requests from anon, authenticated;
revoke all on table public.care_error_code_registry from anon, authenticated;

grant all on table public.care_relationships to service_role;
grant all on table public.care_relationship_events to service_role;
grant all on table public.care_link_codes to service_role;
grant all on table public.care_check_settings to service_role;
grant all on table public.care_checkin_rounds to service_role;
grant all on table public.care_operation_requests to service_role;
grant select on table public.care_error_code_registry to service_role;

grant select on table public.care_check_settings to authenticated;

drop policy if exists "carees can read own check settings"
  on public.care_check_settings;
create policy "carees can read own check settings"
  on public.care_check_settings
  for select
  to authenticated
  using (user_id = auth.uid());

-- Safe owner/capability resolver. Direct entitlement rows remain protected.
create or replace function public.resolve_care_circle_capability(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_plan text;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if auth.role() <> 'service_role' and p_user_id <> auth.uid() then
    raise exception '48007' using errcode = 'P0001';
  end if;

  select account_mode, display_name
  into v_mode, v_display_name
  from public.users
  where id = p_user_id
    and deleted_at is null;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  select entitlement.plan_tier
  into v_plan
  from public.account_entitlements entitlement
  where entitlement.user_id = p_user_id
    and entitlement.status in ('active', 'grace_period')
    and entitlement.valid_from <= now()
    and (entitlement.valid_until is null or entitlement.valid_until > now());

  v_plan := coalesce(v_plan, 'starter');

  return jsonb_build_object(
    'account_mode', v_mode,
    'can_act_as_carer',
      v_mode in ('standard', 'carer_only')
      and nullif(trim(coalesce(v_display_name, '')), '') is not null,
    'can_act_as_caree',
      v_mode = 'standard'
      and v_plan in ('essential', 'prime'),
    'plan_tier', v_plan
  );
end;
$$;

revoke all on function public.resolve_care_circle_capability(uuid)
  from public, anon;
grant execute on function public.resolve_care_circle_capability(uuid)
  to authenticated, service_role;

-- Participant-safe relationship projection. It deliberately excludes code
-- material, event metadata, private charts/chats, billing, and other carers.
create or replace function public.list_care_relationships()
returns table (
  relationship_id uuid,
  participant_role text,
  other_display_name text,
  other_avatar_key text,
  relationship_status text,
  requested_at timestamptz,
  accepted_at timestamptz,
  removed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    relationship.id,
    case
      when relationship.caree_user_id = auth.uid() then 'caree'
      else 'carer'
    end,
    other_user.display_name,
    other_user.buddy_avatar_key,
    relationship.status,
    relationship.requested_at,
    relationship.accepted_at,
    relationship.removed_at
  from public.care_relationships relationship
  join public.users other_user
    on other_user.id = case
      when relationship.caree_user_id = auth.uid()
        then relationship.carer_user_id
      else relationship.caree_user_id
    end
  where auth.uid() is not null
    and (
      relationship.caree_user_id = auth.uid()
      or relationship.carer_user_id = auth.uid()
    )
    and other_user.deleted_at is null
  order by relationship.updated_at desc;
$$;

revoke all on function public.list_care_relationships()
  from public, anon;
grant execute on function public.list_care_relationships()
  to authenticated;

-- Transactional acceptance proves the maximum-five invariant under a
-- Caree-scoped advisory lock. No active UI calls this function.
create or replace function public.accept_care_relationship(
  p_relationship_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.care_relationships%rowtype;
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_active_count integer;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception 'CARE_REQUEST_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-request:' || v_actor::text || ':' || p_request_id::text, 0)
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = v_actor
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_accept'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception 'CARE_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing.response_json;
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and caree_user_id = v_actor
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-capacity:' || v_actor::text, 0)
  );

  if v_relationship.status = 'active' then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', v_relationship.id,
      'status', 'active',
      'idempotent', true
    );
  elsif v_relationship.status <> 'pending_caree_acceptance'
    or (
      v_relationship.request_expires_at is not null
      and v_relationship.request_expires_at <= now()
    ) then
    raise exception '48012' using errcode = 'P0001';
  else
    v_capability := public.resolve_care_circle_capability(v_actor);

    if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
      raise exception '48012' using errcode = 'P0001';
    end if;

    select count(*)
    into v_active_count
    from public.care_relationships
    where caree_user_id = v_actor
      and status = 'active'
      and id <> p_relationship_id;

    if v_active_count >= 5 then
      raise exception '48012' using errcode = 'P0001';
    end if;

    update public.care_relationships
    set
      status = 'active',
      accepted_at = now(),
      last_operation_request_id = p_request_id,
      updated_at = now()
    where id = p_relationship_id;

    insert into public.care_relationship_events (
      relationship_id,
      actor_user_id,
      event_type,
      metadata,
      event_idempotency_key
    ) values (
      p_relationship_id,
      v_actor,
      'request_accepted',
      '{}'::jsonb,
      'relationship_accept:' || v_actor::text || ':' || p_request_id::text
    );

    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', 'active',
      'idempotent', false
    );
  end if;

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    v_actor,
    p_request_id,
    'relationship_accept',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.accept_care_relationship(uuid, uuid, text)
  from public, anon;
grant execute on function public.accept_care_relationship(uuid, uuid, text)
  to authenticated;

create or replace function public.remove_care_relationship(
  p_relationship_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.care_relationships%rowtype;
  v_existing public.care_operation_requests%rowtype;
  v_status text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception 'CARE_REQUEST_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-request:' || v_actor::text || ':' || p_request_id::text, 0)
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = v_actor
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_remove'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception 'CARE_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing.response_json;
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and (caree_user_id = v_actor or carer_user_id = v_actor)
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  if v_relationship.status in (
    'removed_by_caree',
    'removed_by_carer',
    'declined',
    'expired'
  ) then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', v_relationship.status,
      'idempotent', true
    );
  else
    v_status := case
      when v_relationship.caree_user_id = v_actor
        then 'removed_by_caree'
      else 'removed_by_carer'
    end;

    update public.care_relationships
    set
      status = v_status,
      removed_at = now(),
      removed_by_user_id = v_actor,
      last_operation_request_id = p_request_id,
      updated_at = now()
    where id = p_relationship_id;

    update public.care_checkin_rounds
    set
      status = 'cancelled',
      closed_at = now(),
      close_reason = 'relationship_removed',
      updated_at = now()
    where caree_user_id = v_relationship.caree_user_id
      and status in ('open', 'grace_period')
      and not exists (
        select 1
        from public.care_relationships remaining_relationship
        where remaining_relationship.caree_user_id = v_relationship.caree_user_id
          and remaining_relationship.status = 'active'
      );

    insert into public.care_relationship_events (
      relationship_id,
      actor_user_id,
      event_type,
      metadata,
      event_idempotency_key
    ) values (
      p_relationship_id,
      v_actor,
      'relationship_removed',
      jsonb_build_object('removed_by', case
        when v_relationship.caree_user_id = v_actor then 'caree'
        else 'carer'
      end),
      'relationship_remove:' || v_actor::text || ':' || p_request_id::text
    );

    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', v_status,
      'idempotent', false
    );
  end if;

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    v_actor,
    p_request_id,
    'relationship_remove',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.remove_care_relationship(uuid, uuid, text)
  from public, anon;
grant execute on function public.remove_care_relationship(uuid, uuid, text)
  to authenticated;

comment on table public.care_link_codes is
  'Backend-only Caree-owned one-hour invitation code fingerprints. Raw codes are never stored.';
comment on table public.care_check_settings is
  'Inactive Caree-owned cadence and pause foundation. No scheduler is created by migration 0032.';
comment on table public.care_checkin_rounds is
  'Inactive check-in/grace state foundation with a three-notice ceiling. No notification delivery is created.';
comment on function public.accept_care_relationship(uuid, uuid, text) is
  'Inactive backend foundation. Transactionally rechecks Caree capability and enforces at most five active carers.';
-- S2_T40_EXACT_MIGRATION_BODY_END

insert into supabase_migrations.schema_migrations (version, statements, name)
values ('0032', array[$s2_t40_source$-- S2-T03: inactive Care Circle backend foundation.
--
-- This migration corrects the consent direction and provides backend-owned
-- schema/RPC foundations. It does not activate Care Circle, linking UI,
-- reminders, notification delivery, QR scanning, or scheduling.
--
-- Forward-only recovery:
--   1. keep the release UI on the static preview;
--   2. do not deploy callers for these RPCs;
--   3. repair defects with a later corrective migration;
--   4. never restore the reversed consent vocabulary or the misleading
--      maximum-five index.
--
-- Migration number 0031 remains reserved by the unapproved DEL-1 draft under
-- supabase/migration-drafts. This deployable sequence therefore starts at 0032.

alter table public.users
  add column if not exists account_mode text not null default 'standard';

alter table public.users
  drop constraint if exists users_account_mode_check;

alter table public.users
  add constraint users_account_mode_check
  check (account_mode in ('standard', 'carer_only', 'pending_intent'));

comment on column public.users.account_mode is
  'Backend-owned Care Circle account mode. Mobile must not grant Caree or Carer capability.';

-- Old revoked rows do not identify the actor. Stop rather than inventing
-- removed_by_caree/removed_by_carer history.
do $$
begin
  if exists (
    select 1
    from public.care_relationships
    where status = 'revoked'
  ) then
    raise exception 'CARE_LEGACY_REVOKED_ROWS_REQUIRE_REVIEW'
      using errcode = 'P0001';
  end if;
end;
$$;

drop policy if exists "care participants can read relationships"
  on public.care_relationships;
drop policy if exists "care participants can read relationship events"
  on public.care_relationship_events;

drop index if exists public.care_relationships_active_pair_idx;

alter table public.care_relationships
  drop constraint if exists care_relationships_status_check;

alter table public.care_relationships
  alter column status type text;

update public.care_relationships
set status = case status
  when 'pending_caree_confirmation' then 'pending_caree_acceptance'
  when 'pending_carer_acceptance' then 'pending_caree_acceptance'
  else status
end;

alter table public.care_relationships
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by_user_id uuid
    references public.users(id) on delete set null,
  add column if not exists request_expires_at timestamptz,
  add column if not exists last_operation_request_id uuid;

update public.care_relationships
set
  accepted_at = case
    when status = 'active'
      then coalesce(accepted_at, caree_confirmed_at, carer_accepted_at, updated_at)
    else accepted_at
  end,
  declined_at = case
    when status = 'declined'
      then coalesce(declined_at, updated_at)
    else declined_at
  end,
  removed_at = coalesce(removed_at, revoked_at)
where accepted_at is null
   or declined_at is null
   or removed_at is null;

alter table public.care_relationships
  add constraint care_relationships_status_check
  check (status in (
    'pending_caree_acceptance',
    'active',
    'declined',
    'removed_by_caree',
    'removed_by_carer',
    'expired'
  ));

alter table public.care_relationships
  add constraint care_relationships_removed_actor_check
  check (
    (
      status = 'removed_by_caree'
      and removed_by_user_id = caree_user_id
      and removed_at is not null
    )
    or (
      status = 'removed_by_carer'
      and removed_by_user_id = carer_user_id
      and removed_at is not null
    )
    or (
      status not in ('removed_by_caree', 'removed_by_carer')
      and removed_by_user_id is null
    )
  );

alter table public.care_relationships
  add constraint care_relationships_terminal_timestamp_check
  check (
    (status <> 'active' or accepted_at is not null)
    and (status <> 'declined' or declined_at is not null)
  );

create unique index care_relationships_active_pair_idx
  on public.care_relationships (caree_user_id, carer_user_id)
  where status in ('pending_caree_acceptance', 'active');

create index if not exists care_relationships_active_capacity_idx
  on public.care_relationships (caree_user_id, accepted_at desc)
  where status = 'active';

comment on index public.care_relationships_active_capacity_idx is
  'Supports the transactional active-carer count. It does not itself enforce the maximum of five.';

-- Backend-only code material. code_hash must be a keyed fingerprint created
-- outside the database; raw codes and QR URLs are never stored.
create table if not exists public.care_link_codes (
  code_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null,
  status text not null default 'active'
    check (status in ('active', 'consumed', 'revoked', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_user_id uuid references public.users(id) on delete set null,
  relationship_id uuid references public.care_relationships(id) on delete set null,
  revoked_at timestamptz,
  retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_link_codes_window_check check (
    expires_at > issued_at
    and expires_at <= issued_at + interval '1 hour'
  ),
  constraint care_link_codes_consumption_check check (
    (
      status = 'consumed'
      and consumed_at is not null
      and consumed_by_user_id is not null
      and relationship_id is not null
    )
    or (
      status <> 'consumed'
      and consumed_at is null
      and consumed_by_user_id is null
    )
  ),
  constraint care_link_codes_revocation_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create or replace function public.set_care_link_code_retention_until()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.retention_until := new.expires_at + interval '90 days';
  return new;
end;
$$;

drop trigger if exists set_care_link_code_retention_until_trigger
  on public.care_link_codes;
create trigger set_care_link_code_retention_until_trigger
before insert or update of expires_at on public.care_link_codes
for each row execute function public.set_care_link_code_retention_until();

create unique index if not exists care_link_codes_hash_idx
  on public.care_link_codes (code_hash);

create unique index if not exists care_link_codes_one_active_per_caree_idx
  on public.care_link_codes (caree_user_id)
  where status = 'active';

create index if not exists care_link_codes_retention_idx
  on public.care_link_codes (retention_until)
  where status in ('consumed', 'revoked', 'expired');

-- Preserve any legacy invitation fingerprint as consumed backend-only evidence
-- before removing it from participant-readable relationship storage.
insert into public.care_link_codes (
  caree_user_id,
  code_hash,
  status,
  issued_at,
  expires_at,
  consumed_at,
  consumed_by_user_id,
  relationship_id,
  created_at,
  updated_at
)
select
  relationship.caree_user_id,
  relationship.invitation_token_hash,
  'consumed',
  relationship.requested_at,
  relationship.requested_at + interval '1 hour',
  coalesce(relationship.accepted_at, relationship.requested_at),
  relationship.carer_user_id,
  relationship.id,
  relationship.created_at,
  relationship.updated_at
from public.care_relationships relationship
where nullif(trim(relationship.invitation_token_hash), '') is not null
on conflict (code_hash) do nothing;

alter table public.care_relationships
  drop column if exists invitation_token_hash,
  drop column if exists caree_confirmed_at,
  drop column if exists carer_accepted_at,
  drop column if exists revoked_at;

-- Caree-owned pause/cadence state. This migration creates no scheduler.
create table if not exists public.care_check_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default false,
  cadence_days integer not null default 2
    check (cadence_days in (1, 2, 3, 7)),
  grace_hours integer not null default 24
    check (grace_hours = 24),
  timezone text not null,
  quiet_hours_start time,
  quiet_hours_end time,
  next_checkin_at timestamptz,
  paused_at timestamptz,
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_check_settings_pause_window_check check (
    (paused_at is null and paused_until is null)
    or (
      paused_at is not null
      and paused_until is not null
      and paused_until > paused_at
    )
  )
);

-- Grace-period state is round-owned, not a second relationship state machine.
create table if not exists public.care_checkin_rounds (
  round_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'open'
    check (status in (
      'open',
      'grace_period',
      'responded',
      'snoozed',
      'exhausted',
      'cancelled'
    )),
  opened_at timestamptz not null default now(),
  grace_started_at timestamptz,
  next_grace_at timestamptz,
  closed_at timestamptz,
  close_reason text check (close_reason in (
    'caree_ok',
    'need_help',
    'snoozed',
    'passive_signin',
    'escalation_exhausted',
    'relationship_removed',
    'account_deleted'
  )),
  carer_notice_count integer not null default 0
    check (carer_notice_count between 0 and 3),
  caree_reask_count integer not null default 0
    check (caree_reask_count between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_checkin_rounds_state_check check (
    (
      status in ('open', 'grace_period')
      and closed_at is null
      and close_reason is null
    )
    or (
      status in ('responded', 'snoozed', 'exhausted', 'cancelled')
      and closed_at is not null
      and close_reason is not null
    )
  ),
  constraint care_checkin_rounds_grace_check check (
    (status <> 'grace_period')
    or (
      grace_started_at is not null
      and next_grace_at is not null
      and next_grace_at > grace_started_at
    )
  )
);

create unique index if not exists care_checkin_rounds_one_open_idx
  on public.care_checkin_rounds (caree_user_id)
  where status in ('open', 'grace_period');

create index if not exists care_checkin_rounds_grace_idx
  on public.care_checkin_rounds (next_grace_at)
  where status = 'grace_period';

-- Mutation idempotency evidence remains backend-only.
create table if not exists public.care_operation_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in (
    'relationship_accept',
    'relationship_remove',
    'code_create',
    'code_consume',
    'settings_update',
    'checkin_respond'
  )),
  resource_id uuid,
  request_digest text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create index if not exists care_operation_requests_created_idx
  on public.care_operation_requests (created_at);

-- Correct the append-only event vocabulary. Existing events are retained and
-- mapped without exposing them directly to participants.
alter table public.care_relationship_events
  drop constraint if exists care_relationship_events_event_type_check;

alter table public.care_relationship_events
  alter column event_type type text;

update public.care_relationship_events
set event_type = case event_type
  when 'qr_created' then 'code_issued'
  when 'qr_scanned' then 'code_consumed'
  when 'caree_confirmed' then 'request_accepted'
  when 'carer_accepted' then 'request_accepted'
  when 'carer_declined' then 'request_declined'
  when 'relationship_activated' then 'relationship_activated'
  when 'relationship_revoked' then 'relationship_removed'
  when 'check_in_completed' then 'checkin_responded'
  when 'missed_check_in' then 'grace_notice_recorded'
  when 'need_help_tapped' then 'help_requested'
  when 'push_alert_sent' then 'notification_delivery_recorded'
  when 'push_alert_failed' then 'notification_delivery_failed'
  else 'legacy_migrated'
end;

alter table public.care_relationship_events
  add column if not exists event_idempotency_key text,
  add constraint care_relationship_events_event_type_check
  check (event_type in (
    'code_issued',
    'code_revoked',
    'code_consumed',
    'code_expired_purged',
    'request_created',
    'request_accepted',
    'request_declined',
    'request_expired',
    'relationship_activated',
    'relationship_removed',
    'settings_updated',
    'round_opened',
    'grace_started',
    'grace_notice_recorded',
    'checkin_responded',
    'help_requested',
    'round_closed',
    'notification_delivery_recorded',
    'notification_delivery_failed',
    'legacy_migrated'
  ));

create unique index if not exists care_relationship_events_idempotency_idx
  on public.care_relationship_events (event_idempotency_key)
  where event_idempotency_key is not null;

-- Approved backend error map. This is not user-facing copy and does not
-- activate any endpoint.
create table if not exists public.care_error_code_registry (
  error_code text primary key,
  http_status integer not null,
  condition_key text not null,
  retry_mode text not null check (retry_mode in (
    'not_retryable',
    'idempotent_existing',
    'informational',
    'retry_after_profile'
  )),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint care_error_code_registry_range_check check (
    error_code in (
      '48004', '48005', '48006', '48007', '48008',
      '48009', '48010', '48011', '48012', '48013'
    )
  )
);

insert into public.care_error_code_registry (
  error_code,
  http_status,
  condition_key,
  retry_mode
) values
  ('48004', 410, 'code_unavailable', 'not_retryable'),
  ('48005', 409, 'relationship_already_exists', 'idempotent_existing'),
  ('48006', 400, 'self_link_forbidden', 'not_retryable'),
  ('48007', 404, 'relationship_unavailable', 'not_retryable'),
  ('48008', 200, 'push_unavailable_operation_succeeded', 'informational'),
  ('48009', 410, 'relationship_ended', 'not_retryable'),
  ('48010', 200, 'help_requested_event', 'informational'),
  ('48011', 200, 'missed_checkin_event', 'informational'),
  ('48012', 409, 'acceptance_state_changed', 'not_retryable'),
  ('48013', 428, 'carer_profile_incomplete', 'retry_after_profile')
on conflict (error_code) do update
set
  http_status = excluded.http_status,
  condition_key = excluded.condition_key,
  retry_mode = excluded.retry_mode;

-- RLS and grants: sensitive storage is service-only. Caree settings are the
-- sole direct owner-readable Care Circle table.
alter table public.care_relationships enable row level security;
alter table public.care_relationship_events enable row level security;
alter table public.care_link_codes enable row level security;
alter table public.care_check_settings enable row level security;
alter table public.care_checkin_rounds enable row level security;
alter table public.care_operation_requests enable row level security;
alter table public.care_error_code_registry enable row level security;

revoke all on table public.care_relationships from anon, authenticated;
revoke all on table public.care_relationship_events from anon, authenticated;
revoke all on table public.care_link_codes from anon, authenticated;
revoke all on table public.care_check_settings from anon, authenticated;
revoke all on table public.care_checkin_rounds from anon, authenticated;
revoke all on table public.care_operation_requests from anon, authenticated;
revoke all on table public.care_error_code_registry from anon, authenticated;

grant all on table public.care_relationships to service_role;
grant all on table public.care_relationship_events to service_role;
grant all on table public.care_link_codes to service_role;
grant all on table public.care_check_settings to service_role;
grant all on table public.care_checkin_rounds to service_role;
grant all on table public.care_operation_requests to service_role;
grant select on table public.care_error_code_registry to service_role;

grant select on table public.care_check_settings to authenticated;

drop policy if exists "carees can read own check settings"
  on public.care_check_settings;
create policy "carees can read own check settings"
  on public.care_check_settings
  for select
  to authenticated
  using (user_id = auth.uid());

-- Safe owner/capability resolver. Direct entitlement rows remain protected.
create or replace function public.resolve_care_circle_capability(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_plan text;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if auth.role() <> 'service_role' and p_user_id <> auth.uid() then
    raise exception '48007' using errcode = 'P0001';
  end if;

  select account_mode, display_name
  into v_mode, v_display_name
  from public.users
  where id = p_user_id
    and deleted_at is null;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  select entitlement.plan_tier
  into v_plan
  from public.account_entitlements entitlement
  where entitlement.user_id = p_user_id
    and entitlement.status in ('active', 'grace_period')
    and entitlement.valid_from <= now()
    and (entitlement.valid_until is null or entitlement.valid_until > now());

  v_plan := coalesce(v_plan, 'starter');

  return jsonb_build_object(
    'account_mode', v_mode,
    'can_act_as_carer',
      v_mode in ('standard', 'carer_only')
      and nullif(trim(coalesce(v_display_name, '')), '') is not null,
    'can_act_as_caree',
      v_mode = 'standard'
      and v_plan in ('essential', 'prime'),
    'plan_tier', v_plan
  );
end;
$$;

revoke all on function public.resolve_care_circle_capability(uuid)
  from public, anon;
grant execute on function public.resolve_care_circle_capability(uuid)
  to authenticated, service_role;

-- Participant-safe relationship projection. It deliberately excludes code
-- material, event metadata, private charts/chats, billing, and other carers.
create or replace function public.list_care_relationships()
returns table (
  relationship_id uuid,
  participant_role text,
  other_display_name text,
  other_avatar_key text,
  relationship_status text,
  requested_at timestamptz,
  accepted_at timestamptz,
  removed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    relationship.id,
    case
      when relationship.caree_user_id = auth.uid() then 'caree'
      else 'carer'
    end,
    other_user.display_name,
    other_user.buddy_avatar_key,
    relationship.status,
    relationship.requested_at,
    relationship.accepted_at,
    relationship.removed_at
  from public.care_relationships relationship
  join public.users other_user
    on other_user.id = case
      when relationship.caree_user_id = auth.uid()
        then relationship.carer_user_id
      else relationship.caree_user_id
    end
  where auth.uid() is not null
    and (
      relationship.caree_user_id = auth.uid()
      or relationship.carer_user_id = auth.uid()
    )
    and other_user.deleted_at is null
  order by relationship.updated_at desc;
$$;

revoke all on function public.list_care_relationships()
  from public, anon;
grant execute on function public.list_care_relationships()
  to authenticated;

-- Transactional acceptance proves the maximum-five invariant under a
-- Caree-scoped advisory lock. No active UI calls this function.
create or replace function public.accept_care_relationship(
  p_relationship_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.care_relationships%rowtype;
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_active_count integer;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception 'CARE_REQUEST_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-request:' || v_actor::text || ':' || p_request_id::text, 0)
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = v_actor
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_accept'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception 'CARE_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing.response_json;
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and caree_user_id = v_actor
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-capacity:' || v_actor::text, 0)
  );

  if v_relationship.status = 'active' then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', v_relationship.id,
      'status', 'active',
      'idempotent', true
    );
  elsif v_relationship.status <> 'pending_caree_acceptance'
    or (
      v_relationship.request_expires_at is not null
      and v_relationship.request_expires_at <= now()
    ) then
    raise exception '48012' using errcode = 'P0001';
  else
    v_capability := public.resolve_care_circle_capability(v_actor);

    if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
      raise exception '48012' using errcode = 'P0001';
    end if;

    select count(*)
    into v_active_count
    from public.care_relationships
    where caree_user_id = v_actor
      and status = 'active'
      and id <> p_relationship_id;

    if v_active_count >= 5 then
      raise exception '48012' using errcode = 'P0001';
    end if;

    update public.care_relationships
    set
      status = 'active',
      accepted_at = now(),
      last_operation_request_id = p_request_id,
      updated_at = now()
    where id = p_relationship_id;

    insert into public.care_relationship_events (
      relationship_id,
      actor_user_id,
      event_type,
      metadata,
      event_idempotency_key
    ) values (
      p_relationship_id,
      v_actor,
      'request_accepted',
      '{}'::jsonb,
      'relationship_accept:' || v_actor::text || ':' || p_request_id::text
    );

    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', 'active',
      'idempotent', false
    );
  end if;

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    v_actor,
    p_request_id,
    'relationship_accept',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.accept_care_relationship(uuid, uuid, text)
  from public, anon;
grant execute on function public.accept_care_relationship(uuid, uuid, text)
  to authenticated;

create or replace function public.remove_care_relationship(
  p_relationship_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.care_relationships%rowtype;
  v_existing public.care_operation_requests%rowtype;
  v_status text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception 'CARE_REQUEST_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-request:' || v_actor::text || ':' || p_request_id::text, 0)
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = v_actor
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_remove'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception 'CARE_REQUEST_ID_CONFLICT' using errcode = '23505';
    end if;

    return v_existing.response_json;
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and (caree_user_id = v_actor or carer_user_id = v_actor)
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  if v_relationship.status in (
    'removed_by_caree',
    'removed_by_carer',
    'declined',
    'expired'
  ) then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', v_relationship.status,
      'idempotent', true
    );
  else
    v_status := case
      when v_relationship.caree_user_id = v_actor
        then 'removed_by_caree'
      else 'removed_by_carer'
    end;

    update public.care_relationships
    set
      status = v_status,
      removed_at = now(),
      removed_by_user_id = v_actor,
      last_operation_request_id = p_request_id,
      updated_at = now()
    where id = p_relationship_id;

    update public.care_checkin_rounds
    set
      status = 'cancelled',
      closed_at = now(),
      close_reason = 'relationship_removed',
      updated_at = now()
    where caree_user_id = v_relationship.caree_user_id
      and status in ('open', 'grace_period')
      and not exists (
        select 1
        from public.care_relationships remaining_relationship
        where remaining_relationship.caree_user_id = v_relationship.caree_user_id
          and remaining_relationship.status = 'active'
      );

    insert into public.care_relationship_events (
      relationship_id,
      actor_user_id,
      event_type,
      metadata,
      event_idempotency_key
    ) values (
      p_relationship_id,
      v_actor,
      'relationship_removed',
      jsonb_build_object('removed_by', case
        when v_relationship.caree_user_id = v_actor then 'caree'
        else 'carer'
      end),
      'relationship_remove:' || v_actor::text || ':' || p_request_id::text
    );

    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', v_status,
      'idempotent', false
    );
  end if;

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    v_actor,
    p_request_id,
    'relationship_remove',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.remove_care_relationship(uuid, uuid, text)
  from public, anon;
grant execute on function public.remove_care_relationship(uuid, uuid, text)
  to authenticated;

comment on table public.care_link_codes is
  'Backend-only Caree-owned one-hour invitation code fingerprints. Raw codes are never stored.';
comment on table public.care_check_settings is
  'Inactive Caree-owned cadence and pause foundation. No scheduler is created by migration 0032.';
comment on table public.care_checkin_rounds is
  'Inactive check-in/grace state foundation with a three-notice ceiling. No notification delivery is created.';
comment on function public.accept_care_relationship(uuid, uuid, text) is
  'Inactive backend foundation. Transactionally rechecks Caree capability and enforces at most five active carers.';$s2_t40_source$]::text[], 'care_circle_backend_foundation');

do $s2_t40_postcheck$
begin
  if (select count(*) from supabase_migrations.schema_migrations
       where version = '0032' and name = 'care_circle_backend_foundation') <> 1 then
    raise exception 'S2_T40_STOP_HISTORY_INSERT_MISMATCH' using errcode = 'P0001';
  end if;
end
$s2_t40_postcheck$;

rollback;
