# S2-T298 Dice v4 zero-call deployment preflight

This package prepares exactly `DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY` for later review. It does not authorize or perform deployment, migration `0039`, Azure traffic, normal Chat integration, member data access, unit charging, or persistence.

## Fixed authority

- Runtime package: `be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457`
- Authorization package: `53f5cbc0552a30016c8b6c8fb827740bbafcdedd1a36146092fd469b11ba7799`
- Authorization schema: `lumis_dice_default_off_function_deployment_authorization_v4`
- Signed validity: 900 seconds from `issued_at`
- Claim: durable and single-use
- Allowed provider/model calls: `0/0`
- Expected probes: four `DICE_AI_DISABLED` results
- Migration `0039`: excluded

The preflight also checks the signed-off `DiceRitualScreen.tsx` and `LumisDiceScreen.tsx` checksums. This task does not edit product pixels.

The local runtime proof used Deno `2.2.7`, Supabase CLI `2.113.0`, and the immutable cached Edge image. The real entry produced a 14-module ESZIP and four disabled responses with zero remote, provider, or model calls. This is local runtime evidence only, not deployment evidence.

## Offline preflight

```sh
node scripts/s2-t298-dice-v4-zero-call-preflight.mjs
```

It performs no credential read, client construction, network call, claim mutation, or receipt write. On a clean exact source it prints only:

```text
AUTHORIZE_DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY
```

Generate the checksum-bound request only after receiving the reviewed Microsoft Ed25519 signing-key checksum:

```sh
node scripts/s2-t298-dice-v4-review-request.mjs \
  --request-id=dice-auth-request-0123456789abcdef \
  --signing-key-sha256=<reviewed-64-hex-checksum>
```

## Future guarded execution

The future operator requires the exact request, signed v4 receipt, reviewed public key, single-use ledger and output path. It validates all of them before the remote flag is inspected or the inherited guarded T287 executor is entered.

```sh
LUMIS_T298_RUN_REMOTE_DEPLOYMENT=DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY \
zsh scripts/run-s2-t298-dice-v4-zero-call-deployment.zsh --execute \
  --request /closed/request.json \
  --authorization /closed/signed-v4-receipt.json \
  --microsoft-public-key /closed/microsoft-public-key.pem \
  --claim-ledger /closed/single-use-claim \
  --receipt-output /closed/post-deploy.json
```

The post-deploy validator requires both switch values to be literally `false`, all four disabled probes, `provider_calls=0`, `model_invocations=0`, `migration_0039_applied=false`, `normal_chat_unchanged=true`, and `credentials_unset=true`. A failure does not become live evidence.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
