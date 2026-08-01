set request.jwt.claim.role = 'service_role';

insert into public.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000004'),
  ('20000000-0000-4000-8000-000000000005'),
  ('20000000-0000-4000-8000-000000000006'),
  ('30000000-0000-4000-8000-000000000001');

insert into public.care_check_settings (user_id)
values ('10000000-0000-4000-8000-000000000001');

select public.create_care_pairing_code_backend(
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'create-code-v1',
  'synthetic-code-fingerprint'
);

select public.consume_care_pairing_code_backend(
  ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('50000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'consume-' || i,
  'synthetic-code-fingerprint'
)
from generate_series(1, 6) as series(i);

do $$
declare
  v_relationship uuid;
begin
  if (select count(*) from public.care_relationships where status = 'pending_caree_acceptance') <> 6
    or exists (select 1 from public.care_relationships where status = 'active') then
    raise exception 'S2_T68_PENDING_AUTHORITY_MISMATCH';
  end if;

  select id into v_relationship from public.care_relationships order by carer_user_id limit 1;

  begin
    perform public.accept_care_relationship_backend(
      '30000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'outsider-accept',
      v_relationship
    );
    raise exception 'S2_T68_OUTSIDER_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48007' then raise; end if;
  end;

  begin
    perform public.decline_care_relationship_backend(
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      'carer-decline',
      v_relationship
    );
    raise exception 'S2_T68_CARER_DECLINED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48007' then raise; end if;
  end;

  if (public.consume_care_pairing_code_backend(
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'consume-1',
    'synthetic-code-fingerprint'
  )->>'idempotent')::boolean is not true then
    raise exception 'S2_T68_REPLAY_NOT_IDEMPOTENT';
  end if;

  begin
    perform public.consume_care_pairing_code_backend(
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'changed-digest',
      'synthetic-code-fingerprint'
    );
    raise exception 'S2_T68_CONFLICT_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48012' then raise; end if;
  end;
end;
$$;
