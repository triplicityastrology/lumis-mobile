import { resolvePlanTierFromEntitlement, type AccountEntitlementSnapshot } from "./account-entitlement";

const now = new Date("2026-07-18T12:00:00.000Z");
const base: AccountEntitlementSnapshot = {
  planTier: "essential",
  productCode: "ESSENTIAL_M",
  status: "active",
  validFrom: "2026-07-01T00:00:00.000Z",
  validUntil: "2026-08-01T00:00:00.000Z"
};

const cases = [
  { name: "no entitlement", entitlement: null, expected: "starter" },
  { name: "active Essential", entitlement: base, expected: "essential" },
  { name: "Prime in grace period", entitlement: { ...base, planTier: "prime", productCode: "PRIME_M", status: "grace_period" }, expected: "prime" },
  { name: "expired paid plan", entitlement: { ...base, status: "expired" }, expected: "starter" },
  { name: "cancelled paid plan", entitlement: { ...base, status: "cancelled" }, expected: "starter" },
  { name: "past valid-until", entitlement: { ...base, validUntil: "2026-07-18T11:59:59.000Z" }, expected: "starter" },
  { name: "future valid-from", entitlement: { ...base, validFrom: "2026-07-19T00:00:00.000Z" }, expected: "starter" },
  { name: "mismatched product", entitlement: { ...base, productCode: "PRIME_M" }, expected: "starter" }
] as const;

for (const testCase of cases) {
  const actual = resolvePlanTierFromEntitlement(testCase.entitlement, now);
  if (actual !== testCase.expected) {
    throw new Error(`${testCase.name}: expected ${testCase.expected}, received ${actual}.`);
  }
}
