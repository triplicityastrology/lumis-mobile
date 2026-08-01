#!/usr/bin/env bash
# Normal Lumis app launcher for the approved, development-only Care Circle founder test.
set -euo pipefail

EXPECTED_ROOT="/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
EXPECTED_REF="bmqhwofmdgebpcihjlnb"
EXPECTED_URL="https://bmqhwofmdgebpcihjlnb.supabase.co"
EXPECTED_DEPLOYMENT_GATE="0032,0033,0034,care-circle"
EXPECTED_HEALTH_GATE="passed"
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MOBILE_DIR="$ROOT/apps/mobile"
ENV_FILE="$MOBILE_DIR/.env"
CONTROL_FILE="$ROOT/supabase/tests/s2-t43-care-circle-function-pat-control.json"
PORT="${LUMIS_EXPO_PORT:-8081}"

stop() { printf 'STOP_S2_T105_%s\n' "$1" >&2; exit 1; }
read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; found += 1 } END { if (found != 1) exit 1 }' "$ENV_FILE"
}

[[ "$ROOT" == "$EXPECTED_ROOT" ]] || stop "WORKTREE_MISMATCH"
[[ -f "$ENV_FILE" ]] || stop "MOBILE_ENV_MISSING"
[[ -f "$CONTROL_FILE" ]] || stop "FUNCTION_CONTROL_MISSING"
[[ "${S2_CARE_CIRCLE_DEPLOYMENT_GATE:-}" == "$EXPECTED_DEPLOYMENT_GATE" ]] || stop "DEPLOYMENT_NOT_READY"
[[ "${S2_CARE_CIRCLE_HEALTH_GATE:-}" == "$EXPECTED_HEALTH_GATE" ]] || stop "FUNCTION_HEALTH_NOT_READY"
case "$PORT" in 8081|8082) ;; *) stop "PORT_INVALID" ;; esac
command -v git >/dev/null 2>&1 || stop "GIT_UNAVAILABLE"
command -v lsof >/dev/null 2>&1 || stop "LSOF_UNAVAILABLE"
command -v node >/dev/null 2>&1 || stop "NODE_UNAVAILABLE"
command -v pnpm >/dev/null 2>&1 || stop "PNPM_UNAVAILABLE"

GIT_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
[[ "$GIT_ROOT" == "$ROOT" ]] || stop "WORKTREE_MISMATCH"
COMMIT="$(git -C "$ROOT" rev-parse --verify HEAD 2>/dev/null || true)"
BRANCH="$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ && -n "$BRANCH" ]] || stop "SOURCE_REVISION_UNVERIFIED"
[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]] || stop "TRACKED_TREE_DIRTY"

PROJECT_REF="$(read_env SUPABASE_PROJECT_REF)" || stop "PROJECT_REF_MISSING"
SUPABASE_URL="$(read_env EXPO_PUBLIC_SUPABASE_URL)" || stop "SUPABASE_URL_MISSING"
SUPABASE_KEY="$(read_env EXPO_PUBLIC_SUPABASE_KEY)" || stop "PUBLISHABLE_KEY_MISSING"
[[ "$PROJECT_REF" == "$EXPECTED_REF" ]] || stop "PROJECT_REF_MISMATCH"
[[ "$SUPABASE_URL" == "$EXPECTED_URL" ]] || stop "SUPABASE_URL_MISMATCH"
[[ -n "$SUPABASE_KEY" ]] || stop "PUBLISHABLE_KEY_MISSING"

# Validate the public client key without printing it. Legacy anon JWTs and current
# publishable keys are permitted; secret/service-role credentials fail closed.
PUBLIC_KEY="$SUPABASE_KEY" node - <<'NODE' || stop "PUBLIC_KEY_UNSAFE"
const key = process.env.PUBLIC_KEY ?? "";
let safe = key.startsWith("sb_publishable_");
if (!safe && key.split(".").length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    safe = payload.role === "anon";
  } catch {
    safe = false;
  }
}
if (!safe || /sb_secret_|service_role|sbp_/i.test(key)) process.exit(1);
NODE
unset PUBLIC_KEY

FUNCTION_SHA="$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.function_sha256)' "$CONTROL_FILE")"
[[ "$FUNCTION_SHA" =~ ^[0-9a-f]{64}$ ]] || stop "FUNCTION_CONTROL_INVALID"
[[ "${S2_CARE_CIRCLE_DEPLOYED_SHA256:-}" == "$FUNCTION_SHA" ]] || stop "DEPLOYED_CHECKSUM_NOT_READY"
LOCAL_FUNCTION_SHA="$(shasum -a 256 "$ROOT/supabase/functions/care-circle/index.ts" | awk '{print $1}')"
[[ "$LOCAL_FUNCTION_SHA" == "$FUNCTION_SHA" ]] || stop "LOCAL_FUNCTION_CHECKSUM_MISMATCH"

# An empty result is normal. Never use a `lsof | head` pipeline under pipefail.
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PIDS" ]]; then
  while IFS= read -r PID; do
    [[ -z "$PID" ]] && continue
    PROCESS_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
    case "$PROCESS_CWD" in
      "$ROOT"|"$MOBILE_DIR") stop "PORT_ALREADY_SERVING_LUMIS" ;;
      *) stop "PORT_OWNED_BY_ANOTHER_PROJECT" ;;
    esac
  done <<< "$PIDS"
fi

printf 'LUMIS_CURRENT_BUILD commit=%s branch=%s app=normal care_circle=founder_test tracked_tree=clean\n' "$COMMIT" "$BRANCH"
printf 'CARE_CIRCLE_PUBLIC_GATES project=approved deployment=confirmed health=passed checksum=matched\n'
printf 'Starting normal Lumis on port %s. Keep this Terminal open; press Ctrl+C to stop.\n' "$PORT"

export EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="$COMMIT"
export EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1
export EXPO_PUBLIC_CARE_CIRCLE_STAGING_DEPLOYMENT_READY=1
export EXPO_PUBLIC_SUPABASE_PROJECT_REF="$PROJECT_REF"
export EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export EXPO_PUBLIC_SUPABASE_KEY="$SUPABASE_KEY"
unset SUPABASE_KEY

cd "$ROOT"
exec pnpm --dir "$MOBILE_DIR" exec expo start --tunnel --port "$PORT" --clear
