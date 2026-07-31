# S2-T23 Current Chart-Data Authority Matrix

Status: founder decisions reconciled; source-grounded technical authority.

Authority reconciled on 2026-08-01 from:

- `S2-T23_Chart_Integration_Founder_Decisions_2026-07-30.md`;
- its founder-annotated decision card;
- `AC-AI-00_AI_Routing_Founder_Decisions_v1_5.md`.

All seven S2-T23 chart-integration choices are closed. This document records
their technical consequences; it does not authorise deployment, provider
access, Chat/AI, Knowledge Bank retrieval, billing, timing, Dice, or staging.

This document audits the current live natal-chart lifecycle against the
accepted inactive deterministic chain:

```text
provider_neutral_natal_v1
  -> natal_engine_input_v1
  -> natal_engine_output_v1
  -> natal_context_v1
```

It does not connect that chain to production code. It makes no provider call,
reads no credential, persists nothing, changes no UI, and performs no Chat,
AI, Knowledge Bank, billing, Dice, migration, deployment, staging, or network
work.

## Current Lifecycle Boundaries

| Boundary | Current authority | Integration implication |
| --- | --- | --- |
| Chart request | `supabase/functions/profile/index.ts` signs a natal request containing trusted birth location and precision | Any future adapter input must come from the signed Worker result, never client-supplied chart data |
| Provider normalization | `workers/chart-mobile/worker.js` maps provider points/houses into `chart_v2` | This is the only current provider-specific normalization boundary |
| Worker response | Signed `/mobile/natal-chart` returns `chart_v2` and safe telemetry | Future normalization must fail before persistence when required deterministic fields are absent |
| Onboarding persistence | `/profile` passes sanitized `chart_v2` to `complete_profile_onboarding` | Deterministic output must not be written until its storage authority and versioning are approved |
| Regeneration persistence | `/profile` and migration `0026` atomically create a new chart/history/profile version | Any future deterministic artifact must activate in the same transaction as its source chart |
| Chart history | `birth_data_history.chart_json` stores versioned chart snapshots; users may read only their own history | Derived data must remain bound to the exact source `chart_version` |
| Active profile | `ai_profiles.chart_json`, `chart_version`, and `is_active` identify the current chart | One active profile/version is the restoration authority |
| Mobile restoration | `apps/mobile/src/services/accountState.ts` reads the active profile matching `birth_data.active_chart_version` | Mobile must consume a server-approved projection; it must not compose deterministic facts itself |
| Client sanitization | `sanitizeChartForClient` strips raw fields and enforces unknown-time suppression | This remains a presentation boundary, not a calculation-authority boundary |
| Chat boundary | Current Chat loads the active profile server-side and builds a limited safe context | `natal_context_v1` may replace or augment this only after separate persistence and Chat approval |

## Field Authority Matrix

Reliability ratings describe current suitability for the accepted deterministic
chain, not general display usefulness.

| Required field | Current source | Current reliability | Provenance | Timed/no-time suitability | Safe mapping now | Founder decision |
| --- | --- | --- | --- | --- | --- | --- |
| Chart type | Worker endpoint and signed request are natal-only; `chart_v2` itself has no explicit `chartType` | Medium | Endpoint/request establish natal intent, but persisted chart lacks a closed chart-type field | Both | Adapter may set `chartType: "natal"` only from the signed natal endpoint contract | No, if endpoint authority is accepted as sufficient |
| Precision | Worker derives `full` or `no_birth_time` from signed `time_unknown`; persisted in `chart_v2` and profile | High | Source is implicit in signed request and chart field; no per-field provenance object | Both; drives all capability gates | Direct map after equality check against authoritative birth data | No |
| Planet/body key | Worker `POINT_KEY_MAP` maps a fixed provider-name list to `ChartPlanetKey` | Medium-high for mapped names | No original provider field/name is retained downstream | Both, excluding angles for no-time | Map approved keys through the closed provider-neutral alias boundary | No, but unmapped provider names must fail/omit under an approved policy |
| Absolute planet longitude | `normalizeProviderPoint` reads `absoluteLongitude`, `absolute_longitude`, or `full_degree`; `ChartPlanet.absoluteLongitude` is optional | Conditional until strict validation | Only the normalized value survives; source field and calculation identity are absent | Planet longitudes suit both when present; angle longitudes timed only | The designated chart API is the sole authority. Require a finite normalized `0 <= longitude < 360` for every admitted body; never reconstruct from display degree | `CI-01` closed 2026-07-30 |
| Display sign/degree | Worker normalizes sign and accepts several degree fields, including fallback zero | Low for deterministic calculation | Provider source field is not retained; degree semantics may be sign-relative or absolute depending on source | Both for display; insufficient for aspects without a trusted reconstruction rule | Do not use as a substitute for missing absolute longitude | No mapping until chart-source semantics are approved |
| House number on planet | Provider point `house` becomes optional `ChartPlanet.house` | Conditional | No provider source field or validation evidence | Timed only; removed for no-time | Accept only with supplied time and a validated declared house system/cusp set; never expose for no-time | `CI-02` closed 2026-07-30 |
| House number on cusp | Worker reads provider number/house or falls back to array index plus one | Medium-low | Fallback origin is not recorded; uniqueness/range are not enforced in `chart_v2` sanitizer | Timed only; houses empty for no-time | Map only after enforcing integer, unique `1..12`, complete-set rules | No founder choice if strict validation is accepted; malformed/fallback policy still needs technical approval |
| House cusp absolute longitude | Current `ChartHouse` stores the designated engine's ordered sign plus sign-relative `cuspDegree` | Conditional on strict ordered-set validation | The normalized ordered cusp entry survives, but the declared house-system identifier is not yet persisted | Timed only | Validate complete ordered cusps, then canonicalize engine sign plus sign-relative degree to `0..359.999`; no-time charts have no cusps | `CI-02` closed 2026-07-30; house-system provenance remains additive source work |
| Ascendant | Worker may normalize it as a planet and duplicate it under `angles.ascendant` | Conditional timed authority | Original source is not retained; duplicate representations have no equality assertion | Timed only; stripped for no-time | Canonical structured angle fact from the designated source; duplicates must agree or fail closed | `CI-03` closed 2026-07-30 |
| Medium Coeli | Worker may normalize it as a planet and duplicate it under `angles.mediumCoeli` | Conditional timed authority | Same limitation as Ascendant | Timed only; stripped for no-time | Same as Ascendant; DSC and IC follow the same structured-angle policy when supplied | `CI-03` closed 2026-07-30 |
| Moon local-day start/end longitudes | Not present in `chart_v2`, Worker response, profile persistence, or restoration | Missing | None | Needed only for the approved no-time Moon local-day endpoint rule | Use one named, versioned ephemeris/service method; if endpoints are unavailable, the no-time Moon-sign fact is unavailable; never use noon | `CI-04` closed 2026-07-30; source integration remains required |
| Canonical aliases | Worker has provider-specific aliases; the inactive adapter/fact engine has a broader closed canonicalizer | Medium | Alias rule versions exist only in inactive modules, not persisted chart provenance | Both, with angle suppression for no-time | Re-canonicalize at the future adapter boundary and reject duplicates | No; use the accepted closed allow-list |
| Calculation timestamp | `chart_v2.calculatedAt` is created by the Worker after normalization | Medium as an operational timestamp | Does not identify provider ephemeris version, request contract, or calculation revision | Both | May be retained as bounded operational provenance, not as calculation identity | Yes only if founder requires a specific auditable chart-source/version commitment |
| Chart source | `chart_v2.source` currently permits Worker, provider, or fixture values; live Worker emits `triplicity_cloudflare_worker` | Medium | Identifies transport/source family, not provider version or normalizer revision | Both | Persist immutable source/version, calculator/worker version, input fingerprint, precision, generation time, and snapshot identity; source/version changes never rewrite history | `CI-05` closed 2026-07-30; current provenance must be extended additively |
| Chart version | `birth_data.active_chart_version`, `ai_profiles.chart_version`, and `birth_data_history.chart_version` | High | Transactional DB version links active and historical chart snapshots | Both | Bind every deterministic output/context to exact `user_id + chart_version + source chart digest/version` | No |
| Worker request/calculation ID | Signed request has stable `request_id`; Worker cache and provider telemetry use it, but `chart_v2` does not carry a bounded provenance object | Medium operationally | Available around generation; not consistently part of restored client chart | Both | Retain only a bounded non-PII calculation/snapshot identity within immutable provenance; never expose it in mobile summary | `CI-05` closed 2026-07-30 |
| Moon/Chiron/Nodes | Worker active points include Moon, Chiron, True Node; South Node is mapped if provider supplies it | Conditional by returned point and longitude | Same missing per-field provenance as other points | Both; no house placement for no-time | Derive South Node as the exact 180-degree opposite of authoritative North Node and mark it derived; a provider South Node must validate against it. Chiron/Nodes remain excluded from Dice | `CI-06` and AC-AI-00 v1.5 G4 closed |

## Validation Order for Any Future Integration

1. Authenticate the backend caller and load the authoritative active
   `user_id + chart_version`.
2. Confirm the source is the reviewed signed natal Worker contract.
3. Sanitize raw-provider/debug fields before any mapping.
4. Enforce chart type and `precision` against authoritative birth data.
5. Build a closed provider-neutral payload from explicitly approved fields.
6. Reject unknown fields, prohibited scopes, duplicate aliases, missing required
   longitudes, invalid houses, and angle inconsistencies.
7. Run `natal_engine_input_v1` validation.
8. Compose `natal_engine_output_v1`.
9. Project `natal_context_v1`.
10. Bind any approved persisted artifact atomically to its source chart version;
    never replace or reinterpret historical versions.

Failure at steps 2-9 must leave the existing chart/profile/history unchanged.
Failures expose only stable non-echoing codes. No raw chart, provider response,
birth data, account identifier, or source value belongs in user-visible errors.

## Persistence and RLS Implications

- `birth_data_history` is owner-readable and versioned; it is the durable source
  snapshot boundary.
- `ai_profiles` is owner-readable and carries the active chart version.
- Transactional activation in onboarding/regeneration prevents source chart and
  deterministic derivative versions from drifting.
- A future derived-artifact table or columns require explicit schema authority,
  owner-read/service-write RLS, source chart version/digest linkage, and
  forward-only migration/recovery.
- Mobile must not write or calculate authoritative facts.
- Past Reflections must remain bound to their historical chart version.
- Raw provider data and exact birth data must not enter `natal_context_v1`.

## Reconciled Founder Decisions

1. **Absolute longitudes (`CI-01`):** one designated chart API is the sole
   authority. Missing or malformed required longitudes fail closed; display
   degree is not a substitute.
2. **House cusps (`CI-02`):** use the declared house system and ordered cusp
   array only with supplied time. No birth time means no cusps.
3. **Angles (`CI-03`):** ASC, DSC, MC, and IC are structured timed facts. No
   birth time means no angles. Duplicate representations must agree.
4. **Moon no-time endpoints (`CI-04`):** use one named, versioned endpoint
   method. If it is unavailable, the no-time Moon-sign fact is unavailable;
   never substitute noon.
5. **Provenance/history (`CI-05`):** preserve an immutable snapshot with source
   and calculation versions, input fingerprint, precision, and generation
   identity. Source changes never rewrite historical charts without explicit
   founder-initiated regeneration.
6. **South Node (`CI-06`):** derive it as North Node plus 180 degrees and mark it
   derived; validate any supplied provider value against the derivation.
7. **Derived output (`CI-07`):** recompute versioned deterministic facts from
   the preserved normalized snapshot. Any cache is non-authoritative.

These decisions are closed. Remaining work is implementation and evidence, not
Founder policy selection.

## Acceptance Matrix

| Scenario | Required future evidence |
| --- | --- |
| Timed chart | Required longitudes, 12 validated absolute cusps, canonical angles, exact source version, deterministic output |
| No-birth-time chart | No angles/houses/house placements; approved Moon endpoint behavior; deterministic body aspects |
| Malformed chart | Fails before composition/persistence with a stable safe code |
| Prohibited scope | Solar Return, transit, timing, annual theme, Vertex, and unknown fields fail closed |
| Chiron/Nodes | Accepted only when canonical and finite; projected for Chat-safe context only |
| Persistence | Output source version matches active chart; historical versions remain immutable |
| Restoration | Same version and byte-stable deterministic projection restore without mobile recomputation |
| RLS | Owner may read approved projection; cross-user/anonymous writes and reads are denied |
| Privacy | No raw provider response, coordinates, exact birth details, email/account identifiers, or internal errors enter context/evidence |
| Dice | No import, field, invocation, persistence, or integration |

## Audit Verdict

The transactional chart/version lifecycle is suitable as the authority anchor,
and all seven Founder choices are resolved. Controlled source integration may
proceed fail-closed. Current data-shape gaps remain for declared house-system
provenance, Moon local-day endpoints, and complete immutable provenance; those are
implementation gaps governed by the decisions above, not open product policy.
