// Public fixed-template loader for the Lab (reuses the byte-exact registry).
// Runtime "staging" — the Lab is an internal staging/development testing surface, not production.
import {
  createFixedTemplateServerLoader,
  FIXED_TEMPLATE_REGISTRY_VERSION,
  type FixedTemplateFamilyId,
  type FixedTemplateLanguage,
} from "../../../supabase/functions/_shared/fixed-template-registry.ts";
import type { LabLanguage } from "./lab-constants.ts";

const loader = createFixedTemplateServerLoader(() => "staging");

export function templateForPublic(family: FixedTemplateFamilyId, language: LabLanguage) {
  const res = loader({
    registryVersion: FIXED_TEMPLATE_REGISTRY_VERSION,
    familyId: family,
    language: language as FixedTemplateLanguage,
  });
  if (!res.ok) throw new Error(`FIXED_TEMPLATE_LOOKUP_FAILED:${res.error.code}:${family}`);
  return res.value;
}
