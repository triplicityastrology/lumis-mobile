\set ON_ERROR_STOP on
do $$
begin
  if (select count(*) from public.care_link_codes
      where caree_user_id::text like '30000000-0000-4000-8000-%') <> 21 then
    raise exception 'S2_T171_CONCURRENT_ALLOCATION_COUNT_INVALID';
  end if;
  if (select count(distinct code_hash) from public.care_link_codes
      where caree_user_id::text like '30000000-0000-4000-8000-%') <> 21 then
    raise exception 'S2_T171_CONCURRENT_ALLOCATION_NOT_UNIQUE';
  end if;
  if exists (
    select 1 from public.care_pairing_code_reservations
    where reserved_until <> issued_at + interval '60 minutes'
  ) then
    raise exception 'S2_T171_RESERVATION_WINDOW_INVALID';
  end if;
end;
$$;

delete from public.care_pairing_code_reservations
where caree_user_id::text like '30000000-0000-4000-8000-%';
delete from public.users where id::text like '30000000-0000-4000-8000-%';

do $$
begin
  if exists (select 1 from public.care_link_codes where caree_user_id::text like '30000000-0000-4000-8000-%')
    or exists (select 1 from public.care_pairing_code_reservations where caree_user_id::text like '30000000-0000-4000-8000-%')
    or exists (select 1 from public.users where id::text like '30000000-0000-4000-8000-%') then
    raise exception 'S2_T171_SYNTHETIC_CLEANUP_FAILED';
  end if;
end;
$$;

select 'S2_T171_CONCURRENT_RESERVATION_PASSED';
