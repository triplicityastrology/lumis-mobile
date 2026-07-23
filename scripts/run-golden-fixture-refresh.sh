#!/usr/bin/env bash

set -euo pipefail

printf 'Paste the protected Hong Kong golden-reference session ID (input is hidden), then press Return: '
IFS= read -r -s golden_hk_session_id
printf '\n'
printf 'Paste the protected Malaysia golden-reference session ID (input is hidden), then press Return: '
IFS= read -r -s golden_my_session_id
printf '\n'
printf 'Paste the protected Shenzhen golden-reference session ID (input is hidden), then press Return: '
IFS= read -r -s golden_sz_session_id
printf '\n'

GOLDEN_REFERENCE_HK_SESSION_ID="$golden_hk_session_id" \
GOLDEN_REFERENCE_MY_SESSION_ID="$golden_my_session_id" \
GOLDEN_REFERENCE_SZ_SESSION_ID="$golden_sz_session_id" \
node tools/golden-tests/fetch-official-website-fixtures.mjs

unset golden_hk_session_id
unset golden_my_session_id
unset golden_sz_session_id

printf 'Golden references refreshed. Protected source identifiers were not written to the artifact or command history.\n'
