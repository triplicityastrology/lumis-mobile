# S2-T64 Care Circle local database integration

This local-only harness starts a disposable PostgreSQL 17 Supabase image, applies
the minimum existing schema prerequisites, and then applies the reviewed Care
Circle sequence `0032 -> 0033 -> 0034` without editing those migrations. It has
no linked-project, network, credential, or staging path.

The original executable proof stopped while applying `0032` because PostgreSQL
17 rejects a generated `retention_until` expression based on
`timestamptz + interval` as non-immutable. S2-T67 corrected the undeployed
migration source by maintaining the same `expires_at + 90 days` value with a
row trigger. The focused PostgreSQL 17 test applies `0032` and verifies insert
and expiry-update behavior before the wider chain is attempted.

After that blocker is corrected under separate authority, the existing SQL proof
covers pairing-code creation, six pending requests with no pre-acceptance
authority, Caree-only acceptance, five active Carers, sixth rejection, pause,
resume, participant removal, safe participant projection, cross-user denial, and
transaction rollback of all synthetic fixtures.
