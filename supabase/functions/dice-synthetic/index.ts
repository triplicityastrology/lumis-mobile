import { createClient } from "@supabase/supabase-js";

import { createDiceSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const environment = {
  LUMIS_DICE_AI_ENABLED: Deno.env.get("LUMIS_DICE_AI_ENABLED"),
  LUMIS_DICE_TRAFFIC_AUTHORIZED: Deno.env.get("LUMIS_DICE_TRAFFIC_AUTHORIZED"),
  LUMIS_DICE_AZURE_API_KEY: Deno.env.get("LUMIS_DICE_AZURE_API_KEY"),
  LUMIS_DICE_AUTHORITY_HMAC_SECRET: Deno.env.get("LUMIS_DICE_AUTHORITY_HMAC_SECRET"),
  LUMIS_DICE_DEPLOYMENT_ALIAS: Deno.env.get("LUMIS_DICE_DEPLOYMENT_ALIAS"),
  LUMIS_DICE_MODEL: Deno.env.get("LUMIS_DICE_MODEL"),
  LUMIS_DICE_MODEL_VERSION: Deno.env.get("LUMIS_DICE_MODEL_VERSION"),
  LUMIS_DICE_DEPLOYMENT_TYPE: Deno.env.get("LUMIS_DICE_DEPLOYMENT_TYPE"),
  LUMIS_DICE_UPGRADE_POLICY: Deno.env.get("LUMIS_DICE_UPGRADE_POLICY"),
  LUMIS_DICE_GUARDRAIL: Deno.env.get("LUMIS_DICE_GUARDRAIL"),
  LUMIS_DICE_TPM_LIMIT: Deno.env.get("LUMIS_DICE_TPM_LIMIT"),
  LUMIS_DICE_RPM_LIMIT: Deno.env.get("LUMIS_DICE_RPM_LIMIT"),
  LUMIS_DICE_FOUNDRY_HOSTNAME: Deno.env.get("LUMIS_DICE_FOUNDRY_HOSTNAME"),
  LUMIS_DICE_FOUNDRY_PROTOCOL: Deno.env.get("LUMIS_DICE_FOUNDRY_PROTOCOL"),
  LUMIS_DICE_API_ROUTE_FAMILY: Deno.env.get("LUMIS_DICE_API_ROUTE_FAMILY"),
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

const handler = createDiceSyntheticEdgeHandler({
  environment,
  createAuthorityClient(url, serviceRoleKey) {
    const client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-lumis-server-boundary": "dice-synthetic-v1" } },
    });
    return {
      async rpc(name, parameters) {
        const { data, error } = await client.rpc(name, parameters);
        return { data, error };
      },
    };
  },
});

Deno.serve(handler);
