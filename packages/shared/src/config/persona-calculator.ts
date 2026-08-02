export const PERSONA_RULE_VERSION = "v1" as const;

export type PersonaRoleCode =
  | "empathetic_peer"
  | "harmonious_catalyst"
  | "saturnian_anchor";
export type PersonaRoleInput = PersonaRoleCode | "Acceptance" | "Spark" | "Awareness";
export type PersonaFactor = "ASC" | "Sun" | "Moon" | "Mercury" | "Saturn";
export type PersonaSourceRuleCode =
  | "acceptance_moon_from_customer_sun"
  | "spark_moon_from_customer_sun_trine"
  | "awareness_saturn_from_customer_sun_sextile";
export type PersonaCalculationErrorCode = "PERSONA_INPUT_INVALID" | "customer_chart_unavailable";

export type CustomerMoonInput =
  | { status: "available"; proof: "confirmed_birth_time"; sign: number }
  | {
      status: "available";
      proof: "local_day_single_sign";
      sign: number;
      localDayStartSign: number;
      localDayEndSign: number;
    }
  | { status: "unconfirmed" };

export type ResolvedPersonaFactor = {
  factor: PersonaFactor;
  signNumber: number;
  sign: string;
  source: "fixed_role" | "customer_sun" | "customer_moon" | "customer_mercury";
  offset: 0 | 2 | 4 | 6;
  sourceRuleCode?: PersonaSourceRuleCode;
};

export type PersonaCalculationResult =
  | {
      ok: true;
      ruleVersion: typeof PERSONA_RULE_VERSION;
      roleCode: PersonaRoleCode;
      calculatedProfile: ResolvedPersonaFactor[];
      sourceRulesApplied: PersonaSourceRuleCode[];
      provenance: {
        customerMoonStatus: "available" | "unconfirmed";
        customerMoonProof: "confirmed_birth_time" | "local_day_single_sign" | "unconfirmed";
      };
    }
  | {
      ok: false;
      code: PersonaCalculationErrorCode;
      action?: "stop_persona_generation_and_retry";
    };

type PersonaCalculationProvenance = {
  customerMoonStatus: "available" | "unconfirmed";
  customerMoonProof: "confirmed_birth_time" | "local_day_single_sign" | "unconfirmed";
};

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
] as const;

export function offsetSign(userSign: number, offset: number): number | null {
  if (!isSign(userSign) || !Number.isInteger(offset)) return null;
  return ((userSign + offset - 1) % 12 + 12) % 12 + 1;
}

export function calculatePersonaProfile(input: unknown): PersonaCalculationResult {
  if (!isClosedInput(input)) return failure("PERSONA_INPUT_INVALID");
  const roleCode = resolveRoleCode(input.roleCode);
  if (!roleCode) return failure("PERSONA_INPUT_INVALID");
  if (!isSign(input.sunSign) || !isSign(input.mercurySign) || !isMoonInput(input.moon)) {
    return failure("customer_chart_unavailable");
  }

  const moonAvailable = input.moon.status === "available";
  const moonSourceSign = input.moon.status === "available" ? input.moon.sign : input.sunSign;
  const sourceRulesApplied: PersonaSourceRuleCode[] = [];
  const provenance = {
    customerMoonStatus: input.moon.status,
    customerMoonProof: input.moon.status === "available" ? input.moon.proof : "unconfirmed",
  } as const;

  if (roleCode === "empathetic_peer") {
    const rule = moonAvailable ? undefined : "acceptance_moon_from_customer_sun";
    if (rule) sourceRulesApplied.push(rule);
    return success(roleCode, [
      fixedFactor("ASC", 4),
      offsetFactor("Moon", moonSourceSign, 0, moonAvailable ? "customer_moon" : "customer_sun", rule),
      offsetFactor("Mercury", input.mercurySign, 4, "customer_mercury"),
    ], sourceRulesApplied, provenance);
  }

  if (roleCode === "harmonious_catalyst") {
    const rule = moonAvailable ? undefined : "spark_moon_from_customer_sun_trine";
    if (rule) sourceRulesApplied.push(rule);
    return success(roleCode, [
      fixedFactor("ASC", 3),
      offsetFactor("Sun", input.sunSign, 2, "customer_sun"),
      offsetFactor("Moon", moonSourceSign, 4, moonAvailable ? "customer_moon" : "customer_sun", rule),
      offsetFactor("Mercury", input.mercurySign, 2, "customer_mercury"),
    ], sourceRulesApplied, provenance);
  }

  const rule = moonAvailable ? undefined : "awareness_saturn_from_customer_sun_sextile";
  if (rule) sourceRulesApplied.push(rule);
  return success(roleCode, [
    fixedFactor("ASC", 10),
    offsetFactor("Sun", input.sunSign, 2, "customer_sun"),
    offsetFactor("Saturn", moonSourceSign, 2, moonAvailable ? "customer_moon" : "customer_sun", rule),
    offsetFactor("Mercury", input.mercurySign, 6, "customer_mercury"),
  ], sourceRulesApplied, provenance);
}

function fixedFactor(factor: "ASC", signNumber: number): ResolvedPersonaFactor {
  return { factor, signNumber, sign: SIGNS[signNumber - 1], source: "fixed_role", offset: 0 };
}

function offsetFactor(
  factor: Exclude<PersonaFactor, "ASC">,
  sourceSign: number,
  offset: 0 | 2 | 4 | 6,
  source: Exclude<ResolvedPersonaFactor["source"], "fixed_role">,
  sourceRuleCode?: PersonaSourceRuleCode
): ResolvedPersonaFactor {
  const signNumber = offsetSign(sourceSign, offset);
  if (signNumber == null) throw new Error("validated persona sign became invalid");
  return { factor, signNumber, sign: SIGNS[signNumber - 1], source, offset, ...(sourceRuleCode ? { sourceRuleCode } : {}) };
}

function success(
  roleCode: PersonaRoleCode,
  calculatedProfile: ResolvedPersonaFactor[],
  sourceRulesApplied: PersonaSourceRuleCode[],
  provenance: PersonaCalculationProvenance
): PersonaCalculationResult {
  return { ok: true, ruleVersion: PERSONA_RULE_VERSION, roleCode, calculatedProfile, sourceRulesApplied, provenance };
}

function failure(code: PersonaCalculationErrorCode): PersonaCalculationResult {
  return code === "customer_chart_unavailable"
    ? { ok: false, code, action: "stop_persona_generation_and_retry" }
    : { ok: false, code };
}

function isClosedInput(value: unknown): value is { roleCode: PersonaRoleInput; sunSign: number; mercurySign: number; moon: CustomerMoonInput } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["roleCode", "sunSign", "mercurySign", "moon"];
  return Object.keys(record).length === keys.length && keys.every((key) => key in record) && typeof record.roleCode === "string";
}

function isMoonInput(value: unknown): value is CustomerMoonInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const moon = value as Record<string, unknown>;
  if (moon.status === "unconfirmed") return Object.keys(moon).length === 1;
  if (moon.status !== "available" || !isSign(moon.sign)) return false;
  if (moon.proof === "confirmed_birth_time") return Object.keys(moon).length === 3;
  if (moon.proof !== "local_day_single_sign") return false;
  return Object.keys(moon).length === 5 && isSign(moon.localDayStartSign) && isSign(moon.localDayEndSign) &&
    moon.localDayStartSign === moon.localDayEndSign && moon.sign === moon.localDayStartSign;
}

function resolveRoleCode(value: string): PersonaRoleCode | null {
  const aliases: Record<string, PersonaRoleCode> = {
    empathetic_peer: "empathetic_peer",
    harmonious_catalyst: "harmonious_catalyst",
    saturnian_anchor: "saturnian_anchor",
    Acceptance: "empathetic_peer",
    Spark: "harmonious_catalyst",
    Awareness: "saturnian_anchor",
  };
  return aliases[value] ?? null;
}

function isSign(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12;
}
