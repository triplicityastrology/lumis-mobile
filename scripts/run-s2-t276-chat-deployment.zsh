#!/bin/zsh
set -euo pipefail

root=${0:A:h:h}
cd "$root"

if [[ ${1:-} != "--execute" ]]; then
  exec node scripts/s2-t276-chat-readiness.mjs
fi

authorization=${LUMIS_CHAT_DEPLOYMENT_AUTHORIZATION_FILE:-}
if [[ -z "$authorization" || ! -f "$authorization" ]]; then
  print -r -- "STOP_S2_T276_MICROSOFT_DEFAULT_OFF_AUTHORIZATION_REQUIRED"
  exit 2
fi

# Validation intentionally precedes credential input, CLI construction, and all remote commands.
node scripts/s2-t276-chat-readiness.mjs --validate-deployment-authorization "$authorization"

if [[ ${LUMIS_CHAT_REMOTE_EXECUTION_APPROVED:-false} != "true" ]]; then
  print -r -- "STOP_S2_T276_SEPARATE_REMOTE_EXECUTION_APPROVAL_REQUIRED"
  exit 2
fi

print -r -- "READY_S2_T276_DEFAULT_OFF_DEPLOYMENT_ONLY"
print -r -- "Future operator sequence: verify disabled -> deploy chat-synthetic -> four disabled probes -> receipt -> rollback if mismatch"
print -r -- "This source package intentionally does not accept or persist credentials."
exit 3
