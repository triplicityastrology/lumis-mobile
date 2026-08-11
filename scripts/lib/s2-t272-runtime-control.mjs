import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const T272 = Object.freeze({
  baseCommit: "776620bfa1bf3c80090313c83e753cb3004db50d",
  denoVersion: "2.2.7",
  denoBinarySha256: "1abb777a6bce5e54b6fe1153a75e1b8b5ccd53e09940afdeb1684070211d4fda",
  supabaseCliVersion: "2.113.0",
  supabaseCliBinarySha256: "ad4957e507ffc178fa27dd9256eb666f34bade172058b66e97f230413564494a",
  edgeImage: "public.ecr.aws/supabase/edge-runtime@sha256:a82676277615aee03c4f288cbbbf68dedb5ba8693073e567ab8dbfdd11ba5d45",
  edgeRuntimeVersion: "0.1.0",
  edgeDenoVersion: "2.1.4",
  supabaseJsVersion: "2.110.2",
  tokenizerVersion: "1.0.21",
  disabledCode: "DICE_AI_DISABLED",
});

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(path) {
  return sha256(readFileSync(path));
}

export function validateRuntimeControl({ packageJson, lockfile, denoConfig, entrySource }) {
  if (packageJson.devDependencies?.["deno-bin"] !== T272.denoVersion) return "STOP_S2_T272_DENO_VERSION_DRIFT";
  if (packageJson.devDependencies?.supabase !== T272.supabaseCliVersion) return "STOP_S2_T272_SUPABASE_CLI_VERSION_DRIFT";
  if (packageJson.devDependencies?.["@supabase/supabase-js"] !== T272.supabaseJsVersion) return "STOP_S2_T272_SUPABASE_JS_VERSION_DRIFT";
  if (packageJson.devDependencies?.["js-tiktoken"] !== T272.tokenizerVersion) return "STOP_S2_T272_TOKENIZER_VERSION_DRIFT";
  if (denoConfig.nodeModulesDir !== "manual") return "STOP_S2_T272_RUNTIME_MAY_DOWNLOAD";
  if (denoConfig.imports?.["js-tiktoken"] !== `npm:js-tiktoken@${T272.tokenizerVersion}`) return "STOP_S2_T272_TOKENIZER_IMPORT_DRIFT";
  if (denoConfig.imports?.["@supabase/supabase-js"] !== `npm:@supabase/supabase-js@${T272.supabaseJsVersion}`) return "STOP_S2_T272_SUPABASE_IMPORT_DRIFT";
  for (const version of [T272.denoVersion, T272.supabaseCliVersion, T272.supabaseJsVersion, T272.tokenizerVersion]) {
    if (!lockfile.includes(version)) return "STOP_S2_T272_LOCK_DRIFT";
  }
  if (!entrySource.includes('from "@supabase/supabase-js"')) return "STOP_S2_T272_ENTRY_IMPORT_DRIFT";
  if (!entrySource.includes("const { data, error } = await client.rpc(name, parameters)")) return "STOP_S2_T272_RPC_PORT_DRIFT";
  return "S2_T272_RUNTIME_CONTROL_OK";
}
