# S2-T326 Chat/Companion product-path candidate

Status: `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY`.

## Product behavior

- Normal Chat keeps its existing route, presentation, persistence behavior, and service imports.
- Dice stays on Dice after interpretation. Chat opens only when the existing **Reflect in Chat** action is pressed.
- The handoff parser accepts the current question, exactly three displayed results, and the current interpretation. Automatic or augmented handoffs fail closed.
- The pre-login Founder route uses the existing branded Talk presentation for EN, zh-Hant, loading, response, safety, fallback, and retry fixtures. These are offline previews, not live AI.

## Runtime boundary

Mobile runtime accepts only `schema_version` plus one of two reviewed fixture IDs. Server admission requires accepted T317 Technical evidence, a separate default-off Chat deployment receipt, a separate single-use Chat traffic receipt, and a later reviewed source activation. Both mobile and server switches are `false`.

Completed/duplicate responses must satisfy T240 atomic outcome rules. Safety, fallback, and technical outcomes persist nothing and charge zero units. Provider secrets, raw envelopes, member context, thread history, and diagnostics never enter the mobile request.

## Founder test

```sh
bash scripts/start-s2-t326-founder-chat-expo.sh
```

1. Confirm the external strip shows the full current commit and offline fixture mode.
2. Review EN and zh-Hant prompts.
3. Submit and observe the existing thinking state.
4. Review response, safety, and fallback states; use Retry from fallback.
5. Treat all output as deterministic preview. No accepted live evidence exists.

Readiness:

```sh
node scripts/s2-t326-chat-readiness.mjs
```
