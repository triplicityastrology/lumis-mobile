# S2-T303 final default-off Dice deployment packet

Status: `WAITING_FOR_SEPARATE_LUMIS_FOUNDER_V4_DEPLOYMENT_AUTHORIZATION`

This source-only package reconciles T298 with the accepted T292 decision packet
and canonical T287 v4 receipt design. It changes no function, mobile, or Dice
product source. Runtime package
`be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457`
and authorization package
`275d08c3d04f1408b93d4bcc32f90412d2567a7edd9b3eeb0654fad4393138db`
remain exact.

The only possible future operation is a disabled deployment of
`dice-synthetic`, followed by four `DICE_AI_DISABLED` probes. Both switches
must remain false. Provider calls and model invocations must remain zero.
Migration 0039 is excluded, a rollback revision is mandatory, and normal Chat
must remain unchanged.

## Inert command

```sh
node scripts/s2-t303-dice-default-off-preflight.mjs
```

On a clean exact package it prints only:

```text
AUTHORIZE_DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY
```

The future operator remains unreachable without a separately issued,
Lumis-Founder-signed Ed25519 v4 receipt. Its validity is calculated from signed
`issued_at` plus 900 seconds; no static wall-clock expiry is committed. The
deployment ID is consumed once through the accepted durable claim boundary.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
