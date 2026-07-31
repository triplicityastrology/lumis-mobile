# S2-T37 Minimal Natal Lifecycle

Status: source-only prototype path; not deployed.

## Implemented Boundary

The signed Profile Edge Function now requires a live Worker `chart_v2` to pass
this closed chain before onboarding or birth-detail regeneration persistence:

```text
signed Worker chart_v2
  -> provider_neutral_natal_v1
  -> natal_engine_input_v1
  -> natal_engine_output_v1
  -> validated non-authoritative natal_chart_projection_v1
  -> chart_json snapshot
  -> owner-scoped active-profile restoration
  -> mobile_natal_summary_v1
```

The existing JSON chart snapshot can carry the projection, so this source-only
change needs no database migration. Existing historical charts without the new
projection remain readable and are never rewritten.

## Authority Rules

- Only `triplicity_cloudflare_worker` `chart_v2` output from the signed natal
  endpoint may enter the new pipeline.
- Every admitted point requires a finite absolute longitude from the designated
  chart source. Display sign/degree never substitutes for it.
- Timed charts require the ordered complete 12-cusp set. Duplicate angle
  representations must agree.
- No-time charts admit no houses, house placements, ASC, or MC. The current
  noon-derived Moon is omitted because the approved local-day endpoint method
  is not yet supplied by `chart_v2`.
- South Node is recomputed as North Node plus 180 degrees and marked derived;
  any supplied value must agree within the provider precision tolerance.
- The original normalized chart snapshot remains authoritative and immutable.
  `natal_chart_projection_v1` is explicitly non-authoritative and versioned.

## Persistence And Restoration

The projection is added before the existing transactional onboarding or PROF-2
RPC receives `p_chart_json`. A lifecycle failure returns only a stable code and
prevents persistence. No raw provider response enters the projection.

Restoration still requires the authenticated owner, active profile, and exact
`birth_data.active_chart_version === ai_profiles.chart_version` match. The
client sanitizer validates the projection again and drops malformed, mismatched,
or prohibited projections. The mobile chart screen uses it only when valid.

## Explicit Exclusions

No Chat/AI context, Knowledge Bank retrieval, transit, timing, Solar Return,
Vertex, Dice, provider call, credential, deployment, staging operation, billing,
or migration is added here.

## Remaining Gates

1. Deploy the reviewed Profile function only in a separately authorised staging
   task.
2. Generate disposable timed and no-time charts from the designated live source.
3. Prove persistence, active-version restoration, historical immutability, RLS,
   malformed-source rollback, and physical-device summary rendering.
4. Add the named Moon local-day endpoint source before any no-time Moon fact can
   appear in the structural projection.
