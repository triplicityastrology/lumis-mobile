import { createAzureDiceAdapter, readDiceAzureServerConfig } from "../_shared/azure-dice-adapter-v1.ts";
import { createPostgresDiceAuthorityStore, type DiceAuthorityRpcClient } from "../_shared/dice-authority-store-v1.ts";
import { DiceGatewayStop, DiceSyntheticGatewayPortV1 } from "../_shared/dice-synthetic-gateway-port-v1.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

export const DICE_EDGE_PACKAGE_SHA256 = "3ccc7551fd945b4ca4c3aaeaa7b8f9efd61f29b56e8ebe3c69ea9f5c5aaae8ba" as const;
export const DICE_EDGE_REGISTRY_SHA256 = "200cd67c782e0f29038c7cc373d1f749fc790363188d3e5da62d8040ef0e3c62" as const;

type EdgeEnvironment = Readonly<Record<string, string | undefined>>;

export type DiceEdgeDependencies = Readonly<{
  environment: EdgeEnvironment;
  createAuthorityClient(url: string, serviceRoleKey: string): DiceAuthorityRpcClient;
  fetchImpl?: typeof fetch;
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

    const runtimeConfig = readRuntimeConfig(dependencies.environment);
    if (!runtimeConfig.ok) return errorResponse(runtimeConfig.code, 503);
    const body = await request.json().catch(() => null);
    if (!isClosedEdgeRequest(body)) return errorResponse("DICE_REQUEST_SCHEMA_INVALID", 400);

    const authorityClient = dependencies.createAuthorityClient(runtimeConfig.supabaseUrl, runtimeConfig.serviceRoleKey);
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
