-- Lumis mobile initial schema scaffold.
-- User-facing UI says credits; internal units columns may remain temporarily
-- for compatibility with active technical docs.

create table if not exists public.users (
  id uuid primary key,
  display_name text,
  lang varchar(8) not null default 'zh-Hant',
  role varchar(20) not null default 'support',
  focus varchar(20),
  buddy_name varchar(24) not null default 'Lumis',
  buddy_avatar_key varchar(16) not null default 'psyche',
  push_token text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.birth_data (
  user_id uuid primary key references public.users(id) on delete cascade,
  birth_date date not null,
  birth_time time,
  time_unknown boolean not null default false,
  place_name text not null,
  country_code varchar(2) not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  tz_str text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_profiles (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  version int not null,
  raw_chart_json jsonb,
  chart_json jsonb not null,
  profile_json jsonb,
  precision varchar(16) not null check (precision in ('full', 'no_birth_time')),
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create table if not exists public.monthly_balance (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  period_start timestamptz not null default now(),
  period_end timestamptz,
  allocated int not null default 0,
  pack_units int not null default 0,
  used int not null default 0,
  remaining int not null default 0,
  low_alert_sent boolean not null default false
);

alter table public.users enable row level security;
alter table public.birth_data enable row level security;
alter table public.ai_profiles enable row level security;
alter table public.monthly_balance enable row level security;

create policy "users can read own user row" on public.users
  for select using (id = auth.uid());

create policy "users can update own user row" on public.users
  for update using (id = auth.uid());

create policy "users can read own birth data" on public.birth_data
  for select using (user_id = auth.uid());

create policy "users can read own ai profiles" on public.ai_profiles
  for select using (user_id = auth.uid());

create policy "users can read own balance" on public.monthly_balance
  for select using (user_id = auth.uid());

