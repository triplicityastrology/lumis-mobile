import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const paths = [
  "supabase/tests/s2-t271-dice-technical-evidence.schema.json",
  "supabase/tests/s2-t271-founder-chat-window-authorization-request.schema.json",
  "supabase/tests/s2-t271-founder-chat-window-execution-evidence.schema.json",
  "supabase/tests/s2-t271-founder-chat-post-window-disabled.schema.json",
  "supabase/tests/s2-t271-founder-chat-window-verdict.schema.json",
];
for (const path of paths) {
  const text = readFileSync(path, "utf8");
  const schema = JSON.parse(text);
  assert.equal(schema.additionalProperties, false, `${path} is closed`);
  assert.match(createHash("sha256").update(text).digest("hex"), /^[a-f0-9]{64}$/);
}
const authorization = JSON.parse(readFileSync(paths[1], "utf8"));
assert.deepEqual(authorization.properties.runtime_request_fields.const, ["fixture_id"]);
assert.equal(authorization.properties.effects.properties.persistence_writes.const, 0);
assert.equal(authorization.properties.effects.properties.units_charged.const, 0);
const execution = JSON.parse(readFileSync(paths[2], "utf8"));
assert.equal(execution.properties.response.properties.provider_diagnostics.type, "null");
assert.equal(execution.properties.response.properties.persistence_writes.const, 0);
const disabled = JSON.parse(readFileSync(paths[3], "utf8"));
assert.equal(disabled.properties.provider_enabled.const, false);
assert.equal(disabled.properties.residual_access.const, false);
console.log("S2-T281 Founder bridge closed evidence schemas passed");
