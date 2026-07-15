-- Ensure first onboarding creates an active chart/profile version record.
-- This replaces the onboarding RPC without editing already-applied migrations.

with latest_profiles as (
  select distinct on (user_id)
    id,
    user_id,
    chart_version,
    chart_json
  from public.ai_profiles
  order by user_id, chart_version desc, version desc
)
update public.ai_profiles profile
set is_active = (profile.id = latest_profiles.id)
from latest_profiles
where profile.user_id = latest_profiles.user_id;

with latest_profiles as (
  select distinct on (user_id)
    user_id,
    chart_version
  from public.ai_profiles
  order by user_id, chart_version desc, version desc
)
update public.birth_data birth
set active_chart_version = latest_profiles.chart_version
from latest_profiles
where birth.user_id = latest_profiles.user_id;

with latest_profiles as (
  select distinct on (user_id)
    user_id,
    chart_version
  from public.ai_profiles
  order by user_id, chart_version desc, version desc
)
update public.birth_data_history history
set status = 'superseded'
from latest_profiles
where history.user_id = latest_profiles.user_id
  and history.status = 'active'
  and history.chart_version <> latest_profiles.chart_version;

with latest_profiles as (
  select distinct on (profile.user_id)
    profile.id as ai_profile_id,
    profile.user_id,
    profile.chart_version,
    profile.chart_json - 'rawProviderResponse' as chart_json,
    birth.birth_date,
    birth.birth_time,
    birth.time_unknown,
    birth.place_name,
    birth.lat,
    birth.lng,
    birth.tz_str
  from public.ai_profiles profile
  join public.birth_data birth on birth.user_id = profile.user_id
  order by profile.user_id, profile.chart_version desc, profile.version desc
)
insert into public.birth_data_history (
  user_id,
  birth_data_user_id,
  chart_version,
  birth_date,
  birth_time,
  unknown_time_flag,
  birth_place_text,
  lat,
  lng,
  timezone,
  chart_json,
  ai_profile_id,
  status,
  activated_at
)
select
  user_id,
  user_id,
  chart_version,
  birth_date,
  birth_time,
  time_unknown,
  place_name,
  lat,
  lng,
  tz_str,
  chart_json,
  ai_profile_id,
  'active',
  now()
from latest_profiles
on conflict (user_id, chart_version) do update set
  chart_json = excluded.chart_json,
  ai_profile_id = excluded.ai_profile_id,
  status = 'active',
  activated_at = coalesce(public.birth_data_history.activated_at, excluded.activated_at);

with latest_profiles as (
  select distinct on (profile.user_id)
    profile.id,
    profile.user_id,
    profile.chart_version
  from public.ai_profiles profile
  order by profile.user_id, profile.chart_version desc, profile.version desc
)
update public.ai_profiles profile
set birth_data_history_id = history.id
from latest_profiles
join public.birth_data_history history
  on history.user_id = latest_profiles.user_id
  and history.chart_version = latest_profiles.chart_version
where profile.id = latest_profiles.id
  and profile.birth_data_history_id is null;

create or replace function public.complete_profile_onboarding(
  p_user_id uuid,
  p_display_name text,
  p_birth_date date,
  p_birth_time time,
  p_time_unknown boolean,
  p_place_name text,
  p_country_code varchar,
  p_lat numeric,
  p_lng numeric,
  p_tz_str text,
  p_role varchar,
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
  v_birth_exists boolean;
  v_profile_id bigint;
  v_profile_version int;
  v_chart_version int;
  v_grant_exists boolean;
  v_history_id bigint;
begin
  select exists (
    select 1
    from public.birth_data
    where user_id = p_user_id
  ) into v_birth_exists;

  select id, version, chart_version, birth_data_history_id
  into v_profile_id, v_profile_version, v_chart_version, v_history_id
  from public.ai_profiles
  where user_id = p_user_id
  order by chart_version desc, version desc
  limit 1;

  select exists (
    select 1
    from public.monthly_balance
    where user_id = p_user_id
      and grant_type = 'starter_onboarding'
  ) into v_grant_exists;

  if v_birth_exists and v_profile_id is not null then
    update public.ai_profiles
    set is_active = (id = v_profile_id)
    where user_id = p_user_id;

    update public.birth_data
    set active_chart_version = coalesce(v_chart_version, active_chart_version, 1)
    where user_id = p_user_id;

    if v_history_id is null then
      update public.birth_data_history
      set status = 'superseded'
      where user_id = p_user_id
        and status = 'active'
        and chart_version <> coalesce(v_chart_version, 1);

      insert into public.birth_data_history (
        user_id,
        birth_data_user_id,
        chart_version,
        birth_date,
        birth_time,
        unknown_time_flag,
        birth_place_text,
        lat,
        lng,
        timezone,
        chart_json,
        ai_profile_id,
        status,
        activated_at
      )
      select
        p_user_id,
        p_user_id,
        coalesce(v_chart_version, 1),
        birth_date,
        birth_time,
        time_unknown,
        place_name,
        lat,
        lng,
        tz_str,
        (coalesce(p_chart_json, (
          select chart_json
          from public.ai_profiles
          where id = v_profile_id
        ))) - 'rawProviderResponse',
        v_profile_id,
        'active',
        now()
      from public.birth_data
      where user_id = p_user_id
      on conflict (user_id, chart_version) do update set
        chart_json = excluded.chart_json,
        ai_profile_id = excluded.ai_profile_id,
        status = 'active',
        activated_at = coalesce(public.birth_data_history.activated_at, excluded.activated_at)
      returning id into v_history_id;

      update public.ai_profiles
      set birth_data_history_id = v_history_id
      where id = v_profile_id;
    end if;

    if v_grant_exists then
      return jsonb_build_object(
        'ok', false,
        'error_code', 'PROFILE_ALREADY_EXISTS',
        'message', 'This account already has a chart profile. Birth-detail edits must use the controlled regeneration flow.'
      );
    end if;

    insert into public.monthly_balance (
      user_id,
      grant_type,
      allocated,
      remaining
    )
    values (
      p_user_id,
      'starter_onboarding',
      50,
      50
    )
    on conflict (user_id)
    where grant_type = 'starter_onboarding'
    do nothing;

    return jsonb_build_object(
      'ok', true,
      'ai_profile_id', v_profile_id,
      'profile_version', v_profile_version,
      'chart_version', coalesce(v_chart_version, 1),
      'birth_data_history_id', v_history_id,
      'repaired_missing_starter', true
    );
  end if;

  insert into public.users (
    id,
    display_name,
    buddy_name,
    persona_style,
    role
  )
  values (
    p_user_id,
    coalesce(nullif(p_display_name, ''), 'Lumis user'),
    'Lumis',
    'acceptance',
    p_role
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    buddy_name = excluded.buddy_name,
    persona_style = excluded.persona_style,
    role = excluded.role;

  if v_birth_exists then
    if v_profile_id is null then
      update public.birth_data
      set
        birth_date = p_birth_date,
        birth_time = case when p_time_unknown then null else p_birth_time end,
        time_unknown = p_time_unknown,
        place_name = p_place_name,
        country_code = p_country_code,
        lat = p_lat,
        lng = p_lng,
        tz_str = p_tz_str,
        active_chart_version = 1,
        updated_at = now()
      where user_id = p_user_id;
    end if;
  else
    insert into public.birth_data (
      user_id,
      birth_date,
      birth_time,
      time_unknown,
      place_name,
      country_code,
      lat,
      lng,
      tz_str,
      active_chart_version
    )
    values (
      p_user_id,
      p_birth_date,
      case when p_time_unknown then null else p_birth_time end,
      p_time_unknown,
      p_place_name,
      p_country_code,
      p_lat,
      p_lng,
      p_tz_str,
      1
    );
  end if;

  if v_profile_id is null then
    select coalesce(max(version), 0) + 1
    into v_profile_version
    from public.ai_profiles
    where user_id = p_user_id;

    v_chart_version := 1;

    insert into public.birth_data_history (
      user_id,
      birth_data_user_id,
      chart_version,
      birth_date,
      birth_time,
      unknown_time_flag,
      birth_place_text,
      lat,
      lng,
      timezone,
      chart_json,
      status,
      activated_at
    )
    values (
      p_user_id,
      p_user_id,
      v_chart_version,
      p_birth_date,
      case when p_time_unknown then null else p_birth_time end,
      p_time_unknown,
      p_place_name,
      p_lat,
      p_lng,
      p_tz_str,
      p_chart_json - 'rawProviderResponse',
      'active',
      now()
    )
    returning id into v_history_id;

    insert into public.ai_profiles (
      user_id,
      version,
      chart_version,
      birth_data_history_id,
      is_active,
      chart_json,
      raw_chart_json,
      precision,
      model
    )
    values (
      p_user_id,
      v_profile_version,
      v_chart_version,
      v_history_id,
      true,
      p_chart_json - 'rawProviderResponse',
      p_raw_chart_json,
      p_precision,
      p_model
    )
    returning id into v_profile_id;

    update public.birth_data_history
    set ai_profile_id = v_profile_id
    where id = v_history_id;
  end if;

  insert into public.monthly_balance (
    user_id,
    grant_type,
    allocated,
    remaining
  )
  values (
    p_user_id,
    'starter_onboarding',
    50,
    50
  )
  on conflict (user_id)
  where grant_type = 'starter_onboarding'
  do nothing;

  return jsonb_build_object(
    'ok', true,
    'ai_profile_id', v_profile_id,
    'profile_version', v_profile_version,
    'chart_version', coalesce(v_chart_version, 1),
    'birth_data_history_id', v_history_id
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'error_code', 'PROFILE_ALREADY_EXISTS',
      'message', 'This account already has a chart profile. Birth-detail edits must use the controlled regeneration flow.'
    );
end;
$$;

revoke all on function public.complete_profile_onboarding(
  uuid,
  text,
  date,
  time,
  boolean,
  text,
  varchar,
  numeric,
  numeric,
  text,
  varchar,
  jsonb,
  jsonb,
  varchar,
  text
) from public;

grant execute on function public.complete_profile_onboarding(
  uuid,
  text,
  date,
  time,
  boolean,
  text,
  varchar,
  numeric,
  numeric,
  text,
  varchar,
  jsonb,
  jsonb,
  varchar,
  text
) to service_role;
