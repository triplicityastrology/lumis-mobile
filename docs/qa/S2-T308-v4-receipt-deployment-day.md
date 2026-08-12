# S2-T308 v4 receipt intake and deployment-day operator

Status: `WAITING_FOR_SEPARATE_LUMIS_FOUNDER_V4_DEPLOYMENT_AUTHORIZATION`.

This package accepts only a Lumis Founder Deployment Approver Ed25519
`lumis_dice_default_off_function_deployment_authorization_v4` receipt for
`DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY`. The signed issuance time
starts a relative 900-second window. The receipt is consumed once in a durable
mode-0600 claim before any credential read, CLI construction, remote call, or
output receipt mutation.

The operator rejects wrong project, function, source tree, runtime or
authorization package, enabled kill/traffic switches, provider/model authority,
migration authority, missing rollback revision, invalid signature, stale clock,
and replay. Migration 0039 and Azure traffic are absent from the operator.

## Inert command

```sh
node scripts/s2-t308-v4-receipt-intake.mjs
```

It prints `SUPPLY_SIGNED_V4_DEFAULT_OFF_DEPLOYMENT_RECEIPT`. No credential,
client, CLI, receipt, or network boundary is reached.

## Future authorized command

Only after a separately reviewed receipt, matching request, reviewed Founder
public key, durable local claim path, and transient staging credentials exist:

```sh
LUMIS_T308_RUN_REMOTE_DEPLOYMENT=DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY \
  zsh scripts/run-s2-t308-v4-deployment-day.zsh --execute \
  --request /secure/local/request.json \
  --authorization /secure/local/founder-receipt.json \
  --issuer-public-key /secure/local/founder-ed25519-public.pem \
  --claim-ledger /secure/local/dice-deployment-claim \
  --receipt-output /secure/local/post-deploy-disabled-receipt.json
```

The remote sequence verifies the fifteen approved configuration names, captures
the existing function revision and source, deploys only `dice-synthetic`, and
runs four probes that must each return `DICE_AI_DISABLED`. Any failure after a
deployment attempt automatically deletes a function that was previously absent
or redeploys the captured prior source. Successful evidence records zero
provider/model calls, both switches false, migration 0039 unchanged, and normal
Chat unchanged.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
