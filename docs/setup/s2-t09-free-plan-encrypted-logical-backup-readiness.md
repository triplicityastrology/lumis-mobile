# S2-T09 Free-Plan Encrypted Logical Backup Readiness

Status: source-only, Founder-approved, PM/QA classification acceptance pending,
and impossible to execute through the package command. This document prepares
a possible substitute for unavailable Supabase scheduled backup/PITR. It does
not weaken the existing Gate 2 stop.

Approved project: `bmqhwofmdgebpcihjlnb`.

Pinned Supabase CLI: `2.109.1`.

No command in this document has been executed. Future execution requires
Founder/data-owner, PM, QA, security/privacy, and Technical-lead approval.

## Decision Boundary

The substitute is defensible only for a bounded staging migration window after
an encrypted logical dump has been restored and validated in an isolated,
disposable environment. It is not PITR, does not provide second-level recovery,
and is not a complete Supabase platform backup.

The preferred failure recovery remains a reviewed, forward-only corrective
migration. Restoring a logical dump into staging is a separately approved
last-resort operation.

## Exact Backup Scope

Capture:

- roles and application grants;
- complete user-managed schema, functions, policies, indexes, and comments;
- complete relational data required to restore application-owned `public`
  state, including users, entitlements, chart history, Care Circle legacy rows,
  notifications, and migration history;
- metadata-only source commit, CLI version, PostgreSQL major version, UTC
  timestamp, file names, byte sizes, and SHA-256 values.

Do not selectively dump only Care Circle tables. Migrations `0032` and `0033`
alter existing `users`, `care_relationships`, `care_relationship_events`, and
`notifications` boundaries.

Explicit exclusions:

- Storage object binaries;
- Edge Function secrets;
- provider credentials and secrets;
- raw terminal output, connection strings, and database URLs.

## Auth Schema With CLI 2.109.1

The pinned CLI's normal schema dump excludes Supabase-managed schemas,
including `auth` and `storage`. The supported `--data-only` mode can emit
managed relational data needed for migration/restore workflows, but Auth data
contains password hashes and identity metadata and is highly sensitive.

Auth data may be included only when all of the following are true:

1. security/privacy and Founder/data-owner explicitly approve it;
2. plaintext exists only inside the mounted AES-256 volume;
3. the isolated target is a compatible Supabase environment that already owns
   the managed Auth schema and matching PostgreSQL major version;
4. the data-only dump dry-run proves the expected managed-data scope without
   displaying row contents;
5. isolated restore proves public/Auth referential integrity.

If any condition fails, stop. A generic PostgreSQL database without compatible
Supabase managed schemas is not sufficient restoration evidence.

## Future Secure Local Destination

The only approved parent is:

`/Users/rubyku/Library/Application Support/LumisSecureBackups`

The backup must never be under the repository, Google Drive, iCloud,
`~/Library/Mobile Documents`, CloudStorage, Desktop, Downloads, or an included
Time Machine path.

The future operator must first verify the destination and Time Machine
exclusion. These commands are documentation only:

```zsh
BACKUP_PARENT="/Users/rubyku/Library/Application Support/LumisSecureBackups"

case "$BACKUP_PARENT" in
  *"/lumis-mobile"*|*"/GoogleDrive"*|*"/Google Drive"*|*"/CloudStorage"*|*"/iCloud"*|*"/Mobile Documents"*|*"/Desktop"*|*"/Downloads"*)
    printf 'STOP: forbidden backup destination.\n' >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_PARENT"
chmod 700 "$BACKUP_PARENT"

BACKUP_PARENT_REAL="$(cd "$BACKUP_PARENT" && pwd -P)"
if [[ "$BACKUP_PARENT_REAL" != "$BACKUP_PARENT" ]]; then
  printf 'STOP: backup parent resolves outside the approved path.\n' >&2
  exit 1
fi

tmutil addexclusion -p "$BACKUP_PARENT"
TIME_MACHINE_STATUS="$(tmutil isexcluded "$BACKUP_PARENT")"
if [[ "$TIME_MACHINE_STATUS" != *"[Excluded]"* ]]; then
  printf 'STOP: backup parent is included in Time Machine.\n' >&2
  exit 1
fi
unset TIME_MACHINE_STATUS
```

Stop unless `tmutil isexcluded` reports the exact parent as excluded.

## Future AES-256 APFS Image Creation And Mount

The password is entered twice through hidden input, never placed in command
arguments, printed, logged, or saved to Keychain:

```zsh
set +x
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
IMAGE="$BACKUP_PARENT/lumis-staging-$RUN_ID.sparseimage"
VOLUME_NAME="LumisStagingBackup-$RUN_ID"
MOUNT_POINT="/Volumes/$VOLUME_NAME"

printf 'Enter the one-time backup encryption password: '
IFS= read -r -s BACKUP_IMAGE_PASSWORD
printf '\n'
printf 'Enter it again: '
IFS= read -r -s BACKUP_IMAGE_PASSWORD_CONFIRM
printf '\n'

if [[ "$BACKUP_IMAGE_PASSWORD" != "$BACKUP_IMAGE_PASSWORD_CONFIRM" ]]; then
  unset BACKUP_IMAGE_PASSWORD BACKUP_IMAGE_PASSWORD_CONFIRM
  printf 'STOP: encryption passwords do not match.\n' >&2
  exit 1
fi

if (( ${#BACKUP_IMAGE_PASSWORD} < 20 )); then
  unset BACKUP_IMAGE_PASSWORD BACKUP_IMAGE_PASSWORD_CONFIRM
  printf 'STOP: use a one-time password of at least 20 characters.\n' >&2
  exit 1
fi

printf '%s' "$BACKUP_IMAGE_PASSWORD" |
hdiutil create \
  -size 4g \
  -fs APFS \
  -type SPARSE \
  -encryption AES-256 \
  -stdinpass \
  -volname "$VOLUME_NAME" \
  "$IMAGE"

mkdir -p "$MOUNT_POINT"
printf '%s' "$BACKUP_IMAGE_PASSWORD" |
hdiutil attach \
  "$IMAGE" \
  -stdinpass \
  -nobrowse \
  -mountpoint "$MOUNT_POINT"

unset BACKUP_IMAGE_PASSWORD BACKUP_IMAGE_PASSWORD_CONFIRM
chmod 700 "$MOUNT_POINT"

DISK_INFO="$(diskutil info "$MOUNT_POINT")"
if [[ "$DISK_INFO" != *"File System Personality:  APFS"* ]] ||
   [[ "$DISK_INFO" != *"Encrypted:                 Yes"* ]]; then
  unset DISK_INFO
  printf 'STOP: mounted backup is not encrypted APFS.\n' >&2
  exit 1
fi
unset DISK_INFO
```

Stop if the image or mounted volume is not encrypted APFS, the path differs,
or any plaintext file exists outside `"$MOUNT_POINT"`.

## Future Fail-Closed Project And Version Gate

```zsh
EXPECTED_REF="bmqhwofmdgebpcihjlnb"
PINNED_CLI_VERSION="2.109.1"
PNPM="/Users/rubyku/.local/node22/bin/pnpm"
NODE="/Users/rubyku/.local/node22/bin/node"
LINKED_REF="$(tr -d '[:space:]' < supabase/.temp/project-ref)"

if [[ "$LINKED_REF" != "$EXPECTED_REF" ]]; then
  printf 'STOP: wrong linked project.\n' >&2
  exit 1
fi

ACTUAL_CLI_VERSION="$("$PNPM" dlx "supabase@$PINNED_CLI_VERSION" --version)"
if [[ "$ACTUAL_CLI_VERSION" != "$PINNED_CLI_VERSION" ]]; then
  printf 'STOP: Supabase CLI version mismatch.\n' >&2
  exit 1
fi
```

The PostgreSQL major version must be recorded from staging metadata before
capture. Stop if it is unknown or differs from the isolated validation target.

## Future Hidden-Credential Dump Sequence

The database password is transient and hidden. It is never passed through
`--password`, embedded in a URL, or written to the manifest:

```zsh
printf 'Enter the staging database password: '
IFS= read -r -s SUPABASE_DB_PASSWORD
printf '\n'
export SUPABASE_DB_PASSWORD

"$PNPM" dlx "supabase@$PINNED_CLI_VERSION" db dump \
  --linked \
  --role-only \
  --file "$MOUNT_POINT/roles.sql"

"$PNPM" dlx "supabase@$PINNED_CLI_VERSION" db dump \
  --linked \
  --file "$MOUNT_POINT/schema.sql"

"$PNPM" dlx "supabase@$PINNED_CLI_VERSION" db dump \
  --linked \
  --data-only \
  --use-copy \
  --exclude storage.buckets_vectors \
  --exclude storage.vector_indexes \
  --file "$MOUNT_POINT/data.sql"

unset SUPABASE_DB_PASSWORD
```

Any failed component stops the gate. Do not continue with a partial dump.

## Metadata-Only Manifest

The future manifest must contain only approved metadata. Never parse or print
SQL content:

```zsh
(
  cd "$MOUNT_POINT"
  shasum -a 256 roles.sql schema.sql data.sql > manifest.sha256
  chmod 600 roles.sql schema.sql data.sql manifest.sha256
)

SOURCE_COMMIT="$(git rev-parse HEAD)"
BACKUP_UTC_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

"$NODE" scripts/write-logical-backup-manifest.mjs \
  --write \
  --output "$MOUNT_POINT/manifest.json" \
  --project-ref "$EXPECTED_REF" \
  --source-commit "$SOURCE_COMMIT" \
  --supabase-cli-version "$PINNED_CLI_VERSION" \
  --postgres-major "$POSTGRES_MAJOR" \
  --backup-utc-timestamp "$BACKUP_UTC_TIMESTAMP" \
  --component-root "$MOUNT_POINT"
```

The writer is inert without explicit `--write`, accepts only the exact staging
project and pinned CLI version, and writes only to the approved encrypted
`/Volumes/LumisStagingBackup-...` mount. It reads dump bytes only to compute
SHA-256 and never parses or prints SQL content.

## Isolated Restore Validation Plan

No restore environment is created by this package.

Before capture, record the staging PostgreSQL major version. Pin an isolated
local Supabase/PostgreSQL image to the same major version. Keep it unreachable
from external networks and use a fresh disposable database.

Future validation order:

1. verify `manifest.sha256` before reading any dump;
2. restore roles;
3. initialize compatible Supabase-managed schemas;
4. restore application schema;
5. restore data;
6. verify required extensions and PostgreSQL major version;
7. verify roles, grants, policies, RLS enabled state, function signatures, and
   migration history;
8. verify foreign keys and table-count relationships using counts/status only;
9. verify public/Auth referential integrity when Auth data was approved;
10. run `0032`, `0033`, and `0034` only in the disposable restore;
11. run Care Circle schema/RLS/concurrency contracts there;
12. retain only check names and pass/fail status;
13. destroy the disposable database immediately.

Any restore error, unexpected migration, missing function/policy, orphaned row,
count inconsistency, Auth mismatch, or raw-data output blocks Gate 2.

## Future Secure Unmount And Retention

```zsh
sync
hdiutil detach "$MOUNT_POINT"
shasum -a 256 "$IMAGE" > "$IMAGE.sha256"
chmod 600 "$IMAGE" "$IMAGE.sha256"
```

Retain the encrypted image for no more than seven days and only until PM/QA
accept migration and disposable evidence. Do not move it into a synced or
backed-up location.

At the approved destruction point:

```zsh
hdiutil detach "$MOUNT_POINT" 2>/dev/null || true
rm -f "$IMAGE.sha256"
rm -f "$IMAGE"
rmdir "$BACKUP_PARENT" 2>/dev/null || true
```

On SSD/APFS storage, deletion is not a reliable overwrite. Recovery control
therefore depends on AES-256 crypto-erasure: the one-time password must not be
retained anywhere. Record only the destruction UTC timestamp.

## Forward Recovery

If `0032`-`0034` fails, keep Care Circle inactive and do not deploy the
function. Preserve redacted evidence and prepare a reviewed next-numbered
corrective migration. Never drop migration history or reverse consent/RLS
boundaries manually.

Restoring the logical backup into staging is destructive and remains forbidden
without a separate Founder, PM, QA, security/privacy, and Technical approval.
