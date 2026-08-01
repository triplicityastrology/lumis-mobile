import type { WorkbenchRelationship } from "./CareCircleStagingWorkbench";

export type WorkbenchProgressName =
  | "signed_out"
  | "caree_ready"
  | "carer_ready"
  | "caree_code_ready"
  | "carer_pending_no_authority"
  | "caree_decision_required"
  | "active"
  | "paused"
  | "removed"
  | "relationship_cleanup_complete";

export type WorkbenchProgress = {
  evidenceName: WorkbenchProgressName;
  label: string;
  guidance: string;
};

export function resolveWorkbenchProgress(input: {
  authenticated: boolean;
  role?: "caree" | "carer";
  hasUsablePairingCode?: boolean;
  paused?: boolean;
  relationships?: WorkbenchRelationship[];
  projectionConfirmed?: boolean;
  hadRelationship?: boolean;
}): WorkbenchProgress {
  if (!input.authenticated) {
    return progress(
      "signed_out",
      "Signed out",
      "Sign in with one disposable staging account to begin."
    );
  }

  const role = input.role ?? "caree";
  const relationships = (input.relationships ?? []).filter(
    (relationship) => relationship.participantRole === role
  );
  const pending = relationships.some(
    (relationship) => relationship.status === "pending_caree_acceptance"
  );
  const active = relationships.some(
    (relationship) => relationship.status === "active"
  );
  const terminal = relationships.some((relationship) =>
    relationship.status === "declined" ||
    relationship.status === "removed_by_caree" ||
    relationship.status === "removed_by_carer" ||
    relationship.status === "expired"
  );

  if (
    input.projectionConfirmed &&
    relationships.some(
      (relationship) =>
        relationship.status === "removed_by_caree" ||
        relationship.status === "removed_by_carer"
    )
  ) {
    return progress(
      "removed",
      "Relationship removed",
      "Participant-safe state confirms this relationship was removed."
    );
  }
  if (pending && role === "caree") {
    return progress(
      "caree_decision_required",
      "Caree decision required",
      "Review the pending request, then accept or decline it."
    );
  }
  if (pending) {
    return progress(
      "carer_pending_no_authority",
      "Pending Caree acceptance",
      "This Carer has no Care Circle authority until the Caree accepts."
    );
  }
  if (active && input.paused) {
    return progress(
      "paused",
      "Care Circle paused",
      "The accepted relationship remains present but paused."
    );
  }
  if (active) {
    return progress(
      "active",
      "Relationship active",
      "Caree acceptance has activated this relationship."
    );
  }
  if (
    terminal ||
    (input.projectionConfirmed && input.hadRelationship && relationships.length === 0)
  ) {
    return progress(
      "relationship_cleanup_complete",
      "Relationship cleanup complete",
      "No pending or active relationship remains in this safe projection."
    );
  }
  if (role === "caree" && input.hasUsablePairingCode) {
    return progress(
      "caree_code_ready",
      "Caree code ready",
      "The reusable one-hour code is ready for a disposable Carer."
    );
  }
  return role === "caree"
    ? progress("caree_ready", "Caree ready", "Create a one-hour pairing code.")
    : progress("carer_ready", "Carer ready", "Submit the Caree pairing code.");
}

function progress(
  evidenceName: WorkbenchProgressName,
  label: string,
  guidance: string
): WorkbenchProgress {
  return { evidenceName, label, guidance };
}
