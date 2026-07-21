-- Forward repair for staging projects that applied migration 0017 before its
-- provider-event integrity and deterministic ordering rules were finalized.

create or replace function public.apply_entitlement_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_user_id uuid,
  p_provider_customer_id text,
  p_event_type text,
  p_entitlement_label text,
  p_product_code text,
  p_plan_tier text,
  p_entitlement_status text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_provider_event_at timestamptz,
  p_payload_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event_id text;
  existing_payload_digest text;
  entitlement_rows_updated integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'ENTITLEMENT_EVENT_ACCESS_DENIED' using errcode = '42501';
  end if;

  if nullif(trim(p_provider_event_id), '') is null
    or nullif(trim(p_event_type), '') is null
    or nullif(trim(p_payload_digest), '') is null
    or p_user_id is null
    or p_provider_event_at is null then
    raise exception 'ENTITLEMENT_EVENT_INVALID' using errcode = '22023';
  end if;

  insert into public.entitlement_provider_events (
    provider,
    provider_event_id,
    user_id,
    provider_customer_id,
    event_type,
    entitlement_label,
    product_code,
    plan_tier,
    entitlement_status,
    valid_from,
    valid_until,
    provider_event_at,
    payload_digest
  ) values (
    p_provider,
    trim(p_provider_event_id),
    p_user_id,
    p_provider_customer_id,
    trim(p_event_type),
    p_entitlement_label,
    p_product_code,
    p_plan_tier,
    p_entitlement_status,
    p_valid_from,
    p_valid_until,
    p_provider_event_at,
    trim(p_payload_digest)
  )
  on conflict (provider, provider_event_id) do nothing
  returning provider_event_id into inserted_event_id;

  if inserted_event_id is null then
    select payload_digest
    into existing_payload_digest
    from public.entitlement_provider_events
    where provider = p_provider
      and provider_event_id = trim(p_provider_event_id);

    if existing_payload_digest is distinct from trim(p_payload_digest) then
      raise exception 'ENTITLEMENT_EVENT_INTEGRITY_CONFLICT' using errcode = '23505';
    end if;

    return jsonb_build_object('duplicate', true, 'applied', false);
  end if;

  insert into public.account_entitlements (
    user_id,
    plan_tier,
    product_code,
    status,
    valid_from,
    valid_until,
    source,
    provider_customer_id,
    provider_event_id,
    provider_event_at
  ) values (
    p_user_id,
    p_plan_tier,
    p_product_code,
    p_entitlement_status,
    p_valid_from,
    p_valid_until,
    p_provider,
    p_provider_customer_id,
    trim(p_provider_event_id),
    p_provider_event_at
  )
  on conflict (user_id) do update set
    plan_tier = excluded.plan_tier,
    product_code = excluded.product_code,
    status = excluded.status,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    source = excluded.source,
    provider_customer_id = excluded.provider_customer_id,
    provider_event_id = excluded.provider_event_id,
    provider_event_at = excluded.provider_event_at
  where public.account_entitlements.provider_event_at is null
    or excluded.provider_event_at > public.account_entitlements.provider_event_at
    or (
      excluded.provider_event_at = public.account_entitlements.provider_event_at
      and excluded.provider_event_id > coalesce(public.account_entitlements.provider_event_id, '')
    );

  get diagnostics entitlement_rows_updated = row_count;

  return jsonb_build_object(
    'duplicate', false,
    'applied', entitlement_rows_updated = 1
  );
end;
$$;

revoke all on function public.apply_entitlement_provider_event(
  text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.apply_entitlement_provider_event(
  text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text
) to service_role;

comment on function public.apply_entitlement_provider_event(
  text, text, uuid, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text
) is 'Applies append-only entitlement events, rejects digest conflicts, and deterministically orders equal-time events.';
