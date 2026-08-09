# S2-T250 Separate Synthetic Companion/Chat Gateway

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

`chat-synthetic` is a dedicated server-only route, separate from `chat-message`.
It accepts only a closed server fixture ID, an opaque synthetic run ID, and an
idempotency key. The mobile application cannot provide conversation text,
member/profile/thread/chart context, provider routing, an Azure endpoint, a
model name, or credentials.

The server-held registry currently exists only to prove the route boundary.
Deterministic Lumis safety executes before the adapter. The adapter receives
the stable server alias `lumis-ai-chat-stg`, fixed template
`chat_synthetic_prompt_v1`, and `DefaultV2`. Content-filter block or partial
results project to the approved safety redirect. Eligible timeout, network,
rate-limit, and server failures receive at most one retry inside one shared
12-second deadline. Authentication and configuration failures do not retry.

All synthetic outcomes persist nothing and charge zero units. Runtime evidence
contains only fixture ID, language, result class, attempt count, duration
bucket, synthetic run ID, redacted failure code, and the 30-day retention
control. Prompts, responses, member data, and provider diagnostics are not log
fields.

The caps are 60 logical requests split 30 EN and 30 zh-Hant, 120 provider
attempts, 1,200 input tokens, 300 output tokens, and concurrency one. These are
hard source boundaries for the proposed synthetic window, not customer pricing
or entitlement policy.

## Deployment Boundary

Source is deployable but remains unexecuted. A later default-off staging deploy
requires Technical review and independent proof that `LUMIS_AI_ENABLED=false`
before and after deployment. Deployment must make zero model calls. This task
does not authorize credentials, Azure traffic, normal Chat integration, or any
member/public route.

Run the inert preflight:

```bash
LUMIS_AI_ENABLED=false pnpm preflight:s2-t250-chat-synthetic
```

The command reports source hashes and readiness only. Passing `--execute`
returns `STOP_S2_T250_REMOTE_EXECUTION_NOT_AUTHORIZED`; it contains no network
or deployment implementation.
