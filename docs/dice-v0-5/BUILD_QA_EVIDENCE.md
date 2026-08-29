# Dice v5 build — QA evidence

Technical build of "Dice AI Interpretation Prompt v3" (technical identity
`lumis_dice_v0_3_prompt_v5` / `lumis_dice_interpretation_v5`), implemented
**exactly** from the controlling `DICE_PROMPT_V3_TECHNICAL_PROPOSAL_REV4_2_FINAL.md`
(the proposal folder `docs/qa/dice-prompt-v3/` is retained untracked, per Founder
instruction, and is **not** committed).

Deployment is **withheld**: nothing here deploys to Supabase/Azure/Foundry. This
is the Web-first build plus automated QA evidence for Founder review before any
production-enable decision.

## 1. What was built (Add / Modify)

**Added — v5 engine + fixtures (`supabase/functions/`):**
- `_shared/dice-v0-5-fixed-data.ts` — controlled tables: planet nature/speed/traits/essence,
  essential dignity (`dignityOf`, Appendix A precedence), houses (fortune/rank/speed/distance/essence),
  sign→element, 12-sign essence (Appendix H verbatim for Libra/Virgo/Sagittarius), element
  places, v5 combined-pace matrix (Founder Decision A: `slowest × fast = medium`), the
  complete Location Planet/House banks, and the §12.0 controlled landing label table.
- `_shared/dice-v0-5-interpretation-contract.ts` — single-English-block prompts (§11,
  byte-exact token sizes), strict `buildStage2Schema(mode,language)`, Stage-1/Stage-2 parsers,
  `validateLandingIdentity` (§12.0), `validateLocation` (§16), route-review literals, and the
  secondary leak heuristics (timing Level-1 + date leak; Location dignity/fortune leak).
- `_shared/dice-v0-5-presentation.ts` — `given`-envelope builders, the system assembler
  (`lumis_dice_interpretation_v5`), short-key→global-id expansion, and the §18 presentation.
- `_shared/dice-v0-5-window.ts` — two-stage orchestration (Stage-0 hard gates → Stage-1
  mode select → Stage-2 interpretation → assembler), landing validation before Stage 2,
  Location structural gate, metadata-only outcomes; the provider adapter is injected (testable).
- `_shared/azure-dice-adapter-v5.ts` — Azure Responses API strict-Structured-Outputs adapter
  (same reviewed deployment identity as v1/v4), returning the window's result union.
- Fixtures: `dice-v0-5-{routing,judgment,timing,location,level1,schema,length,privacy,tokenizer}.fixtures.ts`
  and `dice-synthetic/founder-window-edge-v5.fixtures.ts`; test tsconfig `tsconfig.dice-v0-5-test.json`.

**Modified:**
- `dice-synthetic/edge-handler-v1.ts` — header gate: `x-lumis-dice-interpretation: v5` → v5
  route; `=== "v4"` → `DICE_INTERPRETATION_VERSION_UNSUPPORTED`; **no header** → v3 default
  unchanged. v4 window/adapter imports replaced by v5.
- `tools/internal-dice-ai-lab/server.mjs` + `founder-live-window.mjs` — Web Lab v5 toggle/route,
  v5 gateway client (`x-lumis-dice-interpretation: v5`), v5 render for all modes incl.
  `most_likely_area`, ranked candidates in `location_search_order`, `location_extension`, and
  metadata-only export (`redactV05Metadata`, units/persistence = 0).
- `scripts/internal-dice-ai-lab-contract.mjs` — Web Lab contract migrated to v5 rendering.
- `package.json` — `test:dice-v05`, `test:dice-v05-web-lab`.
- `dice-synthetic/index.ts` — no change required (v5 reuses the existing env/config wiring).

## 2. Automated test evidence — ALL MOCKED (no live provider calls)

Run: `npm run test:dice-v05` and `npm run test:dice-v05-web-lab`.

| Suite | Coverage | Result |
|---|---|---|
| judgment | Appendix H.2/H.3 assembled deep-equality, RR literal, Node rule, cap/array rejections | PASS |
| timing | v5 matrix (Test 7 = medium, Test 8 = fast), Appendix H.4/H.5, Level-1 & watch caps | PASS |
| location | `validateLocation` §16 valid + 10 negatives, gid expansion, assembler | PASS |
| routing | Stage-1 pairing (all modes), route-review, mismatch/enum/extra-key rejections | PASS |
| level1 | Appendix H.7/H.8/H.9 envelope + assembled equality, element-direction leak | PASS |
| schema | `buildStage2Schema` shapes/caps, landing identity, RR mode-specificity, §12.4 key contract, SC-18/SC-19 leaks | PASS |
| length | per-mode/language char-cap boundaries, followup counts, complete-input structure | PASS |
| tokenizer | **production `js-tiktoken@1.0.21` / o200k_base** (see §3) | PASS |
| privacy | metadata-only outcomes, call accounting 0/1/2, units 0 / persistence 0, no raw text | PASS |
| founder-window-edge | per-mode two-stage orchestration, Location §16 gate, provider accounting | PASS |
| Web Lab contract | v5 judgment/timing/location rendering, toggle/route, metadata-only | PASS |

## 3. Production-tokenizer check (o200k_base via `js-tiktoken@1.0.21`)

Same encoder as the runtime `_shared/dice-tokenizer-v1.ts`. Measured this session:

**Static prompt blocks — exact match to §11:** Stage-1 322, Judgment 464, Timing 437,
Location 577, Level-1 311 (all EXACT — proves the block text is byte-faithful).

**Complete provider inputs (block + delimiter + envelope JSON) ≤ 1600:** judgment 682/707,
timing 582/584, level1 481/498, location 969/1056 (en/zh) — all within cap.

**Cap-saturated Stage-2 outputs at zh density (1 token/char, the binding bound):** judgment 517,
timing 293, level1 398, **location 574→557 ≤ 580** — F1 closed by construction (Founder Decision B).

## 4. Founder-decision conformance

- **Decision A** — v5 combined-pace matrix cell `slowest × fast = medium` (Pluto/House-1);
  differs from the shared v3 `combinedPace` helper ONLY at that cell; **the v3 helper is not edited**.
- **Decision B (F1 closed)** — single root `extension` object, evidence arrays 0–2 unique keys,
  every candidate cites ≥1 direct key, rank-1 cites ≥1 planet key, structured `search_order`;
  Location output ≤ 580 by construction; zh synthesis cap 110→100.

## 5. Surfaced conflicts (NOT silently resolved)

1. **CONFLICT-L1R (dignity of Saturn-in-Virgo).** Appendix H.8 and §20.4A row L1-R print
   `dignity_strength: "weak"`, but the settled deterministic dignity rule (Appendix A +
   `dignityOf`, "model never authors dignity") yields `neutral` — Saturn has no classical
   dignity/debility in Virgo. The build keeps the **settled deterministic rule** (`neutral`);
   the level1 fixture asserts the deterministic value and normalises the printed literal. This
   field never reaches the final output (it only colours prose), so the build is not blocked.
   **Needs Founder ruling** if the examples' "weak" was intended over the dignity table.

2. **v4 physical deletion deferred.** §24 lists deleting 11 v4 files. The runtime retirement
   is already achieved (the edge answers a v4 header with `DICE_INTERPRETATION_VERSION_UNSUPPORTED`
   and no longer imports the v4 window/adapter). The physical deletion cascades into release
   tooling that §24's "modify 5" list does **not** enumerate — `package.json` v4 test scripts,
   `scripts/s2-t289-*`/`s2-t290-*` contracts, `config/s2-t289-…manifest.json`, and
   `apps/mobile/tsconfig.founder-ai-review-test.json` all reference the v4 files. Deleting without
   updating those would break the `pnpm test:*` chain. Deferred and surfaced for Founder direction.

3. **Mobile v5 deferred** (production blocker, per the proposal): `diceLiveResultAdapter.ts`
   and `diceCustomerInterpretationController.ts` are not migrated in this Web-first pass.

## 6. Known gaps / not performed

- **No live provider run.** All evidence above is mocked or local tokenizer measurement. Live
  staging (deployed-commit + prompt/schema identity from the running Edge, per-mode smoke ×EN/zh,
  Tests 5/6/7/8/12, Founder scoring) is specified in §25 and **not performed** — it needs deploy
  credentials and a provider-enable window, which are withheld.
- No deployment to Supabase/Azure/Foundry.
