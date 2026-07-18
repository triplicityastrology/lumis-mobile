-- Correct the staging entitlement scaffold before RevenueCat activation.
-- RevenueCat entitlement identifiers are shared access labels, while event IDs
-- are unique webhook delivery identifiers suitable for idempotency/audit use.

drop index if exists public.account_entitlements_provider_entitlement_idx;

alter table public.account_entitlements
  rename column provider_entitlement_id to provider_event_id;

create unique index if not exists account_entitlements_provider_event_idx
  on public.account_entitlements (provider_event_id)
  where provider_event_id is not null;

create or replace function public.set_account_entitlement_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_account_entitlement_updated_at_trigger
  on public.account_entitlements;
create trigger set_account_entitlement_updated_at_trigger
before update on public.account_entitlements
for each row execute function public.set_account_entitlement_updated_at();

-- Mobile resolves only the safe plan tier through resolve_active_plan_tier.
-- Provider customer/event references remain backend-only.
drop policy if exists "users can read own account entitlement"
  on public.account_entitlements;
revoke all on table public.account_entitlements from anon, authenticated;
grant all on table public.account_entitlements to service_role;

comment on column public.account_entitlements.provider_event_id is
  'Unique provider webhook event or transaction identifier; never a shared RevenueCat entitlement access label.';

comment on table public.account_entitlements is
  'Backend-owned current plan entitlement. Mobile receives only the safe active plan tier through resolve_active_plan_tier.';
