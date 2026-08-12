# S2-T314 Final Disabled Dice Deployment Candidate

## Scope

This source package prepares one future `dice-synthetic` deployment with both
`LUMIS_DICE_AI_ENABLED=false` and `LUMIS_DICE_TRAFFIC_AUTHORIZED=false`.
It does not authorize deployment, migration 0039, Azure traffic, normal Chat,
provider construction, persistence, or units.

The accepted T307 runtime remains the base. The cumulative package adds:

- exact membership in the checksum-sealed 40-item Founder registry;
- 20 English and 20 zh-Hant fixtures, excluding only ZH04;
- preserved ZH08 bundled-question and ZH09 single-question controls;
- issuer `Lumis Founder Deployment Approver`, owned by `Founder`;
- reviewed key ID `founder-ed25519-deployment-approver-v1`;
- reviewed public SPKI SHA-256
  `ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478`;
- Ed25519 fields `issuer_key_id`, `issuer_public_key_spki_sha256`, and
  `issuer_signature_base64`;
- issuance-relative 900-second validity and durable single-use replay denial;
- four required `DICE_AI_DISABLED` probes and a closed zero-call receipt;
- automatic restoration/removal if a future authorized deployment fails.

`DiceRitualScreen.tsx` is protected at SHA-256
`b2f2eeda34df3f408d22f12bbb582e09ebc0e3ef738dde3d1b43130138faa5c6`.

## Readiness

```sh
pnpm dice:t314:readiness
```

The command is zero-network and lists only the operational inputs still
missing. Without the real Founder-signed receipt, execution stops before a
credential read, Supabase CLI/client construction, claim, output mutation, or
remote command.

## Founder Trust Anchor

Technical cannot sign or invent approval. T313 created the Founder-owned key in
approved local custody. T314 does not copy either PEM or record its path. The
supplied public key is loaded only from secure custody and must match both pinned
public fields above before request creation, receipt validation, durable claim,
credential access, or CLI/client construction. The private key must never enter
Git, app code, Expo, shell arguments, logs, receipts, or clipboard.

An authorized operator can create the checksum-bound request after the public
key exists:

```sh
node scripts/s2-t314-final-disabled-deploy.mjs request \
  --request-id=dice-founder-deploy-request-REVIEWEDNONCE \
  --issuer-key-id=founder-ed25519-deployment-approver-v1 \
  --issuer-public-key=/owner-only/path/founder-deploy-public.pem \
  --output=/owner-only/path/request.json
```

Signing is deliberately not implemented in this Technical package. The
Founder-owned approval process signs the canonical receipt bytes independently.

## Future Execution Shape

```sh
zsh scripts/run-s2-t314-final-disabled-deploy.zsh --execute \
  --request /owner-only/path/request.json \
  --authorization /owner-only/path/founder-signed-receipt.json \
  --issuer-public-key /owner-only/path/founder-deploy-public.pem \
  --claim-ledger /owner-only/path/single-use-claim \
  --receipt-output /owner-only/path/post-deploy-receipt.json
```

This command remains inert unless the exact receipt validates and the separate
execution environment switch is deliberately set. Migration 0039 is never
invoked by the operator.

## Authority

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
