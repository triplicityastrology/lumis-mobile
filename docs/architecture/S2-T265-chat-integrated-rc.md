# S2-T265 Chat Integrated RC

Status: `SOURCE_ONLY`; `LOCAL_EMULATOR_ONLY`; `NO_AZURE_TRAFFIC_AUTHORITY`;
`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`.

S2-T265 is based exactly on T260 commit
`aff17b9698f37d6e251dce3b1aeda73005e91faa`. The accepted T240 public response
artifacts from `beab3bc47d3d32fd0e76673f538f47f368f95347` remain byte-for-byte unchanged.
No old T240 file is replayed in this candidate.

## Candidate boundary

The candidate retains `chat_synthetic_gateway_port_v1`, the immutable 60-case
registry, `js-tiktoken` `o200k_base`, 1200 input and 300 output token caps,
migration `0040` metadata ledger source, the separately recorded Microsoft
deployment names, and Lumis deterministic
pre- and post-safety. The existing
gateway remains isolated from `chat-message`, mobile navigation, member data,
conversation persistence, and unit accounting.

The T265 authorization gate verifies canonical SHA-256 digests of both the Dice
evidence object and the integrated authorization receipt. The receipt must carry
the exact prerequisite authority
`ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE`, bind the T260 base, candidate,
Microsoft manifest, canonical T240 schema, gateway source, fixture registry,
run identifier, limits, and validity window, and then pass the T260 port's
single-use authority checks. The committed candidate issues no receipt and
contains no accepted evidence checksum.

The byte-exact read-only Microsoft evidence is bound at SHA-256
`e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f`.
It verifies only deployment alias `lumis-ai-chat-stg`, model `gpt-5-mini`, model
version `2025-08-07`, deployment type `GlobalStandard`, upgrade policy
`NoAutoUpgrade`, guardrail `Microsoft.DefaultV2`, limits of 10,000 TPM and 10
RPM, and hostname `lumis-foundry-stg-sea-20260731.services.ai.azure.com`.
HTTPS to that exact hostname is the only permitted transport name.

Organization-specific pricing in the deployment evidence remains null and
unverified. The Azure API version is also null and unverified; no live API
version is inferred. The authorization gate accepts a
lazy port factory and fails with
`CHAT_SYNTHETIC_AZURE_API_VERSION_EVIDENCE_REQUIRED` before invoking that
factory. Provider or client construction therefore remains prohibited until a
separate API-version evidence checksum is reviewed and added in source.

A separate sanitized pricing record is bound without changing the read-only
deployment evidence envelope. It records USD input/output prices of $0.25 and
$2.00 per million tokens and a maximum Dice-window estimate of $0.192. The
contract proves that estimate from 240 maximum attempts, 800 maximum input
tokens per attempt, and 300 maximum output tokens per attempt. The pricing
record contains no CSV data, billing, subscription, or resource identifiers,
or credentials, and grants no deployment or traffic authority.

Separate sanitized route-family evidence pins only the Azure OpenAI-compatible
route family `v1`. The source authority rejects `preview`, every legacy
date-formatted API-version value, and any attempt to derive an API version from
model version `2025-08-07`. No observed endpoint URL or path is retained. The
route policy is grounded in Microsoft's official
[Foundry Responses API v1 reference](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses),
whose local citation record is independently checksum-bound. This closes only
route-family evidence; `azure_api_version` remains null, provider construction
remains blocked, and both `NO_*` statuses remain in force.

## Offline emulator

`chat_synthetic_local_emulator_v1` accepts only closed fixture IDs and closed
scenario names. It covers EN and zh-Hant Companion output plus projection-only
ordinary Chat responses, deterministic safety, Azure block/partial projection,
malformed provider output, retry and timeout behavior, idempotent replay, and
concurrent duplicate collapse. Ordinary Chat projections are validated with the
accepted T240 mobile response validator.

The emulator constructs no Azure, Supabase, route, member, persistence, or unit
adapter. Its envelope repeats only the verified deployment names and always
reports network disabled, projection-only output,
zero persistence writes, zero units, and zero raw logs. A projected T240
`committed` outcome tests schema mapping only and does not represent a database
write.

## Operations

No network, deployment, secret provisioning, Azure call, Supabase call, or
migration execution is authorized or performed. Migration `0040` remains
source-only. The Microsoft deployment manifest contains no endpoint URL or
path, key, contact field, masked field, or screenshot. Sanitized pricing is
evidence only and grants no deployment or traffic authority.
