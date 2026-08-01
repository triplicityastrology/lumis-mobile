#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MOBILE_DIR="$ROOT/apps/mobile"
WORKBENCH_DIR="$MOBILE_DIR/test-workbenches/care-circle-staging"
ENV_FILE="$MOBILE_DIR/.env"
EXPECTED_REF="bmqhwofmdgebpcihjlnb"
EXPECTED_URL="https://bmqhwofmdgebpcihjlnb.supabase.co"
EXPECTED_GATE="0032,0033,0034,care-circle"
PORT="${LUMIS_CARE_CIRCLE_EXPO_PORT:-8082}"

stop() { printf 'STOP_S2_T72_%s\n' "$1" >&2; exit 1; }
read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; found += 1 } END { if (found != 1) exit 1 }' "$ENV_FILE"
}

[[ -f "$ENV_FILE" ]] || stop "MOBILE_ENV_MISSING"
[[ "${S2_CARE_CIRCLE_DEPLOYMENT_GATE:-}" == "$EXPECTED_GATE" ]] || stop "PREREQUISITES_UNCONFIRMED"
case "$PORT" in 8081|8082) ;; *) stop "PORT_INVALID" ;; esac
command -v lsof >/dev/null 2>&1 || stop "LSOF_UNAVAILABLE"
command -v pnpm >/dev/null 2>&1 || stop "PNPM_UNAVAILABLE"

PROJECT_REF="$(read_env SUPABASE_PROJECT_REF)" || stop "PROJECT_REF_MISSING"
SUPABASE_URL="$(read_env EXPO_PUBLIC_SUPABASE_URL)" || stop "SUPABASE_URL_MISSING"
SUPABASE_KEY="$(read_env EXPO_PUBLIC_SUPABASE_KEY)" || stop "PUBLISHABLE_KEY_MISSING"
[[ "$PROJECT_REF" == "$EXPECTED_REF" ]] || stop "PROJECT_REF_MISMATCH"
[[ "$SUPABASE_URL" == "$EXPECTED_URL" ]] || stop "SUPABASE_URL_MISMATCH"
[[ -n "$SUPABASE_KEY" ]] || stop "PUBLISHABLE_KEY_MISSING"

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PIDS" ]]; then
  while IFS= read -r PID; do
    [[ -z "$PID" ]] && continue
    PROCESS_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
    case "$PROCESS_CWD" in
      "$ROOT"|"$MOBILE_DIR"|"$WORKBENCH_DIR") stop "PORT_ALREADY_SERVING_LUMIS" ;;
      *) stop "PORT_OWNED_BY_ANOTHER_PROJECT" ;;
    esac
  done <<< "$PIDS"
fi

printf '%s\n' \
  'S2-T72 staging prerequisites operator-confirmed: 0032, 0033, 0034, inactive care-circle.' \
  'Founder flow: create code -> pending/no authority -> Caree accept -> active -> pause/resume -> remove.' \
  'Cleanup gate: confirm removed projection, sign out, then authorized operator deletes exactly two disposable accounts.' \
  "Starting isolated Care Circle workbench on port $PORT. Keep this Terminal open; press Ctrl+C to stop."

export EXPO_PUBLIC_CARE_CIRCLE_STAGING_WORKBENCH=1
export EXPO_PUBLIC_SUPABASE_PROJECT_REF="$PROJECT_REF"
export EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export EXPO_PUBLIC_SUPABASE_KEY="$SUPABASE_KEY"
cd "$ROOT"
exec pnpm --dir "$MOBILE_DIR" exec expo start "$WORKBENCH_DIR" \
  --tunnel --port "$PORT" --clear
