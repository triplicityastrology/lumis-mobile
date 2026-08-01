import { createQuotaVerificationEvidence } from "./quotaVerification";

equal(createQuotaVerificationEvidence({
  accountSource: "supabase",
  consumedCount: 0,
  supabaseUrl: "https://bmqhwofmdgebpcihjlnb.supabase.co/",
}), {
  consumedCount: 0,
  remainingAllowance: 3,
  source: "staging_authoritative",
  sourceLabel: "Staging authoritative account state",
}, "staging count zero");

equal(createQuotaVerificationEvidence({
  accountSource: "supabase",
  consumedCount: 3,
  supabaseUrl: "https://bmqhwofmdgebpcihjlnb.supabase.co/",
}), {
  consumedCount: 3,
  remainingAllowance: 0,
  source: "staging_authoritative",
  sourceLabel: "Staging authoritative account state",
}, "staging count three");

equal(createQuotaVerificationEvidence({ accountSource: "local_demo", consumedCount: 0 }), {
  consumedCount: 0,
  remainingAllowance: 3,
  source: "local_demo",
  sourceLabel: "Local demo · not authoritative staging",
}, "local demo distinct");

for (const supabaseUrl of [
  "http://bmqhwofmdgebpcihjlnb.supabase.co/",
  "https://other.supabase.co/",
  "not-a-url",
]) {
  equal(createQuotaVerificationEvidence({ accountSource: "supabase", consumedCount: 0, supabaseUrl }), {
    consumedCount: null,
    remainingAllowance: null,
    source: "unavailable",
    sourceLabel: "Authoritative staging source unavailable",
  }, "non-staging source unavailable");
}

console.log("Founder quota verification fixtures passed");

function equal(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: assertion failed`);
}
