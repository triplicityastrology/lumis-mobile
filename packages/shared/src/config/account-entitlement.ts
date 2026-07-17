import type { PlanTier } from "./entitlements";

export type AccountEntitlementStatus = "active" | "grace_period" | "expired" | "cancelled";

export type AccountEntitlementSnapshot = {
  planTier: PlanTier;
  productCode: "STARTER" | "ESSENTIAL_M" | "PRIME_M";
  status: AccountEntitlementStatus;
  validFrom: string;
  validUntil: string | null;
};

const EXPECTED_PRODUCT: Record<PlanTier, AccountEntitlementSnapshot["productCode"]> = {
  starter: "STARTER",
  essential: "ESSENTIAL_M",
  prime: "PRIME_M"
};

export function resolvePlanTierFromEntitlement(
  entitlement: AccountEntitlementSnapshot | null,
  now = new Date()
): PlanTier {
  if (!entitlement || Number.isNaN(now.getTime())) return "starter";
  if (!(["active", "grace_period"] as AccountEntitlementStatus[]).includes(entitlement.status)) {
    return "starter";
  }
  if (EXPECTED_PRODUCT[entitlement.planTier] !== entitlement.productCode) return "starter";

  const validFrom = new Date(entitlement.validFrom);
  const validUntil = entitlement.validUntil ? new Date(entitlement.validUntil) : null;
  if (Number.isNaN(validFrom.getTime()) || validFrom > now) return "starter";
  if (validUntil && (Number.isNaN(validUntil.getTime()) || validUntil <= now)) return "starter";

  return entitlement.planTier;
}
