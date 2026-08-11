# S2-T279 final Dice Technical window

## Status

`WAITING_FOR_ACCEPTED_DICE_DEFAULT_OFF_DEPLOYMENT_RECEIPT`

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`

The package is zero-network and inert. It does not deploy, apply migration 0039, enable the provider, or call Azure.

## Exact bindings

- Runtime-corrected Dice source: T272 `f5f9e9da238633d84eb8695307c573eef8f1bc96`.
- Runtime package seal: `f47b7a825dda6ee2a9fba0e269a8e1f7d1f94e96732a9445fa32e6a6fa9c98a5`.
- Gateway package: `3ccc7551fd945b4ca4c3aaeaa7b8f9efd61f29b56e8ebe3c69ea9f5c5aaae8ba`.
- T274 PostgreSQL 17 proof contract: `5db1b0e34e5c3e34933e8c68f8481e192bcc62ce`.
- T274 closed receipt SHA-256: `4b10620285c08a16688bfa5f8dd85912ce6a4ee6d7cff13c8a17f2ce13da2f9e`.
- Migration 0039 SHA-256: `7269c821d01b9819eb5d413401cd4afdc23340ca0aba953f1c33d9f9f891a610`.

The T274 receipt proves an isolated local PostgreSQL 17 run. It does not claim staging migration application. A separately accepted migration receipt is therefore mandatory.

## Future gate order

1. Import an accepted T272-bound default-off deployment receipt proving zero provider calls/model invocations and disabled state.
2. Import an accepted 0039 migration receipt bound to the T274 proof and exact migration hash.
3. Obtain a single-use Microsoft receipt scoped exactly to `DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY`.
4. Run exactly 80 Technical fixtures: 40 EN and 40 zh-Hant, no Founder fixtures.
5. Enforce at most 160 attempts, concurrency 2, one eligible retry, a shared 12-second case deadline, 800 input tokens, 300 output tokens, and the USD 0.128 ceiling.
6. Disable in `finally` and require a post-window disabled proof. Any kill criterion stops the run.

## Commands

Authorization request, still inert:

```sh
pnpm dice:technical-window:authorization-request
```

Future guarded command:

```sh
pnpm dice:technical-window:final -- --deployment-receipt /closed/deployment.json --migration-receipt /closed/migration.json --traffic-authorization /closed/traffic.json
```

Without receipts it stops at the first missing authority and reports zero calls.
