-- Lumis profile and first-chat persistence scaffold.
-- User-facing naming is Lumis Persona / credits. Internal role remains for routing compatibility.

alter table public.users
  add column if not exists persona_style varchar(24) not null default 'acceptance'
    check (persona_style in ('acceptance', 'spark', 'awareness'));

alter table public.users
  add constraint users_role_check
  check (role in ('support', 'spark', 'growth'))
  not valid;

alter table public.users validate constraint users_role_check;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  ai_profile_id bigint references public.ai_profiles(id) on delete set null,
  persona_style varchar(24) not null default 'acceptance'
    check (persona_style in ('acceptance', 'spark', 'awareness')),
  route varchar(32) not null default 'casual',
  title text,
  status varchar(16) not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role varchar(16) not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  route varchar(32) not null default 'casual',
  credits_cost int not null default 0,
  status varchar(16) not null default 'committed' check (status in ('draft', 'committed', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "users can read own chat threads" on public.chat_threads
  for select using (user_id = auth.uid());

create policy "users can read own chat messages" on public.chat_messages
  for select using (user_id = auth.uid());

create index if not exists chat_threads_user_created_idx
  on public.chat_threads (user_id, created_at desc);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at asc);
