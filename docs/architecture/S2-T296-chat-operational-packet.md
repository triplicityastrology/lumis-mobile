# S2-T296 Chat/Companion operational packet

This source-only packet keeps `chat-synthetic` separate from `chat-message` and
normal member sessions. Runtime input is exactly `{ "fixture_id": "..." }`.
Founder-authored text is validated and frozen locally into the closed 30 EN / 30
zh-Hant registry before any future authorization review. It never becomes a
free-form provider request.

## Independent gates

1. An accepted T287 v4 default-off Dice deployment receipt and accepted T289
   Technical 80-case evidence must be compiled into this package. Structurally
   valid local JSON cannot grant eligibility.
2. `CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY` permits only a future disabled
   `chat-synthetic` deployment and four `CHAT_AI_DISABLED` probes. It does not
   authorize migration or traffic.
3. `CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY` is a separate request
   and cannot authorize function deployment or traffic.
4. `CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY` is a later bounded synthetic
   traffic request requiring accepted Dice evidence, a disabled deployment
   receipt, a migration receipt, and its own single-use authorization.

All authorization windows are at most 15 minutes and single-use. Default mode
performs zero network calls and prints exactly one next action.

## T240 projection

The public response schema remains T240. The approved fixed copy is unchanged:

- `Lumis couldn’t complete that reflection just now. Please try again.`
- `Lumis can’t help with that request, but it can offer a safer, general reflection instead.`

Fallback, safety, technical error, and all synthetic review requests persist
nothing and charge zero units. Normal Chat remains disconnected.

## Commands

```sh
pnpm chat:t296:preflight
pnpm chat:t296:request -- deployment
pnpm chat:t296:request -- migration
pnpm chat:t296:request -- traffic
pnpm chat:t296:operate
pnpm start:s2-t296-founder-chat-web
pnpm start:s2-t296-founder-chat-simulator
```

The request commands remain blocked until their prerequisite checksums are
compiled. No command in default mode accepts credentials or contacts Supabase
or Azure.

Current status is exactly `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and
`NO_AZURE_TRAFFIC_AUTHORITY`.
