# S2-T23 Current Chart-Data Authority Matrix

Status: inactive, source-grounded technical audit only.

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
| Absolute planet longitude | `normalizeProviderPoint` reads `absoluteLongitude`, `absolute_longitude`, or `full_degree`; `ChartPlanet.absoluteLongitude` is optional | Conditional | Only the normalized value survives; source field and calculation identity are absent | Planet longitudes suit both when present; angle longitudes timed only | Map only finite present values; never reconstruct from display degree alone | Yes: decide whether a chart missing any required absolute longitude fails closed or may remain display-only |
| Display sign/degree | Worker normalizes sign and accepts several degree fields, including fallback zero | Low for deterministic calculation | Provider source field is not retained; degree semantics may be sign-relative or absolute depending on source | Both for display; insufficient for aspects without a trusted reconstruction rule | Do not use as a substitute for missing absolute longitude | No mapping until chart-source semantics are approved |
| House number on planet | Provider point `house` becomes optional `ChartPlanet.house` | Conditional | No provider source field or validation evidence | Timed only; removed for no-time | Not needed by current accepted Part 1 composer; future occupancy facts require closed validation | Yes before occupancy/stellium integration |
| House number on cusp | Worker reads provider number/house or falls back to array index plus one | Medium-low | Fallback origin is not recorded; uniqueness/range are not enforced in `chart_v2` sanitizer | Timed only; houses empty for no-time | Map only after enforcing integer, unique `1..12`, complete-set rules | No founder choice if strict validation is accepted; malformed/fallback policy still needs technical approval |
| House cusp absolute longitude | Current `ChartHouse` stores normalized sign plus `cuspDegree`; it has no `cuspLongitude` | Not currently authoritative | Original provider cusp field and whether it was absolute or sign-relative are not retained | Timed only | No direct safe mapping to `cuspLongitude` | Yes: preserve an authoritative provider absolute cusp, or approve deterministic sign-plus-degree reconstruction with a named rule |
| Ascendant | Worker may normalize it as a planet and duplicate it under `angles.ascendant` | Conditional timed authority | Original source is not retained; duplicate representations have no equality assertion | Timed only; stripped for no-time | Use one validated absolute-longitude source after duplicate equality checks | Yes: designate the canonical angle representation and mismatch policy |
| Medium Coeli | Worker may normalize it as a planet and duplicate it under `angles.mediumCoeli` | Conditional timed authority | Same limitation as Ascendant | Timed only; stripped for no-time | Same as Ascendant | Same angle-authority decision |
| Moon local-day start/end longitudes | Not present in `chart_v2`, Worker response, profile persistence, or restoration | Missing | None | Needed only for the approved no-time Moon local-day endpoint rule | Cannot map | Yes: approve a chart-source/calculation contract for both endpoints, or keep the derived no-time Moon-sign fact unavailable |
| Canonical aliases | Worker has provider-specific aliases; the inactive adapter/fact engine has a broader closed canonicalizer | Medium | Alias rule versions exist only in inactive modules, not persisted chart provenance | Both, with angle suppression for no-time | Re-canonicalize at the future adapter boundary and reject duplicates | No; use the accepted closed allow-list |
| Calculation timestamp | `chart_v2.calculatedAt` is created by the Worker after normalization | Medium as an operational timestamp | Does not identify provider ephemeris version, request contract, or calculation revision | Both | May be retained as bounded operational provenance, not as calculation identity | Yes only if founder requires a specific auditable chart-source/version commitment |
| Chart source | `chart_v2.source` currently permits Worker, provider, or fixture values; live Worker emits `triplicity_cloudflare_worker` | Medium | Identifies transport/source family, not provider version or normalizer revision | Both | Accept only the reviewed live Worker source in a future integration | Yes: approve the authoritative chart source and version evidence required for deterministic signoff |
| Chart version | `birth_data.active_chart_version`, `ai_profiles.chart_version`, and `birth_data_history.chart_version` | High | Transactional DB version links active and historical chart snapshots | Both | Bind every deterministic output/context to exact `user_id + chart_version + source chart digest/version` | No |
| Worker request/calculation ID | Signed request has stable `request_id`; Worker cache and provider telemetry use it, but `chart_v2` does not carry a bounded provenance object | Medium operationally | Available around generation; not consistently part of restored client chart | Both | Future adapter provenance may carry a non-PII bounded calculation ID after storage design approval | Yes: decide retention and whether this ID is required in persisted deterministic provenance |
| Moon/Chiron/Nodes | Worker active points include Moon, Chiron, True Node; South Node is mapped if provider supplies it | Conditional by returned point and longitude | Same missing per-field provenance as other points | Both; no house placement for no-time | Map only present canonical points with finite absolute longitudes; Chiron/Nodes remain Chat-safe context only | Yes if South Node must be provider-supplied versus deterministically derived |

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

## Founder-Decision Appendix

Only these choices currently block controlled integration:

1. **Missing absolute longitudes:** fail the deterministic chain when any
   required body longitude is absent, or permit a separately approved
   reconstruction rule.
2. **House cusp authority:** preserve provider-supplied absolute cusp
   longitudes, or approve sign-plus-degree reconstruction as authoritative.
3. **Angle authority:** choose the canonical persisted angle representation and
   define fail-closed behavior when duplicated angle values disagree.
4. **Moon no-time endpoints:** approve a source/calculation contract for local
   day start/end Moon longitudes, or keep that derived fact unavailable.
5. **Chart-source provenance:** approve the chart source/version identifiers
   and retention needed for deterministic accuracy signoff.
6. **South Node authority:** require an explicit provider longitude or approve
   derivation from the North Node.
7. **Derived persistence:** decide whether engine output is recomputed from an
   immutable chart snapshot or stored as a separately versioned artifact.

No decision is made by this audit.

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

The transactional chart/version lifecycle is suitable as a future authority
anchor. Direct integration is not ready because absolute-longitude completeness,
absolute house cusps, angle authority, Moon endpoints, chart-source provenance,
South Node authority, and derived persistence policy are not all resolved.
