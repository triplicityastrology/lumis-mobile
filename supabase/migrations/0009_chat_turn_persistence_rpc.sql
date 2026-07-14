-- Atomic scaffold chat persistence.
-- The Edge Function builds the reply from the active ai_profile and calls this
-- RPC so thread creation, both messages, and thread metadata commit together.

create or replace function public.persist_scaffold_chat_turn(
  p_user_id uuid,
  p_ai_profile_id bigint,
  p_chart_version int,
  p_persona_style varchar,
  p_route varchar,
  p_title text,
  p_user_message text,
  p_assistant_message text,
  p_force_new_thread boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_profile_id bigint;
begin
  if p_user_id is null
    or p_ai_profile_id is null
    or p_chart_version is null
    or nullif(trim(p_user_message), '') is null
    or nullif(trim(p_assistant_message), '') is null
  then
    return jsonb_build_object('ok', false, 'error_code', 'CHAT_PERSISTENCE_INVALID_INPUT');
  end if;

  select id
  into v_profile_id
  from public.ai_profiles
  where id = p_ai_profile_id
    and user_id = p_user_id
    and chart_version = p_chart_version
    and is_active = true
  limit 1;

  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'ACTIVE_PROFILE_REQUIRED');
  end if;

  if not coalesce(p_force_new_thread, false) then
    select id
    into v_thread_id
    from public.chat_threads
    where user_id = p_user_id
      and status = 'active'
      and chart_version = p_chart_version
    order by updated_at desc, created_at desc
    limit 1;
  end if;

  if v_thread_id is null then
    insert into public.chat_threads (
      user_id,
      ai_profile_id,
      chart_version,
      persona_style,
      route,
      title,
      status
    )
    values (
      p_user_id,
      p_ai_profile_id,
      p_chart_version,
      coalesce(p_persona_style, 'acceptance'),
      coalesce(p_route, 'casual'),
      nullif(trim(coalesce(p_title, '')), ''),
      'active'
    )
    returning id into v_thread_id;
  else
    update public.chat_threads
    set
      ai_profile_id = p_ai_profile_id,
      persona_style = coalesce(p_persona_style, persona_style),
      route = coalesce(p_route, route),
      updated_at = now()
    where id = v_thread_id
      and user_id = p_user_id;
  end if;

  insert into public.chat_messages (
    thread_id,
    user_id,
    role,
    content,
    route,
    credits_cost,
    status
  )
  values (
    v_thread_id,
    p_user_id,
    'user',
    trim(p_user_message),
    coalesce(p_route, 'casual'),
    0,
    'committed'
  )
  returning id into v_user_message_id;

  insert into public.chat_messages (
    thread_id,
    user_id,
    role,
    content,
    route,
    credits_cost,
    status
  )
  values (
    v_thread_id,
    p_user_id,
    'assistant',
    trim(p_assistant_message),
    coalesce(p_route, 'casual'),
    0,
    'committed'
  )
  returning id into v_assistant_message_id;

  update public.chat_threads
  set
    route = coalesce(p_route, route),
    updated_at = now()
  where id = v_thread_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'thread_id', v_thread_id,
    'user_message_id', v_user_message_id,
    'assistant_message_id', v_assistant_message_id,
    'ai_profile_id', p_ai_profile_id,
    'chart_version', p_chart_version
  );
end;
$$;

revoke all on function public.persist_scaffold_chat_turn(
  uuid,
  bigint,
  int,
  varchar,
  varchar,
  text,
  text,
  text,
  boolean
) from public;

grant execute on function public.persist_scaffold_chat_turn(
  uuid,
  bigint,
  int,
  varchar,
  varchar,
  text,
  text,
  text,
  boolean
) to service_role;
