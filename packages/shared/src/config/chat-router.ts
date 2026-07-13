import { ROUTE_CREDITS, type ChatRoute } from "./routes";

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

export function classifyChatRoute(message: string): ChatRoute {
  const normalized = message.toLowerCase();

  if (/(self harm|suicide|kill myself|hurt myself|危險|自殺|傷害自己)/i.test(normalized)) {
    return "safety";
  }

  if (/(medical|legal|tax|investment|diagnose|醫療|法律|投資|診斷)/i.test(normalized)) {
    return "out_of_scope";
  }

  if (/(dice|roll|骰|骰子)/i.test(normalized)) {
    return "dice";
  }

  if (/(transit|timing|solar return|this month|this week|forecast|今年|本月|流年|時機|運勢)/i.test(normalized)) {
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
