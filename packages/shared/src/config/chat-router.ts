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

// Canonical fixed-template wording mirrored for the app/client boundary. The single
// canonical server source is supabase/functions/_shared/fixed-template-registry.ts
// (AC-AI-00 v1.5 §8 / Fixed Template Wording Register v0.2). These app-boundary copies
// are byte-exact mirrors of the OUT_OF_SCOPE, PROFESSIONAL_BOUNDARY, and ROUTE_UNAVAILABLE
// families and are guarded against drift by scripts/companion-shared-composition-contract.mjs.
// The app must not compose or improvise these; it only selects a registered template by
// family + language, never generatively translating or rewriting it.
export const OUT_OF_SCOPE_EN =
  "That request is outside Lumis's scope. I can help you reflect on the feelings or decision around it, without presenting the excluded service as something Lumis provides.";
export const OUT_OF_SCOPE_ZH_HANT =
  "這項要求不屬於 Lumis 的服務範圍。我可以陪你整理相關的感受或抉擇，但不會把不屬於 Lumis 的服務當作可提供的功能。";
export const PROFESSIONAL_BOUNDARY_EN =
  "Lumis cannot diagnose, prescribe, or guarantee legal or financial outcomes. Please consult a qualified professional. I can help you organise questions to bring to them, but I will not provide a diagnosis, treatment instruction, legal advice, or financial guarantee.";
export const PROFESSIONAL_BOUNDARY_ZH_HANT =
  "Lumis 不能作出診斷、處方，亦不能保證法律或財務結果。請諮詢合資格的專業人士。我可以協助你整理需要向專業人士提出的問題，但不會提供診斷、治療指示、法律意見或財務保證。";
export const ROUTE_UNAVAILABLE_EN =
  "That Lumis feature is not available right now. Please try again later.";
export const ROUTE_UNAVAILABLE_ZH_HANT =
  "這項 Lumis 功能目前未能使用，請稍後再試。";

// Direct-professional refinement, byte-identical to the reviewed server planner
// (companion Web Lab lab-engine.ts PROFESSIONAL_DIRECT). This selects the distinct
// professional_direct wording; it does NOT change classifyChatRoute route semantics or
// route credits — a direct professional request still classifies as out_of_scope and is
// then given the PROFESSIONAL_BOUNDARY template instead of the general OUT_OF_SCOPE one.
const PROFESSIONAL_DIRECT_PATTERN =
  /(diagnos|prescrib|medication|dosage|treat(ment)?|symptom|guarantee|sue|lawsuit|legally|invest(ment)?\b|tax\b|診斷|處方|藥物|劑量|治療|症狀|保證|訴訟|投資|報稅)/i;

export function isProfessionalDirectRequest(message: string): boolean {
  return PROFESSIONAL_DIRECT_PATTERN.test(message);
}

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

export function getOutOfScopeResponse(
  message: string,
  appLanguagePreference?: AppLanguagePreference | null
): typeof OUT_OF_SCOPE_EN | typeof OUT_OF_SCOPE_ZH_HANT {
  return resolveFixedTemplateLanguage(appLanguagePreference, message) === "zh-Hant"
    ? OUT_OF_SCOPE_ZH_HANT
    : OUT_OF_SCOPE_EN;
}

export function getProfessionalBoundaryResponse(
  message: string,
  appLanguagePreference?: AppLanguagePreference | null
): typeof PROFESSIONAL_BOUNDARY_EN | typeof PROFESSIONAL_BOUNDARY_ZH_HANT {
  return resolveFixedTemplateLanguage(appLanguagePreference, message) === "zh-Hant"
    ? PROFESSIONAL_BOUNDARY_ZH_HANT
    : PROFESSIONAL_BOUNDARY_EN;
}

export function getRouteUnavailableResponse(
  message: string,
  appLanguagePreference?: AppLanguagePreference | null
): typeof ROUTE_UNAVAILABLE_EN | typeof ROUTE_UNAVAILABLE_ZH_HANT {
  return resolveFixedTemplateLanguage(appLanguagePreference, message) === "zh-Hant"
    ? ROUTE_UNAVAILABLE_ZH_HANT
    : ROUTE_UNAVAILABLE_EN;
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
