import {
  CHAT_ROUTE_FIXTURES,
  classifyChatRoute,
  getChatRouteDecision
} from "./chat-router";
import { ROUTE_PLAN_REQUIREMENTS, type PlanTier } from "./entitlements";
import type { ChatRoute } from "./routes";

const EXPECTED_CREDITS: Record<ChatRoute, number> = {
  casual: 1,
  knowledge: 3,
  dice: 5,
  astro_timing: 5,
  astro_deep: 5,
  out_of_scope: 1,
  safety: 1
};

const EXPECTED_ROUTE_PLANS: Record<ChatRoute, PlanTier> = {
  casual: "starter",
  knowledge: "starter",
  dice: "essential",
  astro_timing: "prime",
  astro_deep: "essential",
  out_of_scope: "starter",
  safety: "starter"
};

export function assertChatRouteFixtures(): void {
  for (const fixture of CHAT_ROUTE_FIXTURES) {
    const actualRoute = classifyChatRoute(fixture.message);

    if (actualRoute !== fixture.expectedRoute) {
      throw new Error(
        `${fixture.name}: expected ${fixture.expectedRoute}, received ${actualRoute}`
      );
    }
  }

  for (const [route, expectedCredits] of Object.entries(EXPECTED_CREDITS) as Array<[ChatRoute, number]>) {
    const decision = getChatRouteDecision(route);

    if (decision.credits !== expectedCredits) {
      throw new Error(
        `${route}: expected ${expectedCredits} credits, received ${decision.credits}`
      );
    }
  }

  for (const [route, expectedPlan] of Object.entries(EXPECTED_ROUTE_PLANS) as Array<[ChatRoute, PlanTier]>) {
    if (ROUTE_PLAN_REQUIREMENTS[route] !== expectedPlan) {
      throw new Error(
        `${route}: expected ${expectedPlan} plan, received ${ROUTE_PLAN_REQUIREMENTS[route]}`
      );
    }
  }
}

assertChatRouteFixtures();
