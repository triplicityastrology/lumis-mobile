#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT"
node scripts/s2-care-circle-four-digit-seal.mjs --check >/dev/null

project_ref="${SUPABASE_PROJECT_REF:-bmqhwofmdgebpcihjlnb}"
mode="${1:-}"
run_id=""

if [[ "$project_ref" != "bmqhwofmdgebpcihjlnb" ]]; then
  printf 'Refusing to run outside the approved Lumis staging project.\n' >&2
  exit 1
fi

if [[ "$mode" != "--execute" ]]; then
  printf 'Execution is disabled. PM-authorised use requires --execute.\n' >&2
  exit 1
fi
shift

if [[ "${1:-}" == "--cleanup" ]]; then
  shift
  run_id="${1:-}"
  if [[ ! "$run_id" =~ ^[0-9]{13}-[a-f0-9]+$ ]]; then
    printf 'A valid redacted run ID is required for cleanup.\n' >&2
    exit 1
  fi
fi

printf 'Paste the dedicated staging sb_secret_ QA key (input hidden): '
IFS= read -r -s secret_key
printf '\n'
printf 'Paste the staging sb_publishable_ key (input hidden): '
IFS= read -r -s publishable_key
printf '\n'

if [[ ! "$secret_key" == sb_secret_* || ! "$publishable_key" == sb_publishable_* ]]; then
  unset secret_key publishable_key
  printf 'The required staging key shapes were not supplied.\n' >&2
  exit 1
fi

command_args=(
  --execute
  --project-ref
  "$project_ref"
)
if [[ -n "$run_id" ]]; then
  command_args+=(--cleanup --run-id "$run_id")
fi

S2_EVIDENCE_EXECUTE="CONFIRMED" \
S2_STAGING_SECRET_KEY="$secret_key" \
S2_STAGING_PUBLISHABLE_KEY="$publishable_key" \
node scripts/s2-care-circle-staging-evidence.mjs "${command_args[@]}"

unset secret_key publishable_key
printf 'Care Circle evidence command finished without storing credential values.\n'
