-- Controlled PROF-2 birth-detail regeneration.
-- A short-lived reservation prevents concurrent requests from paying for the
-- same chart generation. The lifetime counter changes only in the final,
-- transactional chart/profile activation.

create table if not exists public.birth_detail_change_requests (
  request_id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  request_digest text not null,
  expected_chart_version int not null,
  worker_request_id uuid not null,
  worker_requested_at timestamptz not null,
  status text not null default 'processing'
    check (status in ('processing', 'committed', 'failed')),
  result_chart_version int,
  result_ai_profile_id bigint references public.ai_profiles(id) on delete set null,
  result_birth_data_history_id bigint references public.birth_data_history(id) on delete set null,
  error_code text,
  lease_expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists birth_detail_change_requests_user_processing_idx
  on public.birth_detail_change_requests (user_id)
  where status = 'processing';

create index if not exists birth_detail_change_requests_user_created_idx
  on public.birth_detail_change_requests (user_id, created_at desc);

alter table public.birth_detail_change_requests enable row level security;
revoke all on table public.birth_detail_change_requests from public, anon, authenticated;
grant select, insert, update on table public.birth_detail_change_requests to service_role;

create or replace function public.reserve_birth_details_change(
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
  v_birth public.birth_data%rowtype;
  v_existing public.birth_detail_change_requests%rowtype;
  v_has_active_profile boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('birth-details-change:' || p_user_id::text, 0));

  if p_request_digest is null or length(p_request_digest) <> 64 then
    return jsonb_build_object('ok', false, 'error_code', '49002', 'message', 'Invalid birth-detail request.');
  end if;

  select * into v_existing
  from public.birth_detail_change_requests
  where request_id = p_request_id;

  if found then
    if v_existing.user_id <> p_user_id or v_existing.request_digest <> p_request_digest then
      return jsonb_build_object('ok', false, 'error_code', '49002', 'message', 'Birth-detail request conflict.');
    end if;

    if v_existing.status = 'committed' then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'chart_version', v_existing.result_chart_version,
        'ai_profile_id', v_existing.result_ai_profile_id,
        'birth_data_history_id', v_existing.result_birth_data_history_id,
        'worker_request_id', v_existing.worker_request_id,
        'worker_requested_at', v_existing.worker_requested_at
      );
    end if;

    if v_existing.status = 'processing' and v_existing.lease_expires_at > now() then
      return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'Birth-detail regeneration is already in progress.');
    end if;

    if v_existing.status = 'processing' or (
      v_existing.status = 'failed'
      and v_existing.error_code in ('CHART_WORKER_FAILED', 'PROFILE_COMMIT_FAILED', 'LEASE_EXPIRED', '49003')
    ) then
      select * into v_birth
      from public.birth_data
      where user_id = p_user_id
      for update;

      if not found or v_birth.active_chart_version <> v_existing.expected_chart_version then
        return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'The active chart changed before this request could resume.');
      end if;

      if exists (
        select 1 from public.birth_detail_change_requests
        where user_id = p_user_id
          and request_id <> p_request_id
          and status = 'processing'
          and lease_expires_at > now()
      ) then
        return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'Another birth-detail regeneration is already in progress.');
      end if;

      update public.birth_detail_change_requests
      set status = 'failed', error_code = 'LEASE_EXPIRED', updated_at = now(), completed_at = now()
      where user_id = p_user_id
        and request_id <> p_request_id
        and status = 'processing'
        and lease_expires_at <= now();

      update public.birth_detail_change_requests
      set status = 'processing',
          error_code = null,
          lease_expires_at = now() + interval '5 minutes',
          updated_at = now(),
          completed_at = null
      where request_id = p_request_id;

      return jsonb_build_object(
        'ok', true,
        'reserved', true,
        'resumed', true,
        'new_reservation', false,
        'expected_chart_version', v_existing.expected_chart_version,
        'worker_request_id', v_existing.worker_request_id,
        'worker_requested_at', v_existing.worker_requested_at
      );
    end if;

    return jsonb_build_object('ok', false, 'error_code', '49002', 'message', 'This birth-detail request cannot be retried unchanged.');
  end if;

  update public.birth_detail_change_requests
  set status = 'failed', error_code = 'LEASE_EXPIRED', updated_at = now(), completed_at = now()
  where user_id = p_user_id
    and status = 'processing'
    and lease_expires_at <= now();

  if exists (
    select 1 from public.birth_detail_change_requests
    where user_id = p_user_id and status = 'processing'
  ) then
    return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'Birth-detail regeneration is already in progress.');
  end if;

  select * into v_birth
  from public.birth_data
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', '49002', 'message', 'No active birth profile exists.');
  end if;

  select exists (
    select 1 from public.ai_profiles
    where user_id = p_user_id
      and is_active = true
      and chart_version = v_birth.active_chart_version
  ) into v_has_active_profile;

  if not v_has_active_profile then
    return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'The active chart profile is unavailable.');
  end if;

  if v_birth.successful_change_count >= 3 then
    return jsonb_build_object(
      'ok', false,
      'error_code', '49001',
      'message', 'Birth details have already been changed three times.',
      'successful_change_count', v_birth.successful_change_count,
      'remaining_changes', 0
    );
  end if;

  insert into public.birth_detail_change_requests (
    request_id, user_id, request_digest, expected_chart_version,
    worker_request_id, worker_requested_at
  ) values (
    p_request_id, p_user_id, p_request_digest, v_birth.active_chart_version,
    p_request_id, now()
  );

  return jsonb_build_object(
    'ok', true,
    'reserved', true,
    'resumed', false,
    'new_reservation', true,
    'expected_chart_version', v_birth.active_chart_version,
    'worker_request_id', p_request_id,
    'worker_requested_at', (
      select worker_requested_at from public.birth_detail_change_requests where request_id = p_request_id
    ),
    'successful_change_count', v_birth.successful_change_count,
    'remaining_changes', 3 - v_birth.successful_change_count
  );
end;
$$;

create or replace function public.fail_birth_details_change(
  p_user_id uuid,
  p_request_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.birth_detail_change_requests
  set status = 'failed',
      error_code = left(coalesce(p_error_code, '49003'), 64),
      updated_at = now(),
      completed_at = now()
  where request_id = p_request_id
    and user_id = p_user_id
    and status = 'processing';

  return found;
end;
$$;

create or replace function public.complete_birth_details_change(
  p_user_id uuid,
  p_request_id uuid,
  p_birth_date date,
  p_birth_time time,
  p_time_unknown boolean,
  p_place_name text,
  p_country_code varchar,
  p_lat numeric,
  p_lng numeric,
  p_tz_str text,
  p_chart_json jsonb,
  p_raw_chart_json jsonb,
  p_precision varchar,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.birth_detail_change_requests%rowtype;
  v_birth public.birth_data%rowtype;
  v_previous_profile public.ai_profiles%rowtype;
  v_new_profile_id bigint;
  v_new_profile_version int;
  v_new_chart_version int;
  v_history_id bigint;
  v_new_change_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended('birth-details-change:' || p_user_id::text, 0));

  select * into v_request
  from public.birth_detail_change_requests
  where request_id = p_request_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'Birth-detail reservation was not found.');
  end if;

  if v_request.status = 'committed' then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'chart_version', v_request.result_chart_version,
      'ai_profile_id', v_request.result_ai_profile_id,
      'birth_data_history_id', v_request.result_birth_data_history_id
    );
  end if;

  if v_request.status <> 'processing' or v_request.lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'Birth-detail reservation expired.');
  end if;

  select * into v_birth
  from public.birth_data
  where user_id = p_user_id
  for update;

  if not found
    or v_birth.active_chart_version <> v_request.expected_chart_version
    or v_birth.successful_change_count >= 3 then
    return jsonb_build_object(
      'ok', false,
      'error_code', case when v_birth.successful_change_count >= 3 then '49001' else '49003' end,
      'message', 'The active chart changed before regeneration completed.'
    );
  end if;

  if p_birth_date is null
    or nullif(trim(p_place_name), '') is null
    or nullif(trim(p_country_code), '') is null
    or nullif(trim(p_tz_str), '') is null
    or (not p_time_unknown and p_birth_time is null)
    or p_precision not in ('full', 'no_birth_time')
    or (p_time_unknown and p_precision <> 'no_birth_time')
    or jsonb_typeof(p_chart_json) <> 'object' then
    return jsonb_build_object('ok', false, 'error_code', '49002', 'message', 'Validated chart details are incomplete.');
  end if;

  select * into v_previous_profile
  from public.ai_profiles
  where user_id = p_user_id
    and is_active = true
    and chart_version = v_birth.active_chart_version
  order by version desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', '49003', 'message', 'The active chart profile is unavailable.');
  end if;

  v_new_chart_version := v_birth.active_chart_version + 1;
  v_new_change_count := v_birth.successful_change_count + 1;

  select coalesce(max(version), 0) + 1 into v_new_profile_version
  from public.ai_profiles
  where user_id = p_user_id;

  update public.birth_data_history
  set status = 'superseded'
  where user_id = p_user_id and status = 'active';

  update public.ai_profiles
  set is_active = false
  where user_id = p_user_id and is_active = true;

  insert into public.birth_data_history (
    user_id, birth_data_user_id, chart_version, birth_date, birth_time,
    unknown_time_flag, birth_place_text, lat, lng, timezone, chart_json,
    status, activated_at
  ) values (
    p_user_id, p_user_id, v_new_chart_version, p_birth_date,
    case when p_time_unknown then null else p_birth_time end,
    p_time_unknown, trim(p_place_name), p_lat, p_lng, trim(p_tz_str),
    p_chart_json - 'rawProviderResponse', 'active', now()
  ) returning id into v_history_id;

  insert into public.ai_profiles (
    user_id, version, chart_version, birth_data_history_id, is_active,
    chart_json, raw_chart_json, profile_json, precision, model
  ) values (
    p_user_id, v_new_profile_version, v_new_chart_version, v_history_id, true,
    p_chart_json - 'rawProviderResponse', p_raw_chart_json,
    jsonb_build_object(
      'status', 'chart_context_regenerated',
      'flow', 'PROF-2',
      'chart_version', v_new_chart_version,
      'generated_at', now()
    ),
    p_precision, p_model
  ) returning id into v_new_profile_id;

  update public.birth_data_history
  set ai_profile_id = v_new_profile_id
  where id = v_history_id;

  update public.birth_data
  set birth_date = p_birth_date,
      birth_time = case when p_time_unknown then null else p_birth_time end,
      time_unknown = p_time_unknown,
      place_name = trim(p_place_name),
      country_code = upper(trim(p_country_code)),
      lat = p_lat,
      lng = p_lng,
      tz_str = trim(p_tz_str),
      active_chart_version = v_new_chart_version,
      successful_change_count = v_new_change_count,
      updated_at = now()
  where user_id = p_user_id;

  update public.birth_detail_change_requests
  set status = 'committed',
      result_chart_version = v_new_chart_version,
      result_ai_profile_id = v_new_profile_id,
      result_birth_data_history_id = v_history_id,
      updated_at = now(),
      completed_at = now()
  where request_id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'chart_version', v_new_chart_version,
    'profile_version', v_new_profile_version,
    'ai_profile_id', v_new_profile_id,
    'birth_data_history_id', v_history_id,
    'successful_change_count', v_new_change_count,
    'remaining_changes', 3 - v_new_change_count
  );
end;
$$;

revoke all on function public.reserve_birth_details_change(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_birth_details_change(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_birth_details_change(
  uuid, uuid, date, time, boolean, text, varchar, numeric, numeric, text,
  jsonb, jsonb, varchar, text
) from public, anon, authenticated;

grant execute on function public.reserve_birth_details_change(uuid, uuid, text) to service_role;
grant execute on function public.fail_birth_details_change(uuid, uuid, text) to service_role;
grant execute on function public.complete_birth_details_change(
  uuid, uuid, date, time, boolean, text, varchar, numeric, numeric, text,
  jsonb, jsonb, varchar, text
) to service_role;

comment on table public.birth_detail_change_requests is
  'Backend-only PROF-2 idempotency and lease ledger. It stores no submitted birth details.';
