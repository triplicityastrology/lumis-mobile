-- A client message ID identifies the entire requested turn, not only its text.
-- This is required before that ID can guard an atomic paid chat transaction.

alter table public.chat_messages
  add column if not exists request_force_new_thread boolean;
alter table public.chat_messages
  add column if not exists request_thread_id uuid;
alter table public.chat_messages
  add column if not exists request_ai_profile_id bigint;
alter table public.chat_messages
  add column if not exists request_chart_version integer;
alter table public.chat_messages
  add column if not exists request_persona_style varchar(24);

create or replace function public.persist_scaffold_chat_turn(
  p_user_id uuid,
  p_ai_profile_id bigint,
  p_chart_version int,
  p_persona_style varchar,
  p_route varchar,
  p_title text,
  p_user_message text,
  p_assistant_message text,
  p_force_new_thread boolean default false,
  p_thread_id uuid default null,
  p_client_msg_id uuid default null
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
  v_existing_user_content text;
  v_existing_assistant_content text;
  v_existing_route varchar;
  v_existing_force_new_thread boolean;
  v_existing_requested_thread_id uuid;
  v_existing_ai_profile_id bigint;
  v_existing_chart_version integer;
  v_existing_persona_style varchar;
begin
  if p_user_id is null
    or p_ai_profile_id is null
    or p_chart_version is null
    or p_client_msg_id is null
    or nullif(trim(p_user_message), '') is null
    or nullif(trim(p_assistant_message), '') is null
    or (coalesce(p_force_new_thread, false) and p_thread_id is not null)
  then
    return jsonb_build_object('ok', false, 'error_code', 'CHAT_PERSISTENCE_INVALID_INPUT');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_client_msg_id::text, 0)
  );

  select
    id,
    thread_id,
    content,
    route,
    request_force_new_thread,
    request_thread_id,
    request_ai_profile_id,
    request_chart_version,
    request_persona_style
  into
    v_user_message_id,
    v_thread_id,
    v_existing_user_content,
    v_existing_route,
    v_existing_force_new_thread,
    v_existing_requested_thread_id,
    v_existing_ai_profile_id,
    v_existing_chart_version,
    v_existing_persona_style
  from public.chat_messages
  where user_id = p_user_id
    and client_msg_id = p_client_msg_id
    and role = 'user'
  limit 1;

  if v_user_message_id is not null then
    if v_existing_user_content is distinct from trim(p_user_message)
      or v_existing_route is distinct from coalesce(p_route, 'casual')
      or v_existing_force_new_thread is distinct from coalesce(p_force_new_thread, false)
      or v_existing_requested_thread_id is distinct from p_thread_id
      or v_existing_ai_profile_id is distinct from p_ai_profile_id
      or v_existing_chart_version is distinct from p_chart_version
      or v_existing_persona_style is distinct from coalesce(p_persona_style, 'acceptance')
    then
      return jsonb_build_object('ok', false, 'error_code', 'CHAT_IDEMPOTENCY_CONFLICT');
    end if;

    select id, content
    into v_assistant_message_id, v_existing_assistant_content
    from public.chat_messages
    where user_id = p_user_id
      and thread_id = v_thread_id
      and client_msg_id = p_client_msg_id
      and role = 'assistant'
    limit 1;

    if v_assistant_message_id is null then
      return jsonb_build_object('ok', false, 'error_code', 'CHAT_PERSISTENCE_INCOMPLETE');
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'thread_id', v_thread_id,
      'user_message_id', v_user_message_id,
      'assistant_message_id', v_assistant_message_id,
      'assistant_message', v_existing_assistant_content,
      'ai_profile_id', p_ai_profile_id,
      'chart_version', p_chart_version
    );
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

  if p_thread_id is not null then
    select id into v_thread_id
    from public.chat_threads
    where id = p_thread_id
      and user_id = p_user_id
      and status = 'active'
      and chart_version = p_chart_version
    limit 1;

    if v_thread_id is null then
      return jsonb_build_object('ok', false, 'error_code', 'REFLECTION_THREAD_NOT_AVAILABLE');
    end if;
  elsif not coalesce(p_force_new_thread, false) then
    select id into v_thread_id
    from public.chat_threads
    where user_id = p_user_id
      and status = 'active'
      and chart_version = p_chart_version
    order by updated_at desc, created_at desc
    limit 1;
  end if;

  if v_thread_id is null then
    insert into public.chat_threads (
      user_id, ai_profile_id, chart_version, persona_style, route, title, status
    ) values (
      p_user_id,
      p_ai_profile_id,
      p_chart_version,
      coalesce(p_persona_style, 'acceptance'),
      coalesce(p_route, 'casual'),
      nullif(trim(coalesce(p_title, '')), ''),
      'active'
    ) returning id into v_thread_id;
  else
    update public.chat_threads
    set
      ai_profile_id = p_ai_profile_id,
      persona_style = coalesce(p_persona_style, persona_style),
      route = coalesce(p_route, route),
      updated_at = now()
    where id = v_thread_id and user_id = p_user_id;
  end if;

  insert into public.chat_messages (
    thread_id,
    user_id,
    role,
    content,
    route,
    credits_cost,
    status,
    client_msg_id,
    request_force_new_thread,
    request_thread_id,
    request_ai_profile_id,
    request_chart_version,
    request_persona_style
  ) values (
    v_thread_id,
    p_user_id,
    'user',
    trim(p_user_message),
    coalesce(p_route, 'casual'),
    0,
    'committed',
    p_client_msg_id,
    coalesce(p_force_new_thread, false),
    p_thread_id,
    p_ai_profile_id,
    p_chart_version,
    coalesce(p_persona_style, 'acceptance')
  ) returning id into v_user_message_id;

  insert into public.chat_messages (
    thread_id, user_id, role, content, route, credits_cost, status, client_msg_id
  ) values (
    v_thread_id, p_user_id, 'assistant', trim(p_assistant_message),
    coalesce(p_route, 'casual'), 0, 'committed', p_client_msg_id
  ) returning id into v_assistant_message_id;

  update public.chat_threads
  set route = coalesce(p_route, route), updated_at = now()
  where id = v_thread_id and user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'thread_id', v_thread_id,
    'user_message_id', v_user_message_id,
    'assistant_message_id', v_assistant_message_id,
    'assistant_message', trim(p_assistant_message),
    'ai_profile_id', p_ai_profile_id,
    'chart_version', p_chart_version
  );
end;
$$;

revoke all on function public.persist_scaffold_chat_turn(
  uuid, bigint, int, varchar, varchar, text, text, text, boolean, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.persist_scaffold_chat_turn(
  uuid, bigint, int, varchar, varchar, text, text, text, boolean, uuid, uuid
) to service_role;

comment on column public.chat_messages.request_force_new_thread is
  'Original turn intent retained for full client_msg_id conflict detection.';
