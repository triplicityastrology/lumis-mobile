-- Enforce the one-time Starter credit grant.
-- Starter is 50 credits once after first successful onboarding; later PROF-2
-- birth-detail regenerations must not allocate another Starter grant.

alter table public.monthly_balance
  add column if not exists grant_type text not null default 'subscription_period';

create table if not exists public.migration_reports (
  id bigserial primary key,
  migration_name text not null,
  report_json jsonb not null,
  created_at timestamptz not null default now()
);

with starter_candidates as (
  select
    id,
    user_id,
    row_number() over (partition by user_id order by period_start asc, id asc) as starter_rank
  from public.monthly_balance
  where grant_type = 'starter_onboarding'
    or (
      grant_type = 'subscription_period'
      and allocated = 50
      and pack_units = 0
      and used = 0
      and remaining = 50
      and period_end is null
    )
),
starter_updates as (
  update public.monthly_balance balance
  set grant_type = case
    when starter_candidates.starter_rank = 1 then 'starter_onboarding'
    else 'duplicate_starter_quarantined'
  end
  from starter_candidates
  where balance.id = starter_candidates.id
  returning balance.user_id, balance.id, balance.grant_type
),
duplicate_summary as (
  select
    user_id,
    jsonb_agg(id order by id) as duplicate_balance_ids
  from starter_updates
  where grant_type = 'duplicate_starter_quarantined'
  group by user_id
)
insert into public.migration_reports (migration_name, report_json)
select
  '0005_starter_grant_guard',
  jsonb_build_object(
    'duplicate_users', coalesce(jsonb_agg(user_id), '[]'::jsonb),
    'duplicate_rows', coalesce(jsonb_object_agg(user_id, duplicate_balance_ids), '{}'::jsonb)
  )
from duplicate_summary;

create unique index if not exists monthly_balance_one_time_starter_grant_idx
  on public.monthly_balance (user_id)
  where grant_type = 'starter_onboarding';

comment on column public.monthly_balance.grant_type is
  'Credit source marker. starter_onboarding must exist at most once per user.';
