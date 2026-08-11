import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const denoConfig = JSON.parse(readFileSync("supabase/functions/dice-synthetic/deno.json", "utf8"));
assert.deepEqual(denoConfig, { imports: { "js-tiktoken": "npm:js-tiktoken@1.0.21" }, nodeModulesDir: "auto" });
assert.equal(existsSync("scripts/fixtures/js-tiktoken/index.js"), false, "test tokenizer stub must not exist");
const packageMetadata = JSON.parse(readFileSync("node_modules/js-tiktoken/package.json", "utf8"));
assert.equal(packageMetadata.name, "js-tiktoken");
assert.equal(packageMetadata.version, "1.0.21");
const { getEncoding } = await import("js-tiktoken");
const encoding = getEncoding("o200k_base");
assert.deepEqual([...encoding.encode("hello")], [24912]);
assert.deepEqual([...encoding.encode("你好🙂")], [177519, 37459]);
const lock = readFileSync("pnpm-lock.yaml", "utf8");
assert.match(lock, /js-tiktoken@1\.0\.21:/);
assert.match(lock, /sha512-biOj\/6M5qdgx5TKjDnFT1ymSpM5tbd3ylwDtrQvFQSu0Z7bBYko2dF\+W\/aUkXUPuk6IVpRxk\/3Q2sHOzGlS36g==/);

const deno = spawnSync("deno", ["check", "--config", "supabase/functions/dice-synthetic/deno.json", "supabase/functions/dice-synthetic/index.ts"], { encoding: "utf8" });
if (deno.error?.code !== "ENOENT") {
  assert.equal(deno.status, 0, deno.stderr || deno.stdout);
}
console.log(JSON.stringify({
  status: "S2_T267_VERSION_PINNED_TOKENIZER_GRAPH_OK",
  import: denoConfig.imports["js-tiktoken"],
  package_version: packageMetadata.version,
  deno_check_executed: deno.error?.code !== "ENOENT",
}));
