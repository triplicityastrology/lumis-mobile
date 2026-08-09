# S2-T260 Chat Canonical Port

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`; `NO_AZURE_TRAFFIC_AUTHORITY`.

This task ports the T255 source candidate into the server-owned
`chat_synthetic_gateway_port_v1`. It does not deploy the function, issue an
authority, or send Chat traffic. The port is isolated from `chat-message`,
member context, mobile code, persistence, and unit accounting.

## Closed execution boundary

Only the 60 immutable registry fixture identifiers are accepted. Free-form
text and extra fields fail closed. Before a Chat authority can validate, the
port validates a checksum accepted Dice Technical-window evidence prerequisite
covering 80 Technical cases, 40 per language, provider disabled after the
window, zero founder cases, zero persistence writes, and zero units. A Chat
authority is checksum-bound, time-limited, scoped to this registry, and usable
for one run. Each fixture is usable once; an exact idempotent replay returns the
settled result without a second provider call.

The committed review package has no accepted Dice evidence and no issued
authority, so the route remains default-off and cannot reach Azure. The
deployment-authorization schema permits only a separately reviewed default-off
deployment with zero provider calls and no normal-chat integration.

Single use is enforced across Edge instances by the source-only Postgres
authority ledger in migration `0040` (`0039` remains reserved for the T257 Dice
authority ledger). A service-role-only atomic RPC consumes
the checksum-bound authority package/run once. A second atomic RPC claims each
closed fixture once and stores only the fixture identifier plus a SHA-256 digest
of the idempotency key. The port checks this store before every provider call;
store unavailability, malformed results, expiry, replay, or binding conflicts
fail closed. RLS is enabled with no client policy, direct table access is
revoked, and metadata is purged after 30 days. No member identifiers, prompts,
responses, context, persistence units, or raw idempotency keys are stored.

The migration and RPCs are source-only in this task. They have not been applied
or called against any database.

## Token and provider policy

The fully assembled Companion prompt and normalized assistant output are both
counted server-side with `o200k_base` from `js-tiktoken`. Input above 1200
tokens fails before an adapter call. Output above 300 tokens becomes the fixed
zero-effect fallback. Provider usage metadata is not trusted.

Azure configuration accepts only
`https://lumis-ai-chat-stg.openai.azure.com`, API version `2024-10-21`, server
alias `lumis-ai-chat-stg`, and HTTPS with no path, query, user info, fragment,
or alternate port. Azure `DefaultV2` is required in addition to deterministic
Lumis pre-safety and post-safety.

The synthetic prompt contains only its closed fixture context, with no real
conversation history, customer data, Persona, or provenance. Runtime recording
is metadata-only in the engine and disabled in the route: no raw prompts,
responses, diagnostics, or provider payloads are logged.

## Canonical schema

The T240 normal-chat schema remains byte-for-byte unchanged at SHA-256
`0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07`.
The synthetic route keeps its separate zero-effect envelope while preserving
the canonical T240 result projection (`result`, `assistant_message`,
`idempotency_outcome`, `units_charged`) and does not gain normal-chat authority.
