# S2-T294 Dice Technical Run Control Room

This package is the local, zero-network rehearsal and future operator boundary for the first 80-case Technical Dice window. It does not authorize deployment, migration 0039, or Azure traffic.

Before a future run, all three closed receipts must validate independently and in order:

1. Accepted v4 post-deployment disabled receipt for runtime package `be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457`.
2. Accepted separately scoped migration 0039 receipt bound to PG17 proof `0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e`.
3. Accepted, single-use `DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY` traffic receipt.

The controller reserves an attempt durably before provider dispatch. Completed attempts are skipped on resume. A dispatched attempt with no accepted evidence is ambiguous and is never retried automatically; the run stops for reviewed reconciliation. This prevents interruption from repeating a charged/provider attempt.

The emergency command records a local kill request. The controller stops new dispatches, disables in `finally`, and verifies the gateway reports disabled. A failure to prove disabled is a terminal stop.

Local rehearsal:

```sh
pnpm test:s2-t294-dice-control-room
```

Current readiness:

```sh
pnpm dice:t294:status
```

Founder dashboard:

```sh
pnpm start:s2-t294-dice-control-room-web
```

The dashboard uses redacted fixture metadata only: fixture ID, language, disposition, latency bucket, attempt count, token buckets, cost counters, and empty rating fields. It contains no prompts, responses, identities, credentials, raw diagnostics, units, or member persistence.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
