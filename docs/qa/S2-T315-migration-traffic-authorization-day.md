# S2-T315 migration and Technical-80 authorization day

This package prepares two independent Founder-owned decisions. Neither template authorizes the other operation, function deployment, normal Chat, or public/member traffic.

## Current status

- Issuer design: `Lumis Founder Deployment Approver`
- Trust-anchor owner: Founder
- Technical validates signatures and scope; Technical cannot create or sign Founder approval.
- Accepted local proof: T283 commit `b469cb7e0824bd6b864edc983bcd352b37994894`, PostgreSQL 17.6, network disabled, receipt SHA-256 `0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e`.
- Exact T314 candidate: commit `179de7e43fd208858d18398586543028ba9d1b5f`, package `8b8a545986c756403338a93b3b832762a0918e061d044e27710d27146fc33a71`.
- Founder trust anchor: key ID `founder-ed25519-deployment-approver-v1`, SPKI SHA-256 `ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478`.

## A. Migration 0039 only

Founder reviews `config/templates/s2-t315-migration-0039-authorization.template.json` and signs the canonical payload outside this repository with the separately held trust-anchor key. Maximum validity is 900 seconds. Technical receives the public key and verifies that its SPKI fingerprint matches the committed trust anchor; no private key is accepted or stored.

```sh
node scripts/s2-t315-migration-0039-operator.mjs status
node scripts/s2-t315-migration-0039-operator.mjs preflight \
  --authorization /absolute/founder-migration-authorization.json \
  --issuer-public-key /absolute/founder-public-key.pem
```

The future guarded executor is `scripts/run-s2-t315-migration-0039.sh`. It checks the source, PG17 proof, Founder signature, exact project, migration-only scope, action, clock, and single use before reading database inputs. `--apply` runs only the exact 0039 apply packet; `--rollback` requires a separate rollback-scoped receipt and runs only the exact rollback packet. Both paths validate a closed post-action receipt. Neither can deploy the function or authorize traffic.

## B. Technical 80 only

Founder reviews `config/templates/s2-t315-technical-80-authorization.template.json` only after separate accepted disabled-deployment and migration receipts exist. The request is fixed at 40 EN plus 40 zh-Hant, zero Founder cases, 160 attempts, concurrency 2, one eligible retry inside the shared 12-second deadline, real `o200k_base` limits of 800 input and 300 output tokens, and USD 0.128.

```sh
node scripts/s2-t315-technical-80-operator.mjs status
node scripts/s2-t315-technical-80-operator.mjs preflight \
  --post-deploy-receipt /absolute/accepted-disabled-deploy.json \
  --migration-receipt /absolute/accepted-0039-post-action.json \
  --authorization /absolute/founder-technical-80-authorization.json \
  --issuer-public-key /absolute/founder-public-key.pem
```

The future executor is `scripts/run-s2-t315-technical-80.sh`. It validates every gate before constructing the T309 adapter and retains mandatory finally-disable behavior. `kill` prints the exact disable action but performs no remote call by itself.

## Local verification

```sh
node scripts/s2-t315-authorization-day-contract.mjs
node scripts/s2-t315-zero-network-rehearsal.mjs
```

The rehearsal is synthetic and zero-network. It is not migration evidence, Azure evidence, or traffic authority.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
