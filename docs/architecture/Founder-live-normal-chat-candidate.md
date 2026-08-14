# Founder live Normal Chat candidate

Status remains exactly `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

This candidate preserves the signed Chat product pixels and the existing `chat-synthetic` production route. It adds a closed 12-fixture Founder bridge and binds the accepted Technical-80 metadata receipt (`f9503a7a...`) for a later, separately reviewed Chat window.

## Boundary

- The customer-like mobile prompt must match one of 12 reviewed EN/zh-Hant prompts exactly; the future transport body contains only `fixture_id`, `idempotency_key`, and `run_id`.
- The real Chat screen selects the closed `chat-synthetic` transport only in a DEV Founder launch with the exact accepted Dice evidence digest. Production builds remain on the existing path.
- The server requires both `LUMIS_CHAT_AI_ENABLED=true` and `LUMIS_CHAT_TRAFFIC_AUTHORIZED=true` before configuration, authority-client, or provider construction. Azure host, model, key, and provider envelopes never enter mobile source or logs.
- Every synthetic result uses `result`, `assistant_message`, `idempotency_outcome`, and `units_charged`. Fallback and safety copy are the accepted T240 copy; technical errors contain no assistant text.
- Founder-window success remains synthetic and not persisted with zero units. This is deliberately separate from T240 atomic member success.

## Separate authority still required

One 15-minute, single-use `FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY` receipt must name the sealed review package and the 12 ordered fixture IDs. The server must be deployed default-off with the accepted Dice evidence and authority envelopes, then both Chat switches may be enabled only for that reviewed window. Normal `chat-message`, member sessions, threads, persistence, and units remain out of scope.

## Local product route

```bash
pnpm start:founder-live-chat -- --lan
```

This opens the real Chat product screen and invokes only allow-listed fixture IDs. It fails closed unless public Supabase configuration is present and the server-side deployment, accepted Dice evidence, single-use Chat authority, and both server switches have been independently activated.
