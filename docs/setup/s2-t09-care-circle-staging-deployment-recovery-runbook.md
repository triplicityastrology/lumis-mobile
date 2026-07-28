# S2-T09 Care Circle Staging Deployment and Forward Recovery

Status: prepared only; unrun and staging-only.

Approved target: `bmqhwofmdgebpcihjlnb`.

This control does not authorize deployment. It contains future operator steps
for a separate PM-approved window. The ordinary repository command is local
only and makes no network or database request.

## Permanent Inactive Boundary

This deployment must not configure or activate:

- any notification provider;
- device-token registration UI;
- a scheduler or notification delivery;
- QR UI;
- check-ins;
- reminders;
- Care Circle app activation.

There is no production step in this runbook. Keep the existing Care Circle and
Notifications screens static and inactive.

No provider is configured or activated by this package.
No scheduler or delivery path is created. No QR UI, no check-ins, no
reminders, and no app activation are authorized.

## Strict Deployment Order

The only approved order is:

1. `0032_care_circle_backend_foundation.sql`
2. `0033_inactive_notification_foundation.sql`
3. `0034_reusable_care_pairing_operations.sql`
4. `care-circle Edge Function`

Stop on any partial failure. Do not continue to the function until all three
migrations have remote parity.

## Gate 1: Local Source Preflight

This is safe to run before authorization:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
"/Users/rubyku/.local/node22/bin/pnpm" test:s2-care-circle-deployment-readiness
"/Users/rubyku/.local/node22/bin/pnpm" test:s2-care-circle-deployment-runbook
```

It checks the exact staging ref, migration/function checksums, order, recovery
rules, and inactive boundaries using local files only.

## Gate 2: Source, Backup, and Legacy Audit

During a future approved window:

1. Confirm the linked project and CLI project listing both identify only
   `bmqhwofmdgebpcihjlnb`. Stop before prompting for credentials if either does
   not match.
2. Confirm the clean reviewed source commit and preserve its full SHA.
3. Capture migration checksums from the deployment-control JSON.
4. Capture staging backup evidence from the Supabase backup/PITR screen:
   project ref, successful status, and timestamp only. Do not capture connection
   strings, credentials, row data, or private payloads.
5. Run the count-only
   `supabase/tests/s2-t09-care-circle-legacy-audit.sql` in the staging SQL
   editor.
6. Stop if the revoked relationship count is not zero.
7. Stop if the non-SHA-256-shape legacy code count is not zero; PM/security
   must review that legacy shape without copying its values.
8. Record the legacy notification count and body-bearing-row count. Do not
   export notification content.

Save the backup evidence and count-only legacy audit before continuing.

## Gate 3: Remote Plan Without Changes

The future operator must set and verify this guard before every CLI command:

```bash
EXPECTED_REF="bmqhwofmdgebpcihjlnb"
LINKED_REF="$(tr -d '[:space:]' < supabase/.temp/project-ref)"
if [[ "$LINKED_REF" != "$EXPECTED_REF" ]]; then
  printf 'STOP: linked Supabase project is not approved staging.\n' >&2
  exit 1
fi
```

Then:

```bash
"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest migration list --linked
"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest db push --linked --dry-run
```

The dry-run must list exactly `0032`, `0033`, and `0034` in that order, with no
other pending migration. Record names/status only. Any difference stops the
window.

Verify only the presence of the function secret name
`CARE_CIRCLE_PAIRING_SECRET`; never display or record its value:

```bash
"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest secrets list \
  --project-ref "$EXPECTED_REF"
```

If the name is absent, stop. Secret configuration is outside this runbook.

## Future Authorized Deployment

Only after Gates 1-3 pass and PM explicitly releases the window:

```bash
IFS= read -r -s "SUPABASE_DB_PASSWORD?Paste the staging database password, then press Return: "
printf '\n'
export SUPABASE_DB_PASSWORD

"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest db push \
  --linked \
  --yes

unset SUPABASE_DB_PASSWORD
```

Immediately verify remote migration parity. Do not deploy the function if any
migration is missing or failed.

```bash
"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest migration list --linked

"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest functions deploy \
  care-circle \
  --project-ref "$EXPECTED_REF"

"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest functions list \
  --project-ref "$EXPECTED_REF"
```

Record only migration names/status and the `care-circle` function
name/version/status/update time.

## Post-Deploy Verification

Before disposable evidence:

1. Confirm all three migration versions have remote parity.
2. Confirm the deployed function source is from the reviewed commit and its
   function checksum matches the control manifest.
3. Confirm unauthenticated invocation returns `401 AUTH_REQUIRED`.
4. Confirm no direct authenticated grants exist on sensitive Care Circle or
   notification foundation tables/RPCs.
5. Confirm both notification registry rows remain `enabled = false`.
6. Confirm the app still exposes only static previews and no caller invokes
   `care-circle`.
7. Save redacted evidence only.

## Exact S2-T08 Release Point

S2-T08A may run only after every post-deploy verification above passes:

```bash
"/Users/rubyku/.local/node22/bin/pnpm" evidence:s2-care-circle:secure -- --execute
```

S2-T08B must not run in this window. It additionally requires a separately
authorized deployment of the inactive `notification-device` function, which is
outside S2-T09. Migration `0033` alone is not sufficient.

## Forward-Only Database Recovery

Migrations `0032`, `0033`, and `0034` are forward-only. Emergency containment:

1. keep both preview surfaces inactive;
2. remove or disable every app caller;
3. preserve migration and redacted failure evidence;
4. diagnose without exporting private rows;
5. prepare a reviewed next-numbered corrective migration;
6. dry-run and deploy that corrective migration in a later approved window.

Never remove migration history or restore the legacy consent direction,
participant grants, raw code handling, or misleading maximum-five index.

## Safe Function Recovery

The minimum safe function commit is:

`a2aaee6bc7515310acc78719736d7122b814f1f5`

Recovery may redeploy only a reviewed commit at or after this boundary. A
pre-S2-T07 function is prohibited.

```bash
MINIMUM_SAFE_FUNCTION_SHA="a2aaee6bc7515310acc78719736d7122b814f1f5"
SAFE_FUNCTION_SHA="PASTE_REVIEWED_FULL_SHA"

git merge-base --is-ancestor "$MINIMUM_SAFE_FUNCTION_SHA" "$SAFE_FUNCTION_SHA"
git show "$SAFE_FUNCTION_SHA:supabase/functions/care-circle/index.ts" |
rg 'pairing_code_create|pairing_code_submit|CARE_CIRCLE_CONFIGURATION_REQUIRED'
```

Both commands must pass. Then create a temporary source bundle from that
reviewed commit and deploy only from the temporary bundle:

```bash
SAFE_TREE="$(mktemp -d)"
git archive "$SAFE_FUNCTION_SHA" \
  supabase/config.toml \
  supabase/functions/care-circle \
  supabase/functions/_shared |
tar -x -C "$SAFE_TREE"

"/Users/rubyku/.local/node22/bin/pnpm" dlx supabase@latest functions deploy \
  care-circle \
  --project-ref "bmqhwofmdgebpcihjlnb" \
  --workdir "$SAFE_TREE"
```

After recovery, repeat function version capture, unauthenticated denial, and
S2-T08A. Delete the temporary bundle after evidence is complete.

## Evidence Rules

Allowed evidence:

- staging ref;
- reviewed source SHA and checksums;
- backup timestamp/status;
- count-only audit results;
- migration names/status;
- function name/version/status;
- HTTP status and safe code;
- redacted S2-T08 run ID and assertion names.

Never retain credentials, tokens, pairing codes, fingerprints, user IDs,
emails, database rows, private payloads, or terminal input screenshots.
