import { createClient } from "npm:@supabase/supabase-js@2.52.0";

import { createDiceSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const environment = {
  LUMIS_AI_ENABLED: Deno.env.get("LUMIS_AI_ENABLED"),
  LUMIS_DICE_AZURE_API_KEY: Deno.env.get("LUMIS_DICE_AZURE_API_KEY"),
  LUMIS_DICE_AUTHORITY_HMAC_SECRET: Deno.env.get("LUMIS_DICE_AUTHORITY_HMAC_SECRET"),
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

const handler = createDiceSyntheticEdgeHandler({
  environment,
  createAuthorityClient(url, serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-lumis-server-boundary": "dice-synthetic-v1" } },
    });
  },
});

Deno.serve(handler);
