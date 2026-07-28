import {
  CHAT_ROUTE_FIXTURES,
  classifyChatRoute,
  getChatRouteDecision,
  getSafetyResponse,
  getSolarReturnScopeResponse,
  OUT_OF_SCOPE_SOLAR_RETURN_EN,
  OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT,
  SAFETY_RESPONSE_EN,
  SAFETY_RESPONSE_ZH_HANT,
  SOLAR_RETURN_ROUTE_FIXTURES
} from "./chat-router";
import {
  APP_LANGUAGE_PREFERENCES,
  isAppLanguagePreference,
  resolveFixedTemplateLanguage
} from "./app-language";
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

  for (const fixture of SOLAR_RETURN_ROUTE_FIXTURES) {
    const actualResponse = getSolarReturnScopeResponse(fixture.message);

    if (actualResponse !== fixture.expectedResponse) {
      throw new Error(
        `${fixture.name}: expected fixed response ${fixture.expectedResponse}, received ${actualResponse}`
      );
    }
  }

  if (
    APP_LANGUAGE_PREFERENCES.length !== 2 ||
    !isAppLanguagePreference("en") ||
    !isAppLanguagePreference("zh-Hant") ||
    isAppLanguagePreference("zh") ||
    isAppLanguagePreference("en-US")
  ) {
    throw new Error("app language allowlist must contain exactly en and zh-Hant");
  }

  if (
    resolveFixedTemplateLanguage(null, "可以解讀我的太陽回歸嗎？") !== "zh-Hant" ||
    resolveFixedTemplateLanguage(undefined, "Can you interpret my Solar Return?") !== "en"
  ) {
    throw new Error("missing preference must use deterministic request-language fallback");
  }

  if (
    getSolarReturnScopeResponse("Can you interpret my Solar Return?", "zh-Hant") !==
      OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT ||
    getSolarReturnScopeResponse("可以解讀我的太陽回歸嗎？", "en") !==
      OUT_OF_SCOPE_SOLAR_RETURN_EN
  ) {
    throw new Error("persisted app language must override request language for Solar Return");
  }

  if (
    getSafetyResponse("I want to hurt myself tonight.", "zh-Hant") !==
      SAFETY_RESPONSE_ZH_HANT ||
    getSafetyResponse("我想傷害自己。", "en") !== SAFETY_RESPONSE_EN ||
    getSafetyResponse("我想傷害自己。", null) !== SAFETY_RESPONSE_ZH_HANT
  ) {
    throw new Error("safety responses must use one deterministic fixed-language template");
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
