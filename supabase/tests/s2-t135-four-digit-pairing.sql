\set ON_ERROR_STOP on
begin;

insert into public.users (id, display_name, account_mode)
values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Caree One', 'standard'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic Caree Two', 'standard'),
  ('20000000-0000-4000-8000-000000000001', 'Synthetic Carer', 'standard');

insert into public.account_entitlements (user_id, plan_tier, product_code, status, source)
values
  ('10000000-0000-4000-8000-000000000001', 'essential', 'ESSENTIAL_M', 'active', 'admin'),
  ('10000000-0000-4000-8000-000000000002', 'essential', 'ESSENTIAL_M', 'active', 'admin');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_hash text := encode(digest('1234', 'sha256'), 'hex');
  v_second_hash text := encode(digest('5678', 'sha256'), 'hex');
  v_result jsonb;
  v_replay jsonb;
begin
  if v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'S2_T139_HASH_SHAPE_INVALID';
  end if;

  v_result := public.create_care_pairing_code_backend(
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'digest:create:1',
    v_hash
  );
  if v_result->>'status' <> 'active' then
    raise exception 'S2_T139_CODE_NOT_ACTIVE';
  end if;

  v_replay := public.create_care_pairing_code_backend(
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'digest:create:1',
    v_hash
  );
  if coalesce((v_replay->>'idempotent')::boolean, false) is not true then
    raise exception 'S2_T139_REPLAY_NOT_IDEMPOTENT';
  end if;

  begin
    perform public.create_care_pairing_code_backend(
      '10000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      'digest:create:changed',
      v_second_hash
    );
    raise exception 'S2_T139_REQUEST_CONFLICT_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48012' then raise; end if;
  end;

  if (select expires_at - issued_at from public.care_link_codes
      where caree_user_id = '10000000-0000-4000-8000-000000000001'
        and status = 'active') <> interval '10 minutes' then
    raise exception 'S2_T139_EXPIRY_NOT_TEN_MINUTES';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'care_link_codes'
      and column_name in ('code', 'raw_code', 'pairing_code', 'qr_payload')
  ) or exists (
    select 1 from public.care_link_codes
    where code_hash in ('1234', '5678') or code_hash !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'S2_T139_RAW_CODE_PERSISTENCE';
  end if;

  begin
    insert into public.care_link_codes (caree_user_id, code_hash, issued_at, expires_at)
    values (
      '10000000-0000-4000-8000-000000000001',
      v_second_hash,
      transaction_timestamp(),
      transaction_timestamp() + interval '10 minutes'
    );
    raise exception 'S2_T139_SECOND_ACTIVE_CODE_ACCEPTED';
  exception when unique_violation then null;
  end;

  begin
    insert into public.care_link_codes (caree_user_id, code_hash, issued_at, expires_at)
    values (
      '10000000-0000-4000-8000-000000000002',
      v_hash,
      transaction_timestamp(),
      transaction_timestamp() + interval '10 minutes'
    );
    raise exception 'S2_T139_ACTIVE_HASH_COLLISION_ACCEPTED';
  exception when unique_violation then null;
  end;

  update public.care_link_codes
  set status = 'expired',
      issued_at = now() - interval '20 minutes',
      expires_at = now() - interval '10 minutes'
  where caree_user_id = '10000000-0000-4000-8000-000000000001';
  begin
    perform public.consume_care_pairing_code_backend(
      '20000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000001',
      'digest:expired',
      v_hash
    );
    raise exception 'S2_T139_EXPIRED_CODE_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '48004' then raise; end if;
  end;

  begin
    insert into public.care_link_codes (caree_user_id, code_hash, issued_at, expires_at)
    values (
      '10000000-0000-4000-8000-000000000002',
      v_hash,
      transaction_timestamp(),
      transaction_timestamp() + interval '10 minutes'
    );
    raise exception 'S2_T171_STALE_QR_REASSIGNED_DURING_QUARANTINE';
  exception when unique_violation then null;
  end;

  update public.care_pairing_code_reservations
  set issued_at = transaction_timestamp() - interval '61 minutes',
      reserved_until = transaction_timestamp() - interval '1 minute'
  where code_hash = v_hash;

  insert into public.care_link_codes (caree_user_id, code_hash, issued_at, expires_at)
  values (
    '10000000-0000-4000-8000-000000000002',
    v_hash,
    transaction_timestamp(),
    transaction_timestamp() + interval '10 minutes'
  );

  if (select caree_user_id from public.care_pairing_code_reservations where code_hash = v_hash)
      <> '10000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'S2_T171_POST_QUARANTINE_REUSE_FAILED';
  end if;
end;
$$;

rollback;

do $$
begin
  if exists (
    select 1 from public.users
    where id in (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001'
    )
  ) then
    raise exception 'S2_T139_TRANSACTION_ROLLBACK_FAILED';
  end if;
end;
$$;

select 'S2_T139_FOUR_DIGIT_TRANSACTION_PASSED';
