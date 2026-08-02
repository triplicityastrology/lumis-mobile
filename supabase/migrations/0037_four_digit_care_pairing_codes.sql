begin;
alter table public.care_link_codes drop constraint if exists care_link_codes_window_check;
alter table public.care_link_codes add constraint care_link_codes_window_check
  check (expires_at > issued_at and expires_at <= issued_at + interval '10 minutes');
drop index if exists public.care_link_codes_hash_idx;
create unique index care_link_codes_active_hash_idx on public.care_link_codes(code_hash) where status='active';

create table if not exists public.care_pairing_code_reservations (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  caree_user_id uuid references public.users(id) on delete set null,
  issued_at timestamptz not null,
  reserved_until timestamptz not null,
  check (reserved_until = issued_at + interval '60 minutes')
);
alter table public.care_pairing_code_reservations enable row level security;
revoke all on public.care_pairing_code_reservations from public, anon, authenticated;
grant all on public.care_pairing_code_reservations to service_role;
comment on table public.care_pairing_code_reservations is
  'Service-only hash reservation. Four-digit values remain unavailable for 60 minutes after issue; no raw code is stored.';

create or replace function public.reserve_care_pairing_code_hash_backend()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_claimed_hash text;
begin
  insert into public.care_pairing_code_reservations (
    code_hash,
    caree_user_id,
    issued_at,
    reserved_until
  ) values (
    new.code_hash,
    new.caree_user_id,
    new.issued_at,
    new.issued_at + interval '60 minutes'
  )
  on conflict (code_hash) do update set
    caree_user_id = excluded.caree_user_id,
    issued_at = excluded.issued_at,
    reserved_until = excluded.reserved_until
  where care_pairing_code_reservations.reserved_until <= transaction_timestamp()
  returning code_hash into v_claimed_hash;

  if v_claimed_hash is null then
    raise unique_violation using message = 'CARE_PAIRING_CODE_RESERVED';
  end if;
  return new;
end; $$;
revoke all on function public.reserve_care_pairing_code_hash_backend() from public,anon,authenticated;

drop trigger if exists reserve_care_pairing_code_hash on public.care_link_codes;
create trigger reserve_care_pairing_code_hash
before insert on public.care_link_codes
for each row execute function public.reserve_care_pairing_code_hash_backend();

comment on function public.reserve_care_pairing_code_hash_backend() is
  'Atomically reserves one of 10,000 four-digit values for 60 minutes. Scaling beyond 10,000 issues per rolling hour requires six digits.';

create table if not exists public.care_pairing_attempt_windows (
  actor_user_id uuid primary key references public.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  updated_at timestamptz not null default now()
);
alter table public.care_pairing_attempt_windows enable row level security;
revoke all on public.care_pairing_attempt_windows from public, anon, authenticated;

create or replace function public.register_care_pairing_attempt_backend(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.care_pairing_attempt_windows%rowtype;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then raise exception '48010' using errcode='P0001'; end if;
  insert into public.care_pairing_attempt_windows(actor_user_id,window_started_at,attempt_count)
  values(p_actor_user_id,now(),1)
  on conflict(actor_user_id) do update set
    window_started_at=case when care_pairing_attempt_windows.window_started_at <= now()-interval '10 minutes' then now() else care_pairing_attempt_windows.window_started_at end,
    attempt_count=case when care_pairing_attempt_windows.window_started_at <= now()-interval '10 minutes' then 1 else care_pairing_attempt_windows.attempt_count+1 end,
    updated_at=now()
  returning * into v_row;
  return jsonb_build_object('ok',true,'allowed',true);
exception when check_violation then raise exception '48004' using errcode='P0001';
end; $$;
revoke all on function public.register_care_pairing_attempt_backend(uuid) from public,anon,authenticated;
grant execute on function public.register_care_pairing_attempt_backend(uuid) to service_role;

-- Replace only the one-hour literal in the reviewed 0034 create operation.
-- The Dashboard packet generator must compose this corrective body after 0034.
create or replace function public.set_care_pairing_code_ten_minute_expiry()
returns trigger language plpgsql set search_path=public as $$
begin
  new.expires_at := least(new.expires_at, new.issued_at + interval '10 minutes');
  return new;
end; $$;
drop trigger if exists enforce_care_pairing_code_ten_minute_expiry on public.care_link_codes;
create trigger enforce_care_pairing_code_ten_minute_expiry
before insert or update of expires_at on public.care_link_codes
for each row execute function public.set_care_pairing_code_ten_minute_expiry();
comment on table public.care_pairing_attempt_windows is 'Service-only attempt throttle; contains no raw pairing code.';
commit;
