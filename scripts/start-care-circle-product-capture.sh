#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ROOT="/Users/rubyku/Documents/Mobile App/lumis-mobile-s1t04-work"
CONTROL="$EXPECTED_ROOT/supabase/tests/s2-t145-care-circle-capture-control.json"
MOBILE_DIR="$EXPECTED_ROOT/apps/mobile"
PORT="${LUMIS_EXPO_PORT:-8081}"

stop() { printf 'STOP_S2_T145_%s\n' "$1" >&2; exit 1; }
[[ "$(cd "$(dirname "$0")/.." && pwd -P)" == "$EXPECTED_ROOT" ]] || stop WORKTREE_MISMATCH
[[ -f "$CONTROL" ]] || stop CONTROL_MISSING
case "$PORT" in 8081|8082) ;; *) stop PORT_INVALID ;; esac
for command in git lsof node pnpm shasum; do command -v "$command" >/dev/null 2>&1 || stop "${command^^}_UNAVAILABLE"; done

HEAD_SHA="$(git -C "$EXPECTED_ROOT" rev-parse --verify HEAD 2>/dev/null || true)"
BRANCH="$(git -C "$EXPECTED_ROOT" branch --show-current 2>/dev/null || true)"
APPROVED_ANCESTOR="$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.approved_ancestor)' "$CONTROL")"
[[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ && -n "$BRANCH" ]] || stop SOURCE_REVISION_UNVERIFIED
git -C "$EXPECTED_ROOT" merge-base --is-ancestor "$APPROVED_ANCESTOR" "$HEAD_SHA" || stop CORRECTED_UI_ANCESTRY_MISSING
[[ -z "$(git -C "$EXPECTED_ROOT" status --porcelain)" ]] || stop WORKTREE_DIRTY

CONTROL_PATH="$CONTROL" ROOT_PATH="$EXPECTED_ROOT" node - <<'NODE' || stop PROTECTED_UI_DRIFT
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const control = JSON.parse(readFileSync(process.env.CONTROL_PATH, "utf8"));
for (const source of control.protected_sources) {
  const actual = createHash("sha256").update(readFileSync(join(process.env.ROOT_PATH, source.path))).digest("hex");
  if (actual !== source.sha256) process.exit(1);
}
NODE
unset CONTROL_PATH ROOT_PATH

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PIDS" ]]; then
  while IFS= read -r PID; do
    [[ -z "$PID" ]] && continue
    PROCESS_CWD="$(lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
    [[ "$PROCESS_CWD" == "$EXPECTED_ROOT" || "$PROCESS_CWD" == "$MOBILE_DIR" ]] && stop STALE_METRO_RUNNING
    stop PORT_OWNED_BY_ANOTHER_PROJECT
  done <<< "$PIDS"
fi

mkdir -p "$EXPECTED_ROOT/.lumis-local"
MARKER_HEAD="$HEAD_SHA" MARKER_ANCESTOR="$APPROVED_ANCESTOR" node - <<'NODE'
const { writeFileSync } = require("node:fs");
writeFileSync(".lumis-local/care-circle-capture-session.json", JSON.stringify({
  schema: "s2_t145_care_circle_capture_session_v1",
  source_commit: process.env.MARKER_HEAD,
  corrected_ui_ancestor: process.env.MARKER_ANCESTOR,
  product_ui: "protected_bytes_verified",
  app_entry: "normal_mobile",
  rehearsal: "local_non_live"
}) + "\n", { mode: 0o600 });
NODE
unset MARKER_HEAD MARKER_ANCESTOR

printf 'CARE_CIRCLE_CAPTURE_READY source_commit=%s corrected_ui=verified app=normal rehearsal=local_non_live\n' "$HEAD_SHA"
printf 'Open Founder tests > Care Circle staging test > Open local rehearsal. Keep this Terminal open; press Ctrl+C to stop.\n'
export EXPO_PUBLIC_LUMIS_SOURCE_COMMIT="$HEAD_SHA"
cd "$EXPECTED_ROOT"
exec pnpm --dir "$MOBILE_DIR" exec expo start --tunnel --port "$PORT" --clear
