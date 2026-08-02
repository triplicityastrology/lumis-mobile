import type {
  JourneyConfirmationSource,
  SinglePhoneJourneyStage,
  WorkbenchAccountRole,
} from "./singlePhoneJourney";
import type { WorkbenchProgressName } from "./workbenchProgress";

export const WORKBENCH_EVIDENCE_NAMES = [
  "code_ready",
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

const LABELS: Record<WorkbenchEvidenceName, string> = {
  code_ready: "Reusable code ready",
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

export function listWorkbenchEvidence(
  summary: WorkbenchEvidenceSummary
): WorkbenchEvidenceItem[] {
  return WORKBENCH_EVIDENCE_NAMES.map((name) => ({
    name,
    label: LABELS[name],
    confirmed: summary[name],
  }));
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
