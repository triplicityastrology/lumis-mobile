# S2-T205 Corrected Proposed Server Normal-Chat Contract

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and
`NO_AZURE_TRAFFIC_AUTHORITY`. This is a default-off source contract. It does
not connect normal chat to an adapter or authorize traffic.

## Request boundary

The mobile request is closed-schema and contains a client turn UUIDv4, the
member's message, and either a new-thread intent or a server-issued thread ID.
Unknown fields fail before routing. Names, account/device IDs, bearer tokens,
raw birth data, unrestricted history, provider/model/endpoint authority, and
credentials are prohibited.

Before idempotency comparison, the server normalizes Unicode to NFC and LF line endings. It computes idempotency from authenticated actor scope, client turn,
thread intent, and canonical message. Aggregate context is checked by executable
server policy; its final numerical limits remain an unresolved Founder decision.

## Response authority

Every committed or replayed response includes a server-owned UUIDv4 `thread_id`.
The schema has mutually exclusive outcomes:

- `completed`: `assistant_message` plus one atomic transaction covering user
  message, assistant message, unit ledger, and idempotency outcome.
- `duplicate`: the same committed result is replayed with zero additional units.
- `fixed_fallback`: exact copy “Lumis couldn’t complete that reflection just now. Please try again.”, zero units, no persistence, and no thread ID.
- `safety_rejected`: exact copy “Lumis can’t help with that request, but it can offer a safer, general reflection instead.”, zero units, no persistence, and no thread ID.
- `technical_error`: a stable non-echoing code only. Assistant message and thread
  ID are prohibited; it consumes zero units and must persist nothing.

Failed, blocked, fallback, and synthetic requests persist nothing and consume
zero units. A persistence failure rolls back the complete atomic transaction;
the response must never claim a partial assistant result or debit.

## Provider boundary

The proposed server-only alias remains `lumis-ai-chat-stg`. Mobile cannot select
it. The shared provider budget is 12 seconds with at most one bounded retry.
Authentication and authorization denials are not retried. An ambiguous failure
after a provider receipt does not trigger an unbounded or duplicate call.

Deterministic Lumis safety runs before provider routing. Azure content-filter
blocks or partials project to the fixed safety result, with zero units and no
persistence. Raw prompts, responses, provider bodies, member text, and private
context are prohibited from logs and evidence.

## Deliberately unresolved

- Final aggregate context and response-size limits.
- Final structured assistant response shape.
- Route pricing and entitlement policy.
- Founder quality approval.
- Any synthetic or real traffic window.

No source in this task connects `chat-message` to Azure or changes runtime
behavior.

The canonical mobile response fields are `result`, `assistant_message` when the
result carries approved copy, `idempotency_outcome`, and `units_charged`.
Redaction is internal evidence metadata and never a public result or response
field.
