# S2-T257 canonical Dice synthetic gateway port

Status: `SOURCE_ONLY_DEFAULT_OFF_ZERO_TRAFFIC`

`DiceSyntheticGatewayPortV1` is the concrete server-side implementation of `dice_synthetic_gateway_port_v1`. It is not mounted by the Dice Edge route or any normal member/chat route. This branch performs no network, deployment, or Azure operation.

## Closed authority

- Intake is exactly `lumis_dice_default_off_deployment_authorization_v2`.
- The server verifies an HMAC using a server-only secret, package and registry SHA-256 values, signed `issued_at` and maximum 15-minute `valid_until` timestamps, and a single-use `dice-tech80-*` run ID.
- A valid authority executes exactly the canonical 80 Technical fixtures. The 40 Founder fixture IDs are known but prohibited, and direct fixture invocation is unavailable.
- Before provider enablement, every gateway instance must atomically consume the authority through the service-role-only `consume_lumis_dice_synthetic_authority_v1` Postgres RPC. The `run_id` primary key converges concurrent instances to one winner; replay, unavailable RPC, malformed RPC output, and binding failure all stop before provider access.
- The forced-RLS ledger stores only run/package/registry/signature digests and authority/retention timestamps. Its purge RPC removes rows at 30 days; it has no prompt, response, question, member, unit, or application persistence columns.

## Runtime limits

- At most 160 provider attempts, two workers, one retry, and one port-enforced 12-second deadline shared by both attempts for each case.
- Input and output are counted from server-side `o200k_base` token IDs using the pinned `js-tiktoken@1.0.21` implementation aligned with the gpt-5-mini family. Provider usage fields, UTF-8 byte counts, and character estimates are ignored.
- Azure configuration is source-pinned to HTTPS hostname `lumis-foundry-stg-sea-20260731.services.ai.azure.com` and the documented Azure OpenAI-compatible `v1` route family. Preview and legacy date-formatted API-version contracts are rejected. The separate Azure API version field remains null, and no traffic authority exists, so production admission fails closed before provider or authority-client construction. Route-family source: [Microsoft Foundry Responses API v1](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses).
- `finally` disables provider access. `verifyDiceGatewayDisabled(port.status())` independently checks the closed false state.

## Evidence boundary

The returned 30-day evidence is metadata only: run and fixture IDs, language, result class, bounded counters, duration, failure code, timestamps, and explicit zero effects. It contains no prompt, question, model text, endpoint, header, secret, normal-route effect, unit charge, or persistence write.

The canonical package digest and source hashes are in `config/s2-t257-canonical-dice-gateway-manifest.json` and are verified by `pnpm test:s2-t257-canonical-dice-port`.
