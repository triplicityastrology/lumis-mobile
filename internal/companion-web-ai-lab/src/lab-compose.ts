// Founder "Calculate" endpoint: derive the Companion Chart Composition + assembled persona prompt
// for a given chart + role, WITHOUT sending a message and WITHOUT any provider call. Pure preview.

import { validateLabRequest, planLabTurn } from "./lab-engine.ts";
import { assemblePersona } from "./lab-provider.ts";
import { retrieveNatalFacts, buildKnowledgeGrounding } from "./lab-knowledge-bank.ts";
import { LAB_ROLES } from "./lab-constants.ts";

export const COMPOSE_REQUEST_SCHEMA = "companion_web_ai_lab_compose_v1" as const;

export function handleCompose(raw: unknown): { status: number; body: unknown } {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw)) ? { ...(raw as Record<string, unknown>) } : {};
  // The compose request mirrors a conversation request but the message is optional (preview only).
  if (typeof r.schema_version !== "string") r.schema_version = "companion_web_ai_lab_request_v1";
  else r.schema_version = "companion_web_ai_lab_request_v1";
  if (typeof r.message !== "string" || r.message.trim() === "") r.message = "(preview — your message will appear here)";
  if (!("app_language_preference" in r)) r.app_language_preference = null;
  if (!("context" in r)) r.context = [];

  const v = validateLabRequest(r);
  if (!v.ok) return { status: 400, body: { schema_version: COMPOSE_REQUEST_SCHEMA, error_code: v.error_code, detail: v.detail } };

  const plan = planLabTurn(v.request);
  const roleMeta = LAB_ROLES.find((x) => x.code === v.request.role_code)!;
  const kbRetrieval = plan.generative ? retrieveNatalFacts(v.request.chart) : { facts: [], suppressed: [] };
  const assembly = (plan.generative && plan.personaPromptAssembled)
    ? assemblePersona(plan.personaPromptPayload, v.request.message, plan.language, v.request.context, plan.composition, buildKnowledgeGrounding(kbRetrieval))
    : null;
  const prompt = assembly ? assembly.prompt : null;

  return {
    status: 200,
    body: {
      schema_version: COMPOSE_REQUEST_SCHEMA,
      not_signed_off_customer_ui: true,
      role: { code: roleMeta.code, current_label: roleMeta.currentLabel, internal_name: roleMeta.internalName },
      language: plan.language,
      canonical_state: plan.canonicalState,
      chart_composition: plan.composition,
      knowledge_bank: { facts: kbRetrieval.facts, suppressed: kbRetrieval.suppressed },
      persona_blocks: assembly ? assembly.blocks : null,
      voice_card: assembly ? assembly.voice_card : null,
      generative_prompt_preview: prompt,
      persona_prompt_assembled: plan.personaPromptAssembled,
      note: "Deterministic preview: no provider call, no persistence.",
    },
  };
}
