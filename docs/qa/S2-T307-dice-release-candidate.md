# S2-T307 Dice release candidate

This branch reconciles T297, T302, T303, and T304 into one source lineage. The
signed-off `DiceRitualScreen` and `LumisDiceScreen` bytes are sealed. The mobile
adapter remains disabled unless both switches and exact authority are accepted.

The active deployment path is T303. The active Technical runner is T304.
Earlier sibling packets remain historical evidence and are not accepted by the
T307 readiness command.

The integrated entry was checked with Deno 2.2.7 and the real pinned
`js-tiktoken@1.0.21/o200k_base` import using `--no-remote`. Docker was not
available, so no new ESZIP/runtime-start proof is claimed for T307.

Run:

```sh
pnpm dice:t307:readiness
```

It performs no network, credential, client, deployment, migration, provider,
unit, or persistence action. It reports only the exact missing external
receipts. Local 80-case rehearsal remains synthetic evidence, never live proof.

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`
