# S1-T03 PROF-2 Staging Evidence

Date: 2026-07-26

Environment: non-production staging

Supabase project ref: `bmqhwofmdgebpcihjlnb`

This evidence is redacted. It contains no API keys, signing secrets, database
passwords, user identifiers, email addresses, birth payloads, provider payloads,
or disposable test credentials.

## Deployment Evidence

- Migration `0026_birth_details_regeneration.sql` was confirmed through the
  deployed protected `reserve_birth_details_change` RPC.
- The public mobile key was denied access to the protected RPC.
- The hosted deployment check returned the expected backend validation result,
  proving that the migration RPC was available before profile testing.
- The `profile` Edge Function was deployed from the post-S1-T02 source boundary.
- Deployed function metadata:
  - name: `profile`
  - version: `21`
  - status: `ACTIVE`
- Required Supabase configuration names were present:
  - `CHART_WORKER_URL`
  - `CHART_WORKER_ENDPOINT`
  - `CHART_WORKER_SIGNING_SECRET`
  - `CHART_WORKER_TIMEOUT_MS`
  - `LUMIS_ENV`
- Required Cloudflare Worker secret names were present:
  - `ASTRO_API_KEY`
  - `CHART_WORKER_SIGNING_SECRET`
- No secret values were printed or stored in this evidence.

## Hosted PROF-2 Result

Result: passed

Verified:

- fresh onboarding used the populated signed Worker chart;
- malformed birth details were rejected before chart generation with `49002`;
- successful regeneration activated chart/profile version two transactionally;
- version-one Past Reflections retained their original chart version;
- an exact retry returned the committed result without another provider call;
- concurrent regeneration reservations were serialized;
- failed work did not consume a lifetime change;
- an expired same-request reservation resumed with its original Worker identity;
- three real successful changes advanced the backend lifetime count to three;
- a fourth change returned `49001` before chart generation;
- exactly one current chart/profile version remained active;
- previous chart/profile versions remained historical;
- provider telemetry retained its highest concurrent count;
- injected raw provider output was stripped from persisted chart history;
- backend-only RPCs and protected tables rejected mobile access;
- cross-user reads were denied;
- same-email restoration reloaded the saved profile and Past Reflections.

## Missing-Worker Rollback Result

Result: passed

The staging-only proof temporarily removed `CHART_WORKER_URL`, exercised one
authenticated PROF-2 request, and restored the URL automatically.

Verified:

- missing Worker configuration returned `49003`;
- the previous chart and AI profile remained active;
- the successful lifetime-change count remained unchanged;
- no new chart history or AI profile version was committed;
- no fixture chart was committed;
- the reservation ended in a failed state with the safe
  `CHART_WORKER_FAILED` code;
- the Worker URL was restored after the assertion.

## Cleanup Result

Result: passed

- Disposable database records were removed.
- Disposable Auth users left by the interrupted broad test were removed by the
  run-ID cleanup command.
- The scoped PROF-2 proof completed without retaining its hidden QA key.
- The missing-Worker proof completed without storing its hidden QA key.

## Safe Recovery Boundary

- No pre-S1-T02 Edge Function rollback is approved or documented.
- Recovery is limited to Worker URL restoration, matching signing-secret repair,
  and a reviewed post-S1-T02 forward fix.
- Migration `0026` is forward-only and must not be removed as emergency
  recovery.
