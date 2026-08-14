# Founder live Normal Chat candidate

Status remains exactly `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

This candidate preserves the signed Chat product pixels and the existing `chat-synthetic` production route. It adds a closed 12-fixture Founder bridge and binds the accepted Technical-80 metadata receipt (`f9503a7a...`) for a later, separately reviewed Chat window.

## Boundary

- The customer-like mobile prompt must match one of 12 reviewed EN/zh-Hant prompts exactly; the future transport body contains only `fixture_id`, `idempotency_key`, and `run_id`.
- Both mobile source switches remain compiled `false`, before fixture mapping or transport construction.
- The existing server route is not activated or modified. Azure host, model, key, and provider envelopes never enter mobile source or logs.
- Every synthetic result uses `result`, `assistant_message`, `idempotency_outcome`, and `units_charged`. Fallback and safety copy are the accepted T240 copy; technical errors contain no assistant text.
- Founder-window success remains synthetic and not persisted with zero units. This is deliberately separate from T240 atomic member success.

## Separate authority still required

One 15-minute, single-use `FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY` receipt must name the sealed review package and the 12 ordered fixture IDs. A later reviewed source change must wire that receipt into the existing `chat-synthetic` port. Normal `chat-message`, member sessions, threads, persistence, and units remain out of scope.

## Local product route

```bash
pnpm start:founder-live-chat -- --lan
```

This opens the real Chat product screen with deterministic local projections only. It is not live Azure evidence.
