import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

Deno.serve((request) => {
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) {
    return corsPreflight;
  }

  return jsonResponse({
    ok: true,
    stage: "scaffold_only",
    live_revenuecat_enabled: false
  });
});
