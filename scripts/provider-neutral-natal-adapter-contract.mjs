import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adapter = readFileSync(
  "packages/astrology/src/provider-neutral-natal-adapter.ts",
  "utf8"
);
const architecture = readFileSync(
  "docs/architecture/deterministic-natal-fact-engine.md",
  "utf8"
);

assert.match(adapter, /PROVIDER_NEUTRAL_NATAL_VERSION =\s+"provider_neutral_natal_v1"/);
assert.match(adapter, /NATAL_INPUT_CONTRACT_VERSION/);
assert.match(adapter, /validateNatalEngineInput\(engineInput\)/);
assert.match(adapter, /const ROOT_FIELDS = new Set\(\[[\s\S]*"schemaVersion"[\s\S]*"source"[\s\S]*"points"[\s\S]*"houses"/);
assert.match(adapter, /SAFE_IDENTIFIER/);
assert.match(adapter, /NATAL_ADAPTER_DUPLICATE_POINT/);
assert.match(adapter, /NATAL_ADAPTER_TIME_CAPABILITY_MISMATCH/);
assert.match(adapter, /isProhibitedNatalScopeIdentifier/);
assert.doesNotMatch(
  adapter,
  /fetch\(|Deno\.env|process\.env|createClient|supabase|astrology-api|openai|azure|anthropic/i
);
assert.doesNotMatch(
  adapter,
  /apps\/mobile|dice|chat-message|knowledge bank|insert\(|update\(|upsert\(|rpc\(|deploy|migration/i
);
assert.match(architecture, /Provider-neutral natal adapter/);
assert.match(architecture, /inactive technical infrastructure/);
assert.match(architecture, /no raw provider payload/);

console.log("provider-neutral natal adapter source contracts passed");
