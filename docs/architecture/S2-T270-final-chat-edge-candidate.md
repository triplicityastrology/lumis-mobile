# S2-T270 final Companion/Chat Edge candidate

## Boundary

This source-only candidate exposes only `chat-synthetic`. It does not modify or
import `chat-message`, accept member sessions, store prompts or responses, charge
units, or persist customer data. Migration 0040 stores only hashes, run metadata,
fixture claims, and 30-day retention timestamps behind service-role-only RPCs.

The function is default-off through `LUMIS_CHAT_AI_ENABLED=false`. Disabled mode
returns `CHAT_AI_DISABLED` before parsing the request or constructing Supabase or
Azure clients. No deployment, migration, credential use, or provider call was made.

## Later authority gates

1. Microsoft accepts the exact package binding in
   `config/s2-t270-chat-edge-final.json`.
2. Accepted Dice evidence must bind package
   `adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71`
   and record 80 Technical cases, 40 EN and 40 zh-Hant, zero Founder cases,
   provider disabled afterward, zero persistence, and zero units.
3. A separate single-use Chat authority binds that evidence, the exact gateway,
   registry, T240 schema, run ID, caps, and validity window.
4. Migration 0040 and default-off deployment require separate authorization.
5. Chat traffic remains prohibited until later explicit authority is accepted.

The adapter pins HTTPS to the verified Foundry hostname, deployment alias
`lumis-ai-chat-stg`, and stable `v1` Responses route. It does not use preview or a
legacy date-formatted API version. DefaultV2 blocks and partials project to the
approved zero-effect safety result.

Run `pnpm test:s2-t270-chat-edge-final`. The wrapper test injects an in-memory RPC
ledger and fetch emulator and makes no network request. It also compiles the Edge
entry, resolves real `js-tiktoken@1.0.21` through the Deno import map, checks the
bundle, and verifies every sealed source hash.
