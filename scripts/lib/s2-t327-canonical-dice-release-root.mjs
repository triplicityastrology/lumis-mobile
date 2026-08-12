import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const MANIFEST_PATH = "config/s2-t327-canonical-dice-release-root.json";
export const SEAL_PATH = "config/s2-t327-canonical-dice-release-root-seal.json";
export const SUCCESS = "S2_T303_DEFAULT_OFF_FINAL_OK";

export const RUNTIME_FILES = Object.freeze([
  "supabase/functions/_shared/dice-question-pre-submit-v1.ts",
  "supabase/functions/_shared/dice-synthetic-canonical-v1.ts",
  "supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts",
  "supabase/functions/_shared/dice-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/dice-tokenizer-v1.ts",
  "supabase/functions/dice-synthetic/deno.json",
  "supabase/functions/dice-synthetic/edge-handler-v1.ts",
  "supabase/functions/dice-synthetic/index.ts",
]);

export const SEALED_FILES = Object.freeze([
  "apps/mobile/src/dev/founderTomorrowSession.ts",
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/features/dice/dicePreRollValidation.ts",
  "apps/mobile/src/features/dice/dicePreRollValidation.fixtures.ts",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "config/s2-t303-dice-default-off-final-control.json",
  "config/s2-t303-dice-default-off-final-package-seal.json",
  "config/s2-t312-closed-dice-registry.json",
  "config/s2-t312-closed-dice-registry-seal.json",
  "config/s2-t313-founder-signer-trust-anchor.json",
  "config/s2-t314-final-disabled-deploy-control.json",
  "config/s2-t314-final-disabled-deploy-package-seal.json",
  "config/s2-t314-founder-fixture-registry.json",
  "config/s2-t315-authorization-day-package-seal.json",
  "config/s2-t316-founder-session.json",
  "config/s2-t317-final-dice-release.json",
  "config/s2-t317-final-dice-release-seal.json",
  "config/s2-t322-real-dice-pre-roll-validation.json",
  "config/s2-t322-real-dice-pre-roll-validation-seal.json",
  "config/s2-t272-dice-deno-runtime.json",
  "config/evidence/s2-t272-dice-runtime-proof.json",
  "docs/qa/S2-T327-canonical-dice-release-root.md",
  "package.json",
  "scripts/lib/s2-t327-canonical-dice-release-root.mjs",
  "scripts/s2-t327-canonical-dice-release-preflight.mjs",
  "scripts/s2-t327-canonical-dice-release-root-contract.mjs",
  "scripts/s2-t327-refresh-canonical-dice-release-root.mjs",
  ...RUNTIME_FILES,
]);

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const fileHashes = (paths) => Object.fromEntries(paths.map((path) => [path, sha256(readFileSync(path))]));
export const packageSha = (manifest, files) => sha256(`${JSON.stringify({ manifest, files })}\n`);

const packageValue = (path) => readJson(path).package_sha256;

export function registryQuestionSha() {
  const registry = readJson("config/s2-t314-founder-fixture-registry.json");
  const questions = registry.fixtures.map(({ authoring_id, fixture_id, language, exact_text, exact_text_sha256 }) => ({
    authoring_id,
    fixture_id,
    language,
    exact_text,
    exact_text_sha256,
  }));
  return sha256(`${JSON.stringify(questions)}\n`);
}

export function buildManifest() {
  const t303 = readJson("config/s2-t303-dice-default-off-final-control.json");
  const t312 = readJson("config/s2-t312-closed-dice-registry.json");
  const t313 = readJson("config/s2-t313-founder-signer-trust-anchor.json");
  const t314 = readJson("config/s2-t314-final-disabled-deploy-control.json");
  const t316 = readJson("config/s2-t316-founder-session.json");
  const t317 = readJson("config/s2-t317-final-dice-release.json");
  const t322 = readJson("config/s2-t322-real-dice-pre-roll-validation.json");
  const runtimeFiles = fileHashes(RUNTIME_FILES);
  return {
    schema: "s2_t327_canonical_dice_release_root_v1",
    status: "SOURCE_READY_REMOTE_DISABLED",
    base_commit: "cd67316df0b9788886945527f9a51443591e432a",
    canonical_preflight_success: SUCCESS,
    dependencies: {
      t303_default_off: {
        control_sha256: sha256(readFileSync("config/s2-t303-dice-default-off-final-control.json")),
        package_sha256: packageValue("config/s2-t303-dice-default-off-final-package-seal.json"),
        runtime_package_sha256: t303.runtime_package_sha256,
      },
      t312_closed_registry: {
        control_sha256: sha256(readFileSync("config/s2-t312-closed-dice-registry.json")),
        package_sha256: packageValue("config/s2-t312-closed-dice-registry-seal.json"),
        registry_payload_sha256: t312.registry.sha256,
        registry_question_sha256: registryQuestionSha(),
      },
      t313_founder_signer: {
        trust_anchor_sha256: sha256(readFileSync("config/s2-t313-founder-signer-trust-anchor.json")),
        issuer_key_id: t313.issuer_key_id,
        operational_signing_authorized: t313.operational_signing_authorized,
      },
      t314_disabled_deployment: {
        control_sha256: sha256(readFileSync("config/s2-t314-final-disabled-deploy-control.json")),
        package_sha256: packageValue("config/s2-t314-final-disabled-deploy-package-seal.json"),
        t307_package_sha256: t314.source_authority.t307_package_sha256,
      },
      t315_runtime_controls: {
        package_sha256: packageValue("config/s2-t315-authorization-day-package-seal.json"),
      },
      t316_on_dice_interpretation: {
        manifest_sha256: sha256(readFileSync("config/s2-t316-founder-session.json")),
        surface: t316.dice_interpretation_surface,
        chat_navigation: t316.chat_navigation,
      },
      t317_release: {
        manifest_sha256: sha256(readFileSync("config/s2-t317-final-dice-release.json")),
        package_sha256: packageValue("config/s2-t317-final-dice-release-seal.json"),
      },
      t322_actual_screen_pre_roll: {
        control_sha256: sha256(readFileSync("config/s2-t322-real-dice-pre-roll-validation.json")),
        package_sha256: packageValue("config/s2-t322-real-dice-pre-roll-validation-seal.json"),
        product_boundary: t322.product_boundary,
      },
    },
    runtime: {
      files: runtimeFiles,
      seal_sha256: sha256(`${JSON.stringify(runtimeFiles)}\n`),
      control_manifest_sha256: sha256(readFileSync("config/s2-t272-dice-deno-runtime.json")),
      zero_network_proof_sha256: sha256(readFileSync("config/evidence/s2-t272-dice-runtime-proof.json")),
    },
    registry: t317.registry,
    product_path: {
      ...t317.product_path,
      pre_roll_enforcement: "actual_dice_begin_ready_before_roll",
    },
    rejected_question_effects: t322.rejection_effects,
    gates: {
      deployment_authorized: false,
      migration_authorized: false,
      provider_traffic_authorized: false,
      signing_authorized: false,
      remote_calls: 0,
      provider_calls: 0,
      model_invocations: 0,
    },
    authority_status: {
      normal_chat: t317.normal_chat_authority,
      azure_traffic: t317.azure_traffic_authority,
    },
    rollback: {
      target: t314.rollback.target,
      previous_revision_required: true,
      keep_provider_disabled: true,
    },
  };
}

export function validateRoot() {
  const manifest = readJson(MANIFEST_PATH);
  const expected = buildManifest();
  const seal = readJson(SEAL_PATH);
  const files = fileHashes(SEALED_FILES);
  if (JSON.stringify(manifest) !== JSON.stringify(expected)) throw new Error("STOP_S2_T327_MANIFEST_DRIFT");
  if (JSON.stringify(seal.files) !== JSON.stringify(files)) throw new Error("STOP_S2_T327_SOURCE_DRIFT");
  if (seal.schema !== "s2_t327_canonical_dice_release_root_seal_v1" || seal.package_sha256 !== packageSha(manifest, files)) {
    throw new Error("STOP_S2_T327_PACKAGE_DRIFT");
  }
  return Object.freeze({ manifest, seal });
}
