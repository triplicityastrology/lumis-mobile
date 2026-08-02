import type { CareCircleClientPort, CareCircleEdgeRequest } from "../../src/services/inactiveCareCircleClient";
import type { WorkbenchProjection, WorkbenchRelationshipPort } from "./CareCircleStagingWorkbench";

export type LocalRehearsalRole = "caree" | "carer";

const RELATIONSHIP_ID = "10000000-0000-4000-8000-000000000001";
const CODE_ID = "20000000-0000-4000-8000-000000000002";
const PAIRING_CODE = "2468";
type RelationshipState = "none" | "pending_caree_acceptance" | "active" | "removed_by_carer";

export function createLocalCareCircleRehearsal(now = () => Date.now()) {
  let relationship: RelationshipState = "none";
  let paused = false;
  let codeReady = false;

  function operationPort(role: LocalRehearsalRole): CareCircleClientPort {
    return {
      async execute(request: CareCircleEdgeRequest): Promise<unknown> {
        switch (request.action) {
          case "pairing_code_create":
            if (role !== "caree") return denied();
            codeReady = true;
            return { ok: true, pairing_code: PAIRING_CODE, code_id: CODE_ID, expires_at: new Date(now() + 10 * 60 * 1000).toISOString() };
          case "pairing_code_submit":
            if (role !== "carer" || !codeReady || request.pairing_code !== PAIRING_CODE) return { error: { code: "48004" } };
            relationship = "pending_caree_acceptance";
            return { ok: true, relationship_id: RELATIONSHIP_ID, status: "pending_caree_acceptance" };
          case "relationship_accept":
            if (role !== "caree" || relationship !== "pending_caree_acceptance") return denied();
            relationship = "active";
            return { ok: true, relationship_id: RELATIONSHIP_ID };
          case "relationship_decline":
            if (role !== "caree" || relationship !== "pending_caree_acceptance") return denied();
            relationship = "none";
            return { ok: true, relationship_id: RELATIONSHIP_ID };
          case "care_pause":
            if (role !== "caree" || relationship !== "active") return denied();
            paused = true;
            return { ok: true, paused_until: request.paused_until };
          case "care_resume":
            if (role !== "caree" || relationship !== "active") return denied();
            paused = false;
            return { ok: true };
          case "relationship_remove":
            if (role !== "carer" || relationship !== "active") return denied();
            relationship = "removed_by_carer";
            paused = false;
            return { ok: true, relationship_id: RELATIONSHIP_ID };
        }
      },
    };
  }

  function relationshipPort(role: LocalRehearsalRole): WorkbenchRelationshipPort {
    return {
      async readProjection(): Promise<WorkbenchProjection> {
        return {
          paused,
          relationships: relationship === "none" ? [] : [{
            relationshipId: RELATIONSHIP_ID,
            participantRole: role,
            otherDisplayName: role === "caree" ? "Synthetic Carer" : "Synthetic Caree",
            status: relationship,
          }],
        };
      },
    };
  }

  function cleanup(): boolean {
    if (relationship !== "removed_by_carer") return false;
    relationship = "none";
    paused = false;
    codeReady = false;
    return true;
  }

  return {
    cleanup,
    operationPort,
    relationshipPort,
    snapshot: () => ({ codeReady, paused, relationship }),
  };
}

function denied() {
  return { error: { code: "48007" } };
}
