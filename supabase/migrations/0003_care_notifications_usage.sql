-- Care Circle, notifications, and provider usage scaffold.
-- User-facing copy says Care Circle, Past Reflections, Lumis, and credits.
-- Backend remains the policy enforcement layer; mobile is only a client/cache.

create table if not exists public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  caree_user_id uuid not null references public.users(id) on delete cascade,
  carer_user_id uuid not null references public.users(id) on delete cascade,
  status varchar(16) not null default 'pending_caree_confirmation'
    check (status in (
      'pending_caree_confirmation',
      'pending_carer_acceptance',
      'active',
      'declined',
      'revoked',
      'expired'
    )),
  invitation_token_hash text,
  requested_at timestamptz not null default now(),
  caree_confirmed_at timestamptz,
  carer_accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_relationships_distinct_users_check
    check (caree_user_id <> carer_user_id)
);

create unique index if not exists care_relationships_active_pair_idx
  on public.care_relationships (caree_user_id, carer_user_id)
  where status in ('pending_caree_confirmation', 'pending_carer_acceptance', 'active');

create unique index if not exists care_relationships_max_five_active_carers_idx
  on public.care_relationships (caree_user_id, carer_user_id)
  where status = 'active';

create table if not exists public.care_relationship_events (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.care_relationships(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type varchar(32) not null check (event_type in (
    'qr_created',
    'qr_scanned',
    'caree_confirmed',
    'carer_accepted',
    'carer_declined',
    'relationship_activated',
    'relationship_revoked',
    'check_in_completed',
    'missed_check_in',
    'need_help_tapped',
    'push_alert_sent',
    'push_alert_failed',
    'credit_snapshot'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type varchar(40) not null check (notification_type in (
    'care_carer_confirmation_request',
    'care_relationship_activated',
    'care_missed_check_in_alert',
    'care_need_help_alert',
    'push_permission_issue',
    'billing_notice',
    'system_notice'
  )),
  title text not null,
  body text not null,
  related_entity_type varchar(40),
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.message_usage (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  route varchar(32) not null,
  model_class varchar(16) not null,
  provider text,
  model text,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  provider_cost_usd numeric(12,6),
  credits_charged int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.care_relationships enable row level security;
alter table public.care_relationship_events enable row level security;
alter table public.notifications enable row level security;
alter table public.message_usage enable row level security;

create policy "care participants can read relationships" on public.care_relationships
  for select using (caree_user_id = auth.uid() or carer_user_id = auth.uid());

create policy "care participants can read relationship events" on public.care_relationship_events
  for select using (
    exists (
      select 1
      from public.care_relationships
      where care_relationships.id = care_relationship_events.relationship_id
        and (care_relationships.caree_user_id = auth.uid() or care_relationships.carer_user_id = auth.uid())
    )
  );

create policy "users can read own notifications" on public.notifications
  for select using (user_id = auth.uid());

create policy "users can update own notification read state" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can read own message usage" on public.message_usage
  for select using (user_id = auth.uid());

create index if not exists care_relationships_caree_status_idx
  on public.care_relationships (caree_user_id, status, created_at desc);

create index if not exists care_relationships_carer_status_idx
  on public.care_relationships (carer_user_id, status, created_at desc);

create index if not exists care_relationship_events_relationship_created_idx
  on public.care_relationship_events (relationship_id, created_at desc);

create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read_at, created_at desc);

create index if not exists message_usage_user_created_idx
  on public.message_usage (user_id, created_at desc);

create index if not exists message_usage_message_idx
  on public.message_usage (message_id);
