import { createAzureDiceAdapter, readDiceAzureServerConfig } from "../_shared/azure-dice-adapter-v1.ts";
import { createPostgresDiceAuthorityStore, type DiceAuthorityRpcClient } from "../_shared/dice-authority-store-v1.ts";
import { DiceGatewayStop, DiceSyntheticGatewayPortV1 } from "../_shared/dice-synthetic-gateway-port-v1.ts";
import { executeFounderDiceCase, executeFounderDiceFreeTextCase, parseFounderDiceFreeTextRequest, parseFounderDiceRequest, verifyFounderWindowReceipt } from "../_shared/dice-founder-window-v1.ts";
import { executeDiceV04FreeTextCase } from "../_shared/dice-v0-4-window.ts";
import { createDiceV04Adapter } from "../_shared/azure-dice-adapter-v4.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

export const DICE_EDGE_PACKAGE_SHA256 = "7962b7059e678819a7ca91263b4b6aaaea020932f3fa1b4faacbadb4b1ac7959" as const;
export const DICE_EDGE_REGISTRY_SHA256 = "200cd67c782e0f29038c7cc373d1f749fc790363188d3e5da62d8040ef0e3c62" as const;

type EdgeEnvironment = Readonly<Record<string, string | undefined>>;

export type DiceEdgeDependencies = Readonly<{
  environment: EdgeEnvironment;
  createAuthorityClient(url: string, serviceRoleKey: string): DiceAuthorityRpcClient;
  fetchImpl?: typeof fetch;
  verifyFounderReceipt?: typeof verifyFounderWindowReceipt;
}>;

export function createDiceSyntheticEdgeHandler(dependencies: DiceEdgeDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const preflight = handleCorsPreflight(request);
    if (preflight) return preflight;
    if (request.method !== "POST") return errorResponse("DICE_METHOD_NOT_ALLOWED", 405);

    const providerConfig = readDiceAzureServerConfig({
      LUMIS_DICE_AI_ENABLED: dependencies.environment.LUMIS_DICE_AI_ENABLED,
      LUMIS_DICE_TRAFFIC_AUTHORIZED: dependencies.environment.LUMIS_DICE_TRAFFIC_AUTHORIZED,
      LUMIS_DICE_AZURE_API_KEY: dependencies.environment.LUMIS_DICE_AZURE_API_KEY,
      LUMIS_DICE_DEPLOYMENT_ALIAS: dependencies.environment.LUMIS_DICE_DEPLOYMENT_ALIAS,
      LUMIS_DICE_MODEL: dependencies.environment.LUMIS_DICE_MODEL,
      LUMIS_DICE_MODEL_VERSION: dependencies.environment.LUMIS_DICE_MODEL_VERSION,
      LUMIS_DICE_DEPLOYMENT_TYPE: dependencies.environment.LUMIS_DICE_DEPLOYMENT_TYPE,
      LUMIS_DICE_UPGRADE_POLICY: dependencies.environment.LUMIS_DICE_UPGRADE_POLICY,
      LUMIS_DICE_GUARDRAIL: dependencies.environment.LUMIS_DICE_GUARDRAIL,
      LUMIS_DICE_TPM_LIMIT: dependencies.environment.LUMIS_DICE_TPM_LIMIT,
      LUMIS_DICE_RPM_LIMIT: dependencies.environment.LUMIS_DICE_RPM_LIMIT,
      LUMIS_DICE_FOUNDRY_HOSTNAME: dependencies.environment.LUMIS_DICE_FOUNDRY_HOSTNAME,
      LUMIS_DICE_FOUNDRY_PROTOCOL: dependencies.environment.LUMIS_DICE_FOUNDRY_PROTOCOL,
      LUMIS_DICE_API_ROUTE_FAMILY: dependencies.environment.LUMIS_DICE_API_ROUTE_FAMILY,
    });
    if (!providerConfig.ok) return errorResponse(providerConfig.code, 503);

    const body = await request.json().catch(() => null);
    const freeTextRequest = parseFounderDiceFreeTextRequest(body);
    if (hasFounderFreeTextIntent(body) && !freeTextRequest) return errorResponse("DICE_FOUNDER_FREE_TEXT_SCHEMA_INVALID", 400);
    if (freeTextRequest) {
      const suppliedAccess = request.headers.get("x-lumis-founder-free-text-access");
      if (dependencies.environment.LUMIS_DICE_FOUNDER_FREE_TEXT_ENABLED !== "true" ||
          !await validFounderFreeTextAccess(suppliedAccess, dependencies.environment.LUMIS_DICE_FOUNDER_FREE_TEXT_ACCESS_KEY)) {
        return errorResponse("DICE_FOUNDER_FREE_TEXT_DISABLED", 403);
      }
      // v4 (Dice AI Interpretation Prompt v3) two-stage route, opt-in by header
      // so the sealed v3 free-text path remains the untouched default.
      if (request.headers.get("x-lumis-dice-interpretation") === "v4") {
        const v4 = await executeDiceV04FreeTextCase(freeTextRequest, () => createDiceV04Adapter(providerConfig.config, dependencies.fetchImpl));
        if (v4.kind !== "completed") {
          const code = v4.kind === "safety" ? "DICE_SAFETY_REDIRECT" : v4.kind === "bundled" ? "DICE_BUNDLED_QUESTION" : v4.kind === "route_review" ? "DICE_ROUTE_REVIEW_REQUIRED" : "DICE_FIXED_FALLBACK";
          return jsonResponse({ error: { code, redacted_failure_code: v4.code }, metadata: v4.metadata }, { status: 422 });
        }
        return jsonResponse({ result: v4.result, question_mode: v4.question_mode, metadata: v4.metadata }, { status: 200 });
      }
      const outcome = await executeFounderDiceFreeTextCase(freeTextRequest, () => createAzureDiceAdapter(providerConfig.config, dependencies.fetchImpl));
      if (outcome.kind !== "completed") {
        const code = outcome.kind === "safety" ? "DICE_SAFETY_REDIRECT" : outcome.kind === "route_mismatch" ? "DICE_ROUTE_MISMATCH" : "DICE_FIXED_FALLBACK";
        const protectedMetadata = "provider_disposition" in outcome && outcome.provider_disposition
          ? { provider_disposition: outcome.provider_disposition }
          : undefined;
        return jsonResponse({ error: { code, redacted_failure_code: outcome.code }, classification: outcome.classification, metadata: outcome.metadata, protected_metadata: protectedMetadata }, { status: 422 });
      }
      return jsonResponse({ result: outcome.result, classification: outcome.classification, metadata: outcome.metadata, protected_metadata: { provider_disposition: outcome.provider_disposition } }, { status: 200 });
    }

    const runtimeConfig = readRuntimeConfig(dependencies.environment);
    if (!runtimeConfig.ok) return errorResponse(runtimeConfig.code, 503);
    const authorityClient = dependencies.createAuthorityClient(runtimeConfig.supabaseUrl, runtimeConfig.serviceRoleKey);
    const founderRequest = parseFounderDiceRequest(body);
    if (founderRequest) {
      const encoded = request.headers.get("x-lumis-founder-window-authorization");
      const claimedSha256 = request.headers.get("x-lumis-founder-window-receipt-sha256");
      const publicKeyPem = dependencies.environment.LUMIS_DICE_FOUNDER_WINDOW_PUBLIC_KEY_PEM?.trim();
      if (!encoded || !claimedSha256 || !publicKeyPem) return errorResponse("DICE_FOUNDER_WINDOW_NOT_AUTHORIZED", 403);
      let verified: Awaited<ReturnType<typeof verifyFounderWindowReceipt>>;
      try {
        verified = await (dependencies.verifyFounderReceipt ?? verifyFounderWindowReceipt)(encoded, claimedSha256, publicKeyPem);
      } catch {
        return errorResponse("DICE_FOUNDER_WINDOW_REJECTED", 403);
      }
      try {
        const outcome = await executeFounderDiceCase(founderRequest, verified.receipt, verified.receiptSha256, createAzureDiceAdapter(providerConfig.config, dependencies.fetchImpl), authorityClient);
        if (outcome.kind !== "completed") {
          return founderOutcomeResponse(
            outcome.kind === "safety" ? "DICE_SAFETY_REDIRECT" : outcome.kind === "route_mismatch" ? "DICE_ROUTE_MISMATCH" : "DICE_FIXED_FALLBACK",
            outcome.code,
            "provider_disposition" in outcome ? outcome.provider_disposition : undefined,
          );
        }
        return jsonResponse({ result: outcome.result, metadata: outcome.metadata, protected_metadata: { provider_disposition: outcome.provider_disposition } }, { status: 200 });
      } catch (error) {
        return founderOutcomeResponse("DICE_FIXED_FALLBACK", founderExecutionFailure(error));
      }
    }
    if (!isClosedEdgeRequest(body)) return errorResponse("DICE_REQUEST_SCHEMA_INVALID", 400);

    const gateway = new DiceSyntheticGatewayPortV1(
      createAzureDiceAdapter(providerConfig.config, dependencies.fetchImpl),
      createPostgresDiceAuthorityStore(authorityClient),
      runtimeConfig.authoritySecret,
      { gatewayPackageSha256: DICE_EDGE_PACKAGE_SHA256, fixtureRegistrySha256: DICE_EDGE_REGISTRY_SHA256 },
    );

    try {
      const evidence = await gateway.executeAuthorizedWindow(body.authorization);
      return jsonResponse(evidence, { status: 200 });
    } catch (error) {
      return errorResponse(error instanceof DiceGatewayStop ? error.code : "DICE_EDGE_UNAVAILABLE", statusFor(error));
    }
  };
}

function hasFounderFreeTextIntent(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.hasOwn(value, "question");
}

async function validFounderFreeTextAccess(supplied: string | null, expected: string | undefined): Promise<boolean> {
  if (!supplied || !expected?.trim() || supplied.length < 32 || expected.length < 32) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let different = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) different |= a[index] ^ b[index];
  return different === 0;
}

function readRuntimeConfig(environment: EdgeEnvironment):
  | { ok: true; supabaseUrl: string; serviceRoleKey: string; authoritySecret: string }
  | { ok: false; code: "DICE_EDGE_CONFIGURATION_MISSING" } {
  const supabaseUrl = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const authoritySecret = environment.LUMIS_DICE_AUTHORITY_HMAC_SECRET?.trim();
  if (!supabaseUrl || !serviceRoleKey || !authoritySecret) return { ok: false, code: "DICE_EDGE_CONFIGURATION_MISSING" };
  return { ok: true, supabaseUrl, serviceRoleKey, authoritySecret };
}

function isClosedEdgeRequest(value: unknown): value is { authorization: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === 1 && Object.hasOwn(value, "authorization");
}

function statusFor(error: unknown): number {
  if (!(error instanceof DiceGatewayStop)) return 503;
  if (error.code.includes("REPLAYED") || error.code.includes("BUSY")) return 409;
  if (error.code.includes("STORE_UNAVAILABLE")) return 503;
  return 403;
}

function errorResponse(code: string, status: number): Response {
  return jsonResponse({ error: { code } }, { status });
}

function founderOutcomeResponse(code: "DICE_SAFETY_REDIRECT" | "DICE_FIXED_FALLBACK" | "DICE_ROUTE_MISMATCH", redactedFailureCode: string, providerDisposition?: string): Response {
  const body = providerDisposition
    ? { error: { code, redacted_failure_code: redactedFailureCode }, protected_metadata: { provider_disposition: providerDisposition } }
    : { error: { code, redacted_failure_code: redactedFailureCode } };
  return jsonResponse(body, { status: 422 });
}

function founderExecutionFailure(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return ["DICE_FOUNDER_AUTHORITY_REJECTED", "DICE_FOUNDER_RETRY_INVALID"].includes(code)
    ? code
    : "DICE_FOUNDER_EXECUTION_REJECTED";
}
