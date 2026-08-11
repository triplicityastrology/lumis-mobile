# S2-T277 final Dice default-off deployment release

Status: `WAITING_FOR_MICROSOFT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION`

Authority remains:

- `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`
- `NO_AZURE_TRAFFIC_AUTHORITY`
- scope: `DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY`
- project classification: exact staging project `bmqhwofmdgebpcihjlnb`
- function: `dice-synthetic`
- migration 0039 application: **not authorized**; it requires the separate `DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY` scope

## Bound runtime

The release binds T272 commit `f5f9e9da238633d84eb8695307c573eef8f1bc96`, its exact tree, the T272 Deno/runtime control, import graph, runtime receipt, real entry, handler, gateway, tokenizer, Azure adapter, 80-case registry and authorization operator. The package refuses any source or evidence hash drift.

T272 evidence records Deno check and Edge ESZIP bundle success, four disabled probes, disabled-before-JSON/client behavior and zero provider/remote calls. This is local runtime evidence only; it is not hosted deployment evidence.

## Inert checks

```sh
pnpm test:s2-t277-dice-default-off-release
pnpm dice:default-off-deployment-readiness
pnpm verify:s2-t277-dice-runtime
```

The readiness command performs no credential read, CLI construction, network call, deployment or receipt mutation. It prints the single next gate. The runtime recheck mounts the frozen worktree read-only into the cached immutable Edge image instead of dereferencing the entire workspace dependency tree; Docker networking remains disabled for bundling and internal-only for the four local probes.

## Microsoft authorization request

The future request must bind the separately reviewed Microsoft Ed25519 public-key SPKI SHA-256. No key is supplied or trusted by this source task.

```sh
node scripts/s2-t277-dice-deployment-authorization.mjs \
  --request-id=dice-auth-request-REVIEWED_NONCE \
  --issued-at=YYYY-MM-DDTHH:MM:SSZ \
  --valid-until=YYYY-MM-DDTHH:MM:SSZ \
  --signing-key-sha256=REVIEWED_MICROSOFT_SPKI_SHA256
```

The returned closed request requires a 15-minute, single-use, cryptographically signed receipt. The receipt authorizes zero provider calls and zero model invocations, requires both switches false, excludes migration 0039, names the rollback revision and binds every runtime source/evidence hash.

## Future guarded deployment

Only after Microsoft returns the exact signed receipt and the transient Supabase inputs are available in a hidden operator session:

```sh
LUMIS_T277_RUN_REMOTE_DEPLOYMENT=DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY \
SUPABASE_ACCESS_TOKEN='entered only in hidden session' \
SUPABASE_ANON_KEY='entered only in hidden session' \
pnpm dice:default-off-deployment-operator -- --execute \
  --request /secure/ephemeral/request.json \
  --authorization /secure/ephemeral/microsoft-authorization.json \
  --microsoft-public-key /secure/ephemeral/microsoft-public.pem \
  --claim-ledger /secure/local/single-use-claim \
  --receipt-output /secure/local/post-deploy-receipt.json
```

The operator validates source hashes, request, Ed25519 signature, expiry, project, function, scope, rollback revision and migration exclusion before consuming the claim. Only then may it read transient credentials or construct the Supabase CLI. It verifies required configuration names, captures the prior function revision, deploys only `dice-synthetic`, performs four disabled probes, verifies the new function revision and writes a mode-0600 closed receipt. Probe credentials are passed to curl on stdin, not process arguments. Traps unset transient variables and remove temporary responses.

The post-deploy receipt is valid only when all four probes return `DICE_AI_DISABLED`, the function remains disabled, `provider_calls=0`, `model_invocations=0`, normal Chat is unchanged and migration 0039 was not applied. A rollback receipt must record disabled state and restoration/removal to the authorized prior revision.

No deployment, migration, credential use, Supabase call or Azure call occurred while preparing this release.
