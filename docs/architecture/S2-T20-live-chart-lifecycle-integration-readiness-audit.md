# S2-T20 Live Chart Lifecycle Integration Readiness Audit

Status: inactive documentation/readiness audit. No production integration is
authorised or implemented.

Accepted inactive chain:

```text
provider_neutral_natal_v1
  -> natal_engine_input_v1
  -> natal_engine_output_v1
  -> natal_context_v1
```

## Current live lifecycle

### Chart generation and provider normalisation

1. `supabase/functions/profile/index.ts` authenticates the account, resolves a
   trusted birthplace, signs the chart request, and calls the Cloudflare Worker.
2. `workers/chart-mobile/worker.js` is the only provider-facing boundary.
   `generateChartFromProvider` calls the configured astrology source.
3. `buildChartV2`, `normalizeProviderPoint`, and `findProviderHouses` transform
   provider variants into `chart_v2`.
4. `sanitizeUnknownTimeChart` removes Ascendant, MC, houses, and planet-house
   placements when birth time is unknown.
5. The profile Edge Function calls `extractChartV2` and
   `sanitizeChartForClient` before database persistence.

The Worker currently performs permissive provider-shape discovery across
several possible point and house locations. That code is not the accepted
`provider_neutral_natal_v1` adapter and must not be treated as equivalent proof.

### Persistence

- `complete_profile_onboarding` transactionally persists the active
  `ai_profiles.chart_json`, `birth_data`, Starter allocation, and chart-history
  linkage.
- `birth_data_history.chart_json` preserves chart versions and supports
  historical Past Reflections.
- Migration `0010` and database triggers strip `rawProviderResponse`.
- PROF-2 migration `0026` transactionally changes the active chart/profile
  version and preserves the previous version.
- `raw_chart_json` is backend operational metadata. It is not an approved input
  to the deterministic natal chain.

No accepted engine input, engine output, or safe context is currently persisted.

### Restoration

`apps/mobile/src/services/accountState.ts` loads the authenticated user's:

- `users` Persona/focus/language fields;
- `birth_data` and active chart version;
- active `ai_profiles.chart_json`;
- Past Reflections tied to chart versions.

It verifies the active birth/profile version match and sanitizes `chart_json`
before returning it to the app. It does not load or validate
`natal_engine_output_v1` or `natal_context_v1`.

### Chat and Edge boundary

`supabase/functions/chat-message/index.ts` authenticates the caller and loads
the server-owned active `ai_profiles.chart_json`. It currently calls
`buildSafeChatChartContext`, which projects only precision and Sun/Moon/rising
signs.

Mobile also builds a legacy client chart context for its request, but future
deterministic natal context must remain server-owned. Client-supplied chart
context must never become authoritative.

There is no current `natal_context_v1` Chat integration, Knowledge Bank
retrieval, or generated interpretation integration.

## Current `chart_v2` mapping audit

| Current field | Future adapter treatment | Decision |
|---|---|---|
| `version: chart_v2` | Validate upstream source version only; do not copy into `provider_neutral_natal_v1`. | Safe as a gate. |
| `precision` | Map `full` or `no_birth_time` directly. | Safe after sanitizer enforcement. |
| `planets[].key` | Map approved canonical aliases to provider-neutral point `name`. `true_node` canonicalises to `north_node`. | Safe only for the existing natal allow-list. |
| `planets[].absoluteLongitude` | Map to point `longitude` when finite and present. | Safe. Missing values must fail; do not reconstruct silently. |
| `planets[].sign` and `degree` | Do not map when absolute longitude exists. | Reconstructing longitude requires an approved chart-source rule first. |
| `planets[].house` | Do not map. | Not accepted by the engine input; must remain absent for no-time charts. |
| `planets[].retrograde` | Do not map. | Outside accepted deterministic rules. |
| `angles.ascendant` / `angles.mediumCoeli` | Use only as a consistency check against canonical point rows. | A single authoritative angle source must be approved to prevent duplicate aliases. |
| `houses[].no` | Map to provider-neutral house `number`. | Safe when integer 1–12 and unique. |
| `houses[].sign` plus `cuspDegree` | Not enough for an approved automatic `cuspLongitude` mapping. | Decide whether Worker must retain absolute cusp longitude or whether a canonical sign-index conversion is authorised. |
| Moon local-day endpoints | No current `chart_v2` field. | Provider/calculation source and provenance must be approved first. |
| `source` | Do not use as a unique source identifier. | It is a source class, not a bounded calculation identity. |
| `calculatedAt` | Do not use as a calculation identifier. | Timestamp is metadata, not identity. |
| Worker `request_id` | Candidate bounded `calculationId`. | Approve retention/linkage source before integration. |
| labels, calculated timestamp | Omit from deterministic input. | Data minimisation. |
| fixture source | Reject for live integration. | Fixtures cannot authorise deterministic persisted facts. |

## Minimal additive integration seams

### Seam 1: trusted chart-to-adapter mapper

Add one server-only pure mapper beside the profile Edge Function or shared
astrology package. It may consume only the already-sanitized signed Worker
`chart_v2` plus separately approved bounded request provenance.

It must not consume `raw_chart_json`, provider responses, birth data, account
identifiers, email, coordinates, or client chart context.

### Seam 2: pre-persistence deterministic validation

For new onboarding and PROF-2, run this exact order before the transaction:

1. authenticate and resolve authoritative birth/location data;
2. receive and authenticate the signed Worker response;
3. sanitize and enforce unknown-time restrictions;
4. map the approved `chart_v2` fields to `provider_neutral_natal_v1`;
5. run `adaptProviderNeutralNatalPayload`;
6. run `validateNatalEngineInput`;
7. run `composeNatalEngineOutput`;
8. run `projectSafeNatalContext`;
9. only after every stage succeeds, enter the existing transactional persistence
   operation.

Any deterministic-stage failure must stop before chart/profile/version commit.
For PROF-2, the prior chart remains active and the lifetime counter does not
advance. Errors returned to clients must use stable safe codes and never include
payloads, values, stack traces, provider messages, or private data.

### Seam 3: separately authorised persistence envelope

No storage change is approved here. A future forward-only migration must decide
whether to persist:

- the validated engine input;
- the deterministic engine output;
- only a digest/version plus recomputable source chart;
- the safe context.

Prefer the minimum required envelope. Do not duplicate raw birth data,
coordinates, provider payloads, account identity, or operational metadata.
Ownership, RLS, active chart version, historical version, deletion, retention,
idempotency, and forward recovery require separate approval.

### Seam 4: restoration verification

After a storage design is approved, account restoration must:

- read only the authenticated user's active chart version;
- validate stored contract versions before use;
- reject chart/output version mismatch without creating a replacement chart;
- preserve historical contexts as read-only with their original chart version;
- treat temporary derived-context failure as unavailable enrichment, not an
  empty account or onboarding instruction.

### Seam 5: server-owned Chat context

Only after persistence/restoration QA may `chat-message` load or derive
`natal_context_v1` from the server-owned active chart version. It must not trust
mobile `chart_context`. Chiron and North/South Nodes may pass only through the
approved safe natal context. Solar Return, transit, timing, annual-theme,
Vertex, provider payloads, and private birth/account data remain excluded.

This seam does not authorise Chat/AI calls or Knowledge Bank retrieval.

## Safe failure and minimisation rules

- Reject at the earliest closed boundary.
- Never silently drop an unknown field and continue as authoritative.
- Return code/reason/location only from deterministic boundaries.
- Log stable request and failure classifications only; never payloads.
- Never infer missing absolute longitude, house cusp longitude, Moon endpoint,
  birth time, angle, or placement data.
- Never persist partial deterministic output.
- Never replace an existing chart because deterministic enrichment failed.
- Never expose engine output or context to mobile before a separate UI/security
  approval.

## Integration acceptance matrix

| ID | Scenario | Required future evidence |
|---|---|---|
| `T20-01` | Timed chart | Finite canonical point longitudes, approved cusp source, angles consistent, timed capabilities true, transaction commits once. |
| `T20-02` | No-birth-time chart | No ASC, MC, houses, house rulers, or planet-house placements before adapter; timed capabilities false. |
| `T20-03` | Missing absolute point longitude | Fail before adapter/transaction; no reconstruction and no partial record. |
| `T20-04` | Unapproved house cusp source | Fail closed until the source decision is approved. |
| `T20-05` | Malformed/unknown fields | Stable non-echoing failure; no persistence or version change. |
| `T20-06` | Solar Return/SR/transit/timing/annual-theme/Vertex | Earliest boundary rejects; no downstream output. |
| `T20-07` | Chiron and Nodes | Canonical aspects survive only into server-owned Chat-safe natal context. |
| `T20-08` | Initial persistence | Engine version/digest ownership aligns with active chart version atomically. |
| `T20-09` | PROF-2 persistence | Failed enrichment preserves prior active chart and lifetime counter. |
| `T20-10` | Restoration | Same account/version restores byte-stable approved output; mismatch cannot trigger onboarding. |
| `T20-11` | Historical reflections | Earlier chart context remains read-only and tied to its original version. |
| `T20-12` | Cross-user access | RLS/server checks deny every chart/output/context read across users. |
| `T20-13` | PII minimisation | No email, birth fields, place, coordinates, account ID, token, raw response, or provider body in deterministic storage/context/evidence. |
| `T20-14` | Temporary context failure | Chart/account restoration remains truthful; retry does not regenerate or duplicate grants. |

## Explicit exclusions

Dice is fully excluded and must never import, call, persist, receive, or display
this chain.

This audit makes no production-code change and authorises no provider call,
credential access, staging contact, migration, deployment, persistence,
Chat/AI connection, Knowledge Bank retrieval, mobile/UI exposure, billing, or
Dice integration.

## Readiness verdict

Not ready to integrate. The minimum blockers are:

1. approved absolute house-cusp source;
2. approved handling for points missing absolute longitude;
3. approved Moon local-day endpoint source;
4. approved single angle authority and consistency rule;
5. approved bounded calculation provenance linkage;
6. approved versioned persistence/RLS/deletion design;
7. separately authorised restoration and server-owned Chat gates.
