-- Authoritative current plan state. RevenueCat integration will update this
-- backend-owned row later; mobile clients may read but never write it.

create table if not exists public.account_entitlements (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('starter', 'essential', 'prime')),
  product_code text not null check (product_code in ('STARTER', 'ESSENTIAL_M', 'PRIME_M')),
  status text not null check (status in ('active', 'grace_period', 'expired', 'cancelled')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source text not null check (source in ('starter_onboarding', 'revenuecat', 'admin')),
  provider_customer_id text,
  provider_entitlement_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_entitlements_product_matches_tier check (
    (plan_tier = 'starter' and product_code = 'STARTER') or
    (plan_tier = 'essential' and product_code = 'ESSENTIAL_M') or
    (plan_tier = 'prime' and product_code = 'PRIME_M')
  ),
  constraint account_entitlements_valid_window check (
    valid_until is null or valid_until > valid_from
  )
);

create unique index if not exists account_entitlements_provider_entitlement_idx
  on public.account_entitlements (provider_entitlement_id)
  where provider_entitlement_id is not null;

alter table public.account_entitlements enable row level security;
revoke all on table public.account_entitlements from anon, authenticated;
grant select on table public.account_entitlements to authenticated;
grant all on table public.account_entitlements to service_role;

drop policy if exists "users can read own account entitlement" on public.account_entitlements;
create policy "users can read own account entitlement"
  on public.account_entitlements
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.ensure_starter_account_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.grant_type = 'starter_onboarding' then
    insert into public.account_entitlements (
      user_id,
      plan_tier,
      product_code,
      status,
      valid_from,
      valid_until,
      source
    ) values (
      new.user_id,
      'starter',
      'STARTER',
      'active',
      coalesce(new.period_start, now()),
      null,
      'starter_onboarding'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_starter_account_entitlement_trigger on public.monthly_balance;
create trigger ensure_starter_account_entitlement_trigger
after insert on public.monthly_balance
for each row execute function public.ensure_starter_account_entitlement();

insert into public.account_entitlements (
  user_id,
  plan_tier,
  product_code,
  status,
  valid_from,
  valid_until,
  source
)
select
  users.id,
  'starter',
  'STARTER',
  'active',
  users.created_at,
  null,
  'starter_onboarding'
from public.users users
on conflict (user_id) do nothing;

create or replace function public.resolve_active_plan_tier(p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_plan text;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if auth.role() <> 'service_role' and p_user_id <> auth.uid() then
    raise exception 'ENTITLEMENT_ACCESS_DENIED' using errcode = '42501';
  end if;

  select entitlement.plan_tier
  into resolved_plan
  from public.account_entitlements entitlement
  where entitlement.user_id = p_user_id
    and entitlement.status in ('active', 'grace_period')
    and entitlement.valid_from <= now()
    and (entitlement.valid_until is null or entitlement.valid_until > now());

  return coalesce(resolved_plan, 'starter');
end;
$$;

revoke all on function public.resolve_active_plan_tier(uuid) from public, anon;
grant execute on function public.resolve_active_plan_tier(uuid) to authenticated, service_role;

comment on table public.account_entitlements is
  'Backend-owned current plan entitlement. RevenueCat webhook integration updates this row; credit balances do not determine plan.';
