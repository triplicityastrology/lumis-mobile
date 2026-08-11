# S2-T276 Chat runtime and deployment readiness

## Status

`NO_NORMAL_CHAT_INTEGRATION_AUTHORITY`

`NO_AZURE_TRAFFIC_AUTHORITY`

This package does not deploy `chat-synthetic`, apply migration 0040, invoke Azure,
connect `chat-message`, accept member context, persist content, or charge units.
The next gate is an exact Microsoft default-off deployment authorization naming
the committed SHA and `config/s2-t276-chat-runtime-review.json` package binding.

## Proven local runtime

The actual Edge entry was checked and served with the official Deno 2.2.12
macOS ARM64 binary. Its official archive SHA-256 is
`0dcab0cfe848cd37aba624bfa1a975ff8f7ed5ab83e61d7d32c6a3f47754ef69`.
The import graph resolved `npm:js-tiktoken@1.0.21` and
`npm:@supabase/supabase-js@2.110.2` from the frozen local installation. Four
loopback-only malformed/closed-request probes returned `CHAT_AI_DISABLED` while
the kill switch was false. No provider client, Supabase client, JSON request
parsing, external network, or provider call was reached.

Reproduce after placing the checksum-verified Deno binary at
`.tools/deno-2.2.12/deno` and hydrating the frozen dependencies locally:

```bash
node scripts/s2-t276-chat-deno-runtime-proof.mjs
pnpm test:s2-t276-chat-runtime
```

`.tools/` is ignored and is not part of the commit. The runtime source and
checksums are locked in `config/s2-t276-chat-runtime.json`.

## Later operator

The inert command reports the current gate:

```bash
pnpm chat:runtime-readiness
```

The guarded future command is:

```bash
LUMIS_CHAT_DEPLOYMENT_AUTHORIZATION_FILE=/secure/local/authorization.json \
  zsh scripts/run-s2-t276-chat-deployment.zsh --execute
```

Validation occurs before any credential input or remote command. This package
deliberately stops again unless a separate remote-execution approval is present.
It never stores credentials and does not contain a deployment command.

## Founder bridge

`s2_t276_founder_chat_fixture_bridge_v1` accepts only `fixture_id`, a synthetic
run ID, and an idempotency key. It is compatible with the documented T271
Founder journey, but cannot produce `live_synthetic` without accepted Dice
evidence, Chat authority, execution evidence, and a post-window disabled proof.
