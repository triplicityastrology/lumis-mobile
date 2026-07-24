#!/usr/bin/env bash

set -euo pipefail

project_ref="${SUPABASE_PROJECT_REF:-bmqhwofmdgebpcihjlnb}"
mobile_env="apps/mobile/.env"

if [[ "$project_ref" != "bmqhwofmdgebpcihjlnb" ]]; then
  printf 'Refusing to run outside Lumis staging project bmqhwofmdgebpcihjlnb.\n' >&2
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

node --input-type=module -e '
  const module = await import("@supabase/supabase-js");
  if (typeof module.createClient !== "function") process.exit(1);
'

printf 'This staging-only proof temporarily removes CHART_WORKER_URL, verifies rollback, and restores it automatically.\n'
printf 'Paste the dedicated Supabase sb_secret_ QA key (input is hidden), then press Return: '
IFS= read -r -s secret_key
printf '\n'

if [[ ! "$secret_key" == sb_secret_* ]]; then
  unset secret_key
  printf 'A dedicated sb_secret_ key is required.\n' >&2
  exit 1
fi

SUPABASE_PROJECT_REF="$project_ref" \
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
SUPABASE_SECRET_KEY="$secret_key" \
node scripts/staging-prof2-missing-worker-proof.mjs

unset secret_key
printf 'Missing-Worker proof finished. The secret key was not stored.\n'
