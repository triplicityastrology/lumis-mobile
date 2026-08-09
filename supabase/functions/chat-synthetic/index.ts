import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createAzureChatSyntheticAdapter, readChatAzureServerConfig } from "../_shared/azure-chat-synthetic-adapter-v1.ts";
import { ChatSyntheticRun } from "../_shared/chat-synthetic-gateway-v1.ts";
import { ChatSyntheticGatewayPortV1, ChatSyntheticPortError } from "../_shared/chat-synthetic-gateway-port-v1.ts";
import { createChatSyntheticPostgresAuthorityStore, readChatSyntheticAuthorityStoreConfig } from "../_shared/chat-synthetic-postgres-authority-store-v1.ts";

const environment = {
  LUMIS_AI_ENABLED: Deno.env.get("LUMIS_AI_ENABLED"),
  LUMIS_AI_PROVIDER_ALIAS: Deno.env.get("LUMIS_AI_PROVIDER_ALIAS"),
  AZURE_OPENAI_ENDPOINT: Deno.env.get("AZURE_OPENAI_ENDPOINT"),
  AZURE_OPENAI_API_KEY: Deno.env.get("AZURE_OPENAI_API_KEY"),
  AZURE_OPENAI_API_VERSION: Deno.env.get("AZURE_OPENAI_API_VERSION"),
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
};
const serverConfig = readChatAzureServerConfig(environment);
const storeConfig = readChatSyntheticAuthorityStoreConfig(environment);
const runToken = Deno.env.get("CHAT_SYNTHETIC_RUN_TOKEN") ?? "";

const port = serverConfig.ok && storeConfig.ok ? new ChatSyntheticGatewayPortV1({
  gateway: new ChatSyntheticRun({
    aiEnabled: true,
    adapter: createAzureChatSyntheticAdapter(serverConfig.config),
    nowMs: Date.now,
    recordMetadata() {}
  }),
  authorityStore: createChatSyntheticPostgresAuthorityStore(storeConfig.config),
  control: Object.freeze({
    executionAuthority: false,
    acceptedDiceEvidenceSha256: null,
    acceptedAuthoritySha256: null,
    reviewPackageSha256: "unreviewed",
    gatewaySourceSha256: "unreviewed",
    fixtureRegistrySha256: "unreviewed"
  })
}) : null;

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse({ error_code: "CHAT_SYNTHETIC_METHOD_NOT_ALLOWED" }, { status: 405 });
  if (!runToken || request.headers.get("authorization") !== `Bearer ${runToken}`) {
    return jsonResponse({ error_code: "CHAT_SYNTHETIC_UNAUTHORIZED" }, { status: 401 });
  }
  if (!serverConfig.ok) return jsonResponse({ error_code: serverConfig.code }, { status: 503 });
  if (!storeConfig.ok || !port) return jsonResponse({ error_code: "CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE" }, { status: 503 });

  const body = await request.json().catch(() => null);
  try {
    const response = await port.invokeFixture(body);
    return jsonResponse(response, { status: response.result === "technical_error" ? 400 : 200, headers: corsHeaders });
  } catch (error) {
    const errorCode = error instanceof ChatSyntheticPortError ? error.code : "CHAT_SYNTHETIC_TECHNICAL_ERROR";
    return jsonResponse({ error_code: errorCode }, { status: 403, headers: corsHeaders });
  }
});
