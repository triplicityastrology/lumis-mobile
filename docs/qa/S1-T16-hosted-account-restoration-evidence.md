# S1-T16 Hosted Staging Account-Restoration Evidence

Date: 2026-07-28

Environment: Lumis non-production staging (`bmqhwofmdgebpcihjlnb`)

Source commit exercised: `9919345`

Hosted QA run ID: `1785212955706-95ea80fbde68e`

## Safety Boundary

- The run used generated disposable QA users only.
- No founder account, founder email, birth data, token, callback URL, or provider payload appears in this evidence.
- The dedicated staging secret key was collected through hidden Terminal input and was not written to a file or command history.
- No migration, dashboard setting, Edge Function, Worker, or staging configuration was changed.

## Hosted Result

Command:

```sh
pnpm test:staging-account-restore:secure
```

Result: passed (`exit 0`, `ok: true`, scope `prof2`).

Relevant hosted checks:

- Existing chart-version invariants passed for the staging data set.
- A disposable empty account completed fresh onboarding with one live signed Worker chart and no raw provider output.
- Repeat onboarding returned the existing-profile rejection before chart generation.
- Active chart/profile version switching was transactional.
- Persona identity values persisted through the protected RPC, while direct writes were rejected.
- A missing-Starter recovery preserved saved user, birth, and chart data.
- Same-email sign-in reloaded the saved profile and two Past Reflections.
- Cross-user chart reads, protected entitlement storage, migration reports, and backend-only RPCs were denied.
- Chat failed safely when no active profile existed.

The same run also exercised regeneration idempotency, provider-attempt telemetry,
logical billing-period concurrency, chart sanitization, and atomic scaffold-chat
persistence. Those checks are supporting evidence, not additional S1-T16 scope.

## Mobile Boundary Result

The checked-in `test:account-restoration-evidence` contract proves the mobile
decision boundary that cannot be meaningfully simulated by a hosted database
request alone:

- account queries are scoped to the authenticated user ID;
- active birth/chart versions must agree;
- chart, Persona, focus, and Past Reflections are included in restored state;
- only confirmed absence of both birth data and profile can enter onboarding;
- a temporary account query failure throws `ACCOUNT_DATA_UNAVAILABLE` and cannot
  fall through to an empty/local account;
- the signed-in restore path cannot fall through to local demo state.

## Cleanup

The hosted runner reached its normal `finally` cleanup path and exited `0`.
There were no cleanup-failure messages for any of the three run-scoped
disposable users. The cleanup implementation removes external-sync events,
account-deletion requests, the application user row, and the Auth user for each
ID created by this run.

## Limitations

- This proof does not use or mutate the founder's real account.
- It does not visually verify the iPhone presentation after restoration.
- It does not claim that the draft internal account-deletion finalizer is
  deployed.
- Private values were intentionally omitted, so this document cannot be used to
  reconstruct a test account or session.
