# Companion — Founder Web AI Lab (INTERNAL, free-text multi-turn)

**This is an internal AI-testing interface. It is NOT the signed-off customer Chat UI and must not be represented as one.**

A **Founder-only** exploratory Companion experience for natural, multi-turn Azure AI testing on
**staging**. The Founder picks a chart (Sun/Moon/Mercury/Saturn) and a Lumis role, then has a normal
conversation — questions, statements, feelings, follow-ups, short replies, topic changes. Each turn
shows the selected role, the server-derived Chart Composition, a concise product-level classification
(safe to proceed / crisis-safety / out-of-scope / horoscope / professional boundary), and the final
Lumis response. It reuses the reviewed routing, persona/Chart-Composition, safety wording, prompt
pipeline, Azure deployment and response workflow. It performs **no customer billing and no member-state
mutation** and writes nothing to any customer table, unit ledger, or Supabase/Azure store.

**Persistence (Part 2, Founder-directed).** At explicit Founder direction the Lab now keeps a
**local, Founder-only test-record store** for scoring and review (see *Persistent testing sessions*
below). This deliberately reverses the Lab's original "no durable raw-conversation storage" boundary
— but only for **synthetic** test charts and Founder-entered test conversations, stored as local JSON
files on the dev machine, entirely separate from every customer data path. The content-free telemetry
stream is unchanged (dispositions and counts only; never message or chart text).

Conversation context is also held in the browser session (a bounded rolling context of ≤ 12 turns
plus the latest message). **New conversation** starts a fresh session; **End & archive session**
archives the saved test without deleting it; a separate **Delete** removes it after an explicit
confirmation.

The 12 frozen synthetic fixtures remain available as a **separate, optional Regression tests tab** —
not the main experience, not a limit on free-text testing, and not required before free text.

## What it reuses (T350 Normal Chat candidate)

The Lab does not re-implement routing/persona/templates. It reuses the reviewed modules from the
T350 candidate directly:

| Concern | Reused module |
|---|---|
| Deterministic route classification + decisions | `packages/shared/src/config/chat-router.ts`, `routes.ts` |
| Language rule (AC-AI-00 §1) | `packages/shared/src/config/app-language.ts` |
| Chart Composition (Persona Behaviour Mapping v1.2) | `packages/shared/src/config/persona-calculator.ts` |
| Reviewed persona prompt assembly | `supabase/functions/_shared/persona-prompt-pipeline-v1.ts` (+ `persona-behavior-v1.ts`) |
| Byte-exact fixed safety/scope wording v0.2 | `supabase/functions/_shared/fixed-template-registry.ts` |
| Server-side Azure identity + transport | `supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts` |
| Companion prompt-version literal | `supabase/functions/_shared/companion-synthetic-prompt-v1.ts` |

Lab-only code lives in `src/lab-*.ts` (orchestration, safety sub-classification, decision trace,
disposable response) + `public/*` (UI) + `test/*`.

## Authority

Follows, in order: Document Authority Map → AI Routing README → **AC-AI-00 v1.5** (canonical
routing/units/language/safety) → AC-AI-01/02/03 v1.2 (route taxonomy, telemetry privacy, charging
invariant) → **Fixed Template Wording Register v0.2** (byte-exact copy) → **Persona Behaviour
Mapping v1.2 + Reconciliation v0.3** (Chart Composition) → **S2-T23** (no birth time / no cusps /
no ASC). Archive/legacy material is not used as authority.

## Run

```
bash internal/companion-web-ai-lab/scripts/start-companion-web-ai-lab.sh
# then open  http://127.0.0.1:8410
```

The server binds to `127.0.0.1` only (loopback) and never to a LAN/public host; there is no host
override.

The provider is reachable only when **all** of the following hold; otherwise a turn still routes and
shows its Chart Composition + classification but makes **zero provider calls**:

1. `LUMIS_AI_ENABLED` is not `false` (immediate kill switch);
2. the executable-identity receipt at `LAB_IDENTITY_RECEIPT_PATH` verifies against the **clean**
   runtime worktree (commit + tree + source-complete package checksum + fixed bindings); and
3. the server-side Azure config is present (`LUMIS_CHAT_AI_ENABLED=true` + `LUMIS_CHAT_AZURE_API_KEY`).

The key is server-side only and never sent to the browser. There is **no** per-question or
900-second usage window and **no** 12-message cap on Founder free text — authorization binds the
running *executable identity*, not a per-turn quota.

To run against staging (server-side only):

```
export LUMIS_CHAT_AI_ENABLED=true
export LUMIS_CHAT_AZURE_API_KEY=<staging key>
export LAB_IDENTITY_RECEIPT_PATH=<path to the identity receipt>   # see "Executable-identity authorization"
bash internal/companion-web-ai-lab/scripts/start-companion-web-ai-lab.sh
```

## Test

```
bash internal/companion-web-ai-lab/scripts/test-companion-web-ai-lab.sh
```

Compiles then runs `test/lab-engine.fixtures.ts`, `test/lab-identity.fixtures.ts`,
`test/lab-conversation.fixtures.ts`, `test/lab-regression.fixtures.ts`,
`test/lab-azure-responses-adapter.fixtures.ts`, `test/lab-knowledge-bank.fixtures.ts`,
`test/lab-persona-voice.fixtures.ts` (Part 1 Character Voice Card), `test/lab-sessions.fixtures.ts`
(Part 2 persistence + Excel export) — all node:test — plus the loopback smoke test and the static
`scripts/companion-web-ai-lab-contract.mjs`.

## Executable-identity authorization (scope `FOUNDER_INTERNAL_CHAT_LAB_FREE_TEXT_STAGING`)

Microsoft, QA, Technical and the Founder superseded the fixture-first / 900-second design. Live AI is
now authorized by the **running executable identity**, not a per-question window:

- `src/lab-identity.ts` binds: the **final commit**, the **final Git tree**, a **source-complete
  package checksum** (sha256 over the tracked contents of `internal/companion-web-ai-lab`), the
  Founder-only reviewer, the staging environment, the fixed prompt/system version
  (`companion_synthetic_prompt_v1+persona_v1`), the Azure deployment identity, and the disable control
  `LUMIS_AI_ENABLED`.
- **No commit self-reference.** The immutable receipt is generated **after** the final commit exists;
  at runtime the server verifies the receipt's commit/tree/package against the **clean** runtime
  worktree **before** any Azure key or client is accessed.
- `authorizeProvider` order is: **kill switch → executable identity → server-side Azure config**. A
  wrong commit / tree / package, a dirty worktree, a tampered binding, a missing receipt, or
  `LUMIS_AI_ENABLED=false` each fails **before** provider construction (zero Azure access).
- The server only **loads and verifies** a receipt; it never mints one.

### Generate the identity receipt (operator, after the final commit)

```
LAB_IDENTITY_RECEIPT_PATH=/absolute/path/identity-receipt.json \
  node internal/companion-web-ai-lab/scripts/mint-identity-receipt.mjs
```

The generator refuses to run against a dirty worktree, writes the receipt to
`LAB_IDENTITY_RECEIPT_PATH`, and prints the bound commit / tree / package checksum. Point the server
at the same `LAB_IDENTITY_RECEIPT_PATH` to authorize the provider path.

## Routing states (distinct, per AC-AI-00 §2)

`crisis_imminent` · `distress_safety_check` · `illegal_boundary` · `professional_direct` ·
`out_of_scope` · `out_of_scope_solar_return` · `astro_timing_handoff` (explicit confirm; ≤3 dates) ·
`dice_handoff` (normal response + Go-to-Dice) · `casual` / `knowledge` / `astro_deep` (generative) ·
`route_unavailable` (provider disabled) · `router_unavailable` (provider failed after one retry) ·
`chart_unavailable` (Mercury required) · `technical_error` (malformed input, pre-provider).

## Endpoints

- `GET /api/lab/config` — non-secret config: roles, signs, languages, `max_context_turns`,
  provider readiness, kill-switch state, executable-identity status, model identity, regression list.
- `GET /api/lab/identity/status` — content-free executable-identity status.
- `POST /api/lab/conversation` — the main free-text, multi-turn turn:
  `{ schema_version:"companion_web_ai_lab_request_v1", role_code, chart{sun,moon,mercury,saturn,moon_confirmed}, message, app_language_preference, context:[{role,text}] }`.
- `POST /api/lab/regression` — one optional frozen fixture:
  `{ schema_version:"companion_web_ai_lab_regression_request_v1", fixture_id }`.
- **Part 2 (Founder-directed test record):**
  `POST /api/lab/session/new` (create) · `POST /api/lab/session/evaluate` (save per-response scores) ·
  `POST /api/lab/session/summary` (session comment + overall result) ·
  `POST /api/lab/session/archive` (archive without deleting) · `POST /api/lab/session/delete`
  (explicit delete) · `GET /api/lab/sessions` (list) · `GET /api/lab/session?id=` (one session) ·
  `GET /api/lab/export.xlsx[?ids=…]` (Excel workbook download). A conversation turn is persisted only
  when the browser opts in by sending a `session_id`.

## Basic natal Knowledge Bank (Founder-directed)

`src/lab-knowledge-bank.ts` grounds Lumis in the **person's own chart** using **planet-in-sign** facts
transcribed verbatim from the Founder-Approved controlled interpretation bank
(`Lumis_Knowledge_Bank_Founder_Interpretation_Bank_First_Controlled_Draft_2026-07-28.xlsx`, Signs +
Planets sheets). Nothing is invented — per KB Answer Rule ANS-01 only rows present in the approved
bank may be used. It honours the product's confirmed constraints (S2-T23 CI-02/CI-03: **no birth
time, no houses, no cusps, no ASC/DSC/MC/IC**), so the Lab retrieves planet-in-sign only; an
**unconfirmed Moon is suppressed, never inferred**; retrieval stays within the six-fact budget
(KB-TB-04); and composition follows ANS-02/05/06/07/12 (planet=what · sign=how, conditional
language, no whole-chart dump, no houses/timing, no Solar Return). The grounding is threaded into the
persona prompt for generative routes and returned as `knowledge_bank.facts`.

The `/api/lab/compose` "Calculate" endpoint and the per-message **"This message"** panel now show the
**full thinking process** end to end: (1) language, (2) routing & classification, (3) Knowledge Bank
facts, (4) the **Character Voice Card** (below), (5) provider, (6) model & prompt versions, (7) the
assembled prompt, shown block-by-block.

## Persona prompt assembly + Character Voice Card (Part 1, Founder-directed)

The persona system prompt is assembled (`src/lab-provider.ts` `assemblePersona`) as **separated,
ordered blocks** so that *how Lumis speaks* is never merged with *what the Lab knows about the
member*:

1. **Lumis identity** · 2. **Safety and hard guardrails** · 3. **Current situation adjustment**
   (pace/humour/challenge/advice/length/safety) · 4. **Immutable role contract** (what the role does)
   · 5. **Lumis character voice** (the Character Voice Card) · 6. **Character expression + naturalness
   rules** · 7. **Relevant member context** (the customer's natal Knowledge Bank — used only when
   relevant, never as a source of Lumis's personality) · 8. **Conversation continuity** · 9. **Language
   + flexible length** ("around 60–140 words is normal") · 10. **Current user message**.

The **Character Voice Card** (`src/lab-persona-voice.ts` `buildVoiceCard`) is built **deterministically
from the approved Persona Behaviour Mapping v1.2 workbook** (`BEHAVIOUR_BANK`, 60 rows). For every
resolved factor it retrieves **exactly one** approved mapping row by a deterministic id
(`mapping_id = "<factor>_<sign>"`, e.g. `asc_cancer`), carries the row's behavioural instruction and
its mapping version, and stores the mapping ids for reproducibility — the model is **never** asked to
calculate offsets or invent behaviour. Rows are ordered **ASC → Sun/Moon/Saturn → Mercury**; Mercury
is last because it colours *communication*, it does not redefine the role. The card ends with a
deterministic **Combined character** synthesis. Because the three approved roles pull different factor
sets (Acceptance = ASC+Moon+Mercury, Spark = ASC+Sun+Moon+Mercury, Awareness = ASC+Sun+Saturn+Mercury),
the same customer chart yields three **distinguishable** characters (`test/lab-persona-voice.fixtures.ts`).

## Persistent testing sessions, scoring + Excel export (Part 2, Founder-directed)

`src/lab-sessions.ts` (storage) + `src/lab-session-api.ts` (handlers) + `src/lab-xlsx.ts`
(dependency-free `.xlsx`) add a **persistent, server-side, Founder-only test record** — synthetic
charts only. A session is created when a conversation begins (`session/new`); every turn is saved
immediately with turn order + timestamps; the browser autosaves scores and comments with a visible
saved-state indicator.

- **Per-response scoring** (click a Lumis reply): Usefulness / Tone / Specificity 1–5, **Character
  distinctiveness** 1–5, **Natural conversational flow** 1–5, Length (too short / about right / too
  long), and free-text comments — editable and saved after the conversation.
- **Session-level review**: a summary comment + an overall result (Pass / Needs improvement / Fail /
  Not yet reviewed).
- **Reproducibility metadata** per session/response: session id, created/updated, tester, test
  title, role code/labels, customer Sun/Moon/Mercury/Saturn + Moon status, resolved Lumis factors,
  persona rule version, behaviour mapping version, retrieved mapping ids, language, model/deployment,
  prompt version, and the **assembled system-prompt snapshot + hash** per response.
- **Saved sessions tab**: search / filter / open / export. **End & archive** never deletes; **Delete**
  is a separate, confirmed action.
- **Excel export** (`/api/lab/export.xlsx`): one workbook, three tabs — **Evaluations** (one row per
  Lumis response), **Sessions** (one row per session), **Messages** (one row per message) — with
  wrapped text and per-sheet autofilter. The writer is dependency-free (Node built-ins only; STORED
  zip + inline strings), so no npm spreadsheet library is added.

Storage location defaults to `.tmp/lab-sessions` and can be overridden with `LAB_SESSIONS_DIR`. Files
are written atomically (temp + rename, mode `0600`).

## Security posture

- The browser sends **only** the controlled chart context + role + latest message + a bounded
  browser-held rolling context to `POST /api/lab/conversation`; the regression tab sends only a
  `fixture_id`. The browser never contacts Azure and holds no credentials.
- All Azure/Supabase credentials and provider configuration remain server-side; the browser bundle
  contains no endpoint or secret (enforced by the contract runner).
- Provider access is gated by the executable-identity authorization + the `LUMIS_AI_ENABLED` kill
  switch, verified against the clean worktree **before** any Azure key access.
- **Telemetry** is content-free (AC-AI-01/02/03 DEC-03): routing/outcome metadata only — no message
  content, context, birth data, names, or private text. No chain-of-thought or provider internals are
  exposed in telemetry.
- **Durable raw-text storage** exists **only** in the Part 2 Founder-directed test-record store
  (`.tmp/lab-sessions`, synthetic charts only, local Founder-only JSON), and only when the browser
  opts in with a `session_id`. This is a deliberate, documented reversal for internal testing — it is
  **not** customer persistence, billing, or member-state mutation, and touches no Supabase/Azure/unit
  path.
- Disposable at the customer level: `units_charged: 0`, `persistence: "not_committed"`. No customer
  threads/accounts, billing units, or member state are touched.
- Fixed crisis/safety/out-of-scope wording is never replaced by model output.
- The assembled persona prompt **is** surfaced to the browser as a Founder-internal
  `generative_prompt_preview` (re-enabled at Founder direction for this internal Lab). It remains
  Founder-only/internal and is never part of the customer UI; it is also the snapshot hashed into the
  Part 2 reproducibility record.
- Git identity commands run via `execFileSync("git", [...fixed argv])` (no shell string).

## Azure Responses API boundary

The Lab-local adapter (`src/lab-azure-responses-adapter.ts`) preserves `/openai/v1/responses`, the
approved deployment, the server-side `api-key`, the deadline/timeout, the one-retry discipline, and
DefaultV2 gating, and extracts **both** top-level `output_text` and `output[].content[].text`. It
classifies each received response into one metadata-only, body-free `provider_disposition`:
`http_or_schema_rejected` · `content_filtered_input` · `content_filtered_output` ·
`incomplete_truncated` · `completed_empty_output` · `completed_non_text_output` · `completed_text`.
The two content-filter dispositions distinguish an **input** block (the request tripped the DefaultV2
filter) from an **output** block (a partial/incomplete generation flagged on the way out), and
`incomplete_truncated` covers a non-filter incomplete (e.g. a reasoning model spending its output
budget). This corrects the earlier boundary, where an HTTP-200 `incomplete` response or a
completed-but-empty / non-text response was misreported as a hard `malformed` schema rejection
(surfaced as `CHAT_SYNTHETIC_MALFORMED`); those now degrade to a graceful fallback. Because `gpt-5-mini`
is a **reasoning** model, the request sends `reasoning: { effort: "minimal" }` and a generous total
`max_output_tokens` budget so the model returns visible text rather than spending the whole budget on
reasoning. The disposition never retains or exposes response bodies, raw text, headers, URLs, keys, or
Azure identifiers.

## Azure content-filter recommendation (for Technical)

During Founder testing, ordinary emotional-support messages were being blocked by the Azure
**DefaultV2** content filter: aggregate empathetic/self-referential language on the **input** side can
cross the self-harm severity threshold, surfacing as `content_filtered_input`, and some role prompts
tripped the jailbreak/prompt-shield on concealment-style phrasing. The Lab side has been hardened
(positive-phrased naturalness rules; trimmed grounding; graceful "temporarily unavailable" handling),
but the **durable fix is in Azure AI Foundry configuration, not code**: raise the self-harm/violence
severity thresholds (or set the relevant categories to **annotate-only**) for this staging deployment,
so normal companion conversation is not filtered. This is a Technical/Foundry change and is tracked
with them.

## Known documentation note

Persona workbook Worked Example 4 prints `Saturn: Virgo(6)`; the controlled `Calculation_Rules`
formula (and the reused `persona-calculator.ts`) yield `Libra(7)` for that unconfirmed-Moon case
(Sun/Mercury match). The code/formula is authoritative; the printed value is a documentation typo.
Surfaced here for Founder awareness — no source change made.
