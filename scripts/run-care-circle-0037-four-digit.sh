#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ENGINE="${S2_T148_ENGINE:-auto}"

stop() { printf 'STOP_S2_T148_%s\n' "$1" >&2; exit 1; }
[[ "$ENGINE" == "auto" || "$ENGINE" == "docker" || "$ENGINE" == "local" ]] || stop ENGINE_INVALID
for name in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL PGHOST PGDATABASE PGUSER PGPASSWORD; do
  [[ -z "${!name:-}" ]] || stop REMOTE_OR_EXISTING_DATABASE_CONTEXT_PRESENT
done

docker_ready=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  image="${S2_T135_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.143}"
  if docker image inspect "$image" >/dev/null 2>&1; then docker_ready=1; fi
fi

local_ready=1
for command in initdb pg_ctl postgres createdb psql; do
  command -v "$command" >/dev/null 2>&1 || local_ready=0
done
if [[ "$local_ready" == "1" ]] && ! postgres --version | grep -Eq 'PostgreSQL\) 17\.'; then local_ready=0; fi

if [[ "$ENGINE" == "docker" && "$docker_ready" != "1" ]]; then stop DOCKER_POSTGRES17_UNAVAILABLE; fi
if [[ "$ENGINE" == "local" && "$local_ready" != "1" ]]; then stop LOCAL_POSTGRES17_UNAVAILABLE; fi
if [[ "$ENGINE" == "auto" ]]; then
  if [[ "$docker_ready" == "1" ]]; then ENGINE="docker"
  elif [[ "$local_ready" == "1" ]]; then ENGINE="local"
  else stop ISOLATED_POSTGRES17_UNAVAILABLE
  fi
fi

printf 'S2_T148_RUNTIME_SELECTED engine=%s network=disabled disposable=true\n' "$ENGINE"
exec "$ROOT/scripts/run-care-circle-0037-${ENGINE}.sh"
