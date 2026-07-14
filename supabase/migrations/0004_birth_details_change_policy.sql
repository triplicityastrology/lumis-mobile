-- Birth details change policy scaffold.
-- Birth-detail edits are chart/profile regeneration events, not ordinary profile edits.
-- Policy: max 3 successful lifetime changes after the original onboarding chart.

alter table public.birth_data
  add column if not exists active_chart_version int not null default 1,
  add column if not exists successful_change_count int not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'birth_data_successful_change_count_check'
      and conrelid = 'public.birth_data'::regclass
  ) then
    alter table public.birth_data
      add constraint birth_data_successful_change_count_check
      check (successful_change_count >= 0 and successful_change_count <= 3)
      not valid;
  end if;
end $$;

alter table public.birth_data validate constraint birth_data_successful_change_count_check;

create table if not exists public.birth_data_history (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  birth_data_user_id uuid not null references public.birth_data(user_id) on delete cascade,
  chart_version int not null,
  birth_date date not null,
  birth_time time,
  unknown_time_flag boolean not null default false,
  birth_place_text text not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  timezone text not null,
  chart_json jsonb,
  ai_profile_id bigint references public.ai_profiles(id) on delete set null,
  status varchar(16) not null default 'active'
    check (status in ('pending', 'active', 'superseded', 'failed')),
  failure_code varchar(16),
  failure_message text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, chart_version)
);

alter table public.ai_profiles
  add column if not exists chart_version int not null default 1,
  add column if not exists birth_data_history_id bigint references public.birth_data_history(id) on delete set null,
  add column if not exists is_active boolean not null default false;

alter table public.chat_threads
  add column if not exists chart_version int not null default 1;

alter table public.birth_data_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'birth_data_history'
      and policyname = 'users can read own birth data history'
  ) then
    create policy "users can read own birth data history" on public.birth_data_history
      for select using (user_id = auth.uid());
  end if;
end $$;

create unique index if not exists birth_data_history_active_version_idx
  on public.birth_data_history (user_id)
  where status = 'active';

create index if not exists birth_data_history_user_version_idx
  on public.birth_data_history (user_id, chart_version desc);

create index if not exists ai_profiles_user_active_chart_idx
  on public.ai_profiles (user_id, is_active, chart_version desc);

create index if not exists chat_threads_user_chart_created_idx
  on public.chat_threads (user_id, chart_version, created_at desc);

comment on table public.birth_data_history is
  'Versioned birth details and chart snapshots. Successful regeneration creates a new active chart_version; failed regeneration must not consume the lifetime change count.';

comment on column public.chat_threads.chart_version is
  'Past Reflections retain the chart_version active when the thread was created.';
