#!/usr/bin/env bash

set -euo pipefail

project_ref="${SUPABASE_PROJECT_REF:-bmqhwofmdgebpcihjlnb}"
mobile_env="apps/mobile/.env"
mode="${1:-run}"
cleanup_run_id="${2:-}"

if [[ "$mode" == "cleanup" && "$cleanup_run_id" == "--" ]]; then
  cleanup_run_id="${3:-}"
fi

if [[ "$project_ref" != "bmqhwofmdgebpcihjlnb" ]]; then
  printf 'Refusing to run: expected Lumis staging project bmqhwofmdgebpcihjlnb, received %s.\n' "$project_ref" >&2
  exit 1
fi

if [[ "$mode" != "run" && "$mode" != "cleanup" ]]; then
  printf 'Usage: pnpm test:staging-backend:secure OR pnpm test:staging-backend:cleanup -- <run-id>\n' >&2
  exit 1
fi

if [[ "$mode" == "cleanup" && ! "$cleanup_run_id" =~ ^[0-9]{13}-[a-f0-9]+$ ]]; then
  printf 'A valid hosted QA run ID is required for cleanup.\n' >&2
  exit 1
fi

if [[ "$mode" == "run" && -z "${SUPABASE_ANON_KEY:-}" && -f "$mobile_env" ]]; then
  while IFS='=' read -r name value; do
    if [[ "$name" == "EXPO_PUBLIC_SUPABASE_KEY" || "$name" == "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ]]; then
      SUPABASE_ANON_KEY="$value"
      break
    fi
  done < "$mobile_env"
fi

if [[ "$mode" == "run" && -z "${SUPABASE_ANON_KEY:-}" ]]; then
  printf 'The staging publishable key was not found in apps/mobile/.env.\n' >&2
  exit 1
fi

if [[ "$mode" == "run" ]]; then
  printf 'Lumis hosted QA will create disposable staging users, run race/RLS/deletion checks, then clean them up.\n'
else
  printf 'Lumis will remove disposable users and records left by hosted QA run %s.\n' "$cleanup_run_id"
fi
printf 'Paste the dedicated Supabase sb_secret_ QA key (input is hidden), then press Return: '
IFS= read -r -s secret_key
printf '\n'

if [[ ! "$secret_key" == sb_secret_* ]]; then
  unset secret_key
  printf 'A dedicated sb_secret_ key is required; legacy service_role JWTs are not accepted.\n' >&2
  exit 1
fi

if [[ "$mode" == "cleanup" ]]; then
  SUPABASE_PROJECT_REF="$project_ref" \
  SUPABASE_SECRET_KEY="$secret_key" \
  node scripts/staging-backend-cleanup.mjs "$cleanup_run_id"
else
  SUPABASE_PROJECT_REF="$project_ref" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SECRET_KEY="$secret_key" \
  node scripts/staging-backend-smoke.mjs
fi

unset secret_key
printf 'Hosted QA command finished. The secret key was not written to a file or command history.\n'
