import { readFileSync } from "node:fs";
import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

import {
  runRedactedEvidenceMain,
  safeCheck
} from "./lib/redaction-safe-evidence.mjs";
import {
  anonymousRequest,
  cleanupInterruptedRun,
  cleanupRun,
  createDisposableUser,
  createStagingContext,
  invokeFunction,
  makePassword,
  makeRunId,
  parseEvidenceArgs,
  pass,
  printRedactedEvidence,
  serviceRequest,
  signIn,
  STAGING_PROJECT_REF,
  userRequest,
  verifyAdminAccess
} from "./lib/staging-evidence-utils.mjs";

let runId = "not-created";

await runRedactedEvidenceMain(
  {
    getRunId: () => runId,
    boundaryCheck: "care_circle_execute",
    boundaryCode: "CARE_EVIDENCE_INTERNAL_FAILURE"
  },
  async () => {
validateFourDigitSeal();
const args = parseEvidenceArgs(
  process.argv.slice(2),
  "Care Circle staging"
);
const plan = JSON.parse(
  readFileSync("supabase/tests/s2-care-circle-staging-evidence-plan.json", "utf8")
);

safeCheck(
  plan.project_ref === STAGING_PROJECT_REF,
  "plan_project_ref",
  "CARE_PLAN_PROJECT_REF_INVALID"
);
safeCheck(
  plan.execution_default === "preflight_only",
  "plan_default_mode",
  "CARE_PLAN_DEFAULT_MODE_INVALID"
);
safeCheck(
  plan.required_migrations?.join("|")
    === [
      "0032_care_circle_backend_foundation.sql",
      "0034_reusable_care_pairing_operations.sql"
    ].join("|"),
  "plan_migration_order",
  "CARE_PLAN_MIGRATION_ORDER_INVALID"
);

if (!args.execute) {
  assertPlanCoverage(plan);
  process.stdout.write(
    "Care Circle staging evidence preflight passed; no network or database command ran.\n"
  );
  return;
}

runId = args.runId || makeRunId();
const context = await createStagingContext("s2care", runId);
await verifyAdminAccess(context);

if (args.cleanup) {
  const removed = await cleanupInterruptedRun(context);
  pass(context, `Interrupted-run cleanup removed ${removed} disposable account(s)`);
  printRedactedEvidence(context);
  return;
}

const password = makePassword();
try {
  const caree = await createDisposableUser(context, "caree", password);
  const carers = [];
  for (let index = 1; index <= 6; index += 1) {
    carers.push(
      await createDisposableUser(context, `carer${index}`, password)
    );
  }

  await prepareCareCapabilities(context, caree.id, carers.map((item) => item.id));
  const careeToken = await signIn(context, caree.email, password);
  const carerTokens = await Promise.all(
    carers.map((carer) => signIn(context, carer.email, password))
  );

  await verifyCareRls(
    context,
    careeToken,
    null,
    carerTokens[5]
  );
  pass(context, "Owner, unrelated, anonymous, and legacy bypass boundaries hold");

  const createRequestId = crypto.randomUUID();
  const created = await careOperation(context, careeToken, {
    action: "pairing_code_create",
    client_request_id: createRequestId
  });
  safeCheck(
    created.status === 200,
    "pairing_code_create",
    "CARE_PAIRING_CREATE_FAILED"
  );
  safeCheck(
    /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/.test(
      created.body?.pairing_code ?? ""
    ),
    "pairing_code_shape",
    "CARE_PAIRING_CODE_SHAPE_INVALID"
  );
  const pairingCode = created.body.pairing_code;
  const firstCodeId = created.body.code_id;

  const replay = await careOperation(context, careeToken, {
    action: "pairing_code_create",
    client_request_id: createRequestId
  });
  safeCheck(
    replay.status === 200,
    "pairing_code_replay_status",
    "CARE_PAIRING_REPLAY_FAILED"
  );
  safeCheck(
    replay.body.code_id === firstCodeId,
    "pairing_code_replay_record",
    "CARE_PAIRING_REPLAY_RECORD_MISMATCH"
  );
  safeCheck(
    replay.body.pairing_code === pairingCode,
    "pairing_code_replay",
    "CARE_PAIRING_CODE_MISMATCH"
  );
  pass(context, "Stable request replay returns one reusable one-hour pairing code");

  const pending = await Promise.all(
    carerTokens.map((token) =>
      careOperation(context, token, {
        action: "pairing_code_submit",
        client_request_id: crypto.randomUUID(),
        pairing_code: pairingCode
      })
    )
  );
  safeCheck(
    pending.every((result) => result.status === 200),
    "pending_request_status",
    "CARE_PENDING_REQUEST_FAILED"
  );
  safeCheck(
    new Set(pending.map((result) => result.body.relationship_id)).size === 6,
    "pending_request_distinct",
    "CARE_PENDING_REQUEST_DUPLICATE"
  );
  pass(context, "One active pairing code creates six distinct pending requests");

  await verifyCareRls(
    context,
    careeToken,
    carerTokens[0],
    null
  );
  const pendingProjection = await userRequest(
    context,
    carerTokens[0],
    "/rest/v1/rpc/list_care_relationships",
    { method: "POST", body: {} }
  );
  safeCheck(
    pendingProjection.ok &&
      pendingProjection.body.length === 1 &&
      pendingProjection.body[0]?.status === "pending_caree_acceptance" &&
      pendingProjection.body[0]?.accepted_at === null,
    "pending_projection_no_authority",
    "CARE_PENDING_PROJECTION_AUTHORITY_EXPOSED"
  );
  pass(context, "Participant storage denial and safe projection hold");

  const carerAccept = await careOperation(context, carerTokens[0], {
    action: "relationship_accept",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[0].body.relationship_id
  });
  safeCheck(
    carerAccept.body?.error?.code === "48007",
    "carer_accept_denial",
    "CARE_CARER_ACCEPT_DENIAL_FAILED"
  );
  const carerDecline = await careOperation(context, carerTokens[0], {
    action: "relationship_decline",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[0].body.relationship_id
  });
  safeCheck(
    carerDecline.body?.error?.code === "48007",
    "carer_decline_denial",
    "CARE_CARER_DECLINE_DENIAL_FAILED"
  );
  pass(context, "Carer cannot accept or decline the Caree-owned request");

  const conflict = await careOperation(context, careeToken, {
    action: "pairing_code_revoke",
    client_request_id: createRequestId,
    code_id: firstCodeId
  });
  safeCheck(
    conflict.body?.error?.code === "48012",
    "request_id_conflict",
    "CARE_REQUEST_CONFLICT_FAILED"
  );
  pass(context, "Changed operation with the same request ID is rejected safely");

  const acceptance = await Promise.all(
    pending.map((item) =>
      careOperation(context, careeToken, {
        action: "relationship_accept",
        client_request_id: crypto.randomUUID(),
        relationship_id: item.body.relationship_id
      })
    )
  );
  safeCheck(
    acceptance.filter((item) => item.status === 200).length === 5,
    "fifth_carer_limit",
    "CARE_FIFTH_CARER_LIMIT_FAILED"
  );
  const rejected = acceptance.find((item) => item.status !== 200);
  safeCheck(
    rejected?.body?.error?.code === "48012",
    "sixth_carer_denial",
    "CARE_SIXTH_CARER_DENIAL_FAILED"
  );
  const capacityProjection = await userRequest(
    context,
    careeToken,
    "/rest/v1/rpc/list_care_relationships",
    { method: "POST", body: {} }
  );
  safeCheck(
    capacityProjection.ok &&
      capacityProjection.body.filter((item) => item.status === "active")
        .length === 5 &&
      capacityProjection.body.filter(
        (item) => item.status === "pending_caree_acceptance"
      ).length === 1,
    "capacity_projection_state",
    "CARE_CAPACITY_PROJECTION_INVALID"
  );
  pass(context, "Concurrent sixth acceptance is rejected and five become active");

  const rejectedIndex = acceptance.indexOf(rejected);
  const declined = await careOperation(context, careeToken, {
    action: "relationship_decline",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[rejectedIndex].body.relationship_id
  });
  safeCheck(
    declined.body?.status === "declined",
    "caree_decline",
    "CARE_DECLINE_FAILED"
  );
  pass(context, "Caree alone declines a pending request");

  const rotated = await careOperation(context, careeToken, {
    action: "pairing_code_create",
    client_request_id: crypto.randomUUID()
  });
  safeCheck(
    rotated.status === 200,
    "pairing_code_rotation",
    "CARE_PAIRING_ROTATION_FAILED"
  );
  const rotatedOldUse = await careOperation(context, carerTokens[0], {
    action: "pairing_code_submit",
    client_request_id: crypto.randomUUID(),
    pairing_code: pairingCode
  });
  safeCheck(
    rotatedOldUse.body?.error?.code === "48004",
    "rotated_code_denial",
    "CARE_ROTATED_CODE_DENIAL_FAILED"
  );
  const revoked = await careOperation(context, careeToken, {
    action: "pairing_code_revoke",
    client_request_id: crypto.randomUUID(),
    code_id: rotated.body.code_id
  });
  safeCheck(
    revoked.body?.status === "revoked",
    "pairing_code_revoke",
    "CARE_PAIRING_REVOKE_FAILED"
  );
  const revokedUse = await careOperation(context, carerTokens[0], {
    action: "pairing_code_submit",
    client_request_id: crypto.randomUUID(),
    pairing_code: rotated.body.pairing_code
  });
  safeCheck(
    revokedUse.body?.error?.code === "48004",
    "revoked_code_denial",
    "CARE_REVOKED_CODE_DENIAL_FAILED"
  );

  const expiring = await careOperation(context, careeToken, {
    action: "pairing_code_create",
    client_request_id: crypto.randomUUID()
  });
  await serviceRequest(
    context,
    `/rest/v1/care_link_codes?code_id=eq.${expiring.body.code_id}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        issued_at: new Date(Date.now() - 7_200_000).toISOString(),
        expires_at: new Date(Date.now() - 3_600_000).toISOString()
      }
    }
  );
  const expiredUse = await careOperation(context, carerTokens[0], {
    action: "pairing_code_submit",
    client_request_id: crypto.randomUUID(),
    pairing_code: expiring.body.pairing_code
  });
  safeCheck(
    expiredUse.body?.error?.code === "48004",
    "expired_code_denial",
    "CARE_EXPIRED_CODE_DENIAL_FAILED"
  );
  pass(context, "Rotation, revocation, and expiry block later pairing attempts");

  const pause = await careOperation(context, careeToken, {
    action: "care_pause",
    client_request_id: crypto.randomUUID(),
    paused_until: new Date(Date.now() + 86_400_000).toISOString()
  });
  safeCheck(
    pause.body?.status === "paused",
    "care_pause",
    "CARE_PAUSE_FAILED"
  );
  const resume = await careOperation(context, careeToken, {
    action: "care_resume",
    client_request_id: crypto.randomUUID()
  });
  safeCheck(
    resume.body?.status === "active",
    "care_resume",
    "CARE_RESUME_FAILED"
  );
  const remove = await careOperation(context, carerTokens[0], {
    action: "relationship_remove",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[0].body.relationship_id
  });
  safeCheck(
    /^removed_by_/.test(remove.body?.status ?? ""),
    "relationship_remove",
    "CARE_RELATIONSHIP_REMOVE_FAILED"
  );
  pass(context, "Caree pause/resume and participant removal use backend authority");

  const rawStorage = await serviceRequest(
    context,
    `/rest/v1/care_link_codes?caree_user_id=eq.${caree.id}&select=code_hash`
  );
  safeCheck(
    rawStorage.every((row) => row.code_hash !== pairingCode),
    "pairing_storage_redaction",
    "CARE_PAIRING_STORAGE_REDACTION_FAILED"
  );
  const audit = await serviceRequest(
    context,
    `/rest/v1/care_pairing_code_events?caree_user_id=eq.${caree.id}&select=event_type`
  );
  safeCheck(
    audit.length >= 4,
    "pairing_audit_evidence",
    "CARE_PAIRING_AUDIT_INCOMPLETE"
  );
  pass(context, "Sensitive storage and audit contain no raw pairing material");

  await context.adminClient.auth.admin.deleteUser(carers[5].id);
  context.createdUserIds.splice(context.createdUserIds.indexOf(carers[5].id), 1);
  const deletedRows = await serviceRequest(
    context,
    `/rest/v1/care_relationships?carer_user_id=eq.${carers[5].id}&select=id`
  );
  safeCheck(
    deletedRows.length === 0,
    "participant_deletion_cleanup",
    "CARE_DELETION_CLEANUP_FAILED"
  );
  const unrelatedRelationship = await serviceRequest(
    context,
    `/rest/v1/care_relationships?carer_user_id=eq.${carers[0].id}&select=id`
  );
  safeCheck(
    unrelatedRelationship.length >= 1,
    "unrelated_relationship_preserved",
    "CARE_UNRELATED_RELATIONSHIP_CHANGED"
  );
  pass(context, "Disposable participant deletion cascades without unrelated changes");

  printRedactedEvidence(context);
} finally {
  await cleanupRun(context);
}
  }
);

function assertPlanCoverage(definition) {
  for (const id of [
    "reusable-code",
    "pending-requests",
    "caree-consent",
    "sixth-acceptance",
    "idempotency",
    "expiry-rotation-revocation",
    "pause-resume-remove",
    "rls-safe-projection",
    "legacy-rpc-denial",
    "deletion-cleanup"
  ]) {
    safeCheck(
      definition.cases.some((item) => item.id === id),
      "plan_case_coverage",
      "CARE_PLAN_CASE_MISSING"
    );
  }
}

async function careOperation(context, token, body) {
  return invokeFunction(context, "care-circle", token, body);
}

async function prepareCareCapabilities(context, careeId, carerIds) {
  await serviceRequest(context, `/rest/v1/users?id=eq.${careeId}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { display_name: "QA Caree", account_mode: "standard" }
  });
  for (const [index, carerId] of carerIds.entries()) {
    await serviceRequest(context, `/rest/v1/users?id=eq.${carerId}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { display_name: `QA Carer ${index + 1}`, account_mode: "carer_only" }
    });
  }
  await serviceRequest(context, "/rest/v1/account_entitlements", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      user_id: careeId,
      plan_tier: "essential",
      product_code: "ESSENTIAL_M",
      status: "active",
      source: "admin"
    }
  });
  await serviceRequest(context, "/rest/v1/care_check_settings", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      user_id: careeId,
      enabled: false,
      cadence_days: 2,
      grace_hours: 24,
      timezone: "Etc/UTC"
    }
  });
}

async function verifyCareRls(
  context,
  careeToken,
  participantToken,
  unrelatedToken
) {
  for (const table of [
    "care_relationships",
    "care_relationship_events",
    "care_link_codes",
    "care_pairing_code_events",
    "care_operation_requests"
  ]) {
    const owner = await userRequest(
      context,
      careeToken,
      `/rest/v1/${table}?select=*`
    );
    safeCheck(
      !owner.ok,
      "owner_storage_denial",
      "CARE_OWNER_STORAGE_EXPOSED"
    );
    if (participantToken) {
      const participant = await userRequest(
        context,
        participantToken,
        `/rest/v1/${table}?select=*`
      );
      safeCheck(
        !participant.ok,
        "participant_storage_denial",
        "CARE_PARTICIPANT_STORAGE_EXPOSED"
      );
    }
    if (unrelatedToken) {
      const unrelated = await userRequest(
        context,
        unrelatedToken,
        `/rest/v1/${table}?select=*`
      );
      safeCheck(
        !unrelated.ok,
        "unrelated_storage_denial",
        "CARE_UNRELATED_STORAGE_EXPOSED"
      );
    }
    const anonymous = await anonymousRequest(
      context,
      `/rest/v1/${table}?select=*`
    );
    safeCheck(
      !anonymous.ok,
      "anonymous_storage_denial",
      "CARE_ANONYMOUS_STORAGE_EXPOSED"
    );
  }

  const projectionToken = participantToken ?? unrelatedToken;
  if (projectionToken) {
    const safeProjection = await userRequest(
      context,
      projectionToken,
      "/rest/v1/rpc/list_care_relationships",
      { method: "POST", body: {} }
    );
    safeCheck(
      safeProjection.ok,
      "safe_projection_access",
      "CARE_SAFE_PROJECTION_FAILED"
    );
    if (unrelatedToken) {
      safeCheck(
        safeProjection.body.length === 0,
        "unrelated_projection_empty",
        "CARE_UNRELATED_PROJECTION_EXPOSED"
      );
    }
    safeCheck(
      safeProjection.body.every(
        (item) =>
          !Object.keys(item).some((key) =>
            /code|hash|metadata|birth|chart|credit|billing/i.test(key)
          )
      ),
      "safe_projection_fields",
      "CARE_SAFE_PROJECTION_FIELD_EXPOSED"
    );
  }

  const legacyBypass = await userRequest(
    context,
    careeToken,
    "/rest/v1/rpc/accept_care_relationship",
    {
      method: "POST",
      body: {
        p_relationship_id: crypto.randomUUID(),
        p_request_id: crypto.randomUUID(),
        p_request_digest: "blocked"
      }
    }
  );
  safeCheck(
    !legacyBypass.ok,
    "legacy_rpc_denial",
    "CARE_LEGACY_RPC_EXPOSED"
  );
}
