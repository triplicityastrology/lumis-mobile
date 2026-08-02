import type {
  JourneyConfirmationSource,
  SinglePhoneJourneyStage,
  WorkbenchAccountRole,
} from "./singlePhoneJourney";
import type { WorkbenchProgressName } from "./workbenchProgress";

export const WORKBENCH_EVIDENCE_NAMES = [
  "code_ready",
  "code_copied",
  "pending_no_authority",
  "accepted_active",
  "paused",
  "resumed",
  "self_removed",
  "relationship_cleanup",
] as const;

export type WorkbenchEvidenceName = (typeof WORKBENCH_EVIDENCE_NAMES)[number];
export type WorkbenchEvidenceSummary = Record<WorkbenchEvidenceName, boolean>;

export type WorkbenchEvidenceItem = {
  name: WorkbenchEvidenceName;
  label: string;
  confirmed: boolean;
};

export const WORKBENCH_SUMMARY_SCHEMA = "lumis_care_circle_test_summary_v1";

const LABELS: Record<WorkbenchEvidenceName, string> = {
  code_ready: "Reusable code ready",
  code_copied: "Pairing code copied",
  pending_no_authority: "Pending with no authority",
  accepted_active: "Caree accepted and active",
  paused: "Care Circle paused",
  resumed: "Care Circle resumed",
  self_removed: "Carer removed self",
  relationship_cleanup: "Relationship cleanup confirmed",
};

export function createWorkbenchEvidenceSummary(): WorkbenchEvidenceSummary {
  return Object.fromEntries(
    WORKBENCH_EVIDENCE_NAMES.map((name) => [name, false])
  ) as WorkbenchEvidenceSummary;
}

export function recordConfirmedWorkbenchEvidence(
  current: WorkbenchEvidenceSummary,
  input: {
    journeyStage: SinglePhoneJourneyStage;
    accountRole: WorkbenchAccountRole;
    evidenceName: WorkbenchProgressName;
    confirmationSource: JourneyConfirmationSource;
  }
): WorkbenchEvidenceSummary {
  const confirmed = resolveConfirmedEvidenceName(input);
  if (!confirmed || current[confirmed]) return current;
  return { ...current, [confirmed]: true };
}

export function recordConfirmedCodeCopy(
  current: WorkbenchEvidenceSummary
): WorkbenchEvidenceSummary {
  if (!current.code_ready || current.code_copied) return current;
  return { ...current, code_copied: true };
}

export function listWorkbenchEvidence(
  summary: WorkbenchEvidenceSummary
): WorkbenchEvidenceItem[] {
  return WORKBENCH_EVIDENCE_NAMES.map((name) => ({
    name,
    label: LABELS[name],
    confirmed: summary[name],
  }));
}

export function buildSelectableWorkbenchSummary(input: {
  buildMarker: string | undefined;
  evidence: WorkbenchEvidenceSummary;
}): string {
  const buildMarker =
    typeof input.buildMarker === "string" && /^[0-9a-f]{7,40}$/u.test(input.buildMarker)
      ? input.buildMarker
      : "unavailable";
  const evidenceKeys = Object.keys(input.evidence).sort();
  const expectedKeys = [...WORKBENCH_EVIDENCE_NAMES].sort();
  if (JSON.stringify(evidenceKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error("CARE_CIRCLE_SUMMARY_SCHEMA_INVALID");
  }
  return [
    WORKBENCH_SUMMARY_SCHEMA,
    `build_marker=${buildMarker}`,
    ...WORKBENCH_EVIDENCE_NAMES.map(
      (name) => `${name}=${input.evidence[name] ? "confirmed" : "not_confirmed"}`
    ),
  ].join("\n");
}

function resolveConfirmedEvidenceName(input: {
  journeyStage: SinglePhoneJourneyStage;
  accountRole: WorkbenchAccountRole;
  evidenceName: WorkbenchProgressName;
  confirmationSource: JourneyConfirmationSource;
}): WorkbenchEvidenceName | null {
  const expectedSource =
    input.journeyStage === "caree_create_code"
      ? "operation_result"
      : "safe_projection";
  if (input.confirmationSource !== expectedSource) return null;
  if (
    input.journeyStage === "caree_create_code" &&
    input.accountRole === "caree" &&
    input.evidenceName === "caree_code_ready"
  ) {
    return "code_ready";
  }
  if (
    input.journeyStage === "carer_submit_code" &&
    input.accountRole === "carer" &&
    input.evidenceName === "carer_pending_no_authority"
  ) {
    return "pending_no_authority";
  }
  if (
    input.journeyStage === "caree_accept" &&
    input.accountRole === "caree" &&
    input.evidenceName === "active"
  ) {
    return "accepted_active";
  }
  if (
    input.journeyStage === "caree_pause" &&
    input.accountRole === "caree" &&
    input.evidenceName === "paused"
  ) {
    return "paused";
  }
  if (
    input.journeyStage === "caree_resume" &&
    input.accountRole === "caree" &&
    input.evidenceName === "active"
  ) {
    return "resumed";
  }
  if (
    input.journeyStage === "carer_remove" &&
    input.accountRole === "carer" &&
    input.evidenceName === "removed"
  ) {
    return "self_removed";
  }
  if (
    input.journeyStage === "operator_cleanup_required" &&
    input.evidenceName === "relationship_cleanup_complete"
  ) {
    return "relationship_cleanup";
  }
  return null;
}
