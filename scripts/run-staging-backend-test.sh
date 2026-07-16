#!/usr/bin/env bash

set -euo pipefail

project_ref="${SUPABASE_PROJECT_REF:-bmqhwofmdgebpcihjlnb}"
mobile_env="apps/mobile/.env"

if [[ "$project_ref" != "bmqhwofmdgebpcihjlnb" ]]; then
  printf 'Refusing to run: expected Lumis staging project bmqhwofmdgebpcihjlnb, received %s.\n' "$project_ref" >&2
  exit 1
fi

if [[ -z "${SUPABASE_ANON_KEY:-}" && -f "$mobile_env" ]]; then
  while IFS='=' read -r name value; do
    if [[ "$name" == "EXPO_PUBLIC_SUPABASE_KEY" || "$name" == "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ]]; then
      SUPABASE_ANON_KEY="$value"
      break
    fi
  done < "$mobile_env"
fi

if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
  printf 'The staging publishable key was not found in apps/mobile/.env.\n' >&2
  exit 1
fi

printf 'Lumis hosted QA will create disposable staging users, run race/RLS/deletion checks, then clean them up.\n'
printf 'Paste the temporary legacy service_role key (input is hidden), then press Return: '
IFS= read -r -s service_role_key
printf '\n'

if [[ -z "$service_role_key" ]]; then
  printf 'No key entered; hosted QA was not run.\n' >&2
  exit 1
fi

SUPABASE_PROJECT_REF="$project_ref" \
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$service_role_key" \
node scripts/staging-backend-smoke.mjs

unset service_role_key
printf 'Hosted QA finished. The temporary key was not written to a file or command history.\n'
