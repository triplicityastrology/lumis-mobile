# S2-T281 Final Chat Request Package

Status is exactly `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and
`NO_AZURE_TRAFFIC_AUTHORITY`.

This package reconciles the T271 Founder fixture-ID interface into T276's
runtime-proved `chat-synthetic` Edge candidate. It does not connect
`chat-message`, member sessions, persistence, units, or normal navigation.

## Closed Dice prerequisite

Chat remains blocked until a separately reviewed
`lumis_dice_technical_window_acceptance_v2` envelope is accepted. The envelope
binds T272 commit `f5f9e9da238633d84eb8695307c573eef8f1bc96`, its runtime control and proof
digests, the exact `DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY` scope, 80 Technical
cases (40 EN / 40 zh-Hant), zero Founder cases, and provider-disabled proof.
Structurally valid local JSON is never enough: the accepted evidence digest is
currently `null` in source.

## Independent future scopes

1. `CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY` permits only a disabled function
   deployment, four `CHAT_AI_DISABLED` probes, and zero provider calls. It does
   not permit migration 0040 or traffic.
2. `CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY` permits only migration
   0040 after separate review. It does not permit function deployment or traffic.
3. `CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY` is a later traffic request. It
   requires accepted Dice evidence plus independently accepted deployment and
   migration receipts. Runtime input remains fixture ID only.

Each request is closed, expiry-bound, nonce-bound, exact-project scoped, and
validated locally before any future operator can be considered. This task ships
no remote command and executes none.

## Current readiness

```bash
pnpm chat:final-request-readiness
```

Expected next action:

`WAITING_FOR_MICROSOFT_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION`

The later local validation forms are:

```bash
pnpm chat:final-request-readiness -- --validate-deployment reviewed.json
pnpm chat:final-request-readiness -- --validate-migration reviewed.json
pnpm chat:final-request-readiness -- --validate-traffic reviewed.json
```

Validation is not execution authority. Rollback and post-window evidence remain
closed receipts with provider disabled, four disabled probes, zero residual
access, zero persistence, and zero units.

## Founder bridge

The pre-login bridge renders only `offline_preview` and `not_yet_run` until
accepted evidence is compiled. It drafts and freezes 60 synthetic fixtures,
invokes later by `fixture_id` only, and exports a checksum-bound verdict.

```bash
pnpm start:s2-t281-founder-chat-web
pnpm start:s2-t281-founder-chat-simulator
```

The default ports are 8151 and 8152, leaving 8140-8146 untouched.
