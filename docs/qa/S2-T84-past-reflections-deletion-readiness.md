# S2-T84 Past Reflections deletion readiness

Status: local-demo is immediately testable; signed-in deletion is source-ready
but not deployed.

## Local prototype

Use the normal Expo app with a local-demo profile that has one saved reflection.
Open Past Reflections, tap the delete icon, and verify:

1. Cancel keeps the row and its continuation unchanged.
2. Confirm removes only that row and returns the list to its truthful empty state.
3. A failed signed-in operation keeps the row present and offers Retry or Cancel.
4. A successful retry applies the confirmed outcome once; deleting the active
   thread clears its selection and starts no replacement conversation.

## Signed-in staging gate

Migration order is `0035` then `0036`. Migration `0036` is pinned in
`config/s2-t84-reflection-deletion-readiness.json` and must match SHA-256
`889a8177e2051af3745a2d3850b8e932011f3605cd933f1c1bce46a4629af1bf`.

Deployment remains blocked with
`blocked_pending_text_type_review`: the authorised read-only T82 check found the
live migration-history `version` and `name` columns are PostgreSQL `text`, while
the reviewed control expected `varchar`. PM/QA must accept the truthful history
shape and authorise one atomic Dashboard application before Technical prepares
an executable packet. No current command applies `0036`.

After a separately authorised deployment, use disposable staging accounts to
prove owner deletion, cross-owner denial, dependent-message cleanup, exact
request replay, conflict rejection, and immediate mobile-list removal. Evidence
must contain pass/stop names and counts only.
