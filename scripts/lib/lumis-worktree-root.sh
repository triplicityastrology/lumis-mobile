#!/usr/bin/env bash

lumis_resolve_worktree_root() {
  local script_root candidate git_root common_dir expected_common_dir
  script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)" || return 1
  candidate="${LUMIS_WORKTREE_ROOT:-$script_root}"
  candidate="$(cd "$candidate" 2>/dev/null && pwd -P)" || return 1
  git_root="$(git -C "$candidate" rev-parse --show-toplevel 2>/dev/null)" || return 1
  git_root="$(cd "$git_root" 2>/dev/null && pwd -P)" || return 1
  [[ "$candidate" == "$git_root" ]] || return 1
  common_dir="$(git -C "$candidate" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 1
  expected_common_dir="$(git -C "$script_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 1
  [[ "$common_dir" == "$expected_common_dir" ]] || return 1
  printf '%s\n' "$candidate"
}

lumis_resolve_evidence_root() {
  local root="$1" subdirectory="$2" base resolved
  [[ "$subdirectory" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || return 1
  base="${LUMIS_EVIDENCE_ROOT:-$root/.lumis-local/evidence}"
  resolved="$(node -e 'const p=require("node:path");process.stdout.write(p.resolve(process.argv[1],process.argv[2]))' "$root" "$base")" || return 1
  case "$resolved" in
    "$root"|"$root/.git"|"$root/.git/"*) return 1 ;;
  esac
  printf '%s/%s\n' "$resolved" "$subdirectory"
}
