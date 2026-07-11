export const PRODUCTS = [
  {
    code: "STARTER",
    type: "grant",
    tier: "starter",
    name: "Starter",
    priceHkd: 0,
    credits: 50,
    renewal: "once"
  },
  {
    code: "ESSENTIAL_M",
    type: "subscription",
    tier: "essential",
    name: "Lumis Essential",
    priceHkd: 58,
    credits: 150,
    renewal: "monthly"
  },
  {
    code: "PRIME_M",
    type: "subscription",
    tier: "prime",
    internalTier: "plus",
    name: "Lumis Prime",
    priceHkd: 98,
    credits: 350,
    renewal: "monthly"
  }
] as const;

export const TOP_UPS = [
  { code: "PACK_S", name: "Top-up Mini", priceHkd: 28, credits: 100, expiresMonths: 12 },
  { code: "PACK_M", name: "Top-up Standard", priceHkd: 78, credits: 300, expiresMonths: 12 },
  { code: "PACK_L", name: "Top-up Max", priceHkd: 238, credits: 1000, expiresMonths: 12 }
] as const;

export type ProductCode = (typeof PRODUCTS)[number]["code"] | (typeof TOP_UPS)[number]["code"];

