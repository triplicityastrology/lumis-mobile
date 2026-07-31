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

## S2-T39 Passwordless Controlled Staging Route

Status: prepared only. The potentially exposed database password is retired and
must never be reused. Password rotation is not a prerequisite for this route.
No step below may run until PM and QA accept this exceptional execution path.
For the S2-T39 window, this section supersedes Gate 3 and Future Authorized
Deployment above: do not run `migration list`, `db push`, or any database-
password prompt from those sections.

Supabase recommends `db push` for tracked migrations because ordinary SQL
Editor changes bypass `supabase_migrations.schema_migrations`. Therefore the
Dashboard route is compliant only when the migration body and its matching
history record are committed in the same reviewed transaction. Never run a
migration body by itself and never repair history after an untracked write.

### Credential and interface boundaries

| Step | Approved interface | Credential boundary |
| --- | --- | --- |
| Project/ref confirmation | Authenticated Dashboard project header/settings | Existing Founder owner session; no value copied |
| Backup/restore evidence review | Existing metadata-only evidence | No credential |
| Legacy count audit | Dashboard SQL Editor | Existing Founder owner session |
| Migration-history/schema inspection | Dashboard SQL Editor, read-only | Existing Founder owner session |
| Exact-order rollback rehearsal | Dashboard SQL Editor transaction ending in `rollback` | Existing Founder owner session |
| Migrations `0032` then `0033` then `0034` | Dashboard SQL Editor, one atomic migration-plus-history transaction at a time | Existing Founder owner session |
| Function secret-name and deployed-version checks | Dashboard names/status views or CLI | Existing owner session, or fresh hidden PAT for CLI |
| Deploy reviewed multi-file `care-circle` function | Supabase CLI only; Dashboard function editor is not an approved deploy path | Fresh hidden PAT, exported for the command and immediately unset |
| Disposable evidence | Existing gated T08A harness | Fresh hidden staging `sb_secret_` QA key and staging publishable key; immediately unset |

The PAT carries the Founder's account privileges and is not a database
password. Create it only for the approved window, enter it through a hidden
local prompt, never run `supabase login`, and revoke it after function/evidence
capture. Never print project keys. The temporary `sb_secret_` key must be
revoked after disposable cleanup. No credential belongs in `.env`, shell
history, evidence, screenshots, or chat.

### Passwordless pre-write gates

1. In the Dashboard, visually confirm exact ref `bmqhwofmdgebpcihjlnb`. A label
   such as `main` or `Production` is not sufficient. Stop on any mismatch.
2. Confirm the accepted logical-backup restore evidence and destruction
   deadline remain recorded. Do not remount or expose backup contents.
3. Run `supabase/tests/s2-t09-care-circle-legacy-audit.sql` in SQL Editor.
   Capture counts only. Stop on nonzero revoked or non-SHA-256-shape counts, an
   unexpected field, query error, or body-bearing notification result requiring
   privacy review.
4. Run this metadata-only query in SQL Editor and capture column names/types
   only:

   ```sql
   select column_name, data_type, udt_name, is_nullable
   from information_schema.columns
   where table_schema = 'supabase_migrations'
     and table_name = 'schema_migrations'
   order by ordinal_position;
   ```

   Stop unless the migration-history shape supports the reviewed atomic history
   insert. Do not guess columns or values.
5. Query only migration version/name metadata and reconcile it with the local
   migration directory. Stop if `0032`, `0033`, or `0034` is already recorded,
   any earlier local migration is missing remotely, or any unexpected later
   migration exists.
6. In one SQL Editor transaction, concatenate the checksum-verified `0032`,
   `0033`, and `0034` sources in order and end with `rollback;`. This is the
   passwordless dry-run equivalent. It must complete without error and leave
   both schema and migration history unchanged. Stop on any error or ambiguity.
7. Re-run the local checksum/readiness contracts. Stop unless they still match
   the deployment-control JSON exactly.

### Controlled writes after gate release

For each migration, Technical prepares one reviewable SQL Editor transaction
containing only:

1. `begin;`;
2. the byte-for-byte checksum-verified migration source;
3. one migration-history insert matching the metadata shape verified above;
4. a metadata-only assertion that exactly that version is recorded; and
5. `commit;`.

Execute and verify `0032`, then `0033`, then `0034`. Stop after the first failed,
partial, duplicate, or unexpected result. Never paste all three into an
unreviewed write tab, never use `migration repair`, and never continue to the
function without exact migration parity.

After parity, use a fresh hidden PAT with pinned CLI `2.109.1` to verify exact
project access, list secret names, deploy only `care-circle`, and list its
version/status. The Dashboard function editor may inspect names/status but must
not recreate or edit this multi-file function. Unset and revoke the PAT.

Finally, use the existing T08A execute gate with fresh hidden staging QA keys.
Run disposable Caree/six-Carer evidence, cleanup by redacted run ID, verify zero
disposable accounts remain, then revoke the temporary secret key. Do not run
T08B or deploy `notification-device`.

### S2-T39 stop conditions

Stop before writes if the project ref, backup evidence, source SHA, checksum,
migration history, history-table shape, count-only audit, rollback rehearsal,
pairing-secret name, or approval differs from the reviewed record. Stop after
writes on any parity failure, unsafe function source/version, unauthenticated
result other than `401 AUTH_REQUIRED`, evidence redaction failure, incomplete
cleanup, or credential exposure. Keep Care Circle static and inactive and use
forward-only recovery only.
