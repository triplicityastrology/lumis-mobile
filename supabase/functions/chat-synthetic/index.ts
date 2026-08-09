import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createAzureChatSyntheticAdapter } from "../_shared/azure-chat-synthetic-adapter-v1.ts";
import { ChatSyntheticRun } from "../_shared/chat-synthetic-gateway-v1.ts";

const enabled = Deno.env.get("LUMIS_AI_ENABLED") === "true";
const endpoint = Deno.env.get("AZURE_FOUNDRY_CHAT_ENDPOINT") ?? "";
const apiKey = Deno.env.get("AZURE_FOUNDRY_CHAT_KEY") ?? "";
const runToken = Deno.env.get("CHAT_SYNTHETIC_RUN_TOKEN") ?? "";

let gateway: ChatSyntheticRun | null = null;

function getEnabledGateway(): ChatSyntheticRun {
  gateway ??= new ChatSyntheticRun({
    aiEnabled: true,
    adapter: createAzureChatSyntheticAdapter({ endpoint, apiKey, providerAlias: "lumis-ai-chat-stg" }),
    nowMs: Date.now,
    recordMetadata(event) {
      // Closed metadata only. Runtime log retention is controlled to 30 days operationally.
      console.info(JSON.stringify({ event: "chat_synthetic_result", ...event }));
    }
  });
  return gateway;
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse({ error_code: "CHAT_SYNTHETIC_METHOD_NOT_ALLOWED" }, { status: 405 });
  if (!runToken || request.headers.get("authorization") !== `Bearer ${runToken}`) {
    return jsonResponse({ error_code: "CHAT_SYNTHETIC_UNAUTHORIZED" }, { status: 401 });
  }
  if (!enabled) return jsonResponse({ error_code: "CHAT_SYNTHETIC_PROVIDER_DISABLED" }, { status: 503 });
  if (!endpoint || !apiKey) return jsonResponse({ error_code: "CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE" }, { status: 503 });

  const body = await request.json().catch(() => null);
  const response = await getEnabledGateway().handle(body);
  return jsonResponse(response, { status: response.result === "technical_error" ? 400 : 200, headers: corsHeaders });
});
