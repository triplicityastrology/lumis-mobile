import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(readFileSync(path.join(root, "config/s2-t276-chat-runtime-review.json"), "utf8"));
const { package_binding_sha256: binding, ...bound } = manifest;
assert.equal(sha(JSON.stringify(bound)), binding, "STOP_S2_T276_PACKAGE_DRIFT");
for (const [file, digest] of Object.entries(manifest.source_sha256)) {
  assert.equal(sha(readFileSync(path.join(root, file))), digest, `STOP_S2_T276_SOURCE_DRIFT:${file}`);
}

const index = process.argv.indexOf("--validate-deployment-authorization");
if (index === -1) {
  console.log("OBTAIN_MICROSOFT_CHAT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");
  process.exit(0);
}

const value = JSON.parse(readFileSync(process.argv[index + 1], "utf8"));
const keys = ["schema", "authority", "project_ref", "function_name", "review_package_sha256", "source_commit", "enabled", "provider_calls_allowed", "migration_0040_authorized", "normal_chat_connected", "issued_at", "valid_until", "nonce"];
assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), "STOP_S2_T276_AUTHORIZATION_FIELDS_INVALID");
assert.equal(value.schema, "s2_t276_chat_default_off_deployment_authorization_v1");
assert.equal(value.authority, "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY");
assert.equal(value.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(value.function_name, "chat-synthetic");
assert.equal(value.review_package_sha256, binding);
assert.equal(value.source_commit, execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim());
assert.equal(value.enabled, false);
assert.equal(value.provider_calls_allowed, 0);
assert.equal(value.migration_0040_authorized, false);
assert.equal(value.normal_chat_connected, false);
assert.match(value.nonce, /^[a-f0-9]{32}$/);
assert.ok(Date.parse(value.issued_at) <= Date.now() && Date.parse(value.valid_until) > Date.now());
console.log("S2_T276_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION_ACCEPTED");
