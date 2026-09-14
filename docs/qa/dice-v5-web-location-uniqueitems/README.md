# Web Dice v5 Location `uniqueItems` recovery evidence

## Runtime diagnosis

- Founder-tested URL: `http://127.0.0.1:8187/`
- Observed process: PID `35756`, `tools/internal-dice-ai-lab/server.mjs`
- Runtime `/api/status` source commit: `6db14e91ec0c2ddaf3502339a360292c86748fdf`
- Runtime source branch: `codex/s2-t359-dice-live-proof`
- Runtime source tree: `76eb0db04938958d24daa33813d3bdcfaa89e137`
- Accepted v5 ancestor: `e7edb0f0126b0d9e46ff97faafd00802a50689c2`
- Web entry point: `tools/internal-dice-ai-lab/server.mjs`
- Web v5 gateway: `createFounderDiceV05FreeTextGatewayClient` in `tools/internal-dice-ai-lab/founder-live-window.mjs`
- Backend: `dice-synthetic`
- Version selection: `x-lumis-dice-interpretation: v5`
- Prompt/schema labels: `lumis_dice_v0_3_prompt_v5` / `lumis_dice_interpretation_v5`

The running Web Lab checkout still contained provider-facing Location
`uniqueItems` in the evidence-array helper and `search_order`. It did not
contain the accepted compatibility correction.

## Recovery

The functional correction was recovered as commit
`71343cff52319858712544c5a9708c2364927019`. The reported `02873f9` is the
subsequent DREL provenance/release-record commit, not the functional change.
The recovered two-keyword source patch has stable patch ID
`188094a92bb31612e150e1cd965845d7cfff5f2f` and was reproduced on the exact
running Web Lab source base. Focused fixtures additionally prove that runtime
validation rejects duplicate Planet, House and Element evidence and duplicate
search-order entries.

## Scope

The provider-facing Stage-2 Location schema no longer includes `uniqueItems`.
All other bounds, enums, required fields and `additionalProperties` rules remain.
The final application result schema is unchanged. Runtime duplicate and exact
order validation remains. No other mode, routing rule, prompt, Location bank,
token cap, retry/deadline behavior, Mobile file, billing file or Azure setting
changed.

No provider call, deployment or merge was performed for this candidate.

## Verification

All commands exited `0`:

- `pnpm test:dice-v05`
- `pnpm test:dice-v05-web-lab`
- `pnpm check:dice-v05-edge`
- `pnpm typecheck`

The complete command output is stored in the adjacent `.log` files. The Web
Lab contract uses no provider calls. Local and mocked checks do not prove live
Azure acceptance; that requires reviewed deployment and a separately authorised
staging smoke test.
