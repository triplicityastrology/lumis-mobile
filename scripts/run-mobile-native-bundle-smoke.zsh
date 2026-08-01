#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MOBILE_ROOT="$ROOT/apps/mobile"
EXPORT_ROOT="$ROOT/.tmp/native-ios-bundle-smoke-$$"
PNPM="${PNPM_BIN:-pnpm}"

cleanup() {
  rm -rf -- "$EXPORT_ROOT"
}
trap cleanup EXIT

if [[ ! -f "$MOBILE_ROOT/index.ts" || ! -f "$MOBILE_ROOT/package.json" ]]; then
  printf 'STOP_MOBILE_BUNDLE_ENTRY_MISSING\n' >&2
  exit 1
fi

mkdir -p "$EXPORT_ROOT"
cd "$ROOT"

CI=1 EXPO_NO_TELEMETRY=1 "$PNPM" --dir apps/mobile exec expo export \
  --platform ios \
  --output-dir "$EXPORT_ROOT" \
  --clear

if ! find "$EXPORT_ROOT" -type f \( -name '*.js' -o -name '*.hbc' \) -print -quit | grep -q .; then
  printf 'STOP_MOBILE_BUNDLE_OUTPUT_MISSING\n' >&2
  exit 1
fi

printf 'MOBILE_NATIVE_BUNDLE_READY\n'
printf 'platform=ios\n'
printf 'temporary_export_removed_on_exit=true\n'
