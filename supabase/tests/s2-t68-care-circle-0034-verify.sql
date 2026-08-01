set request.jwt.claim.role = 'service_role';

do $$
declare
  v_first uuid;
  v_replay jsonb;
begin
  if (select count(*) from public.care_relationships where status = 'active') <> 5 then
    raise exception 'S2_T68_ACTIVE_CAPACITY_MISMATCH';
  end if;
  if (select count(*) from public.care_relationships where status = 'pending_caree_acceptance') <> 1 then
    raise exception 'S2_T68_PENDING_REMAINDER_MISMATCH';
  end if;

  select id into v_first
  from public.care_relationships
  where status = 'active'
  order by carer_user_id
  limit 1;

  select public.accept_care_relationship_backend(
    '10000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'accept-1',
    v_first
  ) into v_replay;
  if (v_replay->>'idempotent')::boolean is not true then
    raise exception 'S2_T68_ACCEPT_REPLAY_MISMATCH';
  end if;

  begin
    perform public.accept_care_relationship_backend(
      '10000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      'accept-conflict',
      v_first
    );
    raise exception 'S2_T68_ACCEPT_CONFLICT_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48012' then raise; end if;
  end;
end;
$$;

select 'S2_T68_0034_CONCURRENCY_PASSED';
