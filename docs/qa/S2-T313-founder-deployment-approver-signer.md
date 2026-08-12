# S2-T313 Founder deployment approver signer

Status: `FOUNDER_TRUST_ANCHOR_CREATED_NO_OPERATIONAL_SIGNING_AUTHORITY`.

The deployment receipt issuer is exactly `Lumis Founder Deployment Approver`.
The trust-anchor owner is `Founder`. Technical validates the public trust
anchor and signed receipt; Technical cannot sign or invent Founder approval.

The v4 receipt retains the 900-second issuance-relative window, durable
single-use claim, replay rejection, rollback requirement, disabled switches,
four `DICE_AI_DISABLED` probes, zero provider/model calls, and migration 0039
exclusion.

One Founder-approved Ed25519 key was created in local, non-cloud, owner-only
custody. Only its public SPKI SHA-256 fingerprint and nonsecret key ID are
committed. The private path and all key material are excluded from source and
evidence. No deployment receipt was signed.

Repeatable public-key verification loads only the custody public key and prints
no fingerprint, key contents, or custody path:

```sh
node scripts/s2-t313-founder-trust-anchor-verify.mjs \
  --issuer-public-key=<custody-public-key-path>
```

## Inert check

```sh
node scripts/s2-t313-founder-ed25519-key-setup.mjs
```

This creates nothing. It does not inspect or replace the existing custody key.

## Future setup after explicit Founder approval

Choose an absolute path on a local, non-cloud-synced encrypted volume. The
directory must already be owner-only or will be created mode `0700`. The key
files are created once with mode `0600`; existing files are never overwritten.

```sh
node scripts/s2-t313-founder-ed25519-key-setup.mjs \
  --execute=true \
  --approval=FOUNDER_APPROVES_LOCAL_ED25519_KEY_CREATION \
  --output=/absolute/non-cloud/private/founder-dice-deployment-ed25519.pem \
  --issuer-key-id=founder-ed25519-primary-2026
```

The command prints only the public key path, `issuer_key_id`, and
`issuer_public_key_spki_sha256`. Never commit the private key, public PEM,
receipt, or local claim ledger. Import only the reviewed public fingerprint and
key ID into a later authorization request.

No operational signature was created. No deployment or remote action is
authorized.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
