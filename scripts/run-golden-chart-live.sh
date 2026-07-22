#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

IFS= read -r -s -p "Paste the Cloudflare chart Worker signing secret (input is hidden), then press Return: " CHART_WORKER_SIGNING_SECRET
echo
export CHART_WORKER_SIGNING_SECRET
export CHART_WORKER_URL="${CHART_WORKER_URL:-https://lumis-chart-staging.triplicityastrology.workers.dev}"
trap 'unset CHART_WORKER_SIGNING_SECRET' EXIT

node scripts/golden-chart-live.mjs
