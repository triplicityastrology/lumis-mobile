-- S2-T09 count-only staging audit. Run manually only after PM authorization.
-- This query returns no IDs, codes, fingerprints, messages, or user content.

select jsonb_build_object(
  'legacy_revoked_relationship_count',
  count(*) filter (where relationship.status = 'revoked'),
  'legacy_code_fingerprint_count',
  count(*) filter (
    where nullif(trim(relationship.invitation_token_hash), '') is not null
  ),
  'legacy_code_non_sha256_shape_count',
  count(*) filter (
    where nullif(trim(relationship.invitation_token_hash), '') is not null
      and relationship.invitation_token_hash !~ '^[a-f0-9]{64}$'
  )
) as care_circle_legacy_counts
from public.care_relationships relationship;

select jsonb_build_object(
  'legacy_notification_count',
  count(*),
  'legacy_notification_with_body_count',
  count(*) filter (
    where nullif(trim(notification.title), '') is not null
       or nullif(trim(notification.body), '') is not null
  )
) as notification_legacy_counts
from public.notifications notification;
