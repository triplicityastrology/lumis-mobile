\set ON_ERROR_STOP on
begin;

insert into public.users (id, display_name, account_mode)
values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Caree', 'standard'),
  ('20000000-0000-4000-8000-000000000001', 'Synthetic Carer 1', 'standard'),
  ('20000000-0000-4000-8000-000000000002', 'Synthetic Carer 2', 'standard'),
  ('20000000-0000-4000-8000-000000000003', 'Synthetic Carer 3', 'standard'),
  ('20000000-0000-4000-8000-000000000004', 'Synthetic Carer 4', 'standard'),
  ('20000000-0000-4000-8000-000000000005', 'Synthetic Carer 5', 'standard'),
  ('20000000-0000-4000-8000-000000000006', 'Synthetic Carer 6', 'standard'),
  ('30000000-0000-4000-8000-000000000001', 'Synthetic Outsider', 'standard');

insert into public.account_entitlements (user_id, plan_tier, product_code, status, source)
values ('10000000-0000-4000-8000-000000000001', 'essential', 'ESSENTIAL_M', 'active', 'admin')
on conflict (user_id) do update set
  plan_tier = excluded.plan_tier, product_code = excluded.product_code,
  status = excluded.status, source = excluded.source;
insert into public.care_check_settings (user_id)
values ('10000000-0000-4000-8000-000000000001');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_code jsonb;
  v_relationship jsonb;
  v_relationship_id uuid;
  v_status text;
  v_carer integer;
begin
  v_code := public.create_care_pairing_code_backend(
    '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
    'digest:create:1', repeat('a', 64)
  );
  if v_code->>'status' <> 'active' then raise exception 'S2_T64_CODE_NOT_ACTIVE'; end if;

  for v_carer in 1..6 loop
    v_relationship := public.consume_care_pairing_code_backend(
      ('20000000-0000-4000-8000-' || lpad(v_carer::text, 12, '0'))::uuid,
      ('41000000-0000-4000-8000-' || lpad(v_carer::text, 12, '0'))::uuid,
      format('digest:consume:%s', v_carer), repeat('a', 64)
    );
    if v_relationship->>'status' <> 'pending_caree_acceptance' then
      raise exception 'S2_T64_PENDING_AUTHORITY_VIOLATION';
    end if;
  end loop;

  select id into v_relationship_id from public.care_relationships
  where carer_user_id = '20000000-0000-4000-8000-000000000001';
  begin
    perform public.accept_care_relationship_backend(
      '30000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
      'digest:outsider-accept', v_relationship_id
    );
    raise exception 'S2_T64_CAREE_ONLY_ACCEPTANCE_FAILED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48007' then raise; end if;
  end;

  for v_carer in 1..5 loop
    select id into v_relationship_id from public.care_relationships
    where carer_user_id = ('20000000-0000-4000-8000-' || lpad(v_carer::text, 12, '0'))::uuid;
    perform public.accept_care_relationship_backend(
      '10000000-0000-4000-8000-000000000001',
      ('43000000-0000-4000-8000-' || lpad(v_carer::text, 12, '0'))::uuid,
      format('digest:accept:%s', v_carer), v_relationship_id
    );
  end loop;

  select id into v_relationship_id from public.care_relationships
  where carer_user_id = '20000000-0000-4000-8000-000000000006';
  begin
    perform public.accept_care_relationship_backend(
      '10000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000006',
      'digest:accept:6', v_relationship_id
    );
    raise exception 'S2_T64_SIXTH_CARER_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48012' then raise; end if;
  end;
  if (select count(*) from public.care_relationships where status = 'active') <> 5 then
    raise exception 'S2_T64_ACTIVE_CAPACITY_MISMATCH';
  end if;

  perform public.update_care_pause_backend(
    '10000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001',
    'digest:pause', now() + interval '1 day'
  );
  if not exists (select 1 from public.care_check_settings
    where user_id = '10000000-0000-4000-8000-000000000001' and paused_until > now()) then
    raise exception 'S2_T64_PAUSE_NOT_PERSISTED';
  end if;
  perform public.update_care_pause_backend(
    '10000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000002',
    'digest:resume', null
  );
  if exists (select 1 from public.care_check_settings
    where user_id = '10000000-0000-4000-8000-000000000001' and paused_until is not null) then
    raise exception 'S2_T64_RESUME_NOT_PERSISTED';
  end if;

  select id into v_relationship_id from public.care_relationships
  where carer_user_id = '20000000-0000-4000-8000-000000000001';
  perform public.remove_care_relationship_backend(
    '20000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001',
    'digest:remove', v_relationship_id
  );
  select status into v_status from public.care_relationships where id = v_relationship_id;
  if v_status <> 'removed_by_carer' then raise exception 'S2_T64_REMOVAL_NOT_CONFIRMED'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.list_care_relationships()) <> 1 then
    raise exception 'S2_T64_PARTICIPANT_PROJECTION_MISMATCH';
  end if;
  if exists (select 1 from public.list_care_relationships()
    where participant_role <> 'carer' or relationship_status <> 'active') then
    raise exception 'S2_T64_PARTICIPANT_PROJECTION_UNSAFE';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
do $$ begin
  if exists (select 1 from public.list_care_relationships()) then
    raise exception 'S2_T64_CROSS_USER_PROJECTION_LEAK';
  end if;
end $$;

rollback;
select 'S2_T64_LOCAL_DATABASE_PROOF_PASSED' as result;
