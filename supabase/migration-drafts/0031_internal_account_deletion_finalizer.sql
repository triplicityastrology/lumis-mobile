-- DRAFT: move into supabase/migrations only after destructive staging QA
-- approves DEL-1. The Edge Function also remains disabled until then.
-- passes. These RPCs provide a leased, resumable finalization path after both
-- external deletion destinations have completed.

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in (
    'pending_external_updates',
    'external_updates_complete',
    'internal_deletion_processing',
    'needs_manual_review',
    'internally_deleted'
  ));

alter table public.account_deletion_requests
  add column if not exists internal_attempt_count integer not null default 0
    check (internal_attempt_count >= 0),
  add column if not exists internal_claimed_at timestamptz,
  add column if not exists internal_claim_expires_at timestamptz,
  add column if not exists next_internal_retry_at timestamptz;

create index if not exists account_deletion_requests_internal_claim_idx
  on public.account_deletion_requests (status, next_internal_retry_at, requested_at)
  where status in ('external_updates_complete', 'internal_deletion_processing');

create or replace function public.claim_internal_account_deletions(p_limit integer default 10)
returns table (
  request_id uuid,
  user_id uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'INTERNAL_DELETION_ACCESS_DENIED' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select request.request_id
    from public.account_deletion_requests request
    where (
      (
        request.status = 'external_updates_complete'
        and (
          request.next_internal_retry_at is null
          or request.next_internal_retry_at <= now()
        )
      )
      or (
        request.status = 'internal_deletion_processing'
        and request.internal_claim_expires_at <= now()
      )
    )
    and (
        select count(distinct event.destination)
        from public.external_sync_events event
        where event.payload_json->>'deletion_request_id' = request.request_id::text
          and coalesce(event.payload_json->>'operation', '') = 'account_deletion'
          and event.status in ('delivered', 'manually_resolved')
      ) = 2
    order by request.requested_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  claimed as (
    update public.account_deletion_requests request
    set
      status = 'internal_deletion_processing',
      internal_attempt_count = request.internal_attempt_count + 1,
      internal_claimed_at = now(),
      internal_claim_expires_at = now() + interval '15 minutes',
      next_internal_retry_at = null,
      last_error = null,
      updated_at = now()
    from candidates
    where request.request_id = candidates.request_id
      and not exists (
        select 1
        from public.external_sync_events event
        where event.payload_json->>'deletion_request_id' = request.request_id::text
          and coalesce(event.payload_json->>'operation', '') = 'account_deletion'
          and event.status not in ('delivered', 'manually_resolved')
      )
    returning
      request.request_id,
      request.user_id,
      request.internal_attempt_count
  )
  select claimed.request_id, claimed.user_id, claimed.internal_attempt_count
  from claimed;
end;
$$;

create or replace function public.prepare_internal_account_deletion(
  p_request_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_message_usage_deleted integer;
  v_runtime_events_deleted integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'INTERNAL_DELETION_ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where request_id = p_request_id
    and user_id = p_user_id
  for update;

  if not found
    or v_request.status <> 'internal_deletion_processing'
    or v_request.internal_claim_expires_at <= now()
  then
    return jsonb_build_object('ok', false, 'error_code', 'INTERNAL_DELETION_CLAIM_REQUIRED');
  end if;

  -- These tables use ON DELETE SET NULL. Remove their user-linked rows before
  -- Auth deletion would erase the lookup key needed for a complete purge.
  delete from public.message_usage where user_id = p_user_id;
  get diagnostics v_message_usage_deleted = row_count;

  delete from public.runtime_request_events where user_id = p_user_id;
  get diagnostics v_runtime_events_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'message_usage_deleted', v_message_usage_deleted,
    'runtime_events_deleted', v_runtime_events_deleted
  );
end;
$$;

create or replace function public.complete_internal_account_deletion(
  p_request_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'INTERNAL_DELETION_ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where request_id = p_request_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'DELETION_REQUEST_NOT_FOUND');
  end if;

  if v_request.status = 'internally_deleted' then
    return jsonb_build_object('ok', true, 'status', 'internally_deleted');
  end if;

  if v_request.status <> 'internal_deletion_processing'
    or v_request.internal_claim_expires_at <= now()
  then
    return jsonb_build_object('ok', false, 'error_code', 'INTERNAL_DELETION_CLAIM_REQUIRED');
  end if;

  if exists (
    select 1
    from public.external_sync_events event
    where event.payload_json->>'deletion_request_id' = p_request_id::text
      and coalesce(event.payload_json->>'operation', '') = 'account_deletion'
      and event.status not in ('delivered', 'manually_resolved')
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'EXTERNAL_DELETION_INCOMPLETE');
  end if;

  if (
    select count(distinct event.destination)
    from public.external_sync_events event
    where event.payload_json->>'deletion_request_id' = p_request_id::text
      and coalesce(event.payload_json->>'operation', '') = 'account_deletion'
      and event.status in ('delivered', 'manually_resolved')
  ) <> 2 then
    return jsonb_build_object('ok', false, 'error_code', 'EXTERNAL_DELETION_INCOMPLETE');
  end if;

  -- Application-owned records cascade from this row. External delivery and
  -- deletion audit rows deliberately have no user foreign key and survive.
  delete from public.users where id = p_user_id;

  update public.account_deletion_requests
  set
    status = 'internally_deleted',
    internally_deleted_at = coalesce(internally_deleted_at, now()),
    internal_claimed_at = null,
    internal_claim_expires_at = null,
    next_internal_retry_at = null,
    last_error = null,
    updated_at = now()
  where request_id = p_request_id;

  return jsonb_build_object('ok', true, 'status', 'internally_deleted');
end;
$$;

create or replace function public.fail_internal_account_deletion(
  p_request_id uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_final boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'INTERNAL_DELETION_ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where request_id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'DELETION_REQUEST_NOT_FOUND');
  end if;

  if v_request.status = 'internally_deleted' then
    return jsonb_build_object('ok', true, 'status', 'internally_deleted');
  end if;

  v_final := v_request.internal_attempt_count >= 3;

  update public.account_deletion_requests
  set
    status = case when v_final then 'needs_manual_review' else 'external_updates_complete' end,
    internal_claimed_at = null,
    internal_claim_expires_at = null,
    next_internal_retry_at = case
      when v_final then null
      when v_request.internal_attempt_count = 1 then now() + interval '1 hour'
      else now() + interval '3 hours'
    end,
    last_error = left(coalesce(nullif(trim(p_error_code), ''), 'INTERNAL_DELETION_FAILED'), 100),
    updated_at = now()
  where request_id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when v_final then 'needs_manual_review' else 'retry_pending' end,
    'attempt_count', v_request.internal_attempt_count
  );
end;
$$;

revoke all on function public.claim_internal_account_deletions(integer)
  from public, anon, authenticated;
revoke all on function public.prepare_internal_account_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_internal_account_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fail_internal_account_deletion(uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_internal_account_deletions(integer)
  to service_role;
grant execute on function public.prepare_internal_account_deletion(uuid, uuid)
  to service_role;
grant execute on function public.complete_internal_account_deletion(uuid, uuid)
  to service_role;
grant execute on function public.fail_internal_account_deletion(uuid, text)
  to service_role;
