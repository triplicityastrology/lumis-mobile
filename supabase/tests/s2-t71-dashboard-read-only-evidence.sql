-- S2-T71: copy-safe pre-write evidence. Run manually in the approved staging
-- Dashboard only after authorization. This transaction is explicitly read-only
-- and returns one JSON value containing counts and schema/version names only.
begin transaction read only;

select jsonb_build_object(
  'schema_version', 1,
  'legacy_counts', jsonb_build_object(
    'legacy_revoked_relationship_count', (
      select count(*) from public.care_relationships where status = 'revoked'
    ),
    'legacy_code_fingerprint_count', (
      select count(*) from public.care_relationships
      where nullif(trim(invitation_token_hash), '') is not null
    ),
    'legacy_code_non_sha256_shape_count', (
      select count(*) from public.care_relationships
      where nullif(trim(invitation_token_hash), '') is not null
        and invitation_token_hash !~ '^[a-f0-9]{64}$'
    ),
    'legacy_notification_count', (
      select count(*) from public.notifications
    ),
    'legacy_notification_with_body_count', (
      select count(*) from public.notifications
      where nullif(trim(title), '') is not null
         or nullif(trim(body), '') is not null
    )
  ),
  'history_columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'column_name', column_name,
      'data_type', data_type,
      'udt_name', udt_name,
      'is_nullable', is_nullable,
      'column_default', column_default,
      'ordinal_position', ordinal_position
    ) order by ordinal_position), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
  ),
  'remote_migrations', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'version', version,
      'name', name
    ) order by version), '[]'::jsonb)
    from supabase_migrations.schema_migrations
  )
) as s2_t71_read_only_evidence;

rollback;
