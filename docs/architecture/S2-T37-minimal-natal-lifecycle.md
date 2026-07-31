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

## S2-T38 Future Staging And Device Sequence

Status: reviewed readiness only. Do not run without a separately authorised
staging window.

### Reviewed source pin

- Lifecycle source commit: `fe5aac6b98911a72ec3661d2f1e3955f0d92bdfe`.
- `supabase/functions/profile/index.ts` SHA-256:
  `7c567bea9a46a820c59ca60d81eeb70e1890aa393b11cbbb3902ec471d021ccb`.
- Target project must equal staging ref `bmqhwofmdgebpcihjlnb` before any CLI
  operation. Stop on a ref, commit, checksum, or dirty-worktree mismatch.
- The normal app path is sufficient. No staging workbench, route, migration, or
  mobile source change is required.

### Future controlled sequence

1. Confirm the exact linked staging ref, clean reviewed commit, profile checksum,
   and names-only presence of the existing Worker URL/signing configuration.
   Never print configuration values.
2. Record the immediately prior deployed `profile` function version and source
   evidence. Deploy only the reviewed `profile` function; do not apply a
   migration or deploy another function.
3. Create two disposable authenticated staging accounts through the ordinary
   app flow. Never use a founder/member account or copy real birth details.
4. For the timed account, enter synthetic supported birth details, generate the
   chart, and require the result mode to be `supabase`. Confirm the Sky screen
   shows the validated structural caption, timed placements, houses, ASC, and
   MC. Restart the app and confirm the same active chart/version restores.
5. For the no-time account, enable the existing unknown-time control before
   generation and again require `supabase` mode. Confirm the restored Sky screen
   contains no houses, house placements, ASC, MC, or structural Moon placement.
6. Exercise one ordinary PROF-2 change only on a disposable account. Confirm the
   authoritative reload shows the new active version and the prior version
   remains historical/read-only.
7. The existing source fixtures prove malformed, partial, and prohibited-scope
   Worker charts fail before persistence. Do not alter the live Worker or inject
   malformed provider data merely to reproduce that case. A live fault test
   requires a separately reviewed, non-provider fault-injection mechanism.
8. Delete all disposable accounts with the approved cleanup path and record only
   the count of records removed.

### Redacted evidence

Retain only: run ID, UTC timestamps, source commit, source/function checksums,
deployed function version, pass/fail check names, safe status/error codes,
precision, projection schema/engine versions, placement/house/aspect counts,
active chart version numbers, and cleanup counts. Do not retain email, user ID,
birth details, coordinates, raw chart JSON, callback/request URLs, tokens,
signatures, secrets, or provider payloads.

### Failure and recovery boundary

Stop on any fixture result, missing projection, wrong precision, unexpected
timed field in a no-time chart, persistence/version mismatch, unsafe error, or
failed cleanup. A local/fixture chart is preview evidence only and must never be
reported as staging proof. Migration rollback is not applicable. Function
recovery may use only the captured immediately prior reviewed function version
if it preserves live-Worker enforcement and backend-owned profile rules;
otherwise stop for a forward corrective function deployment.
