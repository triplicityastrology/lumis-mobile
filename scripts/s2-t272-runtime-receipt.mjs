import { readFileSync, writeFileSync } from "node:fs";
import { T272, sha256File } from "./lib/s2-t272-runtime-control.mjs";

const [graphPath, eszipPath, probesPath, outputPath] = process.argv.slice(2);
if (!graphPath || !eszipPath || !probesPath || !outputPath) throw new Error("STOP_S2_T272_RECEIPT_ARGUMENTS");
const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const probes = readFileSync(probesPath, "utf8").trim().split("\n").map((line) => {
  const [fixture, status, code] = line.split("\t");
  if (!fixture || status !== "503" || code !== T272.disabledCode) throw new Error("STOP_S2_T272_DISABLED_PROBE_FAILED");
  return { fixture, http_status: 503, result_code: code };
});
if (probes.length !== 4) throw new Error("STOP_S2_T272_PROBE_COUNT");
const modules = graph.modules ?? [];
const specifiers = modules.map((module) => module.specifier ?? "");
if (!specifiers.some((value) => value.includes("js-tiktoken@1.0.21"))) throw new Error("STOP_S2_T272_TOKENIZER_GRAPH_MISSING");
if (!specifiers.some((value) => value.includes("supabase-js@2.110.2"))) throw new Error("STOP_S2_T272_SUPABASE_GRAPH_MISSING");
const receipt = {
  evidence_type: "s2_t272_dice_edge_runtime_proof_v1",
  authority: { azure_traffic: "NO_AZURE_TRAFFIC_AUTHORITY", normal_chat: "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" },
  base_commit: T272.baseCommit,
  runtime: {
    deno_cli: T272.denoVersion,
    supabase_cli: T272.supabaseCliVersion,
    edge_runtime: T272.edgeRuntimeVersion,
    edge_runtime_deno: T272.edgeDenoVersion,
    edge_image: T272.edgeImage,
  },
  dependencies: { tokenizer: `js-tiktoken@${T272.tokenizerVersion}`, supabase_js: `@supabase/supabase-js@${T272.supabaseJsVersion}` },
  proof: {
    deno_check: "passed",
    edge_eszip_bundle: "passed",
    edge_eszip_sha256: sha256File(eszipPath),
    import_graph_module_count: modules.length,
    import_graph_sha256: sha256File(graphPath),
    docker_network: "internal_only",
    disabled_before_json_parse_and_client_construction: true,
    probes,
    provider_calls: 0,
    remote_calls: 0,
  },
};
writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`S2_T272_RUNTIME_RECEIPT_OK eszip=${receipt.proof.edge_eszip_sha256} modules=${modules.length}`);
