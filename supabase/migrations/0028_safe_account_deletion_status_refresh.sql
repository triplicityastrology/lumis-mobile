-- Resolve deletion requests by a guarded text lookup. A malformed or stale
-- outbound payload must never abort the account-deletion transaction.
create or replace function public.refresh_account_deletion_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_resolved_count int;
  v_failed_count int;
begin
  if coalesce(new.payload_json->>'operation', '') <> 'account_deletion' then
    return new;
  end if;

  select request.request_id
  into v_request_id
  from public.account_deletion_requests request
  where request.user_id = new.user_id
    and request.request_id::text = coalesce(new.payload_json->>'deletion_request_id', '');

  if not found then
    return new;
  end if;

  select
    count(*) filter (where status in ('delivered', 'manually_resolved')),
    count(*) filter (where status = 'failed_final')
  into v_resolved_count, v_failed_count
  from public.external_sync_events
  where user_id = new.user_id
    and payload_json->>'deletion_request_id' = v_request_id::text;

  update public.account_deletion_requests
  set
    status = case
      when v_resolved_count = 2 then 'external_updates_complete'
      when v_failed_count > 0 then 'needs_manual_review'
      else 'pending_external_updates'
    end,
    external_processed_at = case when v_resolved_count = 2 then now() else null end,
    last_error = case when v_failed_count > 0 then 'EXT-SYNC-3' else null end,
    updated_at = now()
  where request_id = v_request_id
    and status <> 'internally_deleted';

  return new;
end;
$$;

revoke all on function public.refresh_account_deletion_request_status()
  from public, anon, authenticated;
grant execute on function public.refresh_account_deletion_request_status()
  to service_role;
