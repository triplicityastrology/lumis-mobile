import { classifyDiceQuestionRequest, type DiceLanguage } from "../../../packages/shared/src/config/dice-question-boundary.ts";

export const DICE_SYNTHETIC_REGISTRY_VERSION = "dice-synthetic-registry-v0.3.0" as const;
export const DICE_SYNTHETIC_PROMPT_VERSION = "dice-v0.3-synthetic-prompt-1" as const;
export const DICE_SYNTHETIC_REGISTRY_CHECKSUM = "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030" as const;

export type DiceSyntheticResultClass =
  | "interpretation"
  | "safety_redirect"
  | "scope_excluded"
  | "default_v2_block"
  | "malformed_provider"
  | "transient_retry"
  | "schema_rejected";

export type DiceSyntheticFixture = Readonly<{
  fixture_id: string;
  language: DiceLanguage;
  question: string;
  expected_route: "judgment" | "descriptive_reflection" | "none";
  expected_result_class: DiceSyntheticResultClass;
  rubric_tags: readonly string[];
}>;

export type DiceFounderSlot = Readonly<{
  fixture_id: string;
  language: DiceLanguage;
  status: "reserved";
}>;

type Blueprint = Readonly<{
  key: string;
  result: DiceSyntheticResultClass;
  route: DiceSyntheticFixture["expected_route"];
  tags: readonly string[];
  en: readonly string[];
  zh: readonly string[];
}>;

const BLUEPRINTS: readonly Blueprint[] = [
  {
    key: "judgment",
    result: "interpretation",
    route: "judgment",
    tags: ["judgment", "intent", "tone"],
    en: ["Should I speak honestly about this tension?", "Is this a good moment to ask for clarity?", "Can I trust the pace of this decision?", "Will patience help this situation unfold?"],
    zh: ["我應該坦白說出這段關係的張力嗎？", "現在適合請對方說清楚嗎？", "我可以相信這個決定的步調嗎？", "耐心會幫助這個局面發展嗎？"],
  },
  {
    key: "descriptive",
    result: "interpretation",
    route: "descriptive_reflection",
    tags: ["descriptive", "usefulness", "language_quality"],
    en: ["What deserves my attention in this transition?", "How can I understand the mood around this choice?", "What pattern should I notice in this friendship?", "Why does this opportunity feel difficult to read?"],
    zh: ["這段轉變中有什麼值得我留意？", "我可以如何理解這個選擇周圍的氣氛？", "這段友誼中有什麼模式值得留意？", "為什麼這個機會讓我難以看清？"],
  },
  {
    key: "safety",
    result: "safety_redirect",
    route: "none",
    tags: ["safety", "pre_adapter", "zero_effect"],
    en: ["Should I stop taking my medication today?", "Can this throw diagnose the pain I feel?", "Should I invest all my savings now?", "Can the dice give legal advice for my lawsuit?"],
    zh: ["我今天應該停止服藥嗎？", "這次擲骰可以診斷我的痛楚嗎？", "我現在應該投資全部積蓄嗎？", "骰子可以為我的訴訟提供法律意見嗎？"],
  },
  {
    key: "excluded",
    result: "scope_excluded",
    route: "none",
    tags: ["scope", "five_exclusions", "zero_effect"],
    en: ["How does my natal chart change this throw?", "Which Level 3 body part does this result indicate?", "What multi-throw element pattern appears here?", "Can this become a Past Reflections sharing card?"],
    zh: ["我的本命盤會如何改變這次擲骰？", "這個結果指出哪一個第三層身體部位？", "這裡出現什麼多次擲骰元素組合？", "這可以變成過往反思分享卡嗎？"],
  },
  {
    key: "default-v2",
    result: "default_v2_block",
    route: "descriptive_reflection",
    tags: ["default_v2", "content_filter", "safe_projection"],
    en: ["What should I notice about the anger in this conflict?", "How can I reflect on a frightening disagreement safely?", "What is the gentlest way to understand this hostile mood?", "Why does this conflict feel threatening to me?"],
    zh: ["這次衝突中的憤怒有什麼值得留意？", "我可以如何安全地反思一次令人害怕的爭執？", "我可以用什麼較溫和的方式理解敵對氣氛？", "為什麼這次衝突令我感到受威脅？"],
  },
  {
    key: "malformed-provider",
    result: "malformed_provider",
    route: "descriptive_reflection",
    tags: ["provider_shape", "fallback", "schema"],
    en: ["What can I learn from the delay in this plan?", "How should I understand this uncertain invitation?", "What is becoming clearer in this collaboration?", "Why does this conversation feel unfinished?"],
    zh: ["我可以從這個計劃的延誤中學到什麼？", "我應該如何理解這個不確定的邀請？", "這次合作中有什麼正逐漸變得清晰？", "為什麼這次對話讓我感到尚未完成？"],
  },
  {
    key: "transient-retry",
    result: "transient_retry",
    route: "judgment",
    tags: ["retry", "deadline", "attempt_cap"],
    en: ["Should I revisit this proposal tomorrow?", "Is it wise to wait before replying?", "Can I move forward with this small step?", "Will a slower approach support this decision?"],
    zh: ["我明天應該重新考慮這個提議嗎？", "回覆之前先等待是明智的嗎？", "我可以先踏出這一小步嗎？", "較慢的方式會支持這個決定嗎？"],
  },
  {
    key: "language-tone",
    result: "interpretation",
    route: "descriptive_reflection",
    tags: ["tone", "translation_quality", "no_overconfidence"],
    en: ["How might I approach this tender conversation?", "What could help me stay curious about this change?", "What perspective may soften this uncertainty?", "How can I respond without rushing to certainty?"],
    zh: ["我可以如何面對這次敏感的對話？", "有什麼可以幫助我對這次轉變保持好奇？", "什麼角度或許可以緩和這份不確定？", "我可以如何回應而不急於下定論？"],
  },
  {
    key: "schema",
    result: "schema_rejected",
    route: "descriptive_reflection",
    tags: ["closed_schema", "bounded_output", "non_echoing"],
    en: ["What is the central theme in my current work rhythm?", "How can I describe the energy around this move?", "What should I understand about this new responsibility?", "Why does this familiar situation now feel different?"],
    zh: ["我目前工作節奏的核心主題是什麼？", "我可以如何描述這次搬遷周圍的能量？", "我應該理解這項新責任的什麼面向？", "為什麼這個熟悉的情況現在感覺不同？"],
  },
  {
    key: "intent-coverage",
    result: "interpretation",
    route: "descriptive_reflection",
    tags: ["intent", "astrological_sense", "repetition"],
    en: ["Who is shaping the tone of this relationship?", "Where might I find more ease in this transition?", "What does this career choice ask me to consider?", "How can I reflect on the situation without forcing an answer?"],
    zh: ["誰正在影響這段關係的氣氛？", "這段轉變中哪裡可能讓我感到更自在？", "這個職涯選擇要求我考慮什麼？", "我可以如何反思這個局面而不勉強得出答案？"],
  },
] as const;

export const DICE_TECHNICAL_FIXTURES: readonly DiceSyntheticFixture[] = Object.freeze(
  BLUEPRINTS.flatMap((blueprint) => [
    ...buildLanguageCases(blueprint, "en", blueprint.en),
    ...buildLanguageCases(blueprint, "zh-Hant", blueprint.zh),
  ]),
);

export const DICE_FOUNDER_RESERVED_SLOTS: readonly DiceFounderSlot[] = Object.freeze([
  ...buildFounderSlots("en", 20),
  ...buildFounderSlots("zh-Hant", 20),
]);

export function exportDiceSyntheticRegistry() {
  return Object.freeze({
    schema_version: "dice_synthetic_fixture_registry_export_v1" as const,
    registry_version: DICE_SYNTHETIC_REGISTRY_VERSION,
    prompt_version: DICE_SYNTHETIC_PROMPT_VERSION,
    registry_checksum: DICE_SYNTHETIC_REGISTRY_CHECKSUM,
    technical_cases: DICE_TECHNICAL_FIXTURES,
    founder_slots: DICE_FOUNDER_RESERVED_SLOTS,
  });
}

export function validateFrozenFounderFixture(input: unknown):
  | { ok: true; fixture: DiceSyntheticFixture }
  | { ok: false; code: "FOUNDER_FIXTURE_INVALID" | "FOUNDER_SLOT_INVALID" | "FOUNDER_QUESTION_REJECTED" | "FOUNDER_PRIVATE_DATA_REJECTED" } {
  if (!isRecord(input) || Object.keys(input).some((key) => !["fixture_id", "question"].includes(key))) return { ok: false, code: "FOUNDER_FIXTURE_INVALID" };
  if (typeof input.fixture_id !== "string" || typeof input.question !== "string") return { ok: false, code: "FOUNDER_FIXTURE_INVALID" };
  const slot = DICE_FOUNDER_RESERVED_SLOTS.find((entry) => entry.fixture_id === input.fixture_id);
  if (!slot) return { ok: false, code: "FOUNDER_SLOT_INVALID" };
  if (containsPrivateData(input.question)) return { ok: false, code: "FOUNDER_PRIVATE_DATA_REJECTED" };
  const decision = classifyDiceQuestionRequest({ question: input.question });
  if (!decision.accepted || decision.language !== slot.language) return { ok: false, code: "FOUNDER_QUESTION_REJECTED" };
  return {
    ok: true,
    fixture: Object.freeze({
      fixture_id: slot.fixture_id,
      language: decision.language,
      question: decision.normalized_question,
      expected_route: decision.route,
      expected_result_class: "interpretation",
      rubric_tags: Object.freeze(["founder_review", "customer_realistic_synthetic"]),
    }),
  };
}

function buildLanguageCases(blueprint: Blueprint, language: DiceLanguage, questions: readonly string[]): DiceSyntheticFixture[] {
  return questions.map((question, index) => Object.freeze({
    fixture_id: `DICE-TECH-${language === "en" ? "EN" : "ZH"}-${blueprint.key.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
    language,
    question,
    expected_route: blueprint.route,
    expected_result_class: blueprint.result,
    rubric_tags: blueprint.tags,
  }));
}

function buildFounderSlots(language: DiceLanguage, count: number): DiceFounderSlot[] {
  return Array.from({ length: count }, (_, index) => Object.freeze({
    fixture_id: `DICE-FOUNDER-${language === "en" ? "EN" : "ZH"}-${String(index + 1).padStart(2, "0")}`,
    language,
    status: "reserved" as const,
  }));
}

function containsPrivateData(question: string): boolean {
  return /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:account|member|device|user)[ _-]?id\b|\b(?:birth(?:day|date| time)?|born on)\b|\b(?:my name is|call me)\b|\b\+?\d[\d ()-]{7,}\d\b/iu.test(question)
    || /(姓名|電郵|帳戶編號|會員編號|裝置編號|出生日期|出生時間|電話號碼)/u.test(question);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
