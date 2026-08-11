import { createClient } from "npm:@supabase/supabase-js@2.52.0";

import { createChatSyntheticEdgeHandler } from "./edge-handler-v1.ts";

const environment = {
  LUMIS_CHAT_AI_ENABLED: Deno.env.get("LUMIS_CHAT_AI_ENABLED"),
  LUMIS_CHAT_AZURE_API_KEY: Deno.env.get("LUMIS_CHAT_AZURE_API_KEY"),
  LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256: Deno.env.get("LUMIS_CHAT_ACCEPTED_DICE_EVIDENCE_SHA256"),
  LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256: Deno.env.get("LUMIS_CHAT_ACCEPTED_AUTHORITY_SHA256"),
  LUMIS_CHAT_REVIEW_PACKAGE_SHA256: Deno.env.get("LUMIS_CHAT_REVIEW_PACKAGE_SHA256"),
  LUMIS_CHAT_GATEWAY_SOURCE_SHA256: Deno.env.get("LUMIS_CHAT_GATEWAY_SOURCE_SHA256"),
  LUMIS_CHAT_FIXTURE_REGISTRY_SHA256: Deno.env.get("LUMIS_CHAT_FIXTURE_REGISTRY_SHA256"),
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

const handler = createChatSyntheticEdgeHandler({
  environment,
  createAuthorityClient(url, serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-lumis-server-boundary": "chat-synthetic-v1" } },
    });
  },
});

Deno.serve(handler);
