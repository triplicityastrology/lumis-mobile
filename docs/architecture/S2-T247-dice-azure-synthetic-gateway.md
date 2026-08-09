# S2-T247 Dice Azure synthetic gateway

Status: `READY_SOURCE_ONLY_NO_TRAFFIC`

Authority remains:

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`

## Boundary

`dice-synthetic` is a dedicated server-only Edge Function. Its public request is
closed to `{ "fixture_id": "..." }`. The server-held registry owns every
question, landed outcome, language, expected classification, and expected safety
disposition. Unknown fields, free-form text, member context, and registry drift
stop before adapter construction.

The gateway recomputes deterministic Dice v0.3 classification and safety. It
prohibits natal/birth context, Level 3 body-part material, multi-throw element
patterns, Past Reflections linkage, and sharing cards. Safety and DefaultV2
block/partial outcomes project a fixed safe, zero-effect result.

The fixed prompt version is `dice_v0_3_synthetic_prompt_2026_08_09`. Azure is
addressed only through server alias `lumis-ai-chat-stg`; the controlled
deployment family is `gpt-5-mini`. Endpoint, API key, API version, prompt, raw
response, and provider diagnostics are never projected or logged.

## Caps

The run budget enforces 120 logical requests, at most 240 provider attempts,
60 EN and 60 zh-Hant fixtures, 800 input tokens, 300 output tokens, concurrency
2, one eligible retry, and one shared 12-second deadline.
`DiceSyntheticBudgetPort` is the stable server integration interface; this task's
in-memory implementation exists for fail-closed offline proof, while T249 can
provide authoritative run-scoped counters without changing the gateway.

Synthetic calls persist nothing and charge zero units. The route has no import
or connection to `chat-message`, normal mobile navigation, profiles, billing, or
member history.

## Technical review

The offline suite proves closed requests, classification/safety drift rejection,
DefaultV2 projection, retry eligibility, deadline sharing, cap behavior, output
schema projection, zero effects, configuration validation before adapter
construction, and absence of provider diagnostics.

Run:

```bash
pnpm test:s2-t247-dice-gateway
pnpm preflight:s2-t247-dice-staging
```

The preflight is inert. A later default-off deployment requires the exact staging
project, `LUMIS_AI_ENABLED=false`, a separately authorized transient deployment
credential, and Microsoft review. It performs no deployment itself. This task
does not authorize model traffic.
