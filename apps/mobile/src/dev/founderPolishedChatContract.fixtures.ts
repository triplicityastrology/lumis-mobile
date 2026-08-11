import {
  FOUNDER_POLISHED_CHAT_VERSION,
  founderChatEligibility,
  projectFounderChatFixture,
  validateFounderChatPrompt,
} from "./founderPolishedChatContract";
import { T240_FIXED_FALLBACK, T240_SAFETY_REDIRECT } from "./founderCompanionChatContract";

check(FOUNDER_POLISHED_CHAT_VERSION === "s2_t299_founder_polished_chat_v1", "version");
check(!validateFounderChatPrompt("   ").ok, "empty prompt blocked");
check(!validateFounderChatPrompt("x".repeat(601)).ok, "oversized prompt blocked");
const normalized = validateFounderChatPrompt("  line one\r\nline two  ");
check(normalized.ok && normalized.prompt === "line one\nline two", "line endings normalized");

for (const language of ["en", "zh-Hant"] as const) {
  for (const scenario of ["success", "safety", "fallback"] as const) {
    const projection = projectFounderChatFixture(language, scenario);
    check(projection.provider_calls === 0, `${language}/${scenario} provider calls`);
    check(projection.units_charged === 0, `${language}/${scenario} units`);
    check(projection.persistence_writes === 0, `${language}/${scenario} persistence`);
    check(projection.thread_writes === 0 && projection.message_writes === 0, `${language}/${scenario} message effects`);
    check(projection.member_context === false, `${language}/${scenario} member context`);
  }
}
check(projectFounderChatFixture("en", "fallback").assistant_message === T240_FIXED_FALLBACK, "exact fallback");
check(projectFounderChatFixture("zh-Hant", "safety").assistant_message === T240_SAFETY_REDIRECT, "exact safety");
check(founderChatEligibility().live_enabled === false, "live disabled");
check(founderChatEligibility().next_action === "WAITING_FOR_ACCEPTED_DICE_TECHNICAL_EVIDENCE_AND_CHAT_AUTHORITY", "gate exact");

console.log("S2_T299_FOUNDER_POLISHED_CHAT_FIXTURES_OK");

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`STOP_S2_T299_${label.replaceAll(" ", "_").toUpperCase()}`);
}
