# S2-T272 Dice Deno/Supabase runtime proof

## Boundary

This proof is local-only. It does not log in to Supabase, read credentials, pull an image, contact staging, enable Dice AI, or make an Azure/provider request. `NO_AZURE_TRAFFIC_AUTHORITY` and `NO_NORMAL_CHAT_INTEGRATION_AUTHORITY` remain unchanged.

The source pins Deno CLI 2.2.7 and Supabase CLI 2.113.0 as declared development tools. The actual function check uses Deno with `--no-remote`. The actual bundle and local worker use the immutable, already-cached Supabase Edge Runtime image `public.ecr.aws/supabase/edge-runtime@sha256:a82676277615aee03c4f288cbbbf68dedb5ba8693073e567ab8dbfdd11ba5d45`, which reports Edge Runtime 0.1.0 and Deno 2.1.4.

`deno.json` uses manual node modules and exact npm mappings for `js-tiktoken@1.0.21` and `@supabase/supabase-js@2.110.2`. This lets both Deno and Edge Runtime resolve the locked local package bytes while Docker networking is disabled. No handwritten tokenizer substitute exists.

## Reproduce

Prerequisites are the committed frozen pnpm dependency graph, a running Docker daemon, and the exact Edge image already present locally. The proof deliberately refuses to pull it.

```sh
cd "/Users/rubyku/Documents/Mobile App/lumis-mobile-s2-t272-work"
pnpm install --offline --frozen-lockfile
pnpm test:s2-t272-dice-deno-runtime
pnpm verify:s2-t272-dice-deno-runtime
```

The runner creates only ignored `.runtime/s2-t272-proof` material. Its trap removes the  generated service tree, container, and internal Docker network. The retained local receipt contains only versions, hashes, four named disabled results, and zero-call counters.

## What is proven

- The real entry passes Deno type checking; this found and repaired the previously hidden `SupabaseClient.rpc()` thenable-versus-Promise adapter mismatch.
- The real import graph contains the exact tokenizer and Supabase client packages.
- The immutable Supabase Edge Runtime creates a SHA-256 ESZIP from the actual entry with Docker networking set to `none`.
- The same runtime starts on an internal-only Docker network.
- Malformed JSON, an empty object, null authorization, and an unknown field all return HTTP 503 with `DICE_AI_DISABLED`.
- Because malformed JSON is not parsed and no Supabase configuration exists, those responses establish the disabled decision occurs before JSON parsing and authority-client construction.

This is local runtime evidence, not deployment evidence. It does not prove hosted Supabase parity, migration 0039 application, credentials, Azure connectivity, or model behavior.
