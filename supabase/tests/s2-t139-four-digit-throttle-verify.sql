\set ON_ERROR_STOP on
do $$
begin
  if (select attempt_count from public.care_pairing_attempt_windows
      where actor_user_id = '90000000-0000-4000-8000-000000000001') <> 5 then
    raise exception 'S2_T139_CONCURRENT_THROTTLE_COUNT_INVALID';
  end if;
end;
$$;

delete from public.users
where id = '90000000-0000-4000-8000-000000000001';

do $$
begin
  if exists (
    select 1 from public.care_pairing_attempt_windows
    where actor_user_id = '90000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.users
    where id = '90000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'S2_T139_THROTTLE_CLEANUP_FAILED';
  end if;
end;
$$;

select 'S2_T139_CONCURRENT_THROTTLE_PASSED';
