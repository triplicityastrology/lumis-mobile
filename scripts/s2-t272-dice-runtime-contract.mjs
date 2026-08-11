import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { T272, sha256File, validateRuntimeControl } from "./lib/s2-t272-runtime-control.mjs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const denoConfig = JSON.parse(readFileSync("supabase/functions/dice-synthetic/deno.json", "utf8"));
const entrySource = readFileSync("supabase/functions/dice-synthetic/index.ts", "utf8");
assert.equal(validateRuntimeControl({ packageJson, lockfile, denoConfig, entrySource }), "S2_T272_RUNTIME_CONTROL_OK");
const manifest = JSON.parse(readFileSync("config/s2-t272-dice-deno-runtime.json", "utf8"));
for (const [path, expected] of Object.entries(manifest.controlled_source_sha256)) {
  assert.equal(sha256File(path), expected, `STOP_S2_T272_SOURCE_DRIFT:${path}`);
}

const cases = [
  [{ ...denoConfig, nodeModulesDir: "auto" }, "STOP_S2_T272_RUNTIME_MAY_DOWNLOAD"],
  [{ ...denoConfig, imports: { ...denoConfig.imports, "js-tiktoken": "npm:js-tiktoken@1.0.20" } }, "STOP_S2_T272_TOKENIZER_IMPORT_DRIFT"],
  [{ ...denoConfig, imports: { "js-tiktoken": denoConfig.imports["js-tiktoken"] } }, "STOP_S2_T272_SUPABASE_IMPORT_DRIFT"],
];
for (const [mutated, expected] of cases) {
  assert.equal(validateRuntimeControl({ packageJson, lockfile, denoConfig: mutated, entrySource }), expected);
}

const deno = spawnSync("./node_modules/.bin/deno", ["--version"], { encoding: "utf8" });
assert.equal(deno.status, 0, deno.stderr);
assert.match(deno.stdout, new RegExp(`deno ${T272.denoVersion.replaceAll(".", "\\.")}`));
assert.equal(sha256File("node_modules/deno-bin/bin/deno"), T272.denoBinarySha256);
const denoCheck = spawnSync("./node_modules/.bin/deno", [
  "check", "--config", "supabase/functions/dice-synthetic/deno.json", "--no-remote",
  "supabase/functions/dice-synthetic/index.ts",
], { encoding: "utf8", env: { ...process.env, DENO_DIR: `${process.cwd()}/.runtime/s2-t272-contract-deno` } });
assert.equal(denoCheck.status, 0, denoCheck.stderr || denoCheck.stdout);
const isolatedHome = `${process.cwd()}/.runtime/s2-t272-contract-home`;
mkdirSync(isolatedHome, { recursive: true });
const supabase = spawnSync("./node_modules/.bin/supabase", ["--version"], {
  encoding: "utf8",
  env: { ...process.env, HOME: isolatedHome },
});
rmSync(isolatedHome, { recursive: true, force: true });
assert.equal(supabase.status, 0, supabase.stderr);
assert.equal(supabase.stdout.trim(), T272.supabaseCliVersion);
assert.equal(sha256File("node_modules/.pnpm/@supabase+cli-darwin-arm64@2.113.0/node_modules/@supabase/cli-darwin-arm64/bin/supabase"), T272.supabaseCliBinarySha256);

const sourceOrder = readFileSync("supabase/functions/dice-synthetic/edge-handler-v1.ts", "utf8");
assert(sourceOrder.indexOf("readDiceAzureServerConfig") < sourceOrder.indexOf("request.json()"));
assert(sourceOrder.indexOf("request.json()") < sourceOrder.indexOf("dependencies.createAuthorityClient("));
assert(!readFileSync("scripts/run-s2-t272-dice-runtime-proof.zsh", "utf8").includes("docker pull"));
assert(!readFileSync("scripts/run-s2-t272-dice-runtime-proof.zsh", "utf8").includes("supabase login"));
const proof = JSON.parse(readFileSync("config/evidence/s2-t272-dice-runtime-proof.json", "utf8"));
assert.equal(proof.proof.provider_calls, 0);
assert.equal(proof.proof.remote_calls, 0);
assert.equal(proof.proof.probes.length, 4);
assert(proof.proof.probes.every((probe) => probe.http_status === 503 && probe.result_code === T272.disabledCode));
const graph = JSON.parse(readFileSync("config/evidence/s2-t272-dice-runtime-import-graph.json", "utf8"));
assert.equal(graph.module_count, 14);
assert(graph.external_modules.includes("js-tiktoken@1.0.21/dist/index.js"));
assert(graph.external_modules.includes("@supabase/supabase-js@2.110.2/dist/index.mjs"));
console.log("S2_T272_DICE_RUNTIME_CONTRACT_OK hostile=3 remote_calls=0 provider_calls=0");
