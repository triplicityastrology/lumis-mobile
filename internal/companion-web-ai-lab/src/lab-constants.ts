// Companion / Normal Chat Web AI Lab — shared constants.
//
// INTERNAL AI-TESTING INTERFACE ONLY. This is NOT the signed-off customer Chat UI
// and must never be represented as one.
//
// Authority: AC-AI-00 v1.5 (canonical routing/units/language/safety), AC-AI-01/02/03 v1.2
// (route taxonomy, telemetry privacy, charging invariant), the Persona Behaviour Mapping
// Technical Draft v1.2 + Authority Reconciliation v0.3, the AI Routing Fixed Template Wording
// Register v0.2, and S2-T23 chart-integration decisions (no birth time / no cusps / no ASC).
//
// All substantive routing/persona/template/provider logic is REUSED from the T350 Normal
// Chat candidate modules (packages/shared + supabase/functions/_shared). This file only adds
// Lab identity plus byte-exact copies of a few gateway string constants that we deliberately
// do not import at runtime (importing the gateway module would pull the tokenizer dependency,
// which the Lab does not need). Byte-exactness of these copies is proven by the Lab test
// suite, which reads the gateway source file and asserts equality.

// ---- Reused provider identity (server-side only; never sent to the browser) ----
export {
  CHAT_AZURE_APPROVED_HOSTNAME,
  CHAT_AZURE_DEPLOYMENT,
  CHAT_AZURE_MODEL,
  CHAT_AZURE_MODEL_VERSION,
  CHAT_AZURE_DEPLOYMENT_TYPE,
  CHAT_AZURE_GUARDRAIL,
} from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";

export const CHAT_SYNTHETIC_PROVIDER_ALIAS = "lumis-ai-chat-stg" as const;
export const CHAT_SYNTHETIC_SAFETY_PROFILE = "DefaultV2" as const;

// ---- Byte-exact copies of chat-synthetic-gateway-v1.ts string constants ----
// Source of truth: supabase/functions/_shared/chat-synthetic-gateway-v1.ts
// (verified byte-for-byte by test/lab-engine.fixtures.ts).
export const CHAT_SYNTHETIC_FALLBACK =
  "Lumis couldn’t complete that reflection just now. Please try again.";
export const CHAT_SYNTHETIC_SAFETY_REDIRECT =
  "Lumis can’t help with that request, but it can offer a safer, general reflection instead.";

// Provider discipline caps (subset mirrored from CHAT_SYNTHETIC_CAPS; deadline/retries only).
export const LAB_PROVIDER_DEADLINE_MS = 12_000;
export const LAB_PROVIDER_MAX_OUTPUT_TOKENS = 300 as const;
export const LAB_PROVIDER_RETRIES = 1;

export const LAB_REQUEST_SCHEMA = "companion_web_ai_lab_request_v1" as const;
export const LAB_RESPONSE_SCHEMA = "companion_web_ai_lab_response_v1" as const;

// The mobile Chat structured response contract whose result-class mapping this Lab mirrors,
// while remaining disposable (units_charged: 0, persistence: not_committed).
export const MOBILE_CHAT_RESPONSE_SCHEMA = "normal_chat_mobile_response_v1" as const;
export const CHAT_SYNTHETIC_RESPONSE_SCHEMA = "chat_synthetic_response_v1" as const;

// ---- The exact three Founder-approved Lumis roles (stable codes + current UI labels) ----
// Source: Persona Behaviour Mapping v1.2 Authority Reconciliation v0.3 (Compatibility table).
// Do not invent, rename, or simplify these. Historical labels retained for evidence only.
export type LabRoleCode =
  | "empathetic_peer"
  | "harmonious_catalyst"
  | "saturnian_anchor";

export const LAB_ROLES: ReadonlyArray<
  Readonly<{ code: LabRoleCode; currentLabel: string; internalName: string; historicalLabel: string }>
> = Object.freeze([
  { code: "empathetic_peer", currentLabel: "Ordinary Person", internalName: "The Empathetic Peer", historicalLabel: "Acceptance" },
  { code: "harmonious_catalyst", currentLabel: "Friend", internalName: "The Harmonious Catalyst", historicalLabel: "Spark" },
  { code: "saturnian_anchor", currentLabel: "Mentor", internalName: "The Saturnian Anchor", historicalLabel: "Awareness" },
]);

export const LAB_ROLE_CODES: ReadonlyArray<LabRoleCode> = Object.freeze(
  LAB_ROLES.map((r) => r.code),
);

// ---- Zodiac (sign-number model; 1..12). No houses/angles/cusps per S2-T23 CI-02/CI-03. ----
export const ZODIAC_SIGNS = Object.freeze([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]);

export function isSignNumber(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12;
}

export function signName(signNumber: number): string {
  return ZODIAC_SIGNS[signNumber - 1] ?? `sign_${signNumber}`;
}

export type LabLanguage = "en" | "zh-Hant";
