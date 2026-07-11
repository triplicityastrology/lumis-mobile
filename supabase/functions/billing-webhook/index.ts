Deno.serve(() => {
  return Response.json({
    ok: true,
    stage: "scaffold_only",
    live_revenuecat_enabled: false
  });
});

