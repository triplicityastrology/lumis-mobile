create table public.users (
  id uuid primary key,
  deleted_at timestamptz
);

create table public.care_operation_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  resource_id uuid,
  request_digest text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  constraint care_operation_requests_operation_check check (operation in (
    'relationship_accept', 'relationship_decline', 'relationship_remove'
  ))
);

create table public.care_link_codes (
  code_id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null unique,
  status text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  carer_user_id uuid not null references public.users(id) on delete cascade,
  status text not null,
  requested_at timestamptz not null default now(),
  request_expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  removed_at timestamptz,
  removed_by_user_id uuid references public.users(id) on delete set null,
  last_operation_request_id uuid,
  updated_at timestamptz not null default now()
);

create table public.care_relationship_events (
  event_id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.care_relationships(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  event_idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.care_check_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  paused_at timestamptz,
  paused_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.care_checkin_rounds (
  id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  status text not null,
  closed_at timestamptz,
  close_reason text,
  updated_at timestamptz not null default now()
);

create or replace function public.resolve_care_circle_capability(p_user_id uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'can_act_as_caree', exists(select 1 from public.users where id = p_user_id and deleted_at is null),
    'can_act_as_carer', exists(select 1 from public.users where id = p_user_id and deleted_at is null)
  );
$$;

create or replace function public.accept_care_relationship(uuid, uuid, text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.remove_care_relationship(uuid, uuid, text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
