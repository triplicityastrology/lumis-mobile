import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const control = JSON.parse(readFileSync(path.join(root, "config/s2-t276-chat-runtime.json"), "utf8"));
const deno = process.env.LUMIS_DENO_BIN || path.join(root, ".tools/deno-2.2.12/deno");
const denoDir = path.join(root, ".tools/deno-cache");
const entry = "supabase/functions/chat-synthetic/index.ts";
const config = "supabase/functions/chat-synthetic/deno.json";
const common = ["--no-remote", "--node-modules-dir=manual", "--config", config];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const receiptPath = process.env.LUMIS_DENO_PROOF_OUTPUT || "config/evidence/s2-t276-chat-deno-runtime-proof.json";
const receiptSchema = process.env.LUMIS_DENO_PROOF_SCHEMA || "s2_t276_chat_deno_runtime_proof_v1";
const receiptLabel = process.env.LUMIS_DENO_PROOF_LABEL || "S2_T276_DENO_RUNTIME_PROOF_OK";

function run(args, options = {}) {
  const result = spawnSync(deno, args, { cwd: root, encoding: "utf8", env: { ...process.env, DENO_DIR: denoDir }, ...options });
  if (result.status !== 0) throw new Error(`S2_T276_DENO_COMMAND_FAILED ${args[0]} ${result.stderr || result.stdout}`);
  return result.stdout;
}

const versionText = run(["--version"]);
assert.match(versionText, new RegExp(`deno ${control.deno.version.replaceAll(".", "\\.")}`));
assert.equal(sha(readFileSync(deno)), control.deno.binary_sha256, "Deno binary checksum drift");
run(["check", ...common, entry]);
const infoText = run(["info", "--json", ...common, entry]);
const info = JSON.parse(infoText);
const serializedInfo = JSON.stringify(info);
assert.match(serializedInfo, /js-tiktoken@1\.0\.21/);
assert.match(serializedInfo, /@supabase(?:\+|\/)supabase-js@2\.110\.2/);
assert.equal(/https?:\/\/(?!localhost|127\.0\.0\.1)/.test(serializedInfo), false);

const port = control.runtime_policy.probe_port;
const child = spawn(deno, [
  "run", ...common, "--allow-env", `--allow-net=0.0.0.0:${port},127.0.0.1:${port}`, entry,
], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DENO_DIR: denoDir,
    PORT: String(port),
    LUMIS_CHAT_AI_ENABLED: "false",
  },
});
let serverOutput = "";
child.stdout.on("data", (chunk) => { serverOutput += chunk; });
child.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function request(body, method = "POST") {
  const response = await fetch(`http://127.0.0.1:${port}/`, { method, body });
  return { status: response.status, body: await response.json() };
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const response = await request("not-json");
      if (response.status === 503) { ready = true; break; }
    } catch {}
  }
  assert.equal(ready, true, `Deno server did not start: ${serverOutput}`);
  const probes = [
    await request("not-json"),
    await request("{}"),
    await request(JSON.stringify({ member_id: "forbidden" })),
    await request("", "POST"),
  ];
  for (const probe of probes) {
    assert.equal(probe.status, 503);
    assert.deepEqual(probe.body, { error: { code: "CHAT_AI_DISABLED" } });
  }
  const receipt = {
    schema: receiptSchema,
    runtime: { deno: control.deno.version, target: control.deno.target, binary_sha256: control.deno.binary_sha256 },
    entry,
    config,
    import_graph_sha256: sha(infoText),
    tokenizer: control.dependencies.js_tiktoken,
    supabase_js: control.dependencies.supabase_js,
    check: "passed",
    local_serve: "passed",
    disabled_probe_count: probes.length,
    disabled_code: "CHAT_AI_DISABLED",
    json_parsing_reached: false,
    client_construction_reached: false,
    provider_calls: 0,
    remote_imports: 0,
    network_scope: "loopback_only",
  };
  writeFileSync(path.join(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`${receiptLabel} deno=${control.deno.version} probes=${probes.length} provider_calls=0`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}
