# S2-T292 Dice v4 Microsoft decision packet

Status: `WAITING_FOR_MICROSOFT_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION`

This is a compact, source-only review layer over canonical T287. It changes no
deployable function source and preserves runtime package
`be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457`
and authorization package
`53f5cbc0552a30016c8b6c8fb827740bbafcdedd1a36146092fd469b11ba7799`.

The packet binds the exact clean commit/tree request, the 15 configuration
names, signing-key checksum, request checksum, four disabled probes, 900-second
Microsoft-signed relative window, durable single-use claim, replay rejection,
rollback revision, and closed post-deploy receipt. Migration 0039 is excluded.

## One-command decision preflight

```sh
node scripts/s2-t292-dice-v4-decision-preflight.mjs
```

On the exact clean package it prints only:

```text
OBTAIN_MICROSOFT_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION
```

It performs no credential read, client construction, network request,
deployment, migration, or receipt mutation.

## Exact review artifact

After Microsoft provides the reviewed Ed25519 SPKI checksum, generate the exact
current-commit packet without contacting any remote service:

```sh
node scripts/s2-t292-dice-v4-decision-preflight.mjs \
  --request-id=dice-auth-request-<single-use-id> \
  --signing-key-sha256=<reviewed-spki-sha256> \
  > .lumis-local/s2-t292-dice-v4-microsoft-decision-packet.json
```

The generated JSON contains the exact closed v4 request payload and its own
checksum. It cannot authorize deployment; the future executor still requires a
matching Microsoft-signed, unexpired, single-use receipt and a separate explicit
remote execution boundary.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
