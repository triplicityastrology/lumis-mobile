begin;

insert into public.users (id, display_name)
values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Caree One'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic Caree Two');

insert into public.care_link_codes (
  caree_user_id,
  code_hash,
  issued_at,
  expires_at
) values (
  '10000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  transaction_timestamp(),
  transaction_timestamp() + interval '1 hour'
);

do $$
declare
  v_lifetime interval;
begin
  select expires_at - issued_at into v_lifetime
  from public.care_link_codes
  where caree_user_id = '10000000-0000-4000-8000-000000000001';
  if v_lifetime <> interval '10 minutes' then
    raise exception 'S2_T135_EXPIRY_NOT_CLAMPED';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.care_link_codes (
      caree_user_id,
      code_hash,
      issued_at,
      expires_at
    ) values (
      '10000000-0000-4000-8000-000000000002',
      repeat('a', 64),
      transaction_timestamp(),
      transaction_timestamp() + interval '10 minutes'
    );
    raise exception 'S2_T135_ACTIVE_CODE_COLLISION_ACCEPTED';
  exception when unique_violation then
    null;
  end;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'register_care_pairing_attempt_backend'
  ) then
    raise exception 'S2_T135_THROTTLE_FUNCTION_MISSING';
  end if;
end;
$$;

select 'S2_T135_FOUR_DIGIT_POSTGRES17_PASSED';
rollback;
