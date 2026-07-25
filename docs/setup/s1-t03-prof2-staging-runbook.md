# S1-T03 PROF-2 Staging Deployment Runbook

Date: 2026-07-26

Target:

- Supabase project: `lumis-mobile`
- Supabase project ref: `bmqhwofmdgebpcihjlnb`
- Cloudflare Worker: `lumis-chart-staging`
- Environment: staging only

This runbook never prints entered secret values. Secret prompts use hidden Terminal
input. The verification commands print configuration names and deployment metadata
only.

## Prerequisites

- Supabase CLI login is active.
- Wrangler login is active.
- A dedicated, separately revocable staging `sb_secret_` QA key is available.
- The staging database password is available.
- The astrology provider API key is available.
- A shared Worker signing secret is available. The same value is installed in
  Cloudflare and Supabase.

## 1. Confirm Target, Configure, Deploy, and Test

Paste this complete block into Terminal. There are no shell comment lines because
interactive zsh may treat them as commands.

```bash
(
set -euo pipefail

REPO="/Users/rubyku/Documents/Mobile App/lumis-mobile"
PNPM="/Users/rubyku/.local/node22/bin/pnpm"
NODE="/Users/rubyku/.local/node22/bin/node"
EXPECTED_REF="bmqhwofmdgebpcihjlnb"
EXPECTED_WORKER="lumis-chart-staging"
WORKER_URL="https://lumis-chart-staging.triplicityastrology.workers.dev"
ROLLBACK_COMMIT="467a3f980a3bc201d69d14747e13ebd38326ca73"
EVIDENCE_DIR="/private/tmp/lumis-s1-t03-$(date +%Y%m%d-%H%M%S)"
SECRET_FILE="$(mktemp)"

cleanup_runbook() {
  rm -f "$SECRET_FILE"
  unset SHARED_SIGNING_SECRET
  unset ASTRO_API_KEY
  unset SUPABASE_DB_PASSWORD
}
trap cleanup_runbook EXIT INT TERM

cd "$REPO"
mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"
chmod 600 "$SECRET_FILE"

printf 'Step 1: Confirming linked staging project.\n'
LINKED_REF="$(tr -d '[:space:]' < supabase/.temp/project-ref)"
if [[ "$LINKED_REF" != "$EXPECTED_REF" ]]; then
  printf 'STOP: linked project is %s, expected %s.\n' "$LINKED_REF" "$EXPECTED_REF" >&2
  exit 1
fi

"$PNPM" dlx supabase@latest projects list --output-format json |
"$NODE" --input-type=module -e '
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  const parsed = JSON.parse(source);
  const rows = Array.isArray(parsed) ? parsed : (parsed.projects ?? []);
  const expected = "bmqhwofmdgebpcihjlnb";
  const project = rows.find((row) => (row.id ?? row.ref) === expected);
  if (!project) process.exit(2);
  console.log(JSON.stringify({
    confirmed_project_ref: expected,
    project_name: project.name ?? "lumis-mobile",
    region: project.region ?? null
  }, null, 2));
'

printf 'Step 2: Entering configuration securely.\n'
IFS= read -r -s "SHARED_SIGNING_SECRET?Paste the shared Worker signing secret, then press Return: "
printf '\n'
IFS= read -r -s "ASTRO_API_KEY?Paste the astrology provider API key, then press Return: "
printf '\n'

if [[ -z "$SHARED_SIGNING_SECRET" || -z "$ASTRO_API_KEY" ]]; then
  printf 'STOP: both hidden secret values are required.\n' >&2
  exit 1
fi

printf 'Step 3: Installing Cloudflare secrets without printing values.\n'
cd "$REPO/workers/chart-mobile"
printf '%s' "$SHARED_SIGNING_SECRET" |
"$PNPM" dlx wrangler@latest secret put CHART_WORKER_SIGNING_SECRET
printf '%s' "$ASTRO_API_KEY" |
"$PNPM" dlx wrangler@latest secret put ASTRO_API_KEY

printf 'Step 4: Installing matching Supabase staging configuration.\n'
cd "$REPO"
{
  printf 'CHART_WORKER_URL=%s\n' "$WORKER_URL"
  printf 'CHART_WORKER_ENDPOINT=/mobile/natal-chart\n'
  printf 'CHART_WORKER_SIGNING_SECRET=%s\n' "$SHARED_SIGNING_SECRET"
  printf 'CHART_WORKER_TIMEOUT_MS=15000\n'
  printf 'LUMIS_ENV=staging\n'
} > "$SECRET_FILE"

"$PNPM" dlx supabase@latest secrets set \
  --env-file "$SECRET_FILE" \
  --project-ref "$EXPECTED_REF"

rm -f "$SECRET_FILE"
unset SHARED_SIGNING_SECRET
unset ASTRO_API_KEY

printf 'Step 5: Verifying configuration names only.\n'
"$PNPM" dlx supabase@latest secrets list \
  --project-ref "$EXPECTED_REF" \
  --output-format json |
"$NODE" --input-type=module -e '
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  const parsed = JSON.parse(source);
  const rows = Array.isArray(parsed) ? parsed : (parsed.secrets ?? []);
  const names = new Set(rows.map((row) => row.name));
  const required = [
    "CHART_WORKER_URL",
    "CHART_WORKER_ENDPOINT",
    "CHART_WORKER_SIGNING_SECRET",
    "CHART_WORKER_TIMEOUT_MS",
    "LUMIS_ENV"
  ];
  const result = Object.fromEntries(required.map((name) => [name, names.has(name)]));
  console.log(JSON.stringify({ supabase_required_names: result }, null, 2));
  if (required.some((name) => !names.has(name))) process.exit(3);
'

cd "$REPO/workers/chart-mobile"
"$PNPM" dlx wrangler@latest secret list --format json |
"$NODE" --input-type=module -e '
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  const rows = JSON.parse(source);
  const names = new Set(rows.map((row) => row.name));
  const required = ["ASTRO_API_KEY", "CHART_WORKER_SIGNING_SECRET"];
  const result = Object.fromEntries(required.map((name) => [name, names.has(name)]));
  console.log(JSON.stringify({
    worker: "lumis-chart-staging",
    cloudflare_required_names: result
  }, null, 2));
  if (required.some((name) => !names.has(name))) process.exit(4);
'

printf 'Step 6: Checking migration plan without applying unexpected migrations.\n'
cd "$REPO"
IFS= read -r -s "SUPABASE_DB_PASSWORD?Paste the staging database password, then press Return: "
printf '\n'
export SUPABASE_DB_PASSWORD

"$PNPM" dlx supabase@latest migration list --linked |
tee "$EVIDENCE_DIR/migration-list-before.txt"

DRY_RUN_OUTPUT="$("$PNPM" dlx supabase@latest db push --linked --dry-run 2>&1)"
printf '%s\n' "$DRY_RUN_OUTPUT" |
tee "$EVIDENCE_DIR/migration-dry-run.txt"

UNEXPECTED_MIGRATIONS="$(
  printf '%s\n' "$DRY_RUN_OUTPUT" |
  sed -n 's/^ • \([0-9][0-9][0-9][0-9]_[^[:space:]]*\).*/\1/p' |
  grep -v '^0026_birth_details_regeneration\.sql$' || true
)"

if [[ -n "$UNEXPECTED_MIGRATIONS" ]]; then
  printf 'STOP: unexpected pending migrations were found:\n%s\n' "$UNEXPECTED_MIGRATIONS" >&2
  exit 1
fi

printf 'Step 7: Applying migration 0026 if pending.\n'
"$PNPM" dlx supabase@latest db push --linked --yes |
tee "$EVIDENCE_DIR/database-push.txt"
unset SUPABASE_DB_PASSWORD

printf 'Step 8: Deploying the profile Edge Function.\n'
"$PNPM" dlx supabase@latest functions deploy profile \
  --project-ref "$EXPECTED_REF" 2>&1 |
tee "$EVIDENCE_DIR/profile-deploy.txt"

"$PNPM" dlx supabase@latest functions list \
  --project-ref "$EXPECTED_REF" \
  --output-format json |
"$NODE" --input-type=module -e '
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  const parsed = JSON.parse(source);
  const rows = Array.isArray(parsed) ? parsed : (parsed.functions ?? []);
  const profile = rows.find((row) => row.name === "profile");
  if (!profile) process.exit(5);
  console.log(JSON.stringify({
    name: profile.name,
    version: profile.version,
    status: profile.status,
    updated_at: profile.updated_at
  }, null, 2));
' |
tee "$EVIDENCE_DIR/profile-version.json"

printf 'Step 9: Running the redacted hosted PROF-2 proof.\n'
"$PNPM" test:staging-prof2:secure |
tee "$EVIDENCE_DIR/prof2-hosted-proof.log"

printf 'Step 10: Running the reversible missing-Worker rollback proof.\n'
"$PNPM" test:staging-prof2-missing-worker:secure |
tee "$EVIDENCE_DIR/prof2-missing-worker-proof.log"

printf 'S1-T03 staging run completed. Redacted evidence is in:\n%s\n' "$EVIDENCE_DIR"
printf 'Rollback baseline, if needed: %s\n' "$ROLLBACK_COMMIT"
)
```

The two hosted proof commands each request the dedicated staging `sb_secret_`
QA key through hidden input. The key is intentionally not retained between
commands.

## 2. Emergency Worker URL Restore

Run this if the missing-Worker proof is interrupted after removing
`CHART_WORKER_URL`:

```bash
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile"

PATH="/Users/rubyku/.local/node22/bin:$PATH" \
"/Users/rubyku/.local/node22/bin/pnpm" \
dlx supabase@latest secrets set \
CHART_WORKER_URL=https://lumis-chart-staging.triplicityastrology.workers.dev \
--project-ref bmqhwofmdgebpcihjlnb
```

## 3. Repair a Signing-Secret Mismatch

This generates no terminal output containing the entered value. Install the same
hidden value in Cloudflare first and Supabase immediately afterward.

```bash
(
set -euo pipefail

REPO="/Users/rubyku/Documents/Mobile App/lumis-mobile"
PNPM="/Users/rubyku/.local/node22/bin/pnpm"
SECRET_FILE="$(mktemp)"

cleanup_secret_repair() {
  rm -f "$SECRET_FILE"
  unset SHARED_SIGNING_SECRET
}
trap cleanup_secret_repair EXIT INT TERM

chmod 600 "$SECRET_FILE"
IFS= read -r -s "SHARED_SIGNING_SECRET?Paste a new shared signing secret, then press Return: "
printf '\n'

cd "$REPO/workers/chart-mobile"
printf '%s' "$SHARED_SIGNING_SECRET" |
"$PNPM" dlx wrangler@latest secret put CHART_WORKER_SIGNING_SECRET

printf 'CHART_WORKER_SIGNING_SECRET=%s\n' "$SHARED_SIGNING_SECRET" > "$SECRET_FILE"
cd "$REPO"
"$PNPM" dlx supabase@latest secrets set \
  --env-file "$SECRET_FILE" \
  --project-ref bmqhwofmdgebpcihjlnb
)
```

## 4. Edge Function Rollback

The safe rollback leaves migration `0026` in place because it is additive,
backend-only, and may contain audit/reservation rows. It deploys the reviewed
pre-T02 `profile` function from a detached temporary worktree without changing
the current branch.

```bash
(
set -euo pipefail

REPO="/Users/rubyku/Documents/Mobile App/lumis-mobile"
PNPM="/Users/rubyku/.local/node22/bin/pnpm"
ROLLBACK_COMMIT="467a3f980a3bc201d69d14747e13ebd38326ca73"
ROLLBACK_DIR="/private/tmp/lumis-profile-rollback-$$"

cleanup_rollback() {
  cd "$REPO"
  git worktree remove --force "$ROLLBACK_DIR" 2>/dev/null || true
}
trap cleanup_rollback EXIT INT TERM

cd "$REPO"
git worktree add --detach "$ROLLBACK_DIR" "$ROLLBACK_COMMIT"
cd "$ROLLBACK_DIR"

"$PNPM" dlx supabase@latest functions deploy profile \
  --project-ref bmqhwofmdgebpcihjlnb

printf 'Profile function rolled back to commit %s.\n' "$ROLLBACK_COMMIT"
printf 'Migration 0026 was intentionally retained as dormant additive schema.\n'
)
```

Do not drop `birth_detail_change_requests` or the PROF-2 RPCs as an emergency
rollback. If schema removal is ever required, create a separately reviewed
forward migration after confirming there are no retained requests or audit
requirements.

## 5. Recorded Staging Evidence

As of 2026-07-26:

- Required Supabase configuration names: present.
- Required Cloudflare secret names: present.
- `profile` Edge Function: active, version 21.
- Hosted PROF-2 scope: passed.
- Missing Worker configuration: returned `49003`.
- Failed regeneration preserved the previous chart/profile and lifetime count.
- No fixture or replacement chart/profile version was committed.
- Cross-user and protected RPC access: denied.
- Temporary Worker URL removal: restored successfully.
