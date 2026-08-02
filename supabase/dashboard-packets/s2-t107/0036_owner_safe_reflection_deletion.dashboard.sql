-- S2-T107 Dashboard apply packet: 0036
-- Approved staging ref: bmqhwofmdgebpcihjlnb
-- Exact source: supabase/migrations/0036_owner_safe_reflection_deletion.sql
-- Source SHA-256: 889a8177e2051af3745a2d3850b8e932011f3605cd933f1c1bce46a4629af1bf
-- STATUS: SOURCE_ONLY_UNRUN_REQUIRES_SEPARATE_MANUAL_AUTHORIZATION
-- The operator must independently confirm the Dashboard project ref before use.

begin;

do $s2_t107_preflight$
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
   where table_schema = 'supabase_migrations' and table_name = 'schema_migrations';
  if v_columns is distinct from '[{"column_name":"version","data_type":"text","udt_name":"text","is_nullable":"NO","column_default":null,"ordinal_position":1},{"column_name":"statements","data_type":"ARRAY","udt_name":"_text","is_nullable":"YES","column_default":null,"ordinal_position":2},{"column_name":"name","data_type":"text","udt_name":"text","is_nullable":"YES","column_default":null,"ordinal_position":3}]'::jsonb then
    raise exception 'S2_T107_STOP_HISTORY_SHAPE_MISMATCH' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(version, name) order by version), '[]'::jsonb)
    into v_history from supabase_migrations.schema_migrations;
  if v_history is distinct from '[["0001","initial_schema"],["0002","profile_chat_persistence"],["0003","care_notifications_usage"],["0004","birth_details_change_policy"],["0005","starter_grant_guard"],["0006","profile_onboarding_transaction"],["0007","lock_migration_reports_access"],["0008","onboarding_chart_history"],["0009","chat_turn_persistence_rpc"],["0010","strip_legacy_raw_provider_response"],["0011","explicit_reflection_thread"],["0012","external_sync_delivery_ledger"],["0013","account_deletion_external_sync"],["0014","authoritative_account_entitlements"],["0015","entitlement_provider_privacy"],["0016","trusted_birth_location_resolver"],["0017","persona_policy_and_entitlement_events"],["0018","remove_misleading_care_max_index"],["0019","dice_throws"],["0020","backend_runtime_guardrails"],["0021","runtime_observability_and_schedules"],["0022","chat_idempotency_context"],["0023","strict_sync_retention_and_provider_attempts"],["0024","provider_attempt_concurrency_and_payload_allowlist"],["0025","runtime_scheduler_status"],["0026","birth_details_regeneration"],["0027","entitlement_event_integrity_repair"],["0028","safe_account_deletion_status_refresh"],["0029","safe_account_deletion_enqueue_result"],["0030","safe_salesforce_deletion_subject_json"],["0032","care_circle_backend_foundation"],["0033","inactive_notification_foundation"],["0034","reusable_care_pairing_operations"],["0035","app_language_preference"]]'::jsonb then
    raise exception 'S2_T107_STOP_REMOTE_PARITY_OR_0035_MISMATCH' using errcode = 'P0001';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '0035' and name = 'app_language_preference') then
    raise exception 'S2_T107_STOP_0035_REQUIRED' using errcode = 'P0001';
  end if;
end
$s2_t107_preflight$;

-- S2_T107_EXACT_MIGRATION_BODY_BEGIN
-- Owner-safe, idempotent Past Reflection deletion. Not deployed by this source task.

create table if not exists public.reflection_deletion_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  client_request_id uuid not null,
  thread_id uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, client_request_id)
);

alter table public.reflection_deletion_requests enable row level security;
revoke all on table public.reflection_deletion_requests from anon, authenticated;

create or replace function public.delete_owned_reflection(
  p_thread_id uuid,
  p_client_request_id uuid
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_thread_id uuid;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'REFLECTION_AUTH_REQUIRED';
  end if;
  if p_thread_id is null or p_client_request_id is null then
    raise no_data_found using message = 'REFLECTION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_client_request_id::text, 0));

  select thread_id, completed_at
    into v_existing_thread_id, v_completed_at
    from public.reflection_deletion_requests
   where user_id = v_user_id
     and client_request_id = p_client_request_id;

  if found then
    if v_existing_thread_id <> p_thread_id then
      raise unique_violation using message = 'REFLECTION_REQUEST_CONFLICT';
    end if;
    if v_completed_at is not null then
      return 'already_deleted';
    end if;
  else
    if not exists (
      select 1
        from public.chat_threads
       where id = p_thread_id
         and user_id = v_user_id
       for update
    ) then
      raise no_data_found using message = 'REFLECTION_NOT_FOUND';
    end if;
    insert into public.reflection_deletion_requests (user_id, client_request_id, thread_id)
    values (v_user_id, p_client_request_id, p_thread_id);
  end if;

  delete from public.chat_threads
   where id = p_thread_id
     and user_id = v_user_id;
  if not found then
    raise no_data_found using message = 'REFLECTION_NOT_FOUND';
  end if;

  update public.reflection_deletion_requests
     set completed_at = now()
   where user_id = v_user_id
     and client_request_id = p_client_request_id;
  return 'deleted';
end;
$$;

revoke all on function public.delete_owned_reflection(uuid, uuid) from public, anon;
grant execute on function public.delete_owned_reflection(uuid, uuid) to authenticated;

comment on function public.delete_owned_reflection(uuid, uuid) is
  'Deletes one authenticated owner chat thread; dependent messages cascade and retries are idempotent.';
-- S2_T107_EXACT_MIGRATION_BODY_END

insert into supabase_migrations.schema_migrations (version, statements, name)
values ('0036', array[$s2_t107_source$-- Owner-safe, idempotent Past Reflection deletion. Not deployed by this source task.

create table if not exists public.reflection_deletion_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  client_request_id uuid not null,
  thread_id uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, client_request_id)
);

alter table public.reflection_deletion_requests enable row level security;
revoke all on table public.reflection_deletion_requests from anon, authenticated;

create or replace function public.delete_owned_reflection(
  p_thread_id uuid,
  p_client_request_id uuid
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_thread_id uuid;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'REFLECTION_AUTH_REQUIRED';
  end if;
  if p_thread_id is null or p_client_request_id is null then
    raise no_data_found using message = 'REFLECTION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_client_request_id::text, 0));

  select thread_id, completed_at
    into v_existing_thread_id, v_completed_at
    from public.reflection_deletion_requests
   where user_id = v_user_id
     and client_request_id = p_client_request_id;

  if found then
    if v_existing_thread_id <> p_thread_id then
      raise unique_violation using message = 'REFLECTION_REQUEST_CONFLICT';
    end if;
    if v_completed_at is not null then
      return 'already_deleted';
    end if;
  else
    if not exists (
      select 1
        from public.chat_threads
       where id = p_thread_id
         and user_id = v_user_id
       for update
    ) then
      raise no_data_found using message = 'REFLECTION_NOT_FOUND';
    end if;
    insert into public.reflection_deletion_requests (user_id, client_request_id, thread_id)
    values (v_user_id, p_client_request_id, p_thread_id);
  end if;

  delete from public.chat_threads
   where id = p_thread_id
     and user_id = v_user_id;
  if not found then
    raise no_data_found using message = 'REFLECTION_NOT_FOUND';
  end if;

  update public.reflection_deletion_requests
     set completed_at = now()
   where user_id = v_user_id
     and client_request_id = p_client_request_id;
  return 'deleted';
end;
$$;

revoke all on function public.delete_owned_reflection(uuid, uuid) from public, anon;
grant execute on function public.delete_owned_reflection(uuid, uuid) to authenticated;

comment on function public.delete_owned_reflection(uuid, uuid) is
  'Deletes one authenticated owner chat thread; dependent messages cascade and retries are idempotent.';$s2_t107_source$]::text[], 'owner_safe_reflection_deletion');

do $s2_t107_postcheck$
begin
  if (select count(*) from supabase_migrations.schema_migrations where version = '0036' and name = 'owner_safe_reflection_deletion') <> 1 then
    raise exception 'S2_T107_STOP_HISTORY_INSERT_MISMATCH' using errcode = 'P0001';
  end if;
end
$s2_t107_postcheck$;

commit;
