# S2-T255 Companion/Chat synthetic candidate

Status:

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`

The candidate exposes only the dedicated server-side `chat-synthetic` route. It is not imported by `chat-message` or the mobile app. Requests contain a closed fixture ID, an idempotency key and a synthetic run ID; free-form text, member profiles, threads, charts, birth data and device context are prohibited.

The registry contains exactly 60 server-held fixtures: 30 English and 30 Traditional Chinese. The Companion prompt layer receives only the selected synthetic fixture and its language. It explicitly prohibits inferred identity, biography, astrology, Persona, chart data, provenance and conversation history. This defines presentation discipline, not new product behavior.

Deterministic Lumis safety runs before the adapter. Azure `DefaultV2` is the provider filter boundary. Deterministic post-safety validates the result. Filter blocks and partials return the approved safety redirect. Retryable provider failures receive at most one bounded retry within the shared 12-second deadline; other failures do not retry. Every synthetic result persists nothing and charges zero units.

Only metadata fields in the closed telemetry type may be recorded, with a 30-day operational control. Prompts, responses, customer text, provider diagnostics, endpoints and secrets are prohibited from telemetry.

## Deployment boundary

The local preflight is inert. It does not construct a Supabase or Azure client and prints only names/counts, source hashes and classifications. The present source has no reviewed deployment authorization receipt or safely verified remote configuration, so execution must stop before network activity. A future default-off deployment requires separate review and must prove `LUMIS_AI_ENABLED=false` before any client construction, during verification and afterward. Chat traffic remains prohibited until Dice evidence review grants a separate authority.
