import { ROUTE_CREDITS, type ChatRoute } from "./routes";
import {
  resolveFixedTemplateLanguage,
  type AppLanguagePreference
} from "./app-language";

export type ChatRouteDecision = {
  route: ChatRoute;
  credits: number;
  modelClass: (typeof ROUTE_CREDITS)[number]["modelClass"];
};

export type ChatRouteFixture = {
  name: string;
  message: string;
  expectedRoute: ChatRoute;
};

export const OUT_OF_SCOPE_SOLAR_RETURN_EN = "Solar Return is not part of Lumis.";
export const OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT = "Solar Return 不屬於 Lumis 的服務範圍。";
export const SAFETY_RESPONSE_EN =
  "I am really sorry this feels so heavy. Lumis cannot handle crisis support alone. Please contact local emergency services or someone you trust right now.";
export const SAFETY_RESPONSE_ZH_HANT =
  "聽到你正承受這麼沉重的感受，我很難過。Lumis 無法單獨提供危機支援。請立即聯絡當地緊急服務，或你信任的人。";

export type SolarReturnRouteFixture = ChatRouteFixture & {
  expectedResponse: typeof OUT_OF_SCOPE_SOLAR_RETURN_EN | typeof OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT;
};

export const SOLAR_RETURN_ROUTE_FIXTURES: SolarReturnRouteFixture[] = [
  {
    name: "solar return abbreviated interpretation excluded",
    message: "Can you interpret my SR?",
    expectedRoute: "out_of_scope",
    expectedResponse: OUT_OF_SCOPE_SOLAR_RETURN_EN
  },
  {
    name: "solar return full name excluded",
    message: "Can you interpret my Solar Return?",
    expectedRoute: "out_of_scope",
    expectedResponse: OUT_OF_SCOPE_SOLAR_RETURN_EN
  },
  {
    name: "annual theme excluded",
    message: "What is my annual theme?",
    expectedRoute: "out_of_scope",
    expectedResponse: OUT_OF_SCOPE_SOLAR_RETURN_EN
  },
  {
    name: "traditional Chinese solar return excluded",
    message: "可以解讀我的太陽回歸嗎？",
    expectedRoute: "out_of_scope",
    expectedResponse: OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT
  },
  {
    name: "traditional Chinese annual theme excluded",
    message: "我的年度主題是甚麼？",
    expectedRoute: "out_of_scope",
    expectedResponse: OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT
  }
];

export const CHAT_ROUTE_FIXTURES: ChatRouteFixture[] = [
  {
    name: "casual reflection",
    message: "I feel a little stuck today. What should I notice?",
    expectedRoute: "casual"
  },
  {
    name: "knowledge explanation",
    message: "Can you explain what Venus in Sagittarius means?",
    expectedRoute: "knowledge"
  },
  {
    name: "dice prompt",
    message: "Can we roll the astrology dice for this decision?",
    expectedRoute: "dice"
  },
  {
    name: "timing forecast",
    message: "What should I pay attention to this week with transits?",
    expectedRoute: "astro_timing"
  },
  ...SOLAR_RETURN_ROUTE_FIXTURES,
  {
    name: "ordinary honorific sr is not solar return",
    message: "I spoke with Sr. Alvarez today.",
    expectedRoute: "casual"
  },
  {
    name: "deep natal pattern",
    message: "Can you read the deeper pattern in my Moon and rising?",
    expectedRoute: "astro_deep"
  },
  {
    name: "out of scope medical",
    message: "Can you diagnose this medical symptom for me?",
    expectedRoute: "out_of_scope"
  },
  {
    name: "safety self harm",
    message: "I want to hurt myself tonight.",
    expectedRoute: "safety"
  }
];

export function isSolarReturnRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  const namesSolarReturn =
    /(solar[\s_-]*return|annual theme|太陽回歸|太陽返照|年度主題)/i.test(normalized);
  const usesContextualAbbreviation =
    /\bsr\b/i.test(message) &&
    /(interpret|reading|read|chart|astrolog|meaning|theme|解讀|詮釋|星盤|占星|意義|主題)/i.test(
      normalized
    );

  return namesSolarReturn || usesContextualAbbreviation;
}

export function getSolarReturnScopeResponse(
  message: string,
  appLanguagePreference?: AppLanguagePreference | null
): typeof OUT_OF_SCOPE_SOLAR_RETURN_EN | typeof OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT {
  return resolveFixedTemplateLanguage(appLanguagePreference, message) === "zh-Hant"
    ? OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT
    : OUT_OF_SCOPE_SOLAR_RETURN_EN;
}

export function getSafetyResponse(
  message: string,
  appLanguagePreference?: AppLanguagePreference | null
): typeof SAFETY_RESPONSE_EN | typeof SAFETY_RESPONSE_ZH_HANT {
  return resolveFixedTemplateLanguage(appLanguagePreference, message) === "zh-Hant"
    ? SAFETY_RESPONSE_ZH_HANT
    : SAFETY_RESPONSE_EN;
}

export function classifyChatRoute(message: string): ChatRoute {
  const normalized = message.toLowerCase();

  if (/(self harm|suicide|kill myself|hurt myself|危險|自殺|傷害自己)/i.test(normalized)) {
    return "safety";
  }

  if (/(medical|legal|tax|investment|diagnose|醫療|法律|投資|診斷)/i.test(normalized)) {
    return "out_of_scope";
  }

  if (isSolarReturnRequest(message)) {
    return "out_of_scope";
  }

  if (/(dice|roll|骰|骰子)/i.test(normalized)) {
    return "dice";
  }

  if (/(transit|timing|this month|this week|forecast|今年|本月|流年|時機|運勢)/i.test(normalized)) {
    return "astro_timing";
  }

  if (/(deep|chart|birth chart|natal|pattern|moon|sun|rising|house|aspect|深入|星盤|模式|上升)/i.test(normalized)) {
    return "astro_deep";
  }

  if (/(what is|explain|meaning|astrology|planet|zodiac|venus|mars|意思|解釋|占星)/i.test(normalized)) {
    return "knowledge";
  }

  return "casual";
}

export function getChatRouteDecision(route: ChatRoute): ChatRouteDecision {
  const routeConfig = ROUTE_CREDITS.find((item) => item.route === route) ?? ROUTE_CREDITS[0];

  return {
    route,
    credits: routeConfig.credits,
    modelClass: routeConfig.modelClass
  };
}
