# S2-T306 normal Chat and Companion integration candidate

## Boundary

This commit adds a source-only mobile/service adapter and server transaction
candidate. It does not import the adapter from `App.tsx` or `chat.ts`, does not
change signed Chat pixels, and does not connect `chat-message` to Azure or
`chat-synthetic`.

Admission fails before request parsing, authentication/database access, or
provider construction unless all of these are separately source-authorized:

1. both compile-time switches;
2. both server control switches;
3. a checksum-compiled, structurally closed final Dice Technical evidence
   envelope;
4. a checksum-bound Chat execution authority.

The current values are false/null. Runtime environment values cannot override
them. Current status remains exactly:

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`

## T240 behavior

- Completed and duplicate outcomes require server-owned UUIDv4 `thread_id` and
  one atomic outcome covering the user message, assistant message, unit ledger,
  and idempotency record.
- Safety, fixed fallback, and pure technical errors persist nothing and charge
  zero units.
- Technical errors contain no assistant text.
- The approved fixed fallback and safety redirect are exact constants.
- Mobile sends no chart, Persona, history, account/device identity, provider
  routing, endpoint, model, or credential fields.
- The server candidate accepts no raw logger. Its telemetry surface is closed to
  request ID, result, attempt count, duration bucket, error code, and 30-day
  retention metadata.

No route price or entitlement rule is introduced. `unitsToCharge` remains an
input from a future separately approved deterministic server policy.

## Founder mobile runbook

This is a candidate seam, not an activated Founder build.

1. Run `bash scripts/run-s2-t306-chat-integration-candidate-tests.sh`.
2. Run `node scripts/s2-t306-chat-readiness.mjs` and confirm the only next action is
   `WAITING_FOR_ACCEPTED_DICE_EVIDENCE_AND_CHAT_AUTHORITY`.
3. For future EN review, use a synthetic customer-like reflection such as
   “I keep postponing a difficult conversation. Help me reflect before I act.”
4. For future zh-Hant review, use a synthetic reflection such as
   “我一直拖延一場重要對話，可以陪我先整理自己的想法嗎？”
5. Verify safety, fallback, retry, and technical-error projections using the
   offline fixtures. Do not treat them as live AI results.

Normal Chat remains on its existing implementation. A later approved task must
bind accepted evidence, authorize traffic, and explicitly connect this service
seam before any product-path invocation can occur.
