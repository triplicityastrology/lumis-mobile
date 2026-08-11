#!/bin/zsh
set -euo pipefail

readonly ROOT=${0:A:h:h}
readonly RUNTIME="$ROOT/.runtime/s2-t277-proof"
readonly SERVICE="$RUNTIME/service"
readonly CONTAINER="lumis-s2-t277-edge-proof"
readonly NETWORK="lumis-s2-t277-edge-proof"
readonly IMAGE="public.ecr.aws/supabase/edge-runtime@sha256:a82676277615aee03c4f288cbbbf68dedb5ba8693073e567ab8dbfdd11ba5d45"
cd "$ROOT"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$SERVICE"
}
trap cleanup EXIT INT TERM

[[ -x node_modules/.bin/deno && -x node_modules/.bin/supabase ]] || { print -u2 "STOP_S2_T277_PINNED_TOOLS_MISSING"; exit 1; }
docker info >/dev/null 2>&1 || { print -u2 "STOP_S2_T277_DOCKER_UNAVAILABLE"; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { print -u2 "STOP_S2_T277_EDGE_IMAGE_NOT_CACHED_NO_PULL_ALLOWED"; exit 1; }
[[ -z ${SUPABASE_ACCESS_TOKEN:-} && -z ${LUMIS_DICE_AZURE_API_KEY:-} ]] || { print -u2 "STOP_S2_T277_REMOTE_CREDENTIAL_ENV_PRESENT"; exit 1; }

rm -rf "$RUNTIME"
mkdir -p "$RUNTIME/edge" "$RUNTIME/deno-cache" "$SERVICE/supabase" "$SERVICE/packages"
cp -R supabase/functions "$SERVICE/supabase/functions"
cp -R packages/shared "$SERVICE/packages/shared"
cp package.json pnpm-lock.yaml "$SERVICE/supabase/functions/dice-synthetic/"
mkdir -p "$SERVICE/supabase/functions/dice-synthetic/node_modules/@supabase"
cp -RL node_modules/@supabase/supabase-js "$SERVICE/supabase/functions/dice-synthetic/node_modules/@supabase/supabase-js"
for package in auth-js functions-js postgrest-js realtime-js storage-js phoenix; do
  cp -RL "node_modules/.pnpm/node_modules/@supabase/$package" "$SERVICE/supabase/functions/dice-synthetic/node_modules/@supabase/$package"
done
cp -RL node_modules/js-tiktoken "$SERVICE/supabase/functions/dice-synthetic/node_modules/js-tiktoken"
cp -RL node_modules/.pnpm/node_modules/base64-js "$SERVICE/supabase/functions/dice-synthetic/node_modules/base64-js"
cp -RL node_modules/.pnpm/node_modules/tslib "$SERVICE/supabase/functions/dice-synthetic/node_modules/tslib"
cp -RL node_modules/.pnpm/node_modules/iceberg-js "$SERVICE/supabase/functions/dice-synthetic/node_modules/iceberg-js"

DENO_DIR="$RUNTIME/deno-cache" ./node_modules/.bin/deno check \
  --config supabase/functions/dice-synthetic/deno.json --no-remote \
  supabase/functions/dice-synthetic/index.ts
DENO_DIR="$RUNTIME/deno-cache" ./node_modules/.bin/deno info \
  --config supabase/functions/dice-synthetic/deno.json --no-remote --json \
  supabase/functions/dice-synthetic/index.ts > "$RUNTIME/import-graph.json"

docker run --rm --network none -v "$SERVICE:/work:ro" \
  -v "$RUNTIME/edge:/runtime" -w /work "$IMAGE" \
  bundle --entrypoint /work/supabase/functions/dice-synthetic/index.ts \
  --output /runtime/dice-synthetic.eszip --checksum sha256 --disable-module-cache --timeout 120

docker network create --internal --label lumis.task=S2-T277 "$NETWORK" >/dev/null
docker run -d --name "$CONTAINER" --label lumis.task=S2-T277 --network "$NETWORK" \
  -e LUMIS_DICE_AI_ENABLED=false -e DENO_NO_UPDATE_CHECK=1 -v "$SERVICE:/work:ro" "$IMAGE" \
  start --main-service /work/supabase/functions/dice-synthetic --port 9000 --policy oneshot --disable-module-cache >/dev/null

for _ in {1..30}; do
  [[ $(docker inspect "$CONTAINER" --format '{{.State.Status}}') == running ]] && break
  sleep 1
done
[[ $(docker inspect "$CONTAINER" --format '{{.State.Status}}') == running ]] || { docker logs "$CONTAINER" >&2; print -u2 "STOP_S2_T277_EDGE_RUNTIME_START_FAILED"; exit 1; }
for _ in {1..30}; do
  docker exec "$CONTAINER" /bin/bash -c 'exec 3<>/dev/tcp/127.0.0.1/9000' >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" /bin/bash -c 'exec 3<>/dev/tcp/127.0.0.1/9000' >/dev/null 2>&1 || {
  docker logs "$CONTAINER" >&2
  print -u2 "STOP_S2_T277_EDGE_RUNTIME_NOT_READY"
  exit 1
}

: > "$RUNTIME/probes.tsv"
typeset -a fixtures=(malformed_json empty_object null_authorization unknown_field)
typeset -a bodies=('not-json' '{}' '{"authorization":null}' '{"unexpected":"field"}')
for index in {1..4}; do
  body=${bodies[$index]}
  encoded=$(printf '%s' "$body" | base64)
  response=$(docker exec "$CONTAINER" /bin/bash -c "body=\$(printf '%s' '$encoded' | base64 -d); exec 3<>/dev/tcp/127.0.0.1/9000; printf 'POST / HTTP/1.1\\r\\nHost: localhost\\r\\nContent-Type: application/json\\r\\nContent-Length: %s\\r\\nConnection: close\\r\\n\\r\\n%s' \"\${#body}\" \"\$body\" >&3; cat <&3")
  http_status=$(printf '%s' "$response" | sed -n '1s/.* \([0-9][0-9][0-9]\) .*/\1/p')
  payload=$(printf '%s' "$response" | tail -n 1)
  [[ "$http_status" == 503 && "$payload" == '{"error":{"code":"DICE_AI_DISABLED"}}' ]] || { print -u2 "STOP_S2_T277_DISABLED_PROBE_FAILED"; exit 1; }
  printf '%s\t503\tDICE_AI_DISABLED\n' ${fixtures[$index]} >> "$RUNTIME/probes.tsv"
done

node scripts/s2-t272-runtime-receipt.mjs "$RUNTIME/import-graph.json" \
  "$RUNTIME/edge/dice-synthetic.eszip" "$RUNTIME/probes.tsv" "$RUNTIME/receipt.json"
cat "$RUNTIME/receipt.json"
