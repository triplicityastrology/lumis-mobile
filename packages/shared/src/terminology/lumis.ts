export const PRODUCT_TERMS = {
  appName: "Lumis",
  appNameZh: "星伴 Lumis",
  persona: "Lumis Persona",
  personaZh: "星伴相處模式",
  credits: "credits",
  creditsZh: "運算點數"
} as const;

export const PERSONA_STYLES = [
  {
    key: "acceptance",
    internalRole: "support",
    labelEn: "Acceptance",
    labelZh: "接納",
    promiseEn: "Soft, steady, and emotionally present.",
    promiseZh: "溫柔、安穩，提供無條件的傾聽。"
  },
  {
    key: "spark",
    internalRole: "spark",
    labelEn: "Spark",
    labelZh: "啟發",
    promiseEn: "Warm but energizing, with fresh angles and practical prompts.",
    promiseZh: "溫暖且具動能，帶來全新的視角與鬆動的契機。"
  },
  {
    key: "awareness",
    internalRole: "growth",
    labelEn: "Awareness",
    labelZh: "覺察",
    promiseEn: "Reflective and gently challenging.",
    promiseZh: "深度反思，溫和挑戰，理清反覆出現的輪廓。"
  }
] as const;

export type PersonaStyleKey = (typeof PERSONA_STYLES)[number]["key"];
export type InternalRoleKey = (typeof PERSONA_STYLES)[number]["internalRole"];
