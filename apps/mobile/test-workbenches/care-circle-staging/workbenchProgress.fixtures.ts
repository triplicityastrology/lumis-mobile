import type { WorkbenchRelationship } from "./CareCircleStagingWorkbench";
import { resolveWorkbenchProgress } from "./workbenchProgress";

const pendingCaree = relationship("caree", "pending_caree_acceptance");
const pendingCarer = relationship("carer", "pending_caree_acceptance");
const activeCaree = relationship("caree", "active");
const removedCaree = relationship("caree", "removed_by_caree");

state({ authenticated: false }, "signed_out");
state(
  { authenticated: true, role: "caree", hasUsablePairingCode: true },
  "caree_code_ready"
);
state(
  { authenticated: true, role: "carer", relationships: [pendingCarer] },
  "carer_pending_no_authority"
);
state(
  { authenticated: true, role: "caree", relationships: [pendingCaree] },
  "caree_decision_required"
);
state(
  { authenticated: true, role: "caree", relationships: [activeCaree] },
  "active"
);
state(
  {
    authenticated: true,
    role: "caree",
    relationships: [activeCaree],
    paused: true,
  },
  "paused"
);
state(
  {
    authenticated: true,
    role: "caree",
    relationships: [activeCaree],
    lastSuccessfulOperation: "relationship_removed",
  },
  "removed"
);
state(
  { authenticated: true, role: "caree", relationships: [removedCaree] },
  "relationship_cleanup_complete"
);

const pendingState = resolveWorkbenchProgress({
  authenticated: true,
  role: "carer",
  relationships: [pendingCarer],
});
contains(pendingState.guidance, "no Care Circle authority", "pending is not active");

console.log("Care Circle workbench progress fixtures passed");

function relationship(
  participantRole: WorkbenchRelationship["participantRole"],
  status: WorkbenchRelationship["status"]
): WorkbenchRelationship {
  return {
    relationshipId: "10000000-0000-4000-8000-000000000001",
    participantRole,
    otherDisplayName: "Disposable participant",
    status,
  };
}

function state(
  input: Parameters<typeof resolveWorkbenchProgress>[0],
  expected: ReturnType<typeof resolveWorkbenchProgress>["evidenceName"]
) {
  const actual = resolveWorkbenchProgress(input).evidenceName;
  if (actual !== expected) throw new Error(`${expected}: assertion failed`);
}

function contains(value: string, expected: string, label: string) {
  if (!value.includes(expected)) throw new Error(`${label}: assertion failed`);
}
