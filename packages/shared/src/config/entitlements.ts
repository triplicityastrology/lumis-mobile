import type { ChatRoute } from "./routes";

export type PlanTier = "starter" | "essential" | "prime";

export type EntitlementFeatureKey =
  | "care_circle"
  | "dice"
  | "knowledge_bank"
  | "natal_chat"
  | "personal_transits"
  | "push_notifications";

export const PLAN_ENTITLEMENTS: Record<PlanTier, EntitlementFeatureKey[]> = {
  starter: ["natal_chat", "knowledge_bank"],
  essential: ["natal_chat", "knowledge_bank", "dice", "push_notifications"],
  prime: [
    "natal_chat",
    "knowledge_bank",
    "dice",
    "personal_transits",
    "care_circle",
    "push_notifications"
  ]
};

export const ROUTE_PLAN_REQUIREMENTS: Record<ChatRoute, PlanTier> = {
  casual: "starter",
  knowledge: "starter",
  dice: "essential",
  astro_timing: "prime",
  astro_deep: "starter",
  out_of_scope: "starter",
  safety: "starter"
};

export const FEATURE_LABELS: Record<EntitlementFeatureKey, string> = {
  care_circle: "Care Circle check-ins",
  dice: "Astrology dice",
  knowledge_bank: "Triplicity knowledge",
  natal_chat: "Natal chart chat",
  personal_transits: "Personal transits and Solar Return",
  push_notifications: "Push notifications"
};

export function canUseFeature(planTier: PlanTier, feature: EntitlementFeatureKey): boolean {
  return PLAN_ENTITLEMENTS[planTier].includes(feature);
}

export function canUseRoute(planTier: PlanTier, route: ChatRoute): boolean {
  return planRank(planTier) >= planRank(ROUTE_PLAN_REQUIREMENTS[route]);
}

function planRank(planTier: PlanTier): number {
  return ["starter", "essential", "prime"].indexOf(planTier);
}
