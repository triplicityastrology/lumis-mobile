# S2-T41 Two-Account Founder Evidence Readiness

Status: source-ready, unrun, and staging-only.

Use exactly one disposable Caree and one disposable Carer created for the same
redacted evidence run. Never use an existing account. The normal Lumis app and
static Care Circle preview remain unchanged; this test uses only the isolated
S2-T35 workbench after migrations `0032`-`0034` and the inactive `care-circle`
function pass their deployment gates.

## Exact Device Sequence

1. Sign in as the disposable Caree and create one one-hour pairing code.
2. Use **Switch account** and sign in as the disposable Carer.
3. Submit the code and refresh status. Capture only the safe state name:
   **Pending Caree acceptance - no authority**.
4. Switch back to the Caree, refresh pending requests, and accept the request.
5. Confirm the Caree projection says **Active - accepted by Caree**.
6. Pause Care Circle, confirm the safe paused result, then resume it.
7. Switch to the Carer, refresh, confirm active, then choose **Remove myself**.
8. Refresh and confirm the relationship is removed.
9. Sign out. The authorized operator deletes both disposable accounts and
   records only the redacted run ID and a cleanup count of two.

Do not run the capacity test, create another Carer, exercise notifications, or
open the normal release preview during this evidence run. Do not retain the
pairing code, credentials, account identifiers, emails, or database payloads in
screenshots or evidence.

## Source Readiness Result

The existing workbench already supplies every required device operation and
uses the real injected staging operation port. No release caller or product
feature was added. Account creation, backend deployment, and cleanup remain
later authorized staging operations, not part of this source-only readiness
task.
