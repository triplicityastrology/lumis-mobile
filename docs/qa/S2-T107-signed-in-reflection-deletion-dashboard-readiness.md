# S2-T107 Signed-In Reflection Deletion Dashboard Readiness

Status: source-ready and unrun. This package applies migration `0036` only.

The apply and rollback-rehearsal packets are checksum-bound to
`889a8177e2051af3745a2d3850b8e932011f3605cd933f1c1bce46a4629af1bf`.
Both verify the confirmed `version text`, `statements text[]`, `name text`
migration-history shape and require the exact existing history through
`0035 app_language_preference`. Missing `0035`, any extra/missing migration, or
schema drift stops before the migration body.

Before signed-in Founder testing, PM must separately authorize the exact
staging Dashboard write window after reviewing: exact project confirmation,
current names/versions-only parity through `0035`, the rollback rehearsal with
no persisted change, and the previously accepted PostgreSQL 17 owner/RLS proof.
After apply, retain only migration name/version, checksum, pass/stop names, and
aggregate owner/cross-owner/anonymous test outcomes. Do not retain reflection
content, identifiers, messages, email, tokens, URLs, or SQL result rows.

Rollback means rehearsal ending in `rollback`. Once `0036` is committed it is
forward-only; defects require a corrective migration, not dropping the table or
function and not deleting migration history.
