import type { SupabaseClient } from "@supabase/supabase-js";

import type { CareCircleClientPort } from "../../src/services/inactiveCareCircleClient";
import type {
  WorkbenchRelationship,
  WorkbenchRelationshipPort,
} from "./CareCircleStagingWorkbench";

const SAFE_BACKEND_CODES = new Set([
  "AUTH_REQUIRED",
  "48004",
  "48005",
  "48006",
  "48007",
  "48009",
  "48012",
  "48013",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<WorkbenchRelationship["status"]>([
  "pending_caree_acceptance",
  "active",
  "declined",
  "removed_by_caree",
  "removed_by_carer",
  "expired",
]);

export function createStagingWorkbenchPorts(
  supabase: SupabaseClient
): {
  operationPort: CareCircleClientPort;
  relationshipPort: WorkbenchRelationshipPort;
} {
  return {
    operationPort: {
      async execute(request) {
        const { data, error } = await supabase.functions.invoke("care-circle", {
          body: request,
        });
        if (!error) return data;
        return projectSafeInvocationFailure(error);
      },
    },
    relationshipPort: {
      async listRelationships() {
        const { data, error } = await supabase.rpc(
          "list_care_relationships"
        );
        if (error || !Array.isArray(data)) {
          throw new Error("CARE_CIRCLE_RELATIONSHIP_LIST_UNAVAILABLE");
        }
        const projected = data.map(projectRelationship);
        if (projected.some((item) => item === null)) {
          throw new Error("CARE_CIRCLE_RELATIONSHIP_LIST_UNAVAILABLE");
        }
        return projected as WorkbenchRelationship[];
      },
    },
  };
}

async function projectSafeInvocationFailure(error: unknown) {
  const context = isRecord(error) ? error.context : null;
  if (context instanceof Response) {
    const body = await context
      .clone()
      .json()
      .catch(() => null);
    const code =
      isRecord(body) && isRecord(body.error) ? body.error.code : null;
    if (typeof code === "string" && SAFE_BACKEND_CODES.has(code)) {
      return { error: { code } };
    }
  }
  return { error: { code: "CARE_CIRCLE_OPERATION_FAILED" } };
}

function projectRelationship(value: unknown): WorkbenchRelationship | null {
  if (
    !isRecord(value) ||
    !UUID_PATTERN.test(asString(value.relationship_id)) ||
    (value.participant_role !== "caree" &&
      value.participant_role !== "carer") ||
    typeof value.other_display_name !== "string" ||
    !STATUSES.has(value.relationship_status as WorkbenchRelationship["status"])
  ) {
    return null;
  }

  return {
    relationshipId: asString(value.relationship_id),
    participantRole: value.participant_role,
    otherDisplayName: value.other_display_name,
    status: value.relationship_status as WorkbenchRelationship["status"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
