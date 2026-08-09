import { classifyDiceQuestionRequest, type DiceLanguage } from "../../../../packages/shared/src/config/dice-question-boundary";

export type LocalFounderFixtureDecision =
  | { ok: true; question: string; route: string; shape: string }
  | { ok: false; code: string };

export type FrozenFounderFixtureEnvelope = Readonly<{
  schema_version: "dice_founder_fixture_candidate_v1";
  fixture_id: string;
  language: DiceLanguage;
  question: string;
  expected_route: string;
  review_status: "locally_frozen_pending_review";
  effects: Readonly<{ provider_calls: 0; persistence_writes: 0; units_consumed: 0 }>;
}>;

export function classifyLocalDraft(question: string, expectedLanguage: DiceLanguage): LocalFounderFixtureDecision {
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:account|member|device|user)[ _-]?id\b|\b(?:birth(?:day|date| time)?|born on)\b|\b(?:my name is|call me)\b/iu.test(question)
    || /(姓名|電郵|帳戶編號|會員編號|裝置編號|出生日期|出生時間|電話號碼)/u.test(question)) return { ok: false, code: "FOUNDER_PRIVATE_DATA_REJECTED" };
  const decision = classifyDiceQuestionRequest({ question });
  if (!decision.accepted) return { ok: false, code: decision.code };
  if (decision.language !== expectedLanguage) return { ok: false, code: "FOUNDER_LANGUAGE_MISMATCH" };
  return { ok: true, question: decision.normalized_question, route: decision.route, shape: decision.shape };
}

export function freezeLocalFounderFixture(fixtureId: string, language: DiceLanguage, decision: LocalFounderFixtureDecision): FrozenFounderFixtureEnvelope | null {
  const prefix = language === "en" ? "DICE-FOUNDER-EN-" : "DICE-FOUNDER-ZH-";
  if (!decision.ok || !new RegExp(`^${prefix}(?:0[1-9]|1[0-9]|20)$`).test(fixtureId)) return null;
  return Object.freeze({
    schema_version: "dice_founder_fixture_candidate_v1",
    fixture_id: fixtureId,
    language,
    question: decision.question,
    expected_route: decision.route,
    review_status: "locally_frozen_pending_review",
    effects: Object.freeze({ provider_calls: 0, persistence_writes: 0, units_consumed: 0 }),
  });
}
