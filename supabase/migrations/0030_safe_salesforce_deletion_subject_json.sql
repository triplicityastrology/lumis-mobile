-- Parenthesize JSON text extraction before prefix concatenation. Without the
-- parentheses PostgreSQL may resolve `||` as JSON concatenation and attempt to
-- parse the `LUMIS-...` subject as raw JSON.
create or replace function public.queue_account_deletion_external_sync(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_destination text;
  v_processing_count int;
  v_session_ids jsonb;
  v_salesforce_case_ids jsonb;
  v_salesforce_case_subjects jsonb;
  v_payload jsonb;
  v_inserted_count int := 0;
begin
  select * into v_request
  from public.account_deletion_requests
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'DELETION_REQUEST_NOT_FOUND');
  end if;

  select count(*) into v_processing_count
  from public.external_sync_events
  where user_id = p_user_id
    and status = 'processing'
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  if v_processing_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'status', 'waiting_for_in_flight_exports',
      'processing_count', v_processing_count,
      'external_event_count', 0
    );
  end if;

  select coalesce(jsonb_agg(id order by chart_version), '[]'::jsonb)
  into v_session_ids
  from public.birth_data_history
  where user_id = p_user_id;

  select coalesce(jsonb_agg(external_record_id order by created_at), '[]'::jsonb)
  into v_salesforce_case_ids
  from public.external_sync_events
  where user_id = p_user_id
    and destination = 'salesforce_case'
    and external_record_id is not null
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  select coalesce(
    jsonb_agg(('LUMIS-' || (payload_json->>'request_id')) order by created_at)
      filter (where nullif(payload_json->>'request_id', '') is not null),
    '[]'::jsonb
  )
  into v_salesforce_case_subjects
  from public.external_sync_events
  where user_id = p_user_id
    and destination = 'salesforce_case'
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

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
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  v_payload := jsonb_build_object(
    'operation', 'account_deletion',
    'deletion_deferred_action', 'external_cleanup',
    'deletion_request_id', v_request.request_id,
    'request_id', 'delete-' || v_request.request_id::text,
    'user_id', p_user_id,
    'session_ids', v_session_ids,
    'deletion_requested_at', v_request.requested_at,
    'source', 'mobile_app',
    'status', 'external_cleanup_requested',
    'salesforce_case_ids', v_salesforce_case_ids,
    'salesforce_case_subjects', v_salesforce_case_subjects
  );

  foreach v_destination in array array['salesforce_case', 'google_sheet'] loop
    insert into public.external_sync_events (
      user_id,
      chart_session_id,
      destination,
      idempotency_key,
      payload_json
    )
    values (
      p_user_id,
      null,
      v_destination,
      'lumis:account-deletion:' || v_request.request_id::text || ':' || v_destination,
      v_payload
    )
    on conflict (idempotency_key) do nothing;

    if found then
      v_inserted_count := v_inserted_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'status', 'external_cleanup_queued',
    'external_event_count', v_inserted_count
  );
end;
$$;

revoke all on function public.queue_account_deletion_external_sync(uuid)
  from public, anon, authenticated;
grant execute on function public.queue_account_deletion_external_sync(uuid)
  to service_role;
