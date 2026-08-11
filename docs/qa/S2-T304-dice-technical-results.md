# S2-T304 Dice Technical 80-case runner and results

This package prepares the first Technical Dice AI review window. It runs exactly 80 allow-listed fixtures: 40 English and 40 Traditional Chinese. Founder fixtures are excluded.

The live path remains inert unless three independently accepted receipts validate in order: the v4 post-deployment disabled receipt, the separately scoped migration 0039 receipt, and the single-use `DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY` traffic receipt. The local command constructs no network or provider client.

Limits are enforced at the evidence boundary: at most 160 provider attempts, concurrency 2, one eligible retry, a shared 12-second fixture deadline, real `o200k_base` counts capped at 800 input and 300 output tokens, and USD 0.128 maximum estimated cost. Any cap, malformed result, exhausted retry, or post-run disable failure returns its action-specific kill code. Safety and excluded-scope outcomes remain valid zero-effect results.

The durable journal records an attempt before dispatch. Completed attempts are never repeated. A dispatch with no accepted evidence is ambiguous and requires review, avoiding an accidental second charged attempt. Disable runs in `finally` and success is impossible unless the disabled state is independently observed afterward.

The Founder review contains fixture IDs, language, result/failure class, latency/attempt/token buckets, five 1-5 ratings, and concise failed/weak lists. It contains no question text, prompt, response, identity, provider diagnostics, URL, key, member context, units, or persistence data.

Run the complete zero-network rehearsal:

```sh
pnpm dice:t304:rehearsal
```

Check the first missing future gate without constructing a client:

```sh
pnpm dice:t304:status
```

Generated rehearsal artifacts are local-only under `.tmp/s2-t304-emulator/` and are not live Azure proof.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
