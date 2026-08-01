import type { SupabaseClient } from "@supabase/supabase-js";

import type { CareCircleClientPort } from "../../src/services/inactiveCareCircleClient";
import type {
  WorkbenchRelationship,
  WorkbenchRelationshipPort,
  WorkbenchProjection,
} from "./CareCircleStagingWorkbench";

export type WorkbenchCapabilities = {
  accountRole: "caree" | "carer";
  canActAsCaree: boolean;
  canActAsCarer: boolean;
  careCirclePaused: boolean;
};

export type WorkbenchSessionState =
  | { authenticated: false }
  | {
      authenticated: true;
      capabilities: WorkbenchCapabilities;
    };

export type WorkbenchSessionPort = {
  readSession(): Promise<WorkbenchSessionState>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
};

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
  sessionPort: WorkbenchSessionPort;
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
      async readProjection(): Promise<WorkbenchProjection> {
        const [relationshipsResult, settingsResult] = await Promise.all([
          supabase.rpc("list_care_relationships"),
          supabase
            .from("care_check_settings")
            .select("paused_until")
            .maybeSingle(),
        ]);
        if (
          relationshipsResult.error ||
          settingsResult.error ||
          !Array.isArray(relationshipsResult.data)
        ) {
          throw new Error("CARE_CIRCLE_RELATIONSHIP_LIST_UNAVAILABLE");
        }
        const projected = relationshipsResult.data.map(projectRelationship);
        if (projected.some((item) => item === null)) {
          throw new Error("CARE_CIRCLE_RELATIONSHIP_LIST_UNAVAILABLE");
        }
        return {
          relationships: projected as WorkbenchRelationship[],
          paused: projectPaused(settingsResult.data),
        };
      },
    },
    sessionPort: {
      async readSession() {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) {
          throw new Error("CARE_CIRCLE_SESSION_UNAVAILABLE");
        }
        if (!sessionData.session) {
          return { authenticated: false };
        }

        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error("CARE_CIRCLE_SESSION_UNAVAILABLE");
        }

        const [capabilityResult, settingsResult] = await Promise.all([
          supabase.rpc("resolve_care_circle_capability"),
          supabase
            .from("care_check_settings")
            .select("paused_until")
            .maybeSingle(),
        ]);
        if (capabilityResult.error || settingsResult.error) {
          throw new Error("CARE_CIRCLE_SESSION_UNAVAILABLE");
        }

        const capabilities = projectCapabilities(
          capabilityResult.data,
          settingsResult.data
        );
        if (!capabilities) {
          throw new Error("CARE_CIRCLE_SESSION_UNAVAILABLE");
        }

        return { authenticated: true, capabilities };
      },
      async signIn({ email, password }) {
        if (!email.trim() || !password) {
          throw new Error("CARE_CIRCLE_SIGN_IN_INVALID");
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) {
          throw new Error("CARE_CIRCLE_SIGN_IN_FAILED");
        }
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error("CARE_CIRCLE_SIGN_OUT_FAILED");
        }
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

function projectCapabilities(
  capabilityValue: unknown,
  settingsValue: unknown
): WorkbenchCapabilities | null {
  if (
    !isRecord(capabilityValue) ||
    (capabilityValue.account_mode !== "standard" &&
      capabilityValue.account_mode !== "carer_only") ||
    typeof capabilityValue.can_act_as_caree !== "boolean" ||
    typeof capabilityValue.can_act_as_carer !== "boolean"
  ) {
    return null;
  }

  return {
    accountRole:
      capabilityValue.account_mode === "carer_only" ? "carer" : "caree",
    canActAsCaree: capabilityValue.can_act_as_caree,
    canActAsCarer: capabilityValue.can_act_as_carer,
    careCirclePaused: projectPaused(settingsValue),
  };
}

function projectPaused(settingsValue: unknown): boolean {
  const pausedUntil =
    isRecord(settingsValue) && typeof settingsValue.paused_until === "string"
      ? Date.parse(settingsValue.paused_until)
      : Number.NaN;
  return Number.isFinite(pausedUntil) && pausedUntil > Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
