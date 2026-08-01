-- S2-T40 Dashboard rollback rehearsal: 0034
-- Approved staging ref: bmqhwofmdgebpcihjlnb
-- Exact source: supabase/migrations/0034_reusable_care_pairing_operations.sql
-- Source SHA-256: 466821a3a92a1f75543cf265d2d2c4e3dcb3f850ee79efd77df3269cd4797ceb
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
  if v_history is distinct from '[["0001","initial_schema"],["0002","profile_chat_persistence"],["0003","care_notifications_usage"],["0004","birth_details_change_policy"],["0005","starter_grant_guard"],["0006","profile_onboarding_transaction"],["0007","lock_migration_reports_access"],["0008","onboarding_chart_history"],["0009","chat_turn_persistence_rpc"],["0010","strip_legacy_raw_provider_response"],["0011","explicit_reflection_thread"],["0012","external_sync_delivery_ledger"],["0013","account_deletion_external_sync"],["0014","authoritative_account_entitlements"],["0015","entitlement_provider_privacy"],["0016","trusted_birth_location_resolver"],["0017","persona_policy_and_entitlement_events"],["0018","remove_misleading_care_max_index"],["0019","dice_throws"],["0020","backend_runtime_guardrails"],["0021","runtime_observability_and_schedules"],["0022","chat_idempotency_context"],["0023","strict_sync_retention_and_provider_attempts"],["0024","provider_attempt_concurrency_and_payload_allowlist"],["0025","runtime_scheduler_status"],["0026","birth_details_regeneration"],["0027","entitlement_event_integrity_repair"],["0028","safe_account_deletion_status_refresh"],["0029","safe_account_deletion_enqueue_result"],["0030","safe_salesforce_deletion_subject_json"],["0032","care_circle_backend_foundation"],["0033","inactive_notification_foundation"]]'::jsonb then
    raise exception 'S2_T40_STOP_REMOTE_PARITY_MISMATCH' using errcode = 'P0001';
  end if;
end
$s2_t40_preflight$;

-- S2_T40_EXACT_MIGRATION_BODY_BEGIN
-- S2-T07-R1: reusable Caree pairing-code operations.
--
-- Source-only and inactive. This migration does not activate Care Circle,
-- expose pairing UI, send notifications, or configure a scheduler/provider.
--
-- Forward-only recovery:
--   1. keep all app callers disabled and the release UI on static preview;
--   2. do not expose these service-role RPCs directly to clients;
--   3. repair defects with a later corrective migration;
--   4. preserve relationship and pairing-code audit evidence.

alter table public.care_operation_requests
  drop constraint if exists care_operation_requests_operation_check;

alter table public.care_operation_requests
  add constraint care_operation_requests_operation_check
  check (operation in (
    'relationship_accept',
    'relationship_decline',
    'relationship_remove',
    'code_create',
    'code_revoke',
    'code_consume',
    'settings_pause',
    'settings_resume',
    'settings_update',
    'checkin_respond'
  ));

-- Physical table names from migration 0032 remain for forward compatibility.
-- API and product contracts call this material a pairing code.
comment on table public.care_link_codes is
  'Backend-only reusable Caree pairing-code fingerprints. Raw pairing codes and QR payloads are never stored.';

create table if not exists public.care_pairing_code_events (
  event_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  code_id uuid references public.care_link_codes(code_id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in (
    'pairing_code_created',
    'pairing_code_rotated',
    'pairing_code_revoked',
    'pairing_code_used'
  )),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, request_id, event_type)
);

create index if not exists care_pairing_code_events_caree_created_idx
  on public.care_pairing_code_events (caree_user_id, created_at desc);

alter table public.care_pairing_code_events enable row level security;
revoke all on table public.care_pairing_code_events from anon, authenticated;
grant all on table public.care_pairing_code_events to service_role;

create or replace function public.assert_care_circle_backend_request(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_actor_user_id is null
    or p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception '48012' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_actor_user_id
      and deleted_at is null
  ) then
    raise exception '48007' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_care_circle_backend_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.assert_care_circle_backend_request(uuid, uuid, text)
  to service_role;

create or replace function public.create_care_pairing_code_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_previous_code public.care_link_codes%rowtype;
  v_code public.care_link_codes%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  if nullif(trim(coalesce(p_code_hash, '')), '') is null then
    raise exception '48012' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'code_create'
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;

    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  v_capability := public.resolve_care_circle_capability(p_actor_user_id);
  if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
    raise exception '48012' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-pairing-code:' || p_actor_user_id::text, 0)
  );

  select *
  into v_previous_code
  from public.care_link_codes
  where caree_user_id = p_actor_user_id
    and status = 'active'
  for update;

  if found then
    update public.care_link_codes
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where code_id = v_previous_code.code_id;

    insert into public.care_pairing_code_events (
      caree_user_id,
      code_id,
      actor_user_id,
      event_type,
      request_id
    ) values (
      p_actor_user_id,
      v_previous_code.code_id,
      p_actor_user_id,
      'pairing_code_rotated',
      p_request_id
    );
  end if;

  insert into public.care_link_codes (
    caree_user_id,
    code_hash,
    status,
    issued_at,
    expires_at
  ) values (
    p_actor_user_id,
    trim(p_code_hash),
    'active',
    now(),
    now() + interval '1 hour'
  )
  returning * into v_code;

  insert into public.care_pairing_code_events (
    caree_user_id,
    code_id,
    actor_user_id,
    event_type,
    request_id
  ) values (
    p_actor_user_id,
    v_code.code_id,
    p_actor_user_id,
    'pairing_code_created',
    p_request_id
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code_id', v_code.code_id,
    'status', v_code.status,
    'expires_at', v_code.expires_at,
    'idempotent', false
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    'code_create',
    v_code.code_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.revoke_care_pairing_code_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_code_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_code public.care_link_codes%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  if p_code_id is null then
    raise exception '48004' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'code_revoke'
      or v_existing.resource_id is distinct from p_code_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;

    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_code
  from public.care_link_codes
  where code_id = p_code_id
    and caree_user_id = p_actor_user_id
  for update;

  if not found then
    raise exception '48004' using errcode = 'P0001';
  end if;

  if v_code.status = 'active' then
    update public.care_link_codes
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where code_id = p_code_id;

    insert into public.care_pairing_code_events (
      caree_user_id,
      code_id,
      actor_user_id,
      event_type,
      request_id
    ) values (
      p_actor_user_id,
      p_code_id,
      p_actor_user_id,
      'pairing_code_revoked',
      p_request_id
    );
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'code_id', p_code_id,
    'status', case when v_code.status = 'active' then 'revoked' else v_code.status end,
    'idempotent', v_code.status <> 'active'
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    'code_revoke',
    p_code_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.consume_care_pairing_code_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_code public.care_link_codes%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  if nullif(trim(coalesce(p_code_hash, '')), '') is null then
    raise exception '48004' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'code_consume'
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;

    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  v_capability := public.resolve_care_circle_capability(p_actor_user_id);
  if coalesce((v_capability->>'can_act_as_carer')::boolean, false) is not true then
    raise exception '48013' using errcode = 'P0001';
  end if;

  select *
  into v_code
  from public.care_link_codes
  where code_hash = trim(p_code_hash)
    and status = 'active'
    and expires_at > now()
  for update;

  if not found then
    raise exception '48004' using errcode = 'P0001';
  end if;

  if v_code.caree_user_id = p_actor_user_id then
    raise exception '48006' using errcode = 'P0001';
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where caree_user_id = v_code.caree_user_id
    and carer_user_id = p_actor_user_id
    and status in ('pending_caree_acceptance', 'active')
  for update;

  if found then
    raise exception '48005' using errcode = 'P0001';
  end if;

  insert into public.care_relationships (
    caree_user_id,
    carer_user_id,
    status,
    requested_at,
    request_expires_at,
    last_operation_request_id
  ) values (
    v_code.caree_user_id,
    p_actor_user_id,
    'pending_caree_acceptance',
    now(),
    null,
    p_request_id
  )
  returning * into v_relationship;

  insert into public.care_relationship_events (
    relationship_id,
    actor_user_id,
    event_type,
    metadata,
    event_idempotency_key
  ) values
    (
      v_relationship.id,
      p_actor_user_id,
      'code_consumed',
      '{}'::jsonb,
      'pairing_code_used:' || p_actor_user_id::text || ':' || p_request_id::text
    ),
    (
      v_relationship.id,
      p_actor_user_id,
      'request_created',
      '{}'::jsonb,
      'relationship_request_created:' || p_actor_user_id::text || ':' || p_request_id::text
    );

  insert into public.care_pairing_code_events (
    caree_user_id,
    code_id,
    actor_user_id,
    event_type,
    request_id
  ) values (
    v_code.caree_user_id,
    v_code.code_id,
    p_actor_user_id,
    'pairing_code_used',
    p_request_id
  );

  v_result := jsonb_build_object(
    'ok', true,
    'relationship_id', v_relationship.id,
    'status', v_relationship.status,
    'idempotent', false
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    'code_consume',
    v_relationship.id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.accept_care_relationship_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_relationship_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_capability jsonb;
  v_active_count integer;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_accept'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and caree_user_id = p_actor_user_id
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-capacity:' || p_actor_user_id::text, 0)
  );

  if v_relationship.status = 'active' then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', v_relationship.id,
      'status', 'active',
      'idempotent', true
    );
  elsif v_relationship.status <> 'pending_caree_acceptance' then
    raise exception '48012' using errcode = 'P0001';
  else
    v_capability := public.resolve_care_circle_capability(p_actor_user_id);
    if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
      raise exception '48012' using errcode = 'P0001';
    end if;

    select count(*)
    into v_active_count
    from public.care_relationships
    where caree_user_id = p_actor_user_id
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
      p_actor_user_id,
      'request_accepted',
      '{}'::jsonb,
      'relationship_accept:' || p_actor_user_id::text || ':' || p_request_id::text
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
    p_actor_user_id,
    p_request_id,
    'relationship_accept',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.decline_care_relationship_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_relationship_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_decline'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and caree_user_id = p_actor_user_id
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  if v_relationship.status = 'declined' then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', 'declined',
      'idempotent', true
    );
  elsif v_relationship.status <> 'pending_caree_acceptance' then
    raise exception '48012' using errcode = 'P0001';
  else
    update public.care_relationships
    set
      status = 'declined',
      declined_at = now(),
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
      p_actor_user_id,
      'request_declined',
      '{}'::jsonb,
      'relationship_decline:' || p_actor_user_id::text || ':' || p_request_id::text
    );

    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', 'declined',
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
    p_actor_user_id,
    p_request_id,
    'relationship_decline',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.update_care_pause_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_paused_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_operation text;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  v_operation := case
    when p_paused_until is null then 'settings_resume'
    else 'settings_pause'
  end;

  if p_paused_until is not null and p_paused_until <= now() then
    raise exception '48012' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> v_operation
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  v_capability := public.resolve_care_circle_capability(p_actor_user_id);
  if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
    raise exception '48012' using errcode = 'P0001';
  end if;

  update public.care_check_settings
  set
    paused_at = case when p_paused_until is null then null else now() end,
    paused_until = p_paused_until,
    updated_at = now()
  where user_id = p_actor_user_id;

  if not found then
    raise exception '48012' using errcode = 'P0001';
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'status', case when p_paused_until is null then 'active' else 'paused' end,
    'paused_until', p_paused_until,
    'idempotent', false
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    v_operation,
    p_actor_user_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.remove_care_relationship_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_relationship_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_status text;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_remove'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and (
      caree_user_id = p_actor_user_id
      or carer_user_id = p_actor_user_id
    )
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
      when v_relationship.caree_user_id = p_actor_user_id
        then 'removed_by_caree'
      else 'removed_by_carer'
    end;

    update public.care_relationships
    set
      status = v_status,
      removed_at = now(),
      removed_by_user_id = p_actor_user_id,
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
      p_actor_user_id,
      'relationship_removed',
      jsonb_build_object(
        'removed_by',
        case
          when v_relationship.caree_user_id = p_actor_user_id then 'caree'
          else 'carer'
        end
      ),
      'relationship_remove:' || p_actor_user_id::text || ':' || p_request_id::text
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
    p_actor_user_id,
    p_request_id,
    'relationship_remove',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.accept_care_relationship(uuid, uuid, text)
  from authenticated;
revoke all on function public.remove_care_relationship(uuid, uuid, text)
  from authenticated;

revoke all on function public.create_care_pairing_code_backend(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_care_pairing_code_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.consume_care_pairing_code_backend(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.accept_care_relationship_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.decline_care_relationship_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_care_pause_backend(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.remove_care_relationship_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.create_care_pairing_code_backend(uuid, uuid, text, text)
  to service_role;
grant execute on function public.revoke_care_pairing_code_backend(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.consume_care_pairing_code_backend(uuid, uuid, text, text)
  to service_role;
grant execute on function public.accept_care_relationship_backend(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.decline_care_relationship_backend(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.update_care_pause_backend(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.remove_care_relationship_backend(uuid, uuid, text, uuid)
  to service_role;

comment on table public.care_pairing_code_events is
  'Service-only pairing-code lifecycle evidence. Contains no raw code, QR payload, or participant-readable metadata.';
comment on function public.consume_care_pairing_code_backend(uuid, uuid, text, text) is
  'Atomically uses a reusable pairing-code fingerprint to create one pending Caree-consent request per Carer.';
comment on function public.accept_care_relationship_backend(uuid, uuid, text, uuid) is
  'Service-only acceptance boundary with a Caree-scoped lock and transactional maximum-five active-carer guard.';
-- S2_T40_EXACT_MIGRATION_BODY_END

insert into supabase_migrations.schema_migrations (version, statements, name)
values ('0034', array[$s2_t40_source$-- S2-T07-R1: reusable Caree pairing-code operations.
--
-- Source-only and inactive. This migration does not activate Care Circle,
-- expose pairing UI, send notifications, or configure a scheduler/provider.
--
-- Forward-only recovery:
--   1. keep all app callers disabled and the release UI on static preview;
--   2. do not expose these service-role RPCs directly to clients;
--   3. repair defects with a later corrective migration;
--   4. preserve relationship and pairing-code audit evidence.

alter table public.care_operation_requests
  drop constraint if exists care_operation_requests_operation_check;

alter table public.care_operation_requests
  add constraint care_operation_requests_operation_check
  check (operation in (
    'relationship_accept',
    'relationship_decline',
    'relationship_remove',
    'code_create',
    'code_revoke',
    'code_consume',
    'settings_pause',
    'settings_resume',
    'settings_update',
    'checkin_respond'
  ));

-- Physical table names from migration 0032 remain for forward compatibility.
-- API and product contracts call this material a pairing code.
comment on table public.care_link_codes is
  'Backend-only reusable Caree pairing-code fingerprints. Raw pairing codes and QR payloads are never stored.';

create table if not exists public.care_pairing_code_events (
  event_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  code_id uuid references public.care_link_codes(code_id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in (
    'pairing_code_created',
    'pairing_code_rotated',
    'pairing_code_revoked',
    'pairing_code_used'
  )),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, request_id, event_type)
);

create index if not exists care_pairing_code_events_caree_created_idx
  on public.care_pairing_code_events (caree_user_id, created_at desc);

alter table public.care_pairing_code_events enable row level security;
revoke all on table public.care_pairing_code_events from anon, authenticated;
grant all on table public.care_pairing_code_events to service_role;

create or replace function public.assert_care_circle_backend_request(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_actor_user_id is null
    or p_request_id is null
    or nullif(trim(coalesce(p_request_digest, '')), '') is null then
    raise exception '48012' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_actor_user_id
      and deleted_at is null
  ) then
    raise exception '48007' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_care_circle_backend_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.assert_care_circle_backend_request(uuid, uuid, text)
  to service_role;

create or replace function public.create_care_pairing_code_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_previous_code public.care_link_codes%rowtype;
  v_code public.care_link_codes%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  if nullif(trim(coalesce(p_code_hash, '')), '') is null then
    raise exception '48012' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'code_create'
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;

    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  v_capability := public.resolve_care_circle_capability(p_actor_user_id);
  if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
    raise exception '48012' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-pairing-code:' || p_actor_user_id::text, 0)
  );

  select *
  into v_previous_code
  from public.care_link_codes
  where caree_user_id = p_actor_user_id
    and status = 'active'
  for update;

  if found then
    update public.care_link_codes
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where code_id = v_previous_code.code_id;

    insert into public.care_pairing_code_events (
      caree_user_id,
      code_id,
      actor_user_id,
      event_type,
      request_id
    ) values (
      p_actor_user_id,
      v_previous_code.code_id,
      p_actor_user_id,
      'pairing_code_rotated',
      p_request_id
    );
  end if;

  insert into public.care_link_codes (
    caree_user_id,
    code_hash,
    status,
    issued_at,
    expires_at
  ) values (
    p_actor_user_id,
    trim(p_code_hash),
    'active',
    now(),
    now() + interval '1 hour'
  )
  returning * into v_code;

  insert into public.care_pairing_code_events (
    caree_user_id,
    code_id,
    actor_user_id,
    event_type,
    request_id
  ) values (
    p_actor_user_id,
    v_code.code_id,
    p_actor_user_id,
    'pairing_code_created',
    p_request_id
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code_id', v_code.code_id,
    'status', v_code.status,
    'expires_at', v_code.expires_at,
    'idempotent', false
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    'code_create',
    v_code.code_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.revoke_care_pairing_code_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_code_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_code public.care_link_codes%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  if p_code_id is null then
    raise exception '48004' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'code_revoke'
      or v_existing.resource_id is distinct from p_code_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;

    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_code
  from public.care_link_codes
  where code_id = p_code_id
    and caree_user_id = p_actor_user_id
  for update;

  if not found then
    raise exception '48004' using errcode = 'P0001';
  end if;

  if v_code.status = 'active' then
    update public.care_link_codes
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where code_id = p_code_id;

    insert into public.care_pairing_code_events (
      caree_user_id,
      code_id,
      actor_user_id,
      event_type,
      request_id
    ) values (
      p_actor_user_id,
      p_code_id,
      p_actor_user_id,
      'pairing_code_revoked',
      p_request_id
    );
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'code_id', p_code_id,
    'status', case when v_code.status = 'active' then 'revoked' else v_code.status end,
    'idempotent', v_code.status <> 'active'
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    'code_revoke',
    p_code_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.consume_care_pairing_code_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_code public.care_link_codes%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  if nullif(trim(coalesce(p_code_hash, '')), '') is null then
    raise exception '48004' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'code_consume'
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;

    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  v_capability := public.resolve_care_circle_capability(p_actor_user_id);
  if coalesce((v_capability->>'can_act_as_carer')::boolean, false) is not true then
    raise exception '48013' using errcode = 'P0001';
  end if;

  select *
  into v_code
  from public.care_link_codes
  where code_hash = trim(p_code_hash)
    and status = 'active'
    and expires_at > now()
  for update;

  if not found then
    raise exception '48004' using errcode = 'P0001';
  end if;

  if v_code.caree_user_id = p_actor_user_id then
    raise exception '48006' using errcode = 'P0001';
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where caree_user_id = v_code.caree_user_id
    and carer_user_id = p_actor_user_id
    and status in ('pending_caree_acceptance', 'active')
  for update;

  if found then
    raise exception '48005' using errcode = 'P0001';
  end if;

  insert into public.care_relationships (
    caree_user_id,
    carer_user_id,
    status,
    requested_at,
    request_expires_at,
    last_operation_request_id
  ) values (
    v_code.caree_user_id,
    p_actor_user_id,
    'pending_caree_acceptance',
    now(),
    null,
    p_request_id
  )
  returning * into v_relationship;

  insert into public.care_relationship_events (
    relationship_id,
    actor_user_id,
    event_type,
    metadata,
    event_idempotency_key
  ) values
    (
      v_relationship.id,
      p_actor_user_id,
      'code_consumed',
      '{}'::jsonb,
      'pairing_code_used:' || p_actor_user_id::text || ':' || p_request_id::text
    ),
    (
      v_relationship.id,
      p_actor_user_id,
      'request_created',
      '{}'::jsonb,
      'relationship_request_created:' || p_actor_user_id::text || ':' || p_request_id::text
    );

  insert into public.care_pairing_code_events (
    caree_user_id,
    code_id,
    actor_user_id,
    event_type,
    request_id
  ) values (
    v_code.caree_user_id,
    v_code.code_id,
    p_actor_user_id,
    'pairing_code_used',
    p_request_id
  );

  v_result := jsonb_build_object(
    'ok', true,
    'relationship_id', v_relationship.id,
    'status', v_relationship.status,
    'idempotent', false
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    'code_consume',
    v_relationship.id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.accept_care_relationship_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_relationship_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_capability jsonb;
  v_active_count integer;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_accept'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and caree_user_id = p_actor_user_id
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('care-capacity:' || p_actor_user_id::text, 0)
  );

  if v_relationship.status = 'active' then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', v_relationship.id,
      'status', 'active',
      'idempotent', true
    );
  elsif v_relationship.status <> 'pending_caree_acceptance' then
    raise exception '48012' using errcode = 'P0001';
  else
    v_capability := public.resolve_care_circle_capability(p_actor_user_id);
    if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
      raise exception '48012' using errcode = 'P0001';
    end if;

    select count(*)
    into v_active_count
    from public.care_relationships
    where caree_user_id = p_actor_user_id
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
      p_actor_user_id,
      'request_accepted',
      '{}'::jsonb,
      'relationship_accept:' || p_actor_user_id::text || ':' || p_request_id::text
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
    p_actor_user_id,
    p_request_id,
    'relationship_accept',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.decline_care_relationship_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_relationship_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_decline'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and caree_user_id = p_actor_user_id
  for update;

  if not found then
    raise exception '48007' using errcode = 'P0001';
  end if;

  if v_relationship.status = 'declined' then
    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', 'declined',
      'idempotent', true
    );
  elsif v_relationship.status <> 'pending_caree_acceptance' then
    raise exception '48012' using errcode = 'P0001';
  else
    update public.care_relationships
    set
      status = 'declined',
      declined_at = now(),
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
      p_actor_user_id,
      'request_declined',
      '{}'::jsonb,
      'relationship_decline:' || p_actor_user_id::text || ':' || p_request_id::text
    );

    v_result := jsonb_build_object(
      'ok', true,
      'relationship_id', p_relationship_id,
      'status', 'declined',
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
    p_actor_user_id,
    p_request_id,
    'relationship_decline',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.update_care_pause_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_paused_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_capability jsonb;
  v_operation text;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  v_operation := case
    when p_paused_until is null then 'settings_resume'
    else 'settings_pause'
  end;

  if p_paused_until is not null and p_paused_until <= now() then
    raise exception '48012' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> v_operation
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  v_capability := public.resolve_care_circle_capability(p_actor_user_id);
  if coalesce((v_capability->>'can_act_as_caree')::boolean, false) is not true then
    raise exception '48012' using errcode = 'P0001';
  end if;

  update public.care_check_settings
  set
    paused_at = case when p_paused_until is null then null else now() end,
    paused_until = p_paused_until,
    updated_at = now()
  where user_id = p_actor_user_id;

  if not found then
    raise exception '48012' using errcode = 'P0001';
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'status', case when p_paused_until is null then 'active' else 'paused' end,
    'paused_until', p_paused_until,
    'idempotent', false
  );

  insert into public.care_operation_requests (
    user_id,
    request_id,
    operation,
    resource_id,
    request_digest,
    response_json
  ) values (
    p_actor_user_id,
    p_request_id,
    v_operation,
    p_actor_user_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

create or replace function public.remove_care_relationship_backend(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_request_digest text,
  p_relationship_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.care_operation_requests%rowtype;
  v_relationship public.care_relationships%rowtype;
  v_status text;
  v_result jsonb;
begin
  perform public.assert_care_circle_backend_request(
    p_actor_user_id,
    p_request_id,
    p_request_digest
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'care-request:' || p_actor_user_id::text || ':' || p_request_id::text,
      0
    )
  );

  select *
  into v_existing
  from public.care_operation_requests
  where user_id = p_actor_user_id
    and request_id = p_request_id;

  if found then
    if v_existing.operation <> 'relationship_remove'
      or v_existing.resource_id is distinct from p_relationship_id
      or v_existing.request_digest <> trim(p_request_digest) then
      raise exception '48012' using errcode = 'P0001';
    end if;
    return v_existing.response_json || jsonb_build_object('idempotent', true);
  end if;

  select *
  into v_relationship
  from public.care_relationships
  where id = p_relationship_id
    and (
      caree_user_id = p_actor_user_id
      or carer_user_id = p_actor_user_id
    )
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
      when v_relationship.caree_user_id = p_actor_user_id
        then 'removed_by_caree'
      else 'removed_by_carer'
    end;

    update public.care_relationships
    set
      status = v_status,
      removed_at = now(),
      removed_by_user_id = p_actor_user_id,
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
      p_actor_user_id,
      'relationship_removed',
      jsonb_build_object(
        'removed_by',
        case
          when v_relationship.caree_user_id = p_actor_user_id then 'caree'
          else 'carer'
        end
      ),
      'relationship_remove:' || p_actor_user_id::text || ':' || p_request_id::text
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
    p_actor_user_id,
    p_request_id,
    'relationship_remove',
    p_relationship_id,
    trim(p_request_digest),
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.accept_care_relationship(uuid, uuid, text)
  from authenticated;
revoke all on function public.remove_care_relationship(uuid, uuid, text)
  from authenticated;

revoke all on function public.create_care_pairing_code_backend(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_care_pairing_code_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.consume_care_pairing_code_backend(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.accept_care_relationship_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.decline_care_relationship_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_care_pause_backend(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.remove_care_relationship_backend(uuid, uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.create_care_pairing_code_backend(uuid, uuid, text, text)
  to service_role;
grant execute on function public.revoke_care_pairing_code_backend(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.consume_care_pairing_code_backend(uuid, uuid, text, text)
  to service_role;
grant execute on function public.accept_care_relationship_backend(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.decline_care_relationship_backend(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.update_care_pause_backend(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.remove_care_relationship_backend(uuid, uuid, text, uuid)
  to service_role;

comment on table public.care_pairing_code_events is
  'Service-only pairing-code lifecycle evidence. Contains no raw code, QR payload, or participant-readable metadata.';
comment on function public.consume_care_pairing_code_backend(uuid, uuid, text, text) is
  'Atomically uses a reusable pairing-code fingerprint to create one pending Caree-consent request per Carer.';
comment on function public.accept_care_relationship_backend(uuid, uuid, text, uuid) is
  'Service-only acceptance boundary with a Caree-scoped lock and transactional maximum-five active-carer guard.';$s2_t40_source$]::text[], 'reusable_care_pairing_operations');

do $s2_t40_postcheck$
begin
  if (select count(*) from supabase_migrations.schema_migrations
       where version = '0034' and name = 'reusable_care_pairing_operations') <> 1 then
    raise exception 'S2_T40_STOP_HISTORY_INSERT_MISMATCH' using errcode = 'P0001';
  end if;
end
$s2_t40_postcheck$;

rollback;
