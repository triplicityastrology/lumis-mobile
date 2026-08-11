import { createAzureChatSyntheticAdapter, readChatAzureServerConfig } from "../_shared/azure-chat-synthetic-adapter-v1.ts";
import { ChatSyntheticRun } from "../_shared/chat-synthetic-gateway-v1.ts";
import {
  ChatSyntheticGatewayPortV1,
  ChatSyntheticPortError,
  type ChatSyntheticReviewControl,
} from "../_shared/chat-synthetic-gateway-port-v1.ts";
import {
  createChatSyntheticPostgresAuthorityStore,
  type ChatAuthorityRpcClient,
} from "../_shared/chat-synthetic-postgres-authority-store-v1.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

export const CHAT_EDGE_ROUTE = "chat-synthetic" as const;

type EdgeEnvironment = Readonly<Record<string, string | undefined>>;

export type ChatEdgeDependencies = Readonly<{
  environment: EdgeEnvironment;
  createAuthorityClient(url: string, serviceRoleKey: string): ChatAuthorityRpcClient;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}>;

type ClosedEdgeRequest = Readonly<{
  dice_evidence: unknown;
  dice_evidence_sha256: string;
  authority: unknown;
  authority_sha256: string;
  fixture: unknown;
}>;

export function createChatSyntheticEdgeHandler(dependencies: ChatEdgeDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const preflight = handleCorsPreflight(request);
    if (preflight) return preflight;
    if (request.method !== "POST") return errorResponse("CHAT_SYNTHETIC_METHOD_NOT_ALLOWED", 405);

    // This check intentionally precedes JSON parsing and all client construction.
    if (dependencies.environment.LUMIS_CHAT_AI_ENABLED !== "true") {
      return errorResponse("CHAT_AI_DISABLED", 503);
    }

    const providerConfig = readChatAzureServerConfig(dependencies.environment);
    if (!providerConfig.ok) return errorResponse(providerConfig.code, 503);
    const runtime = readRuntimeConfig(dependencies.environment);
    if (!runtime.ok) return errorResponse(runtime.code, 503);

    const body = await request.json().catch(() => null);
    if (!isClosedEdgeRequest(body)) return errorResponse("CHAT_SYNTHETIC_INVALID_REQUEST", 400);

    const authorityClient = dependencies.createAuthorityClient(runtime.supabaseUrl, runtime.serviceRoleKey);
    const gateway = new ChatSyntheticRun({
      aiEnabled: true,
      adapter: createAzureChatSyntheticAdapter(providerConfig.config, dependencies.fetchImpl),
      nowMs: dependencies.nowMs ?? Date.now,
      recordMetadata() {},
    });
    const port = new ChatSyntheticGatewayPortV1({
      gateway,
      authorityStore: createChatSyntheticPostgresAuthorityStore(authorityClient),
      control: runtime.control,
      nowMs: dependencies.nowMs,
    });

    try {
      await port.authorize({
        diceEvidence: body.dice_evidence,
        diceEvidenceSha256: body.dice_evidence_sha256,
        authority: body.authority,
        authoritySha256: body.authority_sha256,
      });
      const result = await port.invokeFixture(body.fixture);
      return jsonResponse(result, { status: 200 });
    } catch (error) {
      const code = error instanceof ChatSyntheticPortError ? error.code : "CHAT_SYNTHETIC_TECHNICAL_ERROR";
      return errorResponse(code, statusFor(code));
    }
  };
}

function readRuntimeConfig(environment: EdgeEnvironment):
  | { ok: true; supabaseUrl: string; serviceRoleKey: string; control: ChatSyntheticReviewControl }
  | { ok: false; code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" } {
  const supabaseUrl = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const acceptedDiceEvidenceSha256 = environment.LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256?.trim();
  const acceptedAuthoritySha256 = environment.LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256?.trim();
  const reviewPackageSha256 = environment.LUMIS_CHAT_REVIEW_PACKAGE_SHA256?.trim();
  const gatewaySourceSha256 = environment.LUMIS_CHAT_GATEWAY_SOURCE_SHA256?.trim();
  const fixtureRegistrySha256 = environment.LUMIS_CHAT_FIXTURE_REGISTRY_SHA256?.trim();
  if (!supabaseUrl || !serviceRoleKey || !acceptedDiceEvidenceSha256 || !acceptedAuthoritySha256 ||
      !reviewPackageSha256 || !gatewaySourceSha256 || !fixtureRegistrySha256) {
    return { ok: false, code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" };
  }
  return {
    ok: true,
    supabaseUrl,
    serviceRoleKey,
    control: Object.freeze({
      executionAuthority: true,
      acceptedDiceEvidenceSha256,
      acceptedAuthoritySha256,
      reviewPackageSha256,
      gatewaySourceSha256,
      fixtureRegistrySha256,
    }),
  };
}

function isClosedEdgeRequest(value: unknown): value is ClosedEdgeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 5 && keys.every((key) =>
    ["dice_evidence", "dice_evidence_sha256", "authority", "authority_sha256", "fixture"].includes(key));
}

function statusFor(code: string): number {
  if (code.includes("REPLAYED") || code.includes("ALREADY_USED")) return 409;
  if (code.includes("STORE_UNAVAILABLE") || code.includes("CONFIGURATION")) return 503;
  if (code.includes("INVALID_REQUEST")) return 400;
  return 403;
}

function errorResponse(code: string, status: number): Response {
  return jsonResponse({ error: { code } }, { status });
}
