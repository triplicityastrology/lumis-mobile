# S2-T327 Canonical Dice Release Root

This source-only root binds the T312 closed 40-question registry, T313 Founder
signer trust anchor, T316 on-Dice interpretation surface, T317 release controls,
and T322 actual-screen pre-roll gate. Rejected questions return before READY,
motion setup, random results, AI construction, transport, history, session, or
persistence work.

Run `pnpm preflight:s2-t327-canonical-dice-release-root`. Success is exactly:

```text
S2_T303_DEFAULT_OFF_FINAL_OK
```

The package authorizes no signing, key creation, deployment, migration, probe,
credential read, network call, or provider traffic. Existing Dice branding,
question-bank membership, on-Dice interpretation states, and authority statuses
remain unchanged. Rollback removes or restores only `dice-synthetic` while
keeping provider traffic disabled.
