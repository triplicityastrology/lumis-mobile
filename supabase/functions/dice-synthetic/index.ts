import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createAzureDiceAdapter, readDiceAzureServerConfig } from "../_shared/azure-dice-adapter-v0-3.ts";
import { DiceSyntheticGateway, DiceSyntheticRunBudget } from "../_shared/dice-synthetic-gateway-v0-3.ts";
import { reviewedDiceSyntheticRegistry } from "../_shared/dice-synthetic-registry-adapter-v0-3.ts";

const budget = new DiceSyntheticRunBudget();

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse({ error: { code: "DICE_METHOD_NOT_ALLOWED" } }, { status: 405 });

  // Configuration is checked before adapter/client construction. Disabled is the deployed default.
  const config = readDiceAzureServerConfig({
    LUMIS_AI_ENABLED: Deno.env.get("LUMIS_AI_ENABLED"),
    LUMIS_AI_PROVIDER_ALIAS: Deno.env.get("LUMIS_AI_PROVIDER_ALIAS"),
    LUMIS_AI_DEPLOYMENT_FAMILY: Deno.env.get("LUMIS_AI_DEPLOYMENT_FAMILY"),
    AZURE_OPENAI_ENDPOINT: Deno.env.get("AZURE_OPENAI_ENDPOINT"),
    AZURE_OPENAI_API_KEY: Deno.env.get("AZURE_OPENAI_API_KEY"),
    AZURE_OPENAI_API_VERSION: Deno.env.get("AZURE_OPENAI_API_VERSION")
  });
  if (!config.ok) return jsonResponse({ error: { code: config.code } }, { status: 503 });

  const body = await request.json().catch(() => null);
  const gateway = new DiceSyntheticGateway(
    reviewedDiceSyntheticRegistry,
    createAzureDiceAdapter(config.config),
    budget
  );
  const result = await gateway.run(body);
  return jsonResponse(result.response, { status: result.response.result === "completed" ? 200 : 422 });
});
