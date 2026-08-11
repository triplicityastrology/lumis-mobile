# S2-T262 integrated Dice authorization operator

## Default state

The checked-in control is `WAITING_FOR_MICROSOFT_FINAL_INTEGRATED_DICE_AUTHORIZATION`. Running `pnpm dice:authorization-operator` without `--execute-technical` performs zero network, deployment, provider, or Founder calls. There is no deployment command in this repository.

The final source is bound by `sha256(sorted(path\0sha256))` in `config/s2-t259-dice-authorization-control.json`. This deterministic precommit seal covers the real `dice_synthetic_gateway_port_v1`, the 80-case registry, `js-tiktoken`/`o200k_base`, migration 0039, schemas, operator, claim store, package files, tests, the byte-exact read-only Foundry evidence, and the separate sanitized price evidence. It does not contain a Git commit self-reference.

The evidence file is `config/evidence/s2-t262-azure-foundry-deployment-readonly-v1.json`, SHA-256 `e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f`. It contains only deployment names, limits, the hostname, explicit exclusions, and null unverified fields.

The separate sanitized price record is `config/evidence/s2-t262-azure-foundry-sanitized-price-v1.json`, SHA-256 `2c22ddc1fe40689e99c7a74aed4653e64c39a5ed3ba317a259b5637a8bb41772`. It contains only the approved billing period, service dates, observation time, token prices, region, currency, maximum-window estimate, and deployment alias. No source export or account, billing, subscription, resource, or credential identifiers are included.

The route-family record is `config/evidence/s2-t262-azure-foundry-api-route-family-v1.json`, SHA-256 `2dec65e48845fe4fd2ecedd4d83ce10857b2a773a25855d0bea7454bedb4490e`. It retains only the observed `v1` family, evidence method and time, and exclusions. The canonical URL of Microsoft's [Foundry Responses API v1 reference](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses) is separately bound by SHA-256 `fad1b61431bc2906d38b662ab1e6746fb54a8e93f2cb68035ecd06129a4fc265`; no observed service path is retained.

## Authorization

There is one outer Microsoft manifest: `lumis_dice_microsoft_deployment_manifest_v1`. It binds the source seal, both evidence digests, exact canonical hashes, normal Chat tree/blob, names-only configuration, one deployment ID, expiry, and `TECHNICAL_80_ONLY` with 40 EN, 40 zh-Hant, and zero Founder cases. The distinct HMAC gateway authority is internal to `dice_synthetic_gateway_port_v1` and is consumed durably by migration 0039.

The pinned provider authority is deployment alias `lumis-ai-chat-stg`, model `gpt-5-mini`, model version `2025-08-07`, deployment type `GlobalStandard`, upgrade policy `NoAutoUpgrade`, guardrail `Microsoft.DefaultV2`, limits 10,000 TPM and 10 RPM, HTTPS, sole hostname `lumis-foundry-stg-sea-20260731.services.ai.azure.com`, and Azure OpenAI-compatible route family `v1`. Preview and legacy date-formatted API versions are rejected, and route family is never inferred from model version.

Sanitized evidence binds input and output prices of USD 0.25 and USD 2.00 per one million tokens. The raw 160-attempt technical maximum is `160 * ((800 * 0.25 + 300 * 2.00) / 1,000,000) = USD 0.128`; the supplied full-window estimate is USD 0.192 and remains below the USD 1.00 absolute cap. Legacy `azure_api_version` remains null because the accepted contract is the `v1` route family. The candidate stops at `DICE_AZURE_TRAFFIC_AUTHORITY_MISSING` before provider/client construction. Pricing, route-family evidence, and names do not authorize deployment, Azure traffic, or normal Chat integration; both `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` and `NO_AZURE_TRAFFIC_AUTHORITY` remain in force.

The checked-in `microsoft_authorization.status` remains `AWAITING_MICROSOFT_MANIFEST`; execution therefore fails closed before gateway-module import. Microsoft authorization requires an explicit control update binding the SHA-256 of the received manifest.

## Execution contract

The operator validates the source seal, all three evidence bindings, cap arithmetic, Microsoft manifest, post-deploy disabled receipt, and checked-in 80-case registry. Because deployment and Azure traffic authority remain absent, the checked-in candidate fails closed before gateway-module import. A future explicit authorization must update that gate before any Technical execution path can become reachable.

The gateway itself owns fixture execution, durable authority consumption, retry/deadline behavior, token counting, concurrency, and disable-in-finally. The outer operator validates exactly 80 metadata records, 40/40 language counts, at most 160 attempts, `o200k_base`, token/concurrency/deadline boundaries, zero normal routes/units/persistence, and an independently disabled final status.

## Inert command

```sh
pnpm dice:authorization-operator
```

Reserved Technical execution shape, unreachable without explicit deployment and Azure traffic authority:

```sh
pnpm dice:authorization-operator -- --execute-technical \
  --control config/s2-t259-dice-authorization-control.json \
  --microsoft-manifest /secure/operator/microsoft-deployment-manifest.json \
  --post-deploy-receipt /secure/operator/post-deploy-disabled-receipt.json \
  --registry config/s2-t262-dice-technical-registry-v1.json \
  --gateway-module /secure/operator/dice-gateway-execution.mjs \
  --replay-ledger /secure/operator/used-deployment-ids.json
```

## Failure and rollback

Any `STOP_S2_T262_*` result is terminal for that deployment ID. Preserve the durable replay ledger and redacted failure code; do not alter receipts and retry the same ID. Keep `LUMIS_AI_ENABLED` disabled and verify all four disabled probes again. The real gateway disables in `finally`; the outer operator also requires disabled/no-provider status after success or failure. If that proof fails, stop at `STOP_S2_T262_PROVIDER_DISABLE_UNVERIFIED` and require a new Microsoft/Technical review and deployment ID.
