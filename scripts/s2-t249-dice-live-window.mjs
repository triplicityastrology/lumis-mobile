#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runControlledWindow, sha256, STATUS, validateEvidencePackage, WindowStop } from "./lib/s2-t249-dice-live-window.mjs";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

if (!args.includes("--execute")) {
  console.log(JSON.stringify({
    status: "READY_FOR_T247_INTEGRATION_AND_MICROSOFT_REVIEW",
    authority: STATUS,
    network_calls: 0,
    next_action: "Integrate the reviewed T247 gateway, confirm live pricing, and obtain a single-use Dice-window authorization before using --execute.",
  }));
  process.exit(0);
}

const required = ["--gateway-module", "--registry", "--price", "--authorization", "--evidence-output"];
if (required.some((flag) => !valueAfter(flag))) {
  console.error("STOP_S2_T249_EXECUTION_INPUT_MISSING");
  process.exit(2);
}

try {
  const registryText = await readFile(resolve(valueAfter("--registry")), "utf8");
  const priceText = await readFile(resolve(valueAfter("--price")), "utf8");
  const [gatewayModule, registry, price, authorization] = await Promise.all([
    import(pathToFileURL(resolve(valueAfter("--gateway-module"))).href),
    Promise.resolve(JSON.parse(registryText)),
    Promise.resolve(JSON.parse(priceText)),
    readFile(resolve(valueAfter("--authorization")), "utf8").then(JSON.parse),
  ]);
  if (!gatewayModule.diceSyntheticGatewayPort) throw new WindowStop("STOP_S2_T249_GATEWAY_DRIFT");
  const result = await runControlledWindow({
    gateway: gatewayModule.diceSyntheticGatewayPort,
    registry: registry.fixtures,
    price,
    authorization,
    expectedGateway: registry.gateway,
  });
  const evidencePackage = validateEvidencePackage({
    schema: "s2_t249_dice_window_evidence_package_v1",
    run_id: result.run_id,
    gateway_source_sha256: registry.gateway.source_sha256,
    fixture_registry_sha256: registry.gateway.fixture_registry_sha256,
    price_confirmation_sha256: sha256(priceText),
    logical_total: result.logical_total,
    attempt_total: result.attempt_total,
    language: result.language,
    technical_evidence_valid: true,
    founder_phase_ran: true,
    provider_disabled_verified: result.provider_disabled_verified,
    records: result.evidence,
  }, registry.gateway);
  await writeFile(resolve(valueAfter("--evidence-output")), `${JSON.stringify(evidencePackage, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ ...result, evidence: undefined }));
} catch (error) {
  console.error(error instanceof WindowStop ? error.code : "STOP_S2_T249_OPERATOR_FAILED");
  process.exit(2);
}
