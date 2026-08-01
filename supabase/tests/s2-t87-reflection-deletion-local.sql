\set ON_ERROR_STOP on
begin;

insert into public.users (id, display_name)
values
  ('71000000-0000-4000-8000-000000000001', 'Synthetic Owner A'),
  ('72000000-0000-4000-8000-000000000001', 'Synthetic Owner B');

insert into public.chat_threads (id, user_id, title)
values
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Delete target'),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'Owner A retained'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 'Owner B retained');

insert into public.chat_messages (id, thread_id, user_id, role, content)
values
  ('74000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'user', 'Synthetic delete target'),
  ('74000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'user', 'Synthetic retained A'),
  ('74000000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 'user', 'Synthetic retained B');

do $$
begin
  if has_function_privilege('anon', 'public.delete_owned_reflection(uuid,uuid)', 'EXECUTE') then
    raise exception 'S2_T87_ANONYMOUS_EXECUTE_ALLOWED';
  end if;
  if has_table_privilege('authenticated', 'public.reflection_deletion_requests', 'SELECT')
     or has_table_privilege('authenticated', 'public.reflection_deletion_requests', 'INSERT') then
    raise exception 'S2_T87_REQUEST_LEDGER_EXPOSED';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_result text;
begin
  v_result := public.delete_owned_reflection(
    '73000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000001'
  );
  if v_result <> 'deleted' then raise exception 'S2_T87_OWNER_DELETE_FAILED'; end if;
  if exists (select 1 from public.chat_threads where id = '73000000-0000-4000-8000-000000000001') then
    raise exception 'S2_T87_THREAD_RETAINED';
  end if;
  if exists (select 1 from public.chat_messages where thread_id = '73000000-0000-4000-8000-000000000001') then
    raise exception 'S2_T87_MESSAGE_CASCADE_FAILED';
  end if;
  if not exists (select 1 from public.chat_threads
      where id = '73000000-0000-4000-8000-000000000002') then
    raise exception 'S2_T87_OWNER_RETAINED_THREAD_CHANGED';
  end if;
  if not exists (select 1 from public.chat_messages
      where id = '74000000-0000-4000-8000-000000000002') then
    raise exception 'S2_T87_OWNER_RETAINED_MESSAGE_CHANGED';
  end if;

  v_result := public.delete_owned_reflection(
    '73000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000001'
  );
  if v_result <> 'already_deleted' then raise exception 'S2_T87_REPLAY_NOT_IDEMPOTENT'; end if;

  begin
    perform public.delete_owned_reflection(
      '73000000-0000-4000-8000-000000000002',
      '75000000-0000-4000-8000-000000000001'
    );
    raise exception 'S2_T87_REQUEST_CONFLICT_ALLOWED';
  exception when unique_violation then
    if sqlerrm <> 'REFLECTION_REQUEST_CONFLICT' then raise; end if;
  end;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.chat_threads where id in (
      '73000000-0000-4000-8000-000000000002',
      '73000000-0000-4000-8000-000000000003'
    )) <> 2 then
    raise exception 'S2_T87_UNRELATED_THREAD_CHANGED';
  end if;
  if (select count(*) from public.chat_messages where id in (
      '74000000-0000-4000-8000-000000000002',
      '74000000-0000-4000-8000-000000000003'
    )) <> 2 then
    raise exception 'S2_T87_UNRELATED_MESSAGE_CHANGED';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    perform public.delete_owned_reflection(
      '73000000-0000-4000-8000-000000000002',
      '76000000-0000-4000-8000-000000000001'
    );
    raise exception 'S2_T87_CROSS_OWNER_DELETE_ALLOWED';
  exception when no_data_found then
    null;
  end;
end;
$$;

reset role;
do $$
begin
  if not exists (select 1 from public.chat_threads
      where id = '73000000-0000-4000-8000-000000000002') then
    raise exception 'S2_T87_CROSS_OWNER_THREAD_CHANGED';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.delete_owned_reflection(
      '73000000-0000-4000-8000-000000000003',
      '76000000-0000-4000-8000-000000000002'
    );
    raise exception 'S2_T87_UNAUTHENTICATED_DELETE_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
rollback;
select 'S2_T87_REFLECTION_DELETION_LOCAL_PROOF_PASSED' as result;
