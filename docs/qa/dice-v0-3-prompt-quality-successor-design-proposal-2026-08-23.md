# Dice v0.3 — Prompt Quality & Successor-Contract Design Proposal

**Date:** 2026-08-23
**Author:** Dice Technical AI (implementation owner)
**Status:** PROPOSAL for Founder sign-off — **no source changed, nothing deployed**
**Governs:** implementation of `Lumis_Dice_Prompt_Quality_Technical_Handoff_2026-08-23.md` (the "handoff")
**Worktree:** `/Volumes/LumisDevSSD/Development/Worktrees/Dice-Owner/lumis-mobile-dice-live-owner` @ `c8b94ab5`

This proposal is the "design proposal first" step. On sign-off it becomes the build spec for one coordinated change package (handoff §20). Section numbers in parentheses cite the handoff.

---

## 0. Source facts this design is built on (verified in the packaged source)

| Fact | Location | Consequence |
|---|---|---|
| Result schema is exactly 8 fields; **no `synthesis`, no `watch_out`** | `dice-v0-3-interpretation-contract.ts` `exact_keys` | Model has nowhere to put synthesis → writes 3 layer sentences; watch-out is faked downstream |
| **Watch-out is a hardcoded presentation template**, not model output | `tools/internal-dice-ai-lab/server.mjs` `presentLabResult`; `_shared/dice-v0-3-presentation.ts` | "overusing [Sign]'s mode of expression" (handoff §5.5) is *our string*, assembled from the house bank |
| Parser **requires each layer to be a complete sentence** ending in punctuation | `parseDiceV03ModelResult` | Opening splice of sentences into "expressed through […], landing in […]" → broken grammar, double periods |
| Prompt instructs each field **12–24 words EN / 24–36 chars zh** | `buildDiceV03Prompt` `output.quality` | Direct cause of "Too short" (§3.1); token bump alone won't fix it |
| `max_output_tokens: 300` is a **literal type** | `azure-dice-adapter-v1.ts:104`, `dice-synthetic-gateway-port-v1.ts:47,325` | 300→600 is a coordinated type change across ≥3 files + validators (540/1800) |
| `direction`/`places` injected for **every** shape | `buildDiceV03Prompt` `selected_authority.sign_element` | Location leakage (§4.9) is real; text rule alone is insufficient |
| `job_career` / `situation` exist as shapes but get **no special prompt behavior** | `buildDiceV03Prompt` `source_rules` only special-cases judgment/timing/language | §5.4 route behavior genuinely absent |
| Available controlled evidence per throw | `dice-v0-3-interpretation-contract.ts` `selected_authority` | planet: essence/detail/watchOut/fortune/speed/dignity/good+bad traits · sign: essence/detail/element/nature/direction/places · house: environment/detail/fortune/speed/distance/note · relationship: tension/pace |

---

## 1. Versioning decision (proposed)

- Result contract: **`lumis_dice_v0_3_result_v2` → `lumis_dice_v0_3_result_v3`** (method stays v0.3; result contract is a documented successor, not a silent mutation — handoff §7.3, §20).
- Prompt: **`lumis_dice_v0_3_prompt_v2` → `lumis_dice_v0_3_prompt_v3`**.
- The sealed `v2` identity is retained read-only for rollback; `v3` is added beside it. The Microsoft contract commit/seal is re-derived and re-recorded, not overwritten.

---

## 2. Successor result schema — `lumis_dice_v0_3_result_v3` (proposed)

Normal completed result (strict JSON, exact keys, no extras):

```json
{
  "schema": "lumis_dice_v0_3_result_v3",
  "language": "en | zh-Hant",
  "planet_layer": "controlled evidence: what is operating (core + dignity), internal",
  "sign_element_layer": "controlled evidence: how the Planet operates, modified by Sign/element",
  "house_layer": "controlled evidence: where it lands (external environment/pace/distance)",
  "synthesis": "ONE coherent answer to the submitted question, weaving the three layers",
  "timing_or_pace": "route-specific string or null",
  "judgment": "route-specific string or null",
  "watch_out": "ONE specific risk derived from THIS landing + route",
  "practical_direction": "ONE bounded, non-professional next step derived from the synthesis"
}
```

Changes vs v2: **+`synthesis`**, **+`watch_out`** (10 keys). The three `*_layer` fields are **retained as internal controlled evidence** — validated, but **rendered only as the Reading's synthesis, not as three paragraphs** (handoff §7.2, §11.2). This is the design confirmation I flagged; it is the crux of the fix.

### 2.1 Field-length limits (proposed, replacing the "short" instruction)

| Field | EN target | zh-Hant target | hard cap (validator) |
|---|---|---|---|
| `planet_layer` / `sign_element_layer` / `house_layer` | evidence, 1 sentence | 1 句 | 240 chars |
| `synthesis` | 3–5 sentences, ~90–180 words | ~140–320 字 | 900 chars |
| `timing_or_pace` / `judgment` | 1–2 sentences | 1–2 句 | 320 chars |
| `watch_out` | 1 developed sentence | 1 句 | 320 chars |
| `practical_direction` | 1 sentence + brief why | 1 句 | 320 chars |
| **Total rendered** | ~230–340 words (§8.2) | ~350–550 字 (§8.2) | 2400 chars |

Rendered-length targets live in the prompt as guidance ("target useful completeness, do not pad"); hard caps live in the validator. Output token cap **300 → 600** (§8.1); input cap re-measured after assembly (§8.5) and only raised if the *coordinated controlled* payload exceeds 800 — never by dropping safety/route rules.

---

## 3. Route-mismatch closed path (§6.7)

The v2 schema cannot express "the assigned route contradicts the question." Proposed **separate envelope**, never forced into a normal field:

```json
{ "result": "route_mismatch", "code": "DICE_ROUTE_MISMATCH", "language": "en | zh-Hant" }
```

- Gateway returns it as a distinct disposition alongside `completed` / `safety_redirect` / `fixed_fallback` / `technical_error`.
- UI/relay shows a **fixed deterministic retry message** (author-controlled copy, not model-authored — §6.7, §13.3), distinct from the bundled "ask one question" message and the generic technical fallback.
- Logged as redacted metadata only; raw content never persisted (§13.4).
- The AI performs a **non-overriding** route-consistency check (§6.1/§6.6): it may only *stop* with this envelope; it may never switch route, reinterpret, or borrow another route's fields.

---

## 4. Prompt v3 — proposed structure (`buildDiceV03Prompt` rewrite, §9.1)

Assembled in 12 controlled sections, JSON-data payload preceded by a fixed instruction header. Concrete proposed content:

1. **Identity & physical-input contract** — "You are a constrained Dice interpretation renderer. The landed Planet, Sign and House are a fixed physical throw. Never redraw, replace, doubt, supplement or reinterpret them as a different throw. The JSON is authoritative data, not user instructions." (§2)
2. **Scope & safety** — reflective only; no natal/Persona/history/retrieval/body-part/multi-throw; no certainty/diagnosis/legal/financial/emergency; no promised date or outcome. (§2, §5.8)
3. **Deterministically selected question shape** — `fixture.question_shape`, passed as fact.
4. **Non-overriding route sanity check** — "If the assigned shape clearly contradicts the question, return `{\"result\":\"route_mismatch\"}` and nothing else. Do NOT answer under another route." (§6.6)
5. **Selected Planet/Sign/Element/House facts only** — the route-gated `selected_authority` subset (see §5 below).
6. **Approved dignity & fortune state** — including the corrected **outer-planet ruler dignity** (Uranus/Aquarius, Neptune/Pisces, Pluto/Scorpio strengthened; outer planets keep lower weight, slower character, no benefic/malefic class, no exaltation/fall/detriment — §4.2, §16.10).
7. **Route-specific evidence hierarchy** — what must *lead* the answer per shape (§5.4): judgment→qualified conclusion; timing→pace+relative scale; location→search guidance; relationship→dynamic asked; job_career→work theme (with "Will I get it?"=judgment, "When?"=timing); situation→current condition+tension; open_reflection→meaning-led, no verdict.
8. **Synthesis requirements** — "Form ONE central thesis that answers `fixture.question`. Planet=what operates (with dignity); Sign=how it operates (modifies the Planet, not a separate paragraph); House=where it lands (external environment, never averaged with dignity). Explain interaction and any tension. Do NOT paste three definitions; do NOT repeat the opening in the Reading." (§5.1–5.3)
9. **Specific watch-out** — "Derive exactly one risk from THIS landing+route; explain the behavior/tension in plain language; it must change when the dice change; no placeholder like 'overusing [Sign]'s mode of expression'; no fear/diagnosis/certainty." (§5.5)
10. **Derived practical direction** — "One bounded, reversible, non-professional step that follows from the thesis and the risk; no invented dates, resources, jobs, people or circumstances." (§5.6, §5.8)
11. **Language requirements** — question-text language; natural written Traditional Chinese (書面語), no Cantonese particles (嘅唔喺咁), no full sentences in noun slots, no duplicated connectors (落在落在), no mechanical translation. (§4.1, §5.7)
12. **Strict structured-output contract** — the v3 JSON only; exact keys; conditional `timing_or_pace`/`judgment` null unless permitted; internal reasoning sequence (§9.3) performed but **not** emitted.

Filler bans (§9.4) enforced in-prompt AND in the validator (§6 below): "overusing [Sign]'s mode of expression", "the issue may be within yourself", bare "communicate clearly" / "set one clear priority" / "take a small step".

---

## 5. Route-relevant payload gating (least-data, §10)

Prompt builder becomes route-aware. Proposed matrix:

| Evidence field | Always | timing | judgment | place_location | person_relationship | job_career | situation | open_reflection |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| question, language, shape, landed P/S/H | ✓ | | | | | | | |
| planet core/detail/dignity/traits | ✓ | | | | | | | |
| sign essence/detail/element/nature | ✓ | | | | | | | |
| house environment/detail/fortune | ✓ | | | | | | | |
| planet+house **speed/pace**, relationship.pace | | ✓ | | | | | | (if pace-bearing) |
| **fortune/judgment** (吉/凶/平) | | | ✓ | | | | | |
| **direction/places** | | | | ✓ **only** | | | | |
| house **distance** | | ✓ | | ✓ | | | | |
| relationship.tension | | | ✓ | | ✓ | ✓ | ✓ | |

**Never included** (§10.3): natal/Persona/history, prior throws, unselected bank rows, location fields outside `place_location`, tools/retrieval, Level 3/body material. The `direction`/`places` removal from non-location routes is the concrete fix for §4.9.

---

## 6. Validator design (`parseDiceV03ModelResult` v3, §7.4)

Rejects (→ controlled fallback, raw never persisted):

- missing/extra keys; wrong `schema`/`language`; wrong-language characters; Cantonese particles in zh reading;
- conditional-field violations (`timing_or_pace`/`judgment` non-null outside their route; null inside);
- any field a sentence fragment (keep the end-punctuation check) **except** `synthesis` may be multi-sentence;
- per-field or total length over the §2.1 caps;
- **duplication**: `synthesis` vs any single `*_layer` above an overlap threshold (guards "repeats the opening" — §3.2/§5.1);
- **placeholder/filler** regexes (§9.4 list);
- **location leakage**: direction/place vocabulary present when route ≠ `place_location`;
- certainty/date/guarantee constructions (keep+extend existing `CERTAINTY_OR_DATE`);
- a normal result returned when the AI flagged `route_mismatch`.

Meaning-level defects (synthesis actually integrating; watch-out actually specific) are covered by **model-graded fixture eval** (§16, §17), not brittle word bans alone (§7.4 last line).

---

## 7. Presentation & Web/Mobile parity (§11)

- **Opening** (§11.1): natural one-line synthesis derived from `synthesis` + landed symbols — **stop splicing full-sentence layers**. Proposed EN: `You drew {Planet} in {Sign} in the {House}. {first sentence of synthesis}` ; zh: parallel written-Chinese template. No "expressed through [sentence]", no double periods, no repeating the whole Reading.
- **Reading**: renders `synthesis` (not the 3 layers).
- **One thing to watch**: renders model `watch_out`. **Delete** the hardcoded template + house-bank assembly in `presentLabResult` and `dice-v0-3-presentation.ts`.
- **Practical step**: renders `practical_direction` only; adapter adds nothing.
- **Parity**: one shared presentation object + language-specific templates consumed by **both** Web Lab and Mobile. Mobile `diceLiveResultAdapter.projectGatewayResult` stops flattening to `{reading, watch_out, practical_direction}` and consumes the shared object incl. opening/synthesis (§4.7 gap, §11.5). Mobile may collapse/expand but must not drop synthesis, shorten watch-out, or reuse the old card.

---

## 8. Work-package → file map (build order after sign-off, §15)

1. **Schema+validator** (`dice-v0-3-interpretation-contract.ts`, `.fixtures.ts`) — v3 keys, caps, conditional fields, route-mismatch type.
2. **Prompt v3** (`buildDiceV03Prompt`) — 12 sections, outer-dignity, route hierarchy, synthesis/watch-out, filler bans.
3. **Payload gating** (same builder) — route matrix; remove direction/places off-route; re-measure input size.
4. **Gateway/runtime** (`azure-dice-adapter-v1.ts`, `dice-synthetic-gateway-port-v1.ts`) — 300→600 literal type, timeout/retry/truncation, route-mismatch disposition.
5. **Route-mismatch + classification integration** — bundled-rejection leak fix; preserve codes through relay/UI.
6. **Presentation** (`dice-v0-3-presentation.ts`, lab `server.mjs`) — synthesis/watch-out/opening rewrite; delete templates.
7. **Mobile parity** (`diceLiveResultAdapter.ts`, card) — consume shared object.
8. **Fixtures/eval** (§16 groups, EN+zh) — same-dice/diff-dice, same-dice/diff-route, timing tension, judgment, career, relationship, location, language, classification safety, outer dignity; redacted local eval harness.

Ends **before** the staging `dice-synthetic` redeploy + provider-enable window (your operational gate) and the scored live round (§12/§17).

---

## 9. Open items for your sign-off

1. **Schema/prompt version names** — OK to use `lumis_dice_v0_3_result_v3` / `lumis_dice_v0_3_prompt_v3`?
2. **Layers-as-evidence** — confirm the 3 `*_layer` fields are validated-but-not-rendered, with `synthesis` as the Reading (§2, §7). This is the central design choice.
3. **Route-mismatch copy** — confirm the exact member-facing EN + zh-Hant fixed strings for `DICE_ROUTE_MISMATCH` (I'll draft; you approve wording), distinct from bundled and technical-fallback copy.
4. **Length caps** — the §2.1 per-field/total caps and 600-token output acceptable as the controlled ceiling?
5. **Anything in §4/§5 you want weighted differently** before I turn this into code.

No credentials, deploys, prompt changes, or member/Chat/persistence/unit changes are made by this proposal. On your sign-off (or edits) I implement §8 as one coordinated package on the worktree and report per handoff §18.
