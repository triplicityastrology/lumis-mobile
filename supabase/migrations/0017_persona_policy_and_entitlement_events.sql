-- Protect user-selectable Persona fields and prepare an append-only provider
-- event history before RevenueCat webhook activation.

update public.users
set buddy_avatar_key = 'psyche'
where buddy_avatar_key not in (
  'ceres', 'pallas', 'juno', 'vesta', 'chiron',
  'psyche', 'eros', 'iris', 'hygiea', 'astraea'
);

update public.users
set focus = null
where focus is not null
  and focus not in ('career', 'love', 'emotion', 'timing', 'growth');

alter table public.users
  drop constraint if exists users_buddy_avatar_key_allowed;
alter table public.users
  add constraint users_buddy_avatar_key_allowed check (
    buddy_avatar_key in (
      'ceres', 'pallas', 'juno', 'vesta', 'chiron',
      'psyche', 'eros', 'iris', 'hygiea', 'astraea'
    )
  );

alter table public.users
  drop constraint if exists users_focus_allowed;
alter table public.users
  add constraint users_focus_allowed check (
    focus is null or focus in ('career', 'love', 'emotion', 'timing', 'growth')
  );

drop policy if exists "users can update own user row" on public.users;

create or replace function public.update_lumis_persona(
  p_persona_style text,
  p_buddy_name text,
  p_buddy_avatar_key text,
  p_focus text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(coalesce(p_buddy_name, ''));
  resolved_role text;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_persona_style not in ('acceptance', 'spark', 'awareness') then
    raise exception 'PERSONA_STYLE_INVALID' using errcode = '22023';
  end if;

  if normalized_name = '' or char_length(normalized_name) > 24 then
    raise exception 'PERSONA_NAME_INVALID' using errcode = '22023';
  end if;

  if p_buddy_avatar_key not in (
    'ceres', 'pallas', 'juno', 'vesta', 'chiron',
    'psyche', 'eros', 'iris', 'hygiea', 'astraea'
  ) then
    raise exception 'PERSONA_AVATAR_INVALID' using errcode = '22023';
  end if;

  if p_focus is not null and p_focus not in ('career', 'love', 'emotion', 'timing', 'growth') then
    raise exception 'PERSONA_FOCUS_INVALID' using errcode = '22023';
  end if;

  resolved_role := case p_persona_style
    when 'acceptance' then 'support'
    when 'spark' then 'spark'
    when 'awareness' then 'growth'
  end;

  update public.users
  set
    buddy_avatar_key = p_buddy_avatar_key,
    buddy_name = normalized_name,
    focus = p_focus,
    persona_style = p_persona_style,
    role = resolved_role
  where id = current_user_id
    and deleted_at is null;

  if not found then
    raise exception 'PERSONA_ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'buddy_name', normalized_name,
    'buddy_avatar_key', p_buddy_avatar_key,
    'focus', p_focus,
    'persona_style', p_persona_style
  );
end;
$$;

revoke all on function public.update_lumis_persona(text, text, text, text)
  from public, anon;
grant execute on function public.update_lumis_persona(text, text, text, text)
  to authenticated;

alter table public.account_entitlements
  add column if not exists provider_event_at timestamptz;

create table if not exists public.entitlement_provider_events (
  provider text not null check (provider in ('revenuecat', 'admin')),
  provider_event_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  provider_customer_id text,
  event_type text not null,
  entitlement_label text,
  product_code text not null check (product_code in ('STARTER', 'ESSENTIAL_M', 'PRIME_M')),
  plan_tier text not null check (plan_tier in ('starter', 'essential', 'prime')),
  entitlement_status text not null check (entitlement_status in ('active', 'grace_period', 'expired', 'cancelled')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  provider_event_at timestamptz not null,
  payload_digest text not null,
  recorded_at timestamptz not null default now(),
  primary key (provider, provider_event_id),
  constraint entitlement_provider_events_product_matches_tier check (
    (plan_tier = 'starter' and product_code = 'STARTER') or
    (plan_tier = 'essential' and product_code = 'ESSENTIAL_M') or
    (plan_tier = 'prime' and product_code = 'PRIME_M')
  ),
  constraint entitlement_provider_events_valid_window check (
    valid_until is null or valid_until > valid_from
  )
);

create index if not exists entitlement_provider_events_user_time_idx
  on public.entitlement_provider_events (user_id, provider_event_at desc);

alter table public.entitlement_provider_events enable row level security;
revoke all on table public.entitlement_provider_events from anon, authenticated, service_role;
grant select, insert on table public.entitlement_provider_events to service_role;

create or replace function public.apply_entitlement_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_user_id uuid,
  p_provider_customer_id text,
  p_event_type text,
  p_entitlement_label text,
  p_product_code text,
  p_plan_tier text,
  p_entitlement_status text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_provider_event_at timestamptz,
  p_payload_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event_id text;
  entitlement_rows_updated integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'ENTITLEMENT_EVENT_ACCESS_DENIED' using errcode = '42501';
  end if;

  if nullif(trim(p_provider_event_id), '') is null
    or nullif(trim(p_event_type), '') is null
    or nullif(trim(p_payload_digest), '') is null
    or p_user_id is null
    or p_provider_event_at is null then
    raise exception 'ENTITLEMENT_EVENT_INVALID' using errcode = '22023';
  end if;

  insert into public.entitlement_provider_events (
    provider,
    provider_event_id,
    user_id,
    provider_customer_id,
    event_type,
    entitlement_label,
    product_code,
    plan_tier,
    entitlement_status,
    valid_from,
    valid_until,
    provider_event_at,
    payload_digest
  ) values (
    p_provider,
    trim(p_provider_event_id),
    p_user_id,
    p_provider_customer_id,
    trim(p_event_type),
    p_entitlement_label,
    p_product_code,
    p_plan_tier,
    p_entitlement_status,
    p_valid_from,
    p_valid_until,
    p_provider_event_at,
    trim(p_payload_digest)
  )
  on conflict (provider, provider_event_id) do nothing
  returning provider_event_id into inserted_event_id;

  if inserted_event_id is null then
    return jsonb_build_object('duplicate', true, 'applied', false);
  end if;

  insert into public.account_entitlements (
    user_id,
    plan_tier,
    product_code,
    status,
    valid_from,
    valid_until,
    source,
    provider_customer_id,
    provider_event_id,
    provider_event_at
  ) values (
    p_user_id,
    p_plan_tier,
    p_product_code,
    p_entitlement_status,
    p_valid_from,
    p_valid_until,
    p_provider,
    p_provider_customer_id,
    trim(p_provider_event_id),
    p_provider_event_at
  )
  on conflict (user_id) do update set
    plan_tier = excluded.plan_tier,
    product_code = excluded.product_code,
    status = excluded.status,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    source = excluded.source,
    provider_customer_id = excluded.provider_customer_id,
    provider_event_id = excluded.provider_event_id,
    provider_event_at = excluded.provider_event_at
  where public.account_entitlements.provider_event_at is null
    or excluded.provider_event_at >= public.account_entitlements.provider_event_at;

  get diagnostics entitlement_rows_updated = row_count;

  return jsonb_build_object(
    'duplicate', false,
    'applied', entitlement_rows_updated = 1
  );
end;
$$;

revoke all on function public.apply_entitlement_provider_event(
  text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.apply_entitlement_provider_event(
  text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text
) to service_role;

comment on table public.entitlement_provider_events is
  'Backend-only append history of provider entitlement events. Raw webhook payloads are not stored; payload_digest supports audit comparison.';
