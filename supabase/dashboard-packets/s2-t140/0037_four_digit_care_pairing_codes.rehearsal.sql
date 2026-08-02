-- S2-T140 Dashboard rollback rehearsal: 0037
-- Approved staging ref: bmqhwofmdgebpcihjlnb
-- Exact source SHA-256: 3a5deda8546d5255e51c0cece16e67687cd71a63743f923a49aebf94f2f5852c
-- SOURCE_ONLY_UNRUN: visually verify the exact Dashboard project before use.
begin;
do $s2_t140_preflight$
declare v_columns jsonb; v_history jsonb;
begin
  select jsonb_agg(jsonb_build_object('column_name',column_name,'data_type',data_type,'udt_name',udt_name,'is_nullable',is_nullable,'column_default',column_default,'ordinal_position',ordinal_position) order by ordinal_position)
    into v_columns from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations';
  if v_columns is distinct from '[{"column_name":"version","data_type":"text","udt_name":"text","is_nullable":"NO","column_default":null,"ordinal_position":1},{"column_name":"statements","data_type":"ARRAY","udt_name":"_text","is_nullable":"YES","column_default":null,"ordinal_position":2},{"column_name":"name","data_type":"text","udt_name":"text","is_nullable":"YES","column_default":null,"ordinal_position":3}]'::jsonb then raise exception 'S2_T140_STOP_HISTORY_SHAPE_MISMATCH' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_array(version,name) order by version),'[]'::jsonb) into v_history from supabase_migrations.schema_migrations;
  if v_history is distinct from '[["0001","initial_schema"],["0002","profile_chat_persistence"],["0003","care_notifications_usage"],["0004","birth_details_change_policy"],["0005","starter_grant_guard"],["0006","profile_onboarding_transaction"],["0007","lock_migration_reports_access"],["0008","onboarding_chart_history"],["0009","chat_turn_persistence_rpc"],["0010","strip_legacy_raw_provider_response"],["0011","explicit_reflection_thread"],["0012","external_sync_delivery_ledger"],["0013","account_deletion_external_sync"],["0014","authoritative_account_entitlements"],["0015","entitlement_provider_privacy"],["0016","trusted_birth_location_resolver"],["0017","persona_policy_and_entitlement_events"],["0018","remove_misleading_care_max_index"],["0019","dice_throws"],["0020","backend_runtime_guardrails"],["0021","runtime_observability_and_schedules"],["0022","chat_idempotency_context"],["0023","strict_sync_retention_and_provider_attempts"],["0024","provider_attempt_concurrency_and_payload_allowlist"],["0025","runtime_scheduler_status"],["0026","birth_details_regeneration"],["0027","entitlement_event_integrity_repair"],["0028","safe_account_deletion_status_refresh"],["0029","safe_account_deletion_enqueue_result"],["0030","safe_salesforce_deletion_subject_json"],["0032","care_circle_backend_foundation"],["0033","inactive_notification_foundation"],["0034","reusable_care_pairing_operations"]]'::jsonb then raise exception 'S2_T140_STOP_REMOTE_PARITY_MISMATCH' using errcode='P0001'; end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version='0034' and name='reusable_care_pairing_operations') then raise exception 'S2_T140_STOP_0034_REQUIRED' using errcode='P0001'; end if;
  if to_regclass('public.care_pairing_attempt_windows') is not null or exists (select 1 from supabase_migrations.schema_migrations where version='0037') then raise exception 'S2_T140_STOP_0037_RESIDUE_PRESENT' using errcode='P0001'; end if;
end $s2_t140_preflight$;
-- S2_T140_EXECUTABLE_MIGRATION_BODY_BEGIN
alter table public.care_link_codes drop constraint if exists care_link_codes_window_check;
alter table public.care_link_codes add constraint care_link_codes_window_check
  check (expires_at > issued_at and expires_at <= issued_at + interval '10 minutes');
drop index if exists public.care_link_codes_hash_idx;
create unique index care_link_codes_active_hash_idx on public.care_link_codes(code_hash) where status='active';

create table if not exists public.care_pairing_attempt_windows (
  actor_user_id uuid primary key references public.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  updated_at timestamptz not null default now()
);
alter table public.care_pairing_attempt_windows enable row level security;
revoke all on public.care_pairing_attempt_windows from public, anon, authenticated;

create or replace function public.register_care_pairing_attempt_backend(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.care_pairing_attempt_windows%rowtype;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then raise exception '48010' using errcode='P0001'; end if;
  insert into public.care_pairing_attempt_windows(actor_user_id,window_started_at,attempt_count)
  values(p_actor_user_id,now(),1)
  on conflict(actor_user_id) do update set
    window_started_at=case when care_pairing_attempt_windows.window_started_at <= now()-interval '10 minutes' then now() else care_pairing_attempt_windows.window_started_at end,
    attempt_count=case when care_pairing_attempt_windows.window_started_at <= now()-interval '10 minutes' then 1 else care_pairing_attempt_windows.attempt_count+1 end,
    updated_at=now()
  returning * into v_row;
  return jsonb_build_object('ok',true,'allowed',true);
exception when check_violation then raise exception '48004' using errcode='P0001';
end; $$;
revoke all on function public.register_care_pairing_attempt_backend(uuid) from public,anon,authenticated;
grant execute on function public.register_care_pairing_attempt_backend(uuid) to service_role;

-- Replace only the one-hour literal in the reviewed 0034 create operation.
-- The Dashboard packet generator must compose this corrective body after 0034.
create or replace function public.set_care_pairing_code_ten_minute_expiry()
returns trigger language plpgsql set search_path=public as $$
begin
  new.expires_at := least(new.expires_at, new.issued_at + interval '10 minutes');
  return new;
end; $$;
drop trigger if exists enforce_care_pairing_code_ten_minute_expiry on public.care_link_codes;
create trigger enforce_care_pairing_code_ten_minute_expiry
before insert or update of expires_at on public.care_link_codes
for each row execute function public.set_care_pairing_code_ten_minute_expiry();
comment on table public.care_pairing_attempt_windows is 'Service-only attempt throttle; contains no raw pairing code.';
-- S2_T140_EXECUTABLE_MIGRATION_BODY_END
insert into supabase_migrations.schema_migrations (version, statements, name)
values ('0037',array[$s2_t140_source$begin;
alter table public.care_link_codes drop constraint if exists care_link_codes_window_check;
alter table public.care_link_codes add constraint care_link_codes_window_check
  check (expires_at > issued_at and expires_at <= issued_at + interval '10 minutes');
drop index if exists public.care_link_codes_hash_idx;
create unique index care_link_codes_active_hash_idx on public.care_link_codes(code_hash) where status='active';

create table if not exists public.care_pairing_attempt_windows (
  actor_user_id uuid primary key references public.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  updated_at timestamptz not null default now()
);
alter table public.care_pairing_attempt_windows enable row level security;
revoke all on public.care_pairing_attempt_windows from public, anon, authenticated;

create or replace function public.register_care_pairing_attempt_backend(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.care_pairing_attempt_windows%rowtype;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then raise exception '48010' using errcode='P0001'; end if;
  insert into public.care_pairing_attempt_windows(actor_user_id,window_started_at,attempt_count)
  values(p_actor_user_id,now(),1)
  on conflict(actor_user_id) do update set
    window_started_at=case when care_pairing_attempt_windows.window_started_at <= now()-interval '10 minutes' then now() else care_pairing_attempt_windows.window_started_at end,
    attempt_count=case when care_pairing_attempt_windows.window_started_at <= now()-interval '10 minutes' then 1 else care_pairing_attempt_windows.attempt_count+1 end,
    updated_at=now()
  returning * into v_row;
  return jsonb_build_object('ok',true,'allowed',true);
exception when check_violation then raise exception '48004' using errcode='P0001';
end; $$;
revoke all on function public.register_care_pairing_attempt_backend(uuid) from public,anon,authenticated;
grant execute on function public.register_care_pairing_attempt_backend(uuid) to service_role;

-- Replace only the one-hour literal in the reviewed 0034 create operation.
-- The Dashboard packet generator must compose this corrective body after 0034.
create or replace function public.set_care_pairing_code_ten_minute_expiry()
returns trigger language plpgsql set search_path=public as $$
begin
  new.expires_at := least(new.expires_at, new.issued_at + interval '10 minutes');
  return new;
end; $$;
drop trigger if exists enforce_care_pairing_code_ten_minute_expiry on public.care_link_codes;
create trigger enforce_care_pairing_code_ten_minute_expiry
before insert or update of expires_at on public.care_link_codes
for each row execute function public.set_care_pairing_code_ten_minute_expiry();
comment on table public.care_pairing_attempt_windows is 'Service-only attempt throttle; contains no raw pairing code.';
commit;$s2_t140_source$]::text[],'four_digit_care_pairing_codes');
do $s2_t140_postcheck$ begin
  if to_regclass('public.care_pairing_attempt_windows') is null or (select count(*) from supabase_migrations.schema_migrations where version='0037' and name='four_digit_care_pairing_codes') <> 1 then raise exception 'S2_T140_STOP_POSTCHECK_FAILED' using errcode='P0001'; end if;
end $s2_t140_postcheck$;
rollback;
do $s2_t140_zero_residue$ begin
  if to_regclass('public.care_pairing_attempt_windows') is not null or exists (select 1 from supabase_migrations.schema_migrations where version='0037') then raise exception 'S2_T140_STOP_REHEARSAL_RESIDUE' using errcode='P0001'; end if;
end $s2_t140_zero_residue$;
