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
- `_shared/dice-v0-5-question-gate.ts` — **v5-specific Stage-0 question-boundary gate**
  (`classifyDiceV05QuestionRequest`) that WRAPS the shared v3 classifier without editing it:
  it adds the appended-second-question (bundled) case the v3 gate misses (RT-17), accepts a single
  judgment restated as an evaluative either/or instead of rejecting it as two choices (RT-18), and
  accepts a meaningful-but-ambiguous question so Stage-1 can route-review it instead of rejecting it
  as unclear (RT-19). The v3 module and v3 behaviour are untouched.
- `_shared/dice-v0-5-presentation.ts` — `given`-envelope builders (lossless compact wire encoding:
  related/element places as `{code:text}` maps), the system assembler (`lumis_dice_interpretation_v5`),
  compact-code→global-id expansion, and the §18 presentation.
- `_shared/dice-v0-5-window.ts` — two-stage orchestration (Stage-0 hard gates via the v5 gate →
  Stage-1 mode select → Stage-2 interpretation → assembler), landing validation before Stage 2,
  Location structural gate, the final-result validator (route-review closed-envelope enforced),
  metadata-only outcomes; input cap 1600 (Location Stage-2: 1800) / Location output cap 580; the
  provider adapter is injected (testable).
- `_shared/azure-dice-adapter-v5.ts` — Azure Responses API strict-Structured-Outputs adapter
  (same reviewed deployment identity as v1/v4), returning the window's result union.
- Fixtures: `dice-v0-5-{routing,judgment,timing,location,level1,schema,length,privacy,tokenizer,adapter}.fixtures.ts`
  and `dice-synthetic/founder-window-edge-v5.fixtures.ts`; test tsconfig `tsconfig.dice-v0-5-test.json`
  (also compiles `dice-v0-5-question-gate.ts`, `azure-dice-adapter-v5.ts` + the adapter fixture).

**Modified:**
- `dice-synthetic/edge-handler-v1.ts` — header gate: `x-lumis-dice-interpretation: v5` → v5
  route; `=== "v4"` → `DICE_INTERPRETATION_VERSION_UNSUPPORTED`; **no header** → v3 default
  unchanged. v4 window/adapter imports replaced by v5.
- `tools/internal-dice-ai-lab/server.mjs` + `founder-live-window.mjs` — Web Lab v5 toggle/route,
  v5 gateway client (`x-lumis-dice-interpretation: v5`), v5 render for all modes incl.
  `most_likely_area`, ranked candidates in `location_search_order`, `location_extension`, and
  metadata-only export (`redactV05Metadata`, units/persistence = 0).
- `scripts/internal-dice-ai-lab-contract.mjs` — Web Lab contract migrated to v5 rendering.
- `package.json` — `test:dice-v05` (now includes the adapter fixture), `test:dice-v05-web-lab`,
  `check:dice-v05-edge` (CI Deno type-check); the six retired `test:dice-v04*` scripts removed.
- `dice-synthetic/index.ts` — no change required (v5 reuses the existing env/config wiring).

**Deleted — v4 edge runtime retired (9 of the §24 delete-11; see §5 item 2):**
- `_shared/azure-dice-adapter-v4.ts`, `_shared/dice-v0-4-interpretation-contract.ts` (removes the
  `parseDiceV04Output` permissive parser), `_shared/dice-v0-4-window.ts`,
  `_shared/dice-v0-4-presentation.ts`, the four `_shared/dice-v0-4-*.fixtures.ts` shared fixtures,
  and `dice-synthetic/founder-window-edge-v4.fixtures.ts`.
- The five `supabase/tests/*v4*.schema.json` audit records are **retained** (Founder decision §8.4).
- The two `apps/mobile/src/dev/` v4 dev fixtures are **deferred** (Mobile-surface cascade; §5 item 2).

## 2. Automated test evidence — DETERMINISTIC / STRUCTURAL, ALL MOCKED (no live provider calls)

These fixtures verify the deterministic contract (routing gates, schema shapes, caps, assembly,
traceability, token budgets) with mocked provider responses. Every deterministic §20 mismatch is a
**fail-fast** assertion — there are no non-fatal "findings". They are **not** a substitute for
semantic quality acceptance: whether a real model writes a good Timing/Location/Judgment reading is
a **live-QA** judgement (§6, pending). Run: `npm run test:dice-v05` and `npm run test:dice-v05-web-lab`.

| Suite | Coverage | Result |
|---|---|---|
| judgment | Appendix H.2/H.3 assembled deep-equality, RR literal, Node rule, cap/array rejections, blended-grade rejection | PASS |
| timing | v5 matrix (Test 7 = medium, Test 8 = fast) + full 15 cells, Appendix H.4/H.5, band-only (TM-02b) rejection, **TM-08 Jupiter/Sagittarius vs Jupiter/Gemini** (same band, dignity differs) | PASS |
| location | `validateLocation` §16 valid + 10 negatives, compact-code→gid expansion (permanent, order-independent), assembler, all 12 planets/houses + 4 elements complete | PASS |
| routing | **v5 gate: all 19 RT rows fail-fast** (RT-17 bundled, RT-18→judgment, RT-19→route_review); **Test 6 through the REAL gate (0 provider calls)**; Stage-1 pairing, route-review, mismatch/enum/extra-key rejections | PASS |
| level1 | Appendix H.7/H.8/H.9 envelope + assembled equality, element-direction leak, Saturn/Virgo neutral, SIGN_BANK source-check | PASS |
| schema | `buildStage2Schema` shapes/caps, landing identity, RR mode-specificity, §12.4 key contract, **route-review closed-envelope negatives (12)**, SC-18/SC-19 leaks | PASS |
| length | per-mode/language char-cap boundaries, followup counts, complete-input structure | PASS |
| tokenizer | **production `js-tiktoken@1.0.21` / o200k_base** (see §3) | PASS |
| privacy | metadata-only outcomes, call accounting 0/1/2, units 0 / persistence 0, no raw text | PASS |
| founder-window-edge | per-mode two-stage orchestration, Location §16 gate, provider accounting | PASS |
| adapter | `createDiceV05Adapter` Azure Responses request shape (strict Structured Outputs: `json_schema`/`strict`/schema name, `reasoning.effort`, `store`, `text.verbosity`) + full HTTP/provider status mapping (200/401/403/429/500/400/incomplete/content_filter/throw→network/abort→timeout/past-deadline) via mocked `fetch` | PASS |
| Web Lab contract | v5 judgment/timing/location rendering, toggle/route, metadata-only; **Test 6 driven through the REAL compiled window → exact zh bundled copy, 0 provider calls** | PASS |

**Edge handler & adapter coverage (reviewer item 13).** The v5 Azure adapter
(`_shared/azure-dice-adapter-v5.ts`) is compiled into the v5 test surface and integration-tested by
`dice-v0-5-adapter.fixtures.ts` above (mocked `fetch`, no network). The modified Edge handler
(`dice-synthetic/edge-handler-v1.ts`) is Deno source; its v5 wiring is executable-tested here at the
seam via the `founder-window-edge` suite (the two-stage window it invokes) plus the adapter suite
(the provider client it constructs), and a Deno type-check `npm run check:dice-v05-edge` is provided
for CI. That Deno check is **not runnable in this offline node session** (no `deno` binary;
`deno.land` is proxy-blocked), so it is a CI acceptance gate, not local evidence.

## 3. Production-tokenizer check (o200k_base via `js-tiktoken@1.0.21`)

Same encoder as the runtime `_shared/dice-tokenizer-v1.ts`. Measured this session:

**Static prompt blocks — exact match to §11:** Stage-1 322, Judgment 464, Timing 437,
Location 577, Level-1 311 (all EXACT — proves the block text is byte-faithful).

**Complete provider inputs — non-Location modes ≤ 1600 (unchanged cap):** judgment 680/705,
timing 579/581, level1 478/495 (en/zh) — all within 1600.

**Location input — genuine worst case, exhaustively measured (reviewer item 3).** The Location
Stage-2 input carries the COMPLETE Planet + House + Element banks (all context hints) plus a
full-length 280-code-point question, so its input cap is **1800** (Founder-approved; all other
modes stay 1600). Every Planet × House × Sign/Element combination in both languages was measured
with a genuine maximum-length question (sign enters only via its element, proven, so 4 element
representatives cover all 12 signs): the **actual worst case is 1668 tokens at
Mercury / House 12 / Air (gemini) / zh-Hant — 132 headroom to 1800**. Representative
Moon/Leo/House-4 input (no question) is 1085/1237 en/zh. The prior "1,420 ≤ 1,600" figure was
measured on a lighter, non-worst-case envelope and is **replaced** by this exhaustive measurement.
Nothing was trimmed and no question shortened; the lossless compact wire encoding (below) offsets
part of the growth.

**Cap-saturated Location OUTPUT ≤ 580 by construction (Founder Decision B, item 2).** Location
echoes **compact wire codes** (`pt`/`px`/`ht`/`hx`, `p01`/`h03`/`e02`) rather than long slugs, and
the schema bounds each evidence key to ≤ 3 chars. The schema-permitted **pathological maximum**
(4 candidates × 2 codes in all 3 arrays + every field at cap) = **zh 574 / en 381 — both ≤ 580**.
The single 580 is the provider `max_output_tokens`, the runtime output measurement limit, and the
rejection backstop (no 600/700 split). Other cap-saturated outputs: judgment 517, timing 293,
level1 398 (≤ 600).

## 4. Founder-decision conformance

- **Decision A** — v5 combined-pace matrix cell `slowest × fast = medium` (Pluto/House-1);
  differs from the shared v3 `combinedPace` helper ONLY at that cell; **the v3 helper is not edited**.
- **Decision B (F1 closed)** — single root `extension` object, evidence arrays 0–2 unique keys,
  every candidate cites ≥1 direct key, rank-1 cites ≥1 planet key, structured `search_order`;
  zh synthesis cap 110→100. **Location output ≤ 580 by construction** (`LOCATION_OUTPUT_CAP = 580`):
  compact wire codes (`p01`/`h03`/`e02`, keys bounded to ≤ 3 chars by the schema) keep the
  schema-permitted pathological maximum at zh 574 / en 381 (§3). The stable semantic global ids the
  reader sees (`planet.moon.related.family_home`) are recovered server-side from the compact code by
  a permanent, bank-position-derived mapping — never dependent on the model's echo order.

## 5. Surfaced items

1. **Saturn-in-Virgo dignity — settled (documentation typo, corrected).** Saturn has no
   rulership, exaltation, fall or detriment in Virgo, so the deterministic rule (Appendix A +
   `dignityOf`, "model never authors dignity") yields **`neutral`**. The earlier `dignity_strength:"weak"`
   in Appendix H.8 and §20.4A row L1-R was a documentation typo; it has been **corrected to `neutral`**
   in the proposal examples and the fixtures. The implementation was already `neutral`; no code change
   and **no Founder astrology ruling is required**. (This field colours prose only in Level-1 and never
   reaches the final output object.)

2. **v4 physical deletion — edge runtime done (9 of 11); 2 Mobile-dev fixtures deferred with a
   concrete plan.** §24 lists deleting 11 v4 files. The **9 edge-runtime files are now physically
   deleted** on this branch: `azure-dice-adapter-v4.ts`, `dice-v0-4-interpretation-contract.ts`
   (removes the `parseDiceV04Output` permissive parser — the §23 safety goal), `dice-v0-4-window.ts`,
   `dice-v0-4-presentation.ts`, and the four `dice-v0-4-*.fixtures.ts` shared fixtures +
   `dice-synthetic/founder-window-edge-v4.fixtures.ts`. Their only surviving references were the six
   `test:dice-v04*` Deno scripts in `package.json` (a §24 "modify 5" file), which are removed in the
   same change. The edge already imports only the v5 adapter/window and answers a v4 header with
   `DICE_INTERPRETATION_VERSION_UNSUPPORTED`, so the v4 permissive parser is now unreachable **and**
   physically gone. No dangling reference remains (verified by tree-wide grep); the full v5 node
   suite + Web-Lab contract stay green after the deletion.

   The remaining **2 files are `apps/mobile/src/dev/` Mobile-dev fixtures** —
   `diceV4TechnicalEvidenceFixture.ts` and `founderDiceV4WindowContract.fixtures.ts` — and are
   **deferred**, because completing their deletion is a Mobile-surface change (explicitly out of
   scope for this Web-first pass) whose cascade exceeds §24's enumerated modify-5:
   - `diceV4TechnicalEvidenceFixture.ts` is consumed by a **third Mobile file not in the §24 list**,
     `apps/mobile/src/dev/FounderDiceV4TechnicalEvidenceDashboard.tsx`, and by the **s2-t289 release
     seal** apparatus — `config/s2-t289-dice-v4-technical-window-manifest.json`,
     `scripts/s2-t289-refresh-package-seal.mjs`, `scripts/s2-t289-dice-mobile-evidence-contract.mjs`.
     That s2-t289 tooling produces/validates the s2-t289 **post-deploy-disabled audit receipt whose
     schema §24 explicitly RETAINS**, so gutting it would be at odds with the retain-5 decision.
   - `founderDiceV4WindowContract.fixtures.ts` is compiled by
     `apps/mobile/tsconfig.founder-ai-review-test.json` and chained through the `test:s2-t290-*` →
     `test:s2-t295-*` scripts, and its non-fixture partner `founderDiceV4WindowContract.ts` is **not
     in the §24 delete list**, so deleting only the fixture would orphan a file the plan keeps.

   **Revised retirement plan for these 2 (for approval before it is executed):** in a dedicated
   Mobile pass, delete both dev fixtures **plus** the orphaned `founderDiceV4WindowContract.ts` and
   `FounderDiceV4TechnicalEvidenceDashboard.tsx`; drop the four v4 `include` entries from
   `apps/mobile/tsconfig.founder-ai-review-test.json`; unchain `test:s2-t290-founder-dice-v4` (and
   its `test:s2-t295-*` caller) from the deleted fixture; and decide, with the Founder, whether the
   s2-t289 seal manifest + scripts are retired alongside the runtime **or** retained as historical
   audit tooling next to the retained s2-t289 schema. Not executed here — it edits Mobile and
   retained-audit tooling, both outside this branch's stop line.

3. **Correction-pass changes (this round).**
   - **v5 Stage-0 question gate** (`dice-v0-5-question-gate.ts`) resolves the three settled §20.1
     divergences the reused v3 classifier produced (RT-17 bundled, RT-18 → judgment, RT-19 →
     route_review) **without editing the v3 classifier**. All 19 RT rows are now fail-fast; the
     earlier non-fatal "findings" mechanism is removed.
   - **Location output ≤ 580 by construction** restored via compact wire codes (the unauthorised 700
     backstop is gone); the Location provider limit, runtime limit and backstop are all 580.
   - **Location Stage-2 input cap raised 1600 → 1800 (Founder-approved this round; all other modes
     stay 1600).** The genuine worst case, measured exhaustively over every Planet × House ×
     Sign/Element in both languages with a full 280-code-point question, is **1668 (Mercury/House
     12/Air/zh), 132 headroom** — no controlled content trimmed, no question shortened.
   - **Route-review final envelope is now fully closed**: the validator requires every content field
     null and `suggested_followups` exactly `[]` before returning OK (12 negative tests).
   - **Acceptance evidence corrected**: Test 6 runs the exact bundled question through the REAL gate
     (0 provider calls, exact bundled copy); TM-08 is Jupiter/Sagittarius vs Jupiter/Gemini (same
     band, dignity differs); deterministic §20 mismatches all fail-fast.

4. **Mobile v5 deferred** (production blocker, per the proposal): `diceLiveResultAdapter.ts`
   and `diceCustomerInterpretationController.ts` are not migrated in this Web-first pass.

## 6. Known gaps / not performed

- **No live provider run.** All evidence above is mocked or local tokenizer measurement. Live
  staging (deployed-commit + prompt/schema identity from the running Edge, per-mode smoke ×EN/zh,
  Tests 5/6/7/8/12, Founder scoring) is specified in §25 and **not performed** — it needs deploy
  credentials and a provider-enable window, which are withheld.
- No deployment to Supabase/Azure/Foundry.
