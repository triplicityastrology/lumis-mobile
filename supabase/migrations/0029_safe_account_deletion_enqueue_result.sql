-- Avoid parsing a JSON text field back into an integer in the deletion RPC.
-- The authoritative event count is derived from rows owned by this request.
create or replace function public.enqueue_account_deletion_external_sync(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_queue_result jsonb;
  v_external_event_count integer := 0;
begin
  perform 1
  from public.users
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'ACCOUNT_NOT_FOUND');
  end if;

  insert into public.account_deletion_requests (user_id)
  values (p_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning * into v_request;

  update public.external_sync_events
  set
    status = case when status = 'delivered' then status else 'cancelled_due_to_deletion' end,
    next_retry_at = null,
    last_error = case
      when status = 'delivered' then last_error
      else 'ACCOUNT_DELETION_CANCELLED_PENDING_DELIVERY'
    end,
    resolved_by = coalesce(resolved_by, 'system:account-deletion'),
    resolved_at = coalesce(resolved_at, now()),
    payload_json = jsonb_build_object(
      'operation', 'account_deleted_audit',
      'request_id', payload_json->>'request_id',
      'user_id', p_user_id,
      'chart_session_id', chart_session_id,
      'deletion_request_id', v_request.request_id,
      'redacted_at', now()
    ),
    updated_at = now()
  where user_id = p_user_id
    and status <> 'processing'
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  v_queue_result := public.queue_account_deletion_external_sync(p_user_id);

  select count(*)
  into v_external_event_count
  from public.external_sync_events
  where user_id = p_user_id
    and payload_json->>'operation' = 'account_deletion'
    and payload_json->>'deletion_request_id' = v_request.request_id::text;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.request_id,
    'status', coalesce(v_queue_result->>'status', v_request.status),
    'external_event_count', v_external_event_count
  );
end;
$$;

revoke all on function public.enqueue_account_deletion_external_sync(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_account_deletion_external_sync(uuid)
  to service_role;
