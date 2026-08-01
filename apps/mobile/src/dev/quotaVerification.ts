import { resolveBirthChangeQuota } from "../services/birthChangeQuota";

const STAGING_HOST = "bmqhwofmdgebpcihjlnb.supabase.co";

export type QuotaEvidenceSource = "staging_authoritative" | "local_demo" | "unavailable";

export type QuotaVerificationEvidence = {
  consumedCount: number | null;
  remainingAllowance: number | null;
  source: QuotaEvidenceSource;
  sourceLabel: string;
};

export function createQuotaVerificationEvidence(input: {
  accountSource: "none" | "local_demo" | "supabase";
  consumedCount: unknown;
  supabaseUrl?: string;
}): QuotaVerificationEvidence {
  if (input.accountSource === "local_demo") {
    const quota = resolveBirthChangeQuota(input.consumedCount);
    return {
      consumedCount: quota.successfulChanges,
      remainingAllowance: quota.remainingChanges,
      source: "local_demo",
      sourceLabel: "Local demo · not authoritative staging",
    };
  }

  if (input.accountSource !== "supabase" || !isExactStagingUrl(input.supabaseUrl)) {
    return {
      consumedCount: null,
      remainingAllowance: null,
      source: "unavailable",
      sourceLabel: "Authoritative staging source unavailable",
    };
  }

  const quota = resolveBirthChangeQuota(input.consumedCount);
  return {
    consumedCount: quota.successfulChanges,
    remainingAllowance: quota.remainingChanges,
    source: "staging_authoritative",
    sourceLabel: "Staging authoritative account state",
  };
}

function isExactStagingUrl(value?: string): boolean {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname === STAGING_HOST && url.pathname === "/";
  } catch {
    return false;
  }
}
