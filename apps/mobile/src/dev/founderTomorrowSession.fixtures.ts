import {
  T316_FOUNDER_FIXTURES,
  createFounderFixtureInvocation,
  parseAcceptedTechnicalEvidence,
  resolveTomorrowSessionReadiness,
} from "./founderTomorrowSession";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`T316 fixture failed: ${message}`);
}

check(T316_FOUNDER_FIXTURES.length === 40, "exactly 40 Founder fixtures");
check(T316_FOUNDER_FIXTURES.filter((item) => item.language === "en").length === 20, "20 English fixtures");
check(T316_FOUNDER_FIXTURES.filter((item) => item.language === "zh-Hant").length === 20, "20 zh-Hant fixtures");
check(!T316_FOUNDER_FIXTURES.some((item) => item.authoring_id === "ZH04"), "ZH04 excluded only");
check(T316_FOUNDER_FIXTURES.find((item) => item.authoring_id === "ZH08")?.exact_text === "我個application 會唔會批？幾時會批？", "ZH08 exact bundled control");
check(T316_FOUNDER_FIXTURES.find((item) => item.authoring_id === "ZH09")?.exact_text === "我個application幾時會批？", "ZH09 exact accepted control");

const evidence = JSON.stringify({
  schema_version: "s2_t316_accepted_dice_technical_evidence_v1",
  status: "accepted",
  phase: "technical_80_only",
  logical_total: 80,
  language_totals: { en: 40, "zh-Hant": 40 },
  founder_cases: 0,
  partial: false,
  provider_disabled_verified: true,
  technical_evidence_sha256: "a".repeat(64),
  post_window_disabled_receipt_sha256: "b".repeat(64),
  effects: { member_data: 0, persistence_writes: 0, units_charged: 0 },
});

let rejected = false;
try { parseAcceptedTechnicalEvidence(evidence, "c".repeat(64)); } catch { rejected = true; }
check(rejected, "self-authored evidence rejected");
const accepted = parseAcceptedTechnicalEvidence(evidence, "c".repeat(64), "c".repeat(64));
check(resolveTomorrowSessionReadiness({ technicalEvidence: accepted }).dice === "WAITING_FOR_SEPARATE_FOUNDER_WINDOW_AUTHORITY", "Founder window authority remains required");

let invocationRejected = false;
try { createFounderFixtureInvocation("DICE-FOUNDER-EN-01", accepted); } catch (error) {
  invocationRejected = error instanceof Error && error.message === "STOP_S2_T316_FOUNDER_WINDOW_AUTHORITY_REQUIRED";
}
check(invocationRejected, "fixture invocation remains Founder-window gated");

for (const id of ["DICE-FOUNDER-EN-00", "DICE-FOUNDER-ZH-21", "DICE-FOUNDER-EN-99", "ZH04"]) {
  let hostileRejected = false;
  try { createFounderFixtureInvocation(id, accepted); } catch { hostileRejected = true; }
  check(hostileRejected, `${id} rejected`);
}

console.log("S2-T316 Founder tomorrow session fixtures passed");
