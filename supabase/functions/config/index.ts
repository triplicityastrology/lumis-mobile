import { PRODUCTS, ROUTE_CREDITS, TOP_UPS, PERSONA_STYLES } from "@lumis/shared";

Deno.serve(() => {
  return Response.json({
    age_min: 18,
    app_name: "Lumis",
    personas: PERSONA_STYLES,
    products: PRODUCTS,
    top_ups: TOP_UPS,
    route_credits: ROUTE_CREDITS,
    feature_flags: {
      dice_enabled: true,
      dice_physics: false,
      purchases_enabled: false,
      astro_routes_enabled: true
    },
    model_registry_version: 1
  });
});

