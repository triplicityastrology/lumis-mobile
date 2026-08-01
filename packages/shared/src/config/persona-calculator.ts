export const PERSONA_RULE_VERSION = "v1" as const;

export type PersonaRoleCode =
  | "empathetic_peer"
  | "harmonious_catalyst"
  | "saturnian_anchor";

export type PersonaFactor = "ASC" | "Sun" | "Moon" | "Mercury" | "Saturn";
export type PersonaCalculationErrorCode =
  | "PERSONA_INPUT_INVALID"
  | "PERSONA_SUN_REQUIRED"
  | "PERSONA_MERCURY_REQUIRED";

export type ResolvedPersonaFactor = {
  factor: PersonaFactor;
  signNumber: number;
  sign: string;
  source: "fixed_role" | "customer_sun" | "customer_moon" | "customer_mercury";
  offset: 0 | 2 | 4 | 6;
};

export type PersonaCalculationResult =
  | {
      ok: true;
      ruleVersion: typeof PERSONA_RULE_VERSION;
      roleCode: PersonaRoleCode;
      calculatedProfile: ResolvedPersonaFactor[];
      fallbacksApplied: Array<"neutral_emotional_attunement" | "stable_boundary">;
    }
  | { ok: false; code: PersonaCalculationErrorCode };

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
] as const;

export function offsetSign(userSign: number, offset: number): number | null {
  if (!Number.isInteger(userSign) || userSign < 1 || userSign > 12) return null;
  if (!Number.isInteger(offset)) return null;
  return ((userSign + offset - 1) % 12 + 12) % 12 + 1;
}

export function calculatePersonaProfile(input: {
  roleCode: PersonaRoleCode;
  sunSign?: number | null;
  moonSign?: number | null;
  mercurySign?: number | null;
}): PersonaCalculationResult {
  if (!isRoleCode(input.roleCode)) return failure("PERSONA_INPUT_INVALID");
  if (!isOptionalSign(input.sunSign) || !isOptionalSign(input.moonSign) || !isOptionalSign(input.mercurySign)) {
    return failure("PERSONA_INPUT_INVALID");
  }
  if (input.mercurySign == null) return failure("PERSONA_MERCURY_REQUIRED");

  if (input.roleCode === "empathetic_peer") {
    const factors = [fixedFactor("ASC", 4)];
    const fallbacks: Array<"neutral_emotional_attunement"> = [];
    if (input.moonSign == null) fallbacks.push("neutral_emotional_attunement");
    else factors.push(offsetFactor("Moon", input.moonSign, 0, "customer_moon"));
    factors.push(offsetFactor("Mercury", input.mercurySign, 4, "customer_mercury"));
    return success(input.roleCode, factors, fallbacks);
  }

  if (input.sunSign == null) return failure("PERSONA_SUN_REQUIRED");
  if (input.roleCode === "harmonious_catalyst") {
    return success(input.roleCode, [
      fixedFactor("ASC", 3),
      offsetFactor("Sun", input.sunSign, 2, "customer_sun"),
      offsetFactor("Mercury", input.mercurySign, 2, "customer_mercury")
    ], []);
  }

  const factors = [
    fixedFactor("ASC", 10),
    offsetFactor("Sun", input.sunSign, 2, "customer_sun"),
    offsetFactor("Mercury", input.mercurySign, 6, "customer_mercury")
  ];
  const fallbacks: Array<"stable_boundary"> = [];
  if (input.moonSign == null) fallbacks.push("stable_boundary");
  else factors.splice(2, 0, offsetFactor("Saturn", input.moonSign, 2, "customer_moon"));
  return success(input.roleCode, factors, fallbacks);
}

function fixedFactor(factor: "ASC", signNumber: number): ResolvedPersonaFactor {
  return { factor, signNumber, sign: SIGNS[signNumber - 1], source: "fixed_role", offset: 0 };
}

function offsetFactor(
  factor: Exclude<PersonaFactor, "ASC">,
  sourceSign: number,
  offset: 0 | 2 | 4 | 6,
  source: Exclude<ResolvedPersonaFactor["source"], "fixed_role">
): ResolvedPersonaFactor {
  const signNumber = offsetSign(sourceSign, offset);
  if (signNumber == null) throw new Error("validated persona sign became invalid");
  return { factor, signNumber, sign: SIGNS[signNumber - 1], source, offset };
}

function success(
  roleCode: PersonaRoleCode,
  calculatedProfile: ResolvedPersonaFactor[],
  fallbacksApplied: Array<"neutral_emotional_attunement" | "stable_boundary">
): PersonaCalculationResult {
  return { ok: true, ruleVersion: PERSONA_RULE_VERSION, roleCode, calculatedProfile, fallbacksApplied };
}

function failure(code: PersonaCalculationErrorCode): PersonaCalculationResult {
  return { ok: false, code };
}

function isOptionalSign(value: number | null | undefined): boolean {
  return value == null || (Number.isInteger(value) && value >= 1 && value <= 12);
}

function isRoleCode(value: string): value is PersonaRoleCode {
  return value === "empathetic_peer" || value === "harmonious_catalyst" || value === "saturnian_anchor";
}
