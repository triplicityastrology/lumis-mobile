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

The metadata control now records `confirmed_t82_text_shape`. Migration `0036`
also has an isolated PostgreSQL 17 proof for owner deletion, cross-owner and
anonymous denial, dependent-message cascade, replay, request conflict, unrelated
thread preservation, transaction rollback, and container cleanup. This local
proof is not deployment authority. PM/QA must still authorize a checksum-bound
atomic Dashboard application after remote predecessor `0035` is confirmed.
No current command applies `0036` remotely.

After a separately authorised deployment, use disposable staging accounts to
prove owner deletion, cross-owner denial, dependent-message cleanup, exact
request replay, conflict rejection, and immediate mobile-list removal. Evidence
must contain pass/stop names and counts only.
