#!/bin/zsh
set -euo pipefail

root=${0:A:h:h}
cd "$root"

if [[ ${1:-} != "--execute" ]]; then
  exec node scripts/s2-t291-chat-readiness.mjs
fi

authorization=${LUMIS_CHAT_DEPLOYMENT_AUTHORIZATION_FILE:-}
if [[ -z "$authorization" || ! -f "$authorization" ]]; then
  print -r -- "STOP_S2_T291_MICROSOFT_DEFAULT_OFF_AUTHORIZATION_REQUIRED"
  exit 2
fi

# Validation precedes credential input, client construction, filesystem receipt
# mutation, migration access, traffic enablement, and every remote command.
node scripts/s2-t291-chat-readiness.mjs --validate-deployment "$authorization"

if [[ ${LUMIS_CHAT_REMOTE_EXECUTION_APPROVED:-false} != "EXACT_T291_DEFAULT_OFF_ONLY" ]]; then
  print -r -- "STOP_S2_T291_SEPARATE_REMOTE_EXECUTION_APPROVAL_REQUIRED"
  exit 2
fi

print -r -- "READY_S2_T291_DEFAULT_OFF_DEPLOYMENT_ONLY"
print -r -- "Future sequence: verify disabled -> deploy chat-synthetic -> four CHAT_AI_DISABLED probes -> zero-call receipt -> rollback on mismatch"
print -r -- "Migration 0040 and Chat traffic remain separately authorized scopes."
exit 3
