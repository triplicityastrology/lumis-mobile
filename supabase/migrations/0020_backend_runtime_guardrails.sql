-- Runtime guardrails required before paid chat and broader staging traffic.

-- Calendar-month is the current canonical balance period. RevenueCat must later
-- map provider periods to this key through its protected event handler. Starter
-- and quarantined legacy grants keep their separate one-time uniqueness rule.
alter table public.monthly_balance
  add column if not exists billing_period_key date generated always as (
    date_trunc('month', period_start at time zone 'UTC')::date
  ) stored;

-- Consolidate legacy normal rows in the same logical month without summing
-- allocations. Summing could preserve an accidental double grant. The oldest
-- row remains, conservative maxima/minima preserve usage, and every removed row
-- is reported for manual audit.
with duplicate_groups as (
  select
    user_id,
    billing_period_key,
    min(id) as keeper_id,
    array_agg(id order by id) as balance_ids,
    max(allocated) as allocated,
    max(pack_units) as pack_units,
    max(used) as used,
    min(remaining) as remaining,
    max(period_end) as period_end,
    bool_or(low_alert_sent) as low_alert_sent
  from public.monthly_balance
  where grant_type not in ('starter_onboarding', 'duplicate_starter_quarantined')
  group by user_id, billing_period_key
  having count(*) > 1
),
reported as (
  insert into public.migration_reports (migration_name, report_json)
  select
    '0020_backend_runtime_guardrails',
    jsonb_build_object(
      'monthly_balance_duplicate_groups', count(*),
      'groups', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id', user_id,
            'billing_period_key', billing_period_key,
            'balance_ids', balance_ids,
            'keeper_id', keeper_id
          )
          order by user_id, billing_period_key
        ),
        '[]'::jsonb
      )
    )
  from duplicate_groups
  returning id
),
updated as (
  update public.monthly_balance balance
  set
    allocated = duplicates.allocated,
    pack_units = duplicates.pack_units,
    used = duplicates.used,
    remaining = duplicates.remaining,
    period_end = duplicates.period_end,
    low_alert_sent = duplicates.low_alert_sent
  from duplicate_groups duplicates
  where balance.id = duplicates.keeper_id
  returning balance.id
)
delete from public.monthly_balance balance
using duplicate_groups duplicates
where balance.id = any(duplicates.balance_ids)
  and balance.id <> duplicates.keeper_id;

create unique index if not exists monthly_balance_user_billing_period_idx
  on public.monthly_balance (user_id, billing_period_key)
  where grant_type not in ('starter_onboarding', 'duplicate_starter_quarantined');

comment on column public.monthly_balance.billing_period_key is
  'Canonical UTC calendar month for normal balance rows. Provider webhook code must upsert this logical period, never an arbitrary timestamp.';

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages
  add column if not exists client_msg_id uuid;

create unique index if not exists chat_messages_user_client_msg_idx
  on public.chat_messages (user_id, client_msg_id)
  where client_msg_id is not null and role = 'user';

comment on column public.chat_messages.client_msg_id is
  'Client-generated idempotency key. The same value is stored on both messages in one turn; uniqueness is enforced on the user message.';

drop function if exists public.persist_scaffold_chat_turn(
  uuid, bigint, int, varchar, varchar, text, text, text, boolean, uuid
);

create or replace function public.persist_scaffold_chat_turn(
  p_user_id uuid,
  p_ai_profile_id bigint,
  p_chart_version int,
  p_persona_style varchar,
  p_route varchar,
  p_title text,
  p_user_message text,
  p_assistant_message text,
  p_force_new_thread boolean default false,
  p_thread_id uuid default null,
  p_client_msg_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_profile_id bigint;
  v_existing_user_content text;
  v_existing_assistant_content text;
begin
  if p_user_id is null
    or p_ai_profile_id is null
    or p_chart_version is null
    or nullif(trim(p_user_message), '') is null
    or nullif(trim(p_assistant_message), '') is null
    or (coalesce(p_force_new_thread, false) and p_thread_id is not null)
  then
    return jsonb_build_object('ok', false, 'error_code', 'CHAT_PERSISTENCE_INVALID_INPUT');
  end if;

  if p_client_msg_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_user_id::text || ':' || p_client_msg_id::text, 0)
    );

    select id, thread_id, content
    into v_user_message_id, v_thread_id, v_existing_user_content
    from public.chat_messages
    where user_id = p_user_id
      and client_msg_id = p_client_msg_id
      and role = 'user'
    limit 1;

    if v_user_message_id is not null then
      if v_existing_user_content is distinct from trim(p_user_message) then
        return jsonb_build_object('ok', false, 'error_code', 'CHAT_IDEMPOTENCY_CONFLICT');
      end if;

      select id, content
      into v_assistant_message_id, v_existing_assistant_content
      from public.chat_messages
      where user_id = p_user_id
        and thread_id = v_thread_id
        and client_msg_id = p_client_msg_id
        and role = 'assistant'
      limit 1;

      if v_assistant_message_id is null then
        return jsonb_build_object('ok', false, 'error_code', 'CHAT_PERSISTENCE_INCOMPLETE');
      end if;

      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'thread_id', v_thread_id,
        'user_message_id', v_user_message_id,
        'assistant_message_id', v_assistant_message_id,
        'assistant_message', v_existing_assistant_content,
        'ai_profile_id', p_ai_profile_id,
        'chart_version', p_chart_version
      );
    end if;
  end if;

  select id
  into v_profile_id
  from public.ai_profiles
  where id = p_ai_profile_id
    and user_id = p_user_id
    and chart_version = p_chart_version
    and is_active = true
  limit 1;

  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'error_code', 'ACTIVE_PROFILE_REQUIRED');
  end if;

  if p_thread_id is not null then
    select id into v_thread_id
    from public.chat_threads
    where id = p_thread_id
      and user_id = p_user_id
      and status = 'active'
      and chart_version = p_chart_version
    limit 1;

    if v_thread_id is null then
      return jsonb_build_object('ok', false, 'error_code', 'REFLECTION_THREAD_NOT_AVAILABLE');
    end if;
  elsif not coalesce(p_force_new_thread, false) then
    select id into v_thread_id
    from public.chat_threads
    where user_id = p_user_id
      and status = 'active'
      and chart_version = p_chart_version
    order by updated_at desc, created_at desc
    limit 1;
  end if;

  if v_thread_id is null then
    insert into public.chat_threads (
      user_id, ai_profile_id, chart_version, persona_style, route, title, status
    ) values (
      p_user_id,
      p_ai_profile_id,
      p_chart_version,
      coalesce(p_persona_style, 'acceptance'),
      coalesce(p_route, 'casual'),
      nullif(trim(coalesce(p_title, '')), ''),
      'active'
    ) returning id into v_thread_id;
  else
    update public.chat_threads
    set
      ai_profile_id = p_ai_profile_id,
      persona_style = coalesce(p_persona_style, persona_style),
      route = coalesce(p_route, route),
      updated_at = now()
    where id = v_thread_id and user_id = p_user_id;
  end if;

  insert into public.chat_messages (
    thread_id, user_id, role, content, route, credits_cost, status, client_msg_id
  ) values (
    v_thread_id, p_user_id, 'user', trim(p_user_message),
    coalesce(p_route, 'casual'), 0, 'committed', p_client_msg_id
  ) returning id into v_user_message_id;

  insert into public.chat_messages (
    thread_id, user_id, role, content, route, credits_cost, status, client_msg_id
  ) values (
    v_thread_id, p_user_id, 'assistant', trim(p_assistant_message),
    coalesce(p_route, 'casual'), 0, 'committed', p_client_msg_id
  ) returning id into v_assistant_message_id;

  update public.chat_threads
  set route = coalesce(p_route, route), updated_at = now()
  where id = v_thread_id and user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'thread_id', v_thread_id,
    'user_message_id', v_user_message_id,
    'assistant_message_id', v_assistant_message_id,
    'assistant_message', trim(p_assistant_message),
    'ai_profile_id', p_ai_profile_id,
    'chart_version', p_chart_version
  );
end;
$$;

revoke all on function public.persist_scaffold_chat_turn(
  uuid, bigint, int, varchar, varchar, text, text, text, boolean, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.persist_scaffold_chat_turn(
  uuid, bigint, int, varchar, varchar, text, text, text, boolean, uuid, uuid
) to service_role;

create table if not exists public.api_rate_limit_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  last_request_at timestamptz not null default now(),
  primary key (user_id, endpoint, window_started_at)
);

alter table public.api_rate_limit_windows enable row level security;
revoke all on table public.api_rate_limit_windows from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limit_windows to service_role;

create index if not exists api_rate_limit_windows_expiry_idx
  on public.api_rate_limit_windows (window_started_at);

create or replace function public.check_api_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_request_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'RATE_LIMIT_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_user_id is null
    or nullif(trim(p_endpoint), '') is null
    or p_max_requests < 1
    or p_window_seconds < 1
  then
    raise exception 'RATE_LIMIT_INVALID_INPUT' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limit_windows (
    user_id, endpoint, window_started_at, request_count, last_request_at
  ) values (
    p_user_id, trim(p_endpoint), v_window_start, 1, now()
  )
  on conflict (user_id, endpoint, window_started_at) do update
  set
    request_count = public.api_rate_limit_windows.request_count + 1,
    last_request_at = now()
  returning request_count into v_request_count;

  return jsonb_build_object(
    'allowed', v_request_count <= p_max_requests,
    'request_count', v_request_count,
    'limit', p_max_requests,
    'window_started_at', v_window_start,
    'retry_after_seconds', greatest(
      0,
      p_window_seconds - floor(extract(epoch from (clock_timestamp() - v_window_start)))::integer
    )
  );
end;
$$;

revoke all on function public.check_api_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(uuid, text, integer, integer)
  to service_role;

create table if not exists public.chart_provider_call_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'astrology_api_io',
  status text not null check (status in ('generated', 'committed', 'persistence_failed')),
  compensation_status text not null default 'not_required'
    check (compensation_status in ('not_required', 'review_pending', 'credited', 'waived')),
  provider_called_at timestamptz not null default now(),
  persistence_completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chart_provider_call_events enable row level security;
revoke all on table public.chart_provider_call_events from public, anon, authenticated;
grant select, insert, update on table public.chart_provider_call_events to service_role;

create index if not exists chart_provider_call_events_review_idx
  on public.chart_provider_call_events (status, compensation_status, created_at)
  where status = 'persistence_failed';

create or replace function public.touch_chart_provider_call_event_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_chart_provider_call_event_updated_at_trigger
  on public.chart_provider_call_events;
create trigger touch_chart_provider_call_event_updated_at_trigger
before update on public.chart_provider_call_events
for each row execute function public.touch_chart_provider_call_event_updated_at();

alter table public.external_sync_events
  add column if not exists payload_redacted_at timestamptz;
alter table public.external_sync_events
  add column if not exists payload_expires_at timestamptz;

update public.external_sync_events
set payload_expires_at = created_at + interval '30 days'
where payload_expires_at is null;

alter table public.external_sync_events
  alter column payload_expires_at set default (now() + interval '30 days');
alter table public.external_sync_events
  alter column payload_expires_at set not null;

create or replace function public.redact_completed_external_sync_payload()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.payload_redacted_at is not null
    and new.status in ('pending', 'retry_pending', 'processing')
  then
    raise exception 'EXTERNAL_SYNC_PAYLOAD_REDACTED' using errcode = '22023';
  end if;

  if new.status in ('delivered', 'manually_resolved', 'cancelled_due_to_deletion')
    and new.payload_redacted_at is null
  then
    new.payload_json := new.payload_json
      - 'email'
      - 'name'
      - 'birth_date'
      - 'birth_time'
      - 'place_name'
      - 'birthplace'
      - 'timezone'
      - 'lat'
      - 'lng'
      - 'notes';
    new.payload_redacted_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.redact_expired_external_sync_payloads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redacted integer;
begin
  update public.external_sync_events
  set
    payload_json = payload_json
      - 'email'
      - 'name'
      - 'birth_date'
      - 'birth_time'
      - 'place_name'
      - 'birthplace'
      - 'timezone'
      - 'lat'
      - 'lng'
      - 'notes',
    payload_redacted_at = now(),
    updated_at = now()
  where status = 'failed_final'
    and payload_redacted_at is null
    and payload_expires_at <= now();

  get diagnostics v_redacted = row_count;
  return v_redacted;
end;
$$;

revoke all on function public.redact_expired_external_sync_payloads()
  from public, anon, authenticated;
grant execute on function public.redact_expired_external_sync_payloads()
  to service_role;

drop trigger if exists redact_completed_external_sync_payload_trigger
  on public.external_sync_events;
create trigger redact_completed_external_sync_payload_trigger
before insert or update on public.external_sync_events
for each row execute function public.redact_completed_external_sync_payload();

update public.external_sync_events
set
  payload_json = payload_json
    - 'email'
    - 'name'
    - 'birth_date'
    - 'birth_time'
    - 'place_name'
    - 'birthplace'
    - 'timezone'
    - 'lat'
    - 'lng'
    - 'notes',
  payload_redacted_at = coalesce(payload_redacted_at, now())
where status in ('delivered', 'manually_resolved', 'cancelled_due_to_deletion')
  and payload_redacted_at is null;

comment on table public.api_rate_limit_windows is
  'Backend-only fixed-window rate limits. Old windows are removed by the daily retention job.';
comment on table public.chart_provider_call_events is
  'Backend-only provider-call outcomes used to identify generated charts that failed to persist and may require compensation review.';
comment on column public.external_sync_events.payload_expires_at is
  'Failed-final PII is retained for manual replay for at most 30 days, then redacted while operational metadata remains visible.';
