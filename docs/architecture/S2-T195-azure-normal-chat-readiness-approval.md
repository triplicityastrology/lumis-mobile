# S2-T207 Microsoft/Azure Normal-Chat Readiness Packet

Current status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and
`NO_AZURE_TRAFFIC_AUTHORITY`.

This packet is source-only preparation for Microsoft/Azure review. Normal
`chat-message` remains disconnected from the adapter and
`LUMIS_AI_ENABLED=false` remains the kill switch.

## Confirmed facts and geography

- The resource boundary is Southeast Asia.
- Global Standard `gpt-5-mini` is behind server alias `lumis-ai-chat-stg`.
- Configuration is server-secret-only; mobile has no endpoint, deployment,
  model, credential, or routing authority.
- Global Standard prompts and responses may be processed in any Azure geography
  where the model is deployed. This is not Singapore-only or APAC-only inference.
- Data at rest remains in the designated Azure geography, including the
  applicable Global/Data Zone abuse-monitoring store.
- Default abuse monitoring may select flagged prompts or completions for review.
  Synthetic-only data remains mandatory until separately approved.

## Safety and failure projection

Azure `DefaultV2` filtering supplements, and never replaces, Lumis deterministic
safety policy and routing. Filter blocks and partials project to:

“Lumis can’t help with that request, but it can offer a safer, general reflection instead.”

That result has no assistant persistence and zero units. Provider/router
failures use the approved fallback:

“Lumis couldn’t complete that reflection just now. Please try again.”

Failed, blocked, fallback, and synthetic requests persist nothing and consume
zero units.

## Privacy, telemetry, and cost

Telemetry is metadata-only, retained for 30 days, and owned by Technical Architect. Prompts, responses, user text, birth data, names, account/device IDs,
tokens, endpoints, model identifiers, and provider bodies are prohibited. The
USD20 budget is monitoring only, not a hard cap or traffic authorization.

## Review and recovery gates

Before any future synthetic traffic: approve the contract and 14-case harness,
review DefaultV2 and Lumis controls, confirm names-only server configuration,
approve synthetic red-team evidence, define hard request/concurrency limits,
and grant a separate bounded traffic window. Real-member and production traffic
require later independent approvals.

Recovery is fail-closed: set `LUMIS_AI_ENABLED=false`, verify zero adapter calls,
preserve no failed assistant claim, reconcile only metadata, rotate any temporary
test credential, and require new checksums and approvals before re-enable.

## Unresolved decisions

- Final aggregate and response limits.
- Final structured response shape.
- Pricing and entitlement policy.
- Founder quality approval.
- Any synthetic or real traffic window.

Approved fallback/safety copy, zero-effect behavior, 30-day telemetry ownership,
DefaultV2 plus Lumis controls, and block/partial projection are closed and are
not unresolved.

No Azure, Supabase, provider, credential, deployment, or network action occurred.
