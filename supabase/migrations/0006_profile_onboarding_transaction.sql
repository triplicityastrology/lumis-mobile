-- Atomic first-time profile onboarding.
-- The Edge Function calls this RPC after JWT verification so birth data,
-- fixture/current AI profile, and the one-time Starter grant commit together.

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
  v_grant_exists boolean;
begin
  select exists (
    select 1
    from public.birth_data
    where user_id = p_user_id
  ) into v_birth_exists;

  select id, version
  into v_profile_id, v_profile_version
  from public.ai_profiles
  where user_id = p_user_id
  order by version desc
  limit 1;

  select exists (
    select 1
    from public.monthly_balance
    where user_id = p_user_id
      and grant_type = 'starter_onboarding'
  ) into v_grant_exists;

  if v_birth_exists and v_profile_id is not null then
    if v_grant_exists then
      return jsonb_build_object(
        'ok', false,
        'error_code', 'PROFILE_ALREADY_EXISTS',
        'message', 'This account already has a chart profile. Birth-detail edits must use the controlled regeneration flow.'
      );
    end if;
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
      tz_str
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
      p_tz_str
    );
  end if;

  if v_profile_id is null then
    select coalesce(max(version), 0) + 1
    into v_profile_version
    from public.ai_profiles
    where user_id = p_user_id;

    insert into public.ai_profiles (
      user_id,
      version,
      chart_json,
      raw_chart_json,
      precision,
      model
    )
    values (
      p_user_id,
      v_profile_version,
      p_chart_json,
      p_raw_chart_json,
      p_precision,
      p_model
    )
    returning id into v_profile_id;
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
  );

  return jsonb_build_object(
    'ok', true,
    'ai_profile_id', v_profile_id,
    'profile_version', v_profile_version
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
