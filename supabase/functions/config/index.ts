import { PRODUCTS, TOP_UPS } from "../../../packages/shared/src/config/products.ts";
import { ROUTE_CREDITS } from "../../../packages/shared/src/config/routes.ts";
import { PERSONA_STYLES } from "../../../packages/shared/src/terminology/lumis.ts";

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
