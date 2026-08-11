# S2-T267 Dice Edge release candidate

Status: `SOURCE_READY_DEFAULT_OFF`

Authority remains:

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`

No deployment, migration application, provider call, credential use, staging mutation, unit charge, or member persistence occurred.

## Integrated path

`dice-synthetic/index.ts` creates the default-off Edge handler. Only the canonical `LUMIS_DICE_*` configuration names can pass source validation. A separately authorized request is then admitted by `DiceSyntheticGatewayPortV1`, consumed atomically through `consume_lumis_dice_synthetic_authority_v1` from migration 0039, executed against the closed 80-Technical registry, and projected as metadata-only evidence. The gateway disables provider access in `finally`.

The Azure boundary is pinned to the verified hostname, `lumis-ai-chat-stg`, `gpt-5-mini` version `2025-08-07`, GlobalStandard, NoAutoUpgrade, Microsoft.DefaultV2, and the documented `/openai/v1/responses` route family. A legacy date-formatted API version and preview routes are rejected.

## Tokenizer

The function-local `deno.json` maps `js-tiktoken` to exact runtime dependency `npm:js-tiktoken@1.0.21`. The handwritten tokenizer implementation stub was removed. Offline verification loads the real locked package, confirms the `o200k_base` token IDs, and checks the pnpm integrity record. A machine with Deno can additionally run:

```sh
deno check --config supabase/functions/dice-synthetic/deno.json supabase/functions/dice-synthetic/index.ts
```

The current machine did not provide a Deno executable, so that optional native Deno command was not claimed. The function graph, import map, actual package, TypeScript Edge graph, and generated Edge bundle contract were verified locally.

## Verification

```sh
pnpm test:s2-t267-dice-edge-final
pnpm typecheck
pnpm test:pii
git diff --check
```

The wrapper integration uses an injected, network-disabled provider transport and an RPC-compatible atomic ledger emulator. It proves the full wrapper-to-port-to-ledger path, exact 80-case scope, one durable authority row, replay denial before a second provider run, metadata-only evidence, and provider disablement.

## Remaining gate

The next action is Microsoft review of the exact T267 package seal followed by a separately authorized default-off migration/deployment window. This commit itself grants neither deployment nor Azure traffic authority.
