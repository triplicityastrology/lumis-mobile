# S2-T64 Care Circle local database integration

This local-only harness starts a disposable PostgreSQL 17 Supabase image, applies
the minimum existing schema prerequisites, and then applies the reviewed Care
Circle sequence `0032 -> 0033 -> 0034` without editing those migrations. It has
no linked-project, network, credential, or staging path.

The first executable proof currently stops while applying `0032` because
PostgreSQL 17 rejects the generated `retention_until` expression based on
`timestamptz + interval` as non-immutable. No Care Circle operation is executed
after that stop, and the disposable container is removed. This is a migration
compatibility blocker requiring a separately reviewed forward source correction;
the harness must not substitute a different schema.

After that blocker is corrected under separate authority, the existing SQL proof
covers pairing-code creation, six pending requests with no pre-acceptance
authority, Caree-only acceptance, five active Carers, sixth rejection, pause,
resume, participant removal, safe participant projection, cross-user denial, and
transaction rollback of all synthetic fixtures.
