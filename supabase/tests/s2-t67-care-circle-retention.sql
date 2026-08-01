\set ON_ERROR_STOP on
begin;

insert into public.users (id, display_name)
values ('10000000-0000-4000-8000-000000000067', 'Synthetic Retention Caree');

insert into public.care_link_codes (
  caree_user_id,
  code_hash,
  issued_at,
  expires_at
) values (
  '10000000-0000-4000-8000-000000000067',
  repeat('a', 64),
  '2029-12-31T23:00:00Z',
  '2030-01-01T00:00:00Z'
);

do $$
declare
  v_code_id uuid;
begin
  select code_id into v_code_id
  from public.care_link_codes
  where caree_user_id = '10000000-0000-4000-8000-000000000067';

  if (select retention_until from public.care_link_codes where code_id = v_code_id)
    <> '2030-04-01T00:00:00Z'::timestamptz then
    raise exception 'S2_T67_INSERT_RETENTION_MISMATCH';
  end if;

  update public.care_link_codes
  set
    issued_at = '2030-01-01T00:00:00Z',
    expires_at = '2030-01-01T00:30:00Z'
  where code_id = v_code_id;

  if (select retention_until from public.care_link_codes where code_id = v_code_id)
    <> '2030-04-01T00:30:00Z'::timestamptz then
    raise exception 'S2_T67_UPDATE_RETENTION_MISMATCH';
  end if;
end;
$$;

rollback;
select 'S2_T67_POSTGRES17_RETENTION_PASSED' as result;
