# S2-T287 Canonical v4 Dice default-off deployment release

Status: `WAITING_FOR_LUMIS_FOUNDER_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION`

This package authorizes no remote action. It preserves the accepted T277/T272
runtime package `be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457`
byte-for-byte and adds only a T287-owned v4 authorization boundary.

Founder authority is limited to approval of the
`lumis_dice_default_off_function_deployment_authorization_v4` receipt design
for the controlled Dice staging process. It does not authorize deployment,
migration, Azure traffic, normal Chat integration, member data, or public use.
Every operational action still requires its own reviewed authorization.

## Exact authority

- Scope: `DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY`
- Project classification: exact staging project
- Function: `dice-synthetic`
- Receipt: `lumis_dice_default_off_function_deployment_authorization_v4`
- Clock: 900 seconds from the Lumis-Founder-signed `issued_at`
- Claim: durable, single-use, replay rejecting
- Provider and model calls: zero
- Migration 0039: excluded; separate authorization is mandatory

The request is generated only from a clean current Git commit and tree. It
binds the runtime seal, T287 authorization package seal, all 15 configuration
names, signing-key checksum, rollback target, four disabled probes, and the
request checksum. The post-deploy receipt repeats those exact bindings.

## Local verification

```sh
pnpm test:s2-t287-dice-v4-deployment
pnpm verify:s2-t287-dice-runtime
pnpm dice:v4-deployment-readiness
```

The readiness command is inert and prints the next gate. A future controlled
execution additionally requires a Lumis-Founder-signed, unexpired, single-use
receipt and an explicit remote execution flag. Migration commands are absent.

Generate the exact clean-HEAD request after the Founder supplies the approved
Ed25519 public-key checksum:

```sh
pnpm dice:v4-deployment-request -- \
  --request-id=dice-auth-request-<single-use-id> \
  --signing-key-sha256=<approved-64-character-sha256>
```

The output is the closed v4 request envelope. It contains no credentials and
authorizes no action. The guarded future executor is:

```sh
zsh scripts/run-s2-t287-dice-deployment.zsh --execute \
  --request <reviewed-request.json> \
  --authorization <founder-signed-v4-receipt.json> \
  --issuer-public-key <reviewed-public-key.pem> \
  --claim-ledger <private-local-claim-prefix> \
  --receipt-output <private-local-post-deploy-receipt.json>
```

Without the exact receipt and separate explicit remote flag, this stops before
credential access, client construction, network activity, or receipt mutation.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
