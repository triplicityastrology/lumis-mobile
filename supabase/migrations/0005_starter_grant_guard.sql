-- Enforce the one-time Starter credit grant.
-- Starter is 50 credits once after first successful onboarding; later PROF-2
-- birth-detail regenerations must not allocate another Starter grant.

alter table public.monthly_balance
  add column if not exists grant_type text not null default 'subscription_period';

update public.monthly_balance
set grant_type = 'starter_onboarding'
where grant_type = 'subscription_period'
  and allocated = 50
  and pack_units = 0
  and used = 0
  and remaining = 50
  and period_end is null;

create unique index if not exists monthly_balance_one_time_starter_grant_idx
  on public.monthly_balance (user_id)
  where grant_type = 'starter_onboarding';

comment on column public.monthly_balance.grant_type is
  'Credit source marker. starter_onboarding must exist at most once per user.';
