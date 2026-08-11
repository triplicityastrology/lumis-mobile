# S2-T286 Chat/Companion deploy-and-test candidate

Status: `SOURCE_READY`, `LOCAL_DENO_RUNTIME_PROVED`,
`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`, and `NO_AZURE_TRAFFIC_AUTHORITY`.

This package seals the existing `chat-synthetic` Edge runtime and the pre-login
Founder Companion/Chat journey into one source continuation. It does not connect
`chat-message`, member sessions, threads, messages, units, or persistence.

## Closed order

1. Import a reviewed `s2_t284_dice_technical_evidence_acceptance_v1` envelope.
   It must include a zero-call, four-probe
   `s2_t282_dice_default_off_deployment_receipt_v1` and accepted 80-case
   Technical evidence. Self-authored or structurally incomplete JSON is rejected.
2. Obtain a separate `CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY` authorization.
   Migration 0040 and traffic are explicitly false in this scope.
3. A future operator may deploy only `chat-synthetic` while
   `LUMIS_CHAT_AI_ENABLED=false`, collect four `CHAT_AI_DISABLED` probes, and
   record zero provider calls and zero model invocations.
4. Migration 0040 requires its own
   `CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY` authorization.
5. Synthetic traffic requires a later `CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY`
   authorization bound to accepted Dice, deployment, and migration receipts.
6. The window must finish with a four-probe disabled receipt. Normal Chat remains
   disconnected throughout.

The T240 response fields and exact fixed fallback and safety redirect are unchanged.
The Founder route accepts local synthetic authoring only; runtime accepts
`fixture_id` and never free text.

## Local commands

```sh
pnpm test:s2-t286-chat-final
pnpm chat:t286:readiness
pnpm proof:s2-t286-chat-deno
pnpm start:s2-t286-founder-chat-web
pnpm start:s2-t286-founder-chat-simulator
```

The launchers use ports 8153 and 8154 and refuse occupied ports. They do not kill
another process. No command in the default path creates a remote client.
