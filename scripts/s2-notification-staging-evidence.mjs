import { readFileSync } from "node:fs";

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
  sha256,
  signIn,
  STAGING_PROJECT_REF,
  userRequest,
  verifyAdminAccess
} from "./lib/staging-evidence-utils.mjs";

let runId = "not-created";

await runRedactedEvidenceMain(
  {
    getRunId: () => runId,
    boundaryCheck: "notification_execute",
    boundaryCode: "NOTIFICATION_EVIDENCE_INTERNAL_FAILURE"
  },
  async () => {
const args = parseEvidenceArgs(
  process.argv.slice(2),
  "Notification foundation staging"
);
const plan = JSON.parse(
  readFileSync(
    "supabase/tests/s2-notification-staging-evidence-plan.json",
    "utf8"
  )
);

safeCheck(
  plan.project_ref === STAGING_PROJECT_REF,
  "plan_project_ref",
  "NOTIFICATION_PLAN_PROJECT_REF_INVALID"
);
safeCheck(
  plan.execution_default === "preflight_only",
  "plan_default_mode",
  "NOTIFICATION_PLAN_DEFAULT_MODE_INVALID"
);
safeCheck(
  plan.required_migrations?.join("|")
    === "0033_inactive_notification_foundation.sql",
  "plan_migration_order",
  "NOTIFICATION_PLAN_MIGRATION_ORDER_INVALID"
);

if (!args.execute) {
  assertPlanCoverage(plan);
  process.stdout.write(
    "Notification staging evidence preflight passed; no network or database command ran.\n"
  );
  return;
}

runId = args.runId || makeRunId();
const context = await createStagingContext("s2notify", runId);
await verifyAdminAccess(context);

if (args.cleanup) {
  const removed = await cleanupInterruptedRun(context);
  pass(context, `Interrupted-run cleanup removed ${removed} disposable account(s)`);
  printRedactedEvidence(context);
  return;
}

const password = makePassword();
try {
  const owner = await createDisposableUser(context, "owner", password);
  const secondUser = await createDisposableUser(context, "second", password);
  const ownerToken = await signIn(context, owner.email, password);
  const secondToken = await signIn(context, secondUser.email, password);
  const installationId = crypto.randomUUID();

  await verifyRegistryAndRls(context, ownerToken, secondToken);
  pass(context, "Inactive registry and owner, second-user, and anonymous RLS hold");

  const secondInstallationId = crypto.randomUUID();
  const raceBody = {
    action: "register",
    request_id: crypto.randomUUID(),
    installation_id: secondInstallationId,
    platform: "android",
    provider: "fcm",
    provider_token: makeDummyToken(runId, "race"),
    permission_status: "granted"
  };
  const raceResults = await Promise.all([
    notificationOperation(context, secondToken, raceBody),
    notificationOperation(context, secondToken, raceBody)
  ]);
  safeCheck(
    raceResults.every((result) => result.status === 200),
    "registration_race_status",
    "NOTIFICATION_REGISTRATION_RACE_FAILED"
  );
  safeCheck(
    raceResults[0].body?.endpoint_id === raceResults[1].body?.endpoint_id,
    "registration_race_endpoint",
    "NOTIFICATION_REGISTRATION_RACE_MISMATCH"
  );
  const raceEndpoints = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${secondUser.id}&select=endpoint_id`
  );
  safeCheck(
    raceEndpoints.length === 1,
    "registration_race_count",
    "NOTIFICATION_REGISTRATION_RACE_DUPLICATE"
  );
  await assertRemovalAction(
    context,
    secondToken,
    secondUser.id,
    secondInstallationId,
    "logout",
    runId
  );
  pass(context, "Concurrent identical registration creates one endpoint");

  const firstDummyToken = makeDummyToken(runId, "first");
  const registerRequestId = crypto.randomUUID();
  const registerBody = {
    action: "register",
    request_id: registerRequestId,
    installation_id: installationId,
    platform: "ios",
    provider: "expo",
    provider_token: firstDummyToken,
    permission_status: "granted",
    app_version: "s2-evidence",
    device_locale: "en-HK"
  };
  const registered = await notificationOperation(context, ownerToken, registerBody);
  safeCheck(
    registered.status === 200,
    "device_register_status",
    "NOTIFICATION_REGISTER_FAILED"
  );
  safeCheck(
    registered.body?.registered === true,
    "device_register_result",
    "NOTIFICATION_REGISTER_RESULT_INVALID"
  );
  const replay = await notificationOperation(context, ownerToken, registerBody);
  safeCheck(
    replay.status === 200,
    "registration_replay_status",
    "NOTIFICATION_REPLAY_FAILED"
  );
  safeCheck(
    replay.body?.endpoint_id === registered.body?.endpoint_id,
    "registration_replay_endpoint",
    "NOTIFICATION_REPLAY_MISMATCH"
  );
  const conflict = await notificationOperation(context, ownerToken, {
    ...registerBody,
    provider_token: makeDummyToken(runId, "changed")
  });
  safeCheck(
    conflict.status === 409,
    "registration_conflict_status",
    "NOTIFICATION_CONFLICT_STATUS_INVALID"
  );
  safeCheck(
    conflict.body?.error?.code === "NOTIFICATION_REQUEST_ID_CONFLICT",
    "registration_conflict_code",
    "NOTIFICATION_CONFLICT_CODE_INVALID"
  );
  pass(context, "Registration is idempotent and changed request reuse conflicts");

  await verifyEncryptedStorage(context, owner.id, firstDummyToken);
  pass(context, "Dummy token is encrypted and never returned or stored raw");

  const rotatedDummyToken = makeDummyToken(runId, "rotated");
  const rotated = await notificationOperation(context, ownerToken, {
    ...registerBody,
    request_id: crypto.randomUUID(),
    provider_token: rotatedDummyToken
  });
  safeCheck(
    rotated.status === 200,
    "installation_rotation_status",
    "NOTIFICATION_ROTATION_FAILED"
  );
  const endpointsAfterRotation = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${owner.id}&select=endpoint_id,token_fingerprint,token_ciphertext`
  );
  safeCheck(
    endpointsAfterRotation.length === 1,
    "installation_rotation_count",
    "NOTIFICATION_ROTATION_DUPLICATE"
  );
  safeCheck(
    endpointsAfterRotation[0].token_fingerprint
      === await sha256(rotatedDummyToken),
    "installation_rotation_fingerprint",
    "NOTIFICATION_ROTATION_FINGERPRINT_MISMATCH"
  );
  safeCheck(
    !endpointsAfterRotation[0].token_ciphertext.includes(rotatedDummyToken),
    "installation_rotation_ciphertext",
    "NOTIFICATION_ROTATION_CIPHERTEXT_EXPOSED"
  );
  pass(context, "Installation rotation replaces the endpoint atomically");

  await assertRemovalAction(
    context,
    ownerToken,
    owner.id,
    installationId,
    "permission_revoked",
    runId
  );
  await registerDummy(context, ownerToken, installationId, runId, "logout");
  await assertRemovalAction(
    context,
    ownerToken,
    owner.id,
    installationId,
    "logout",
    runId
  );

  await registerDummy(context, ownerToken, installationId, runId, "invalid");
  await serviceUnregister(
    context,
    owner.id,
    installationId,
    "provider_invalid"
  );
  await assertNoEndpoints(context, owner.id);

  await registerDummy(context, ownerToken, installationId, runId, "deletion");
  const deletionRequestId = crypto.randomUUID();
  const deletionDigest = await sha256(
    ["account_deleted", owner.id, deletionRequestId].join("\n")
  );
  await serviceRequest(
    context,
    "/rest/v1/rpc/remove_notification_devices_for_account",
    {
      method: "POST",
      body: {
        p_user_id: owner.id,
        p_request_id: deletionRequestId,
        p_request_digest: deletionDigest
      }
    }
  );
  await assertNoEndpoints(context, owner.id);
  pass(
    context,
    "Permission revocation, logout, provider invalidation, and account deletion remove endpoints"
  );

  await verifyMetadataAllowlist(context, owner.id);
  pass(context, "Audit metadata rejects unapproved or content-bearing fields");

  await registerDummy(context, ownerToken, installationId, runId, "prune");
  await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${owner.id}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        last_seen_at: new Date(Date.now() - 91 * 86_400_000).toISOString()
      }
    }
  );
  const auditRows = await serviceRequest(
    context,
    `/rest/v1/notification_audit_events?user_id=eq.${owner.id}&select=event_id&limit=1`
  );
  safeCheck(
    auditRows.length === 1,
    "retention_audit_fixture",
    "NOTIFICATION_RETENTION_AUDIT_MISSING"
  );
  const controlledNow = Date.now();
  const oldAuditCreatedAt = new Date(
    controlledNow - 91 * 86_400_000
  ).toISOString();
  const oldAuditRetention = new Date(
    controlledNow - 2 * 86_400_000
  ).toISOString();
  await serviceRequest(
    context,
    `/rest/v1/notification_audit_events?event_id=eq.${auditRows[0].event_id}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        created_at: oldAuditCreatedAt,
        retention_until: oldAuditRetention
      }
    }
  );
  await serviceRequest(
    context,
    `/rest/v1/notification_registration_requests?user_id=eq.${owner.id}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        created_at: new Date(Date.now() - 91 * 86_400_000).toISOString()
      }
    }
  );
  await serviceRequest(
    context,
    "/rest/v1/rpc/prune_inactive_notification_foundation",
    { method: "POST", body: {} }
  );
  await assertNoEndpoints(context, owner.id);
  const oldAudit = await serviceRequest(
    context,
    `/rest/v1/notification_audit_events?event_id=eq.${auditRows[0].event_id}&select=event_id`
  );
  safeCheck(
    oldAudit.length === 0,
    "retention_audit_pruned",
    "NOTIFICATION_AUDIT_NOT_PRUNED"
  );
  const oldRequests = await serviceRequest(
    context,
    `/rest/v1/notification_registration_requests?user_id=eq.${owner.id}&created_at=lte.${encodeURIComponent(new Date(Date.now() - 90 * 86_400_000).toISOString())}&select=request_id`
  );
  safeCheck(
    oldRequests.length === 0,
    "retention_request_pruned",
    "NOTIFICATION_REQUEST_NOT_PRUNED"
  );
  pass(context, "Controlled clock proves 90-day endpoint and metadata pruning");

  printRedactedEvidence(context);
} finally {
  await cleanupRun(context);
}
  }
);

function assertPlanCoverage(value) {
  safeCheck(
    value.actors.disposable_users === 2,
    "plan_disposable_users",
    "NOTIFICATION_PLAN_ACTORS_INVALID"
  );
  safeCheck(
    value.actors.existing_accounts_allowed === false,
    "plan_existing_accounts",
    "NOTIFICATION_PLAN_EXISTING_ACCOUNTS_ALLOWED"
  );
  safeCheck(
    value.actors.real_device_tokens_allowed === false,
    "plan_real_tokens",
    "NOTIFICATION_PLAN_REAL_TOKENS_ALLOWED"
  );
  for (const [boundary, errorCode] of [
    ["provider_delivery", "NOTIFICATION_PLAN_PROVIDER_ENABLED"],
    ["permission_request", "NOTIFICATION_PLAN_PERMISSION_ENABLED"],
    ["scheduler", "NOTIFICATION_PLAN_SCHEDULER_ENABLED"],
    ["notification_send", "NOTIFICATION_PLAN_SEND_ENABLED"],
    ["migration_apply", "NOTIFICATION_PLAN_MIGRATION_ENABLED"],
    ["function_deploy", "NOTIFICATION_PLAN_DEPLOY_ENABLED"]
  ]) {
    safeCheck(
      value.boundaries[boundary] === false,
      "plan_inactive_boundary",
      errorCode
    );
  }
  for (const required of [
    "owner_second_user_anonymous_rls",
    "concurrent_registration_race",
    "idempotent_registration",
    "installation_token_rotation",
    "logout_removal",
    "permission_revocation_removal",
    "provider_invalid_removal",
    "account_deletion_removal",
    "encrypted_storage_without_raw_token",
    "audit_metadata_allowlist",
    "controlled_clock_90_day_pruning",
    "run_scoped_cleanup"
  ]) {
    safeCheck(
      value.checks.includes(required),
      "plan_case_coverage",
      "NOTIFICATION_PLAN_CASE_MISSING"
    );
  }
}

async function verifyRegistryAndRls(context, ownerToken, secondToken) {
  const registry = await serviceRequest(
    context,
    "/rest/v1/notification_type_registry?select=notification_type,enabled&order=notification_type.asc"
  );
  safeCheck(
    registry.length === 2
      && registry[0]?.notification_type === "care_circle_check_in"
      && registry[0]?.enabled === false
      && registry[1]?.notification_type === "care_circle_reminder"
      && registry[1]?.enabled === false,
    "inactive_registry",
    "NOTIFICATION_REGISTRY_INVALID"
  );

  for (const path of [
    "/rest/v1/notification_device_endpoints?select=endpoint_id",
    "/rest/v1/notification_registration_requests?select=request_id",
    "/rest/v1/notification_audit_events?select=event_id"
  ]) {
    const ownerResult = await userRequest(context, ownerToken, path);
    const secondResult = await userRequest(context, secondToken, path);
    const anonymousResult = await anonymousRequest(context, path);
    safeCheck(
      !ownerResult.ok,
      "owner_storage_denial",
      "NOTIFICATION_OWNER_STORAGE_EXPOSED"
    );
    safeCheck(
      !secondResult.ok,
      "second_user_storage_denial",
      "NOTIFICATION_SECOND_USER_STORAGE_EXPOSED"
    );
    safeCheck(
      !anonymousResult.ok,
      "anonymous_storage_denial",
      "NOTIFICATION_ANONYMOUS_STORAGE_EXPOSED"
    );
  }

  const rejectedType = await userRequest(
    context,
    ownerToken,
    "/rest/v1/rpc/disable_notification_preferences",
    {
      method: "POST",
      body: { p_notification_type: "marketing" }
    }
  );
  safeCheck(
    !rejectedType.ok,
    "notification_type_rejection",
    "NOTIFICATION_TYPE_REJECTION_FAILED"
  );
}

async function notificationOperation(context, token, body) {
  return invokeFunction(context, "notification-device", token, body);
}

async function verifyEncryptedStorage(context, userId, dummyToken) {
  const rows = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${userId}&select=token_fingerprint,token_ciphertext`
  );
  safeCheck(
    rows.length === 1,
    "encrypted_storage_count",
    "NOTIFICATION_ENCRYPTED_STORAGE_MISSING"
  );
  safeCheck(
    rows[0].token_fingerprint === await sha256(dummyToken),
    "encrypted_storage_fingerprint",
    "NOTIFICATION_FINGERPRINT_MISMATCH"
  );
  safeCheck(
    rows[0].token_ciphertext !== dummyToken,
    "encrypted_storage_ciphertext",
    "NOTIFICATION_CIPHERTEXT_RAW"
  );
  safeCheck(
    !rows[0].token_ciphertext.includes(dummyToken),
    "encrypted_storage_token_absent",
    "NOTIFICATION_TOKEN_EXPOSED"
  );
}

async function registerDummy(
  context,
  ownerToken,
  installationId,
  runId,
  label
) {
  const result = await notificationOperation(context, ownerToken, {
    action: "register",
    request_id: crypto.randomUUID(),
    installation_id: installationId,
    platform: "ios",
    provider: "expo",
    provider_token: makeDummyToken(runId, label),
    permission_status: "granted",
    app_version: "s2-evidence",
    device_locale: "en-HK"
  });
  safeCheck(
    result.status === 200,
    "dummy_registration",
    "NOTIFICATION_DUMMY_REGISTRATION_FAILED"
  );
}

async function assertRemovalAction(
  context,
  ownerToken,
  userId,
  installationId,
  action,
  runId
) {
  const result = await notificationOperation(context, ownerToken, {
    action,
    request_id: crypto.randomUUID(),
    installation_id: installationId
  });
  safeCheck(
    result.status === 200,
    "device_removal",
    "NOTIFICATION_DEVICE_REMOVAL_FAILED"
  );
  await assertNoEndpoints(context, userId);
  if (action !== "logout") {
    await registerDummy(context, ownerToken, installationId, runId, action);
  }
}

async function serviceUnregister(
  context,
  userId,
  installationId,
  reason
) {
  const requestId = crypto.randomUUID();
  const requestDigest = await sha256(
    [reason, userId, installationId, requestId].join("\n")
  );
  await serviceRequest(
    context,
    "/rest/v1/rpc/unregister_notification_device_endpoint",
    {
      method: "POST",
      body: {
        p_user_id: userId,
        p_request_id: requestId,
        p_request_digest: requestDigest,
        p_installation_id: installationId,
        p_reason: reason
      }
    }
  );
}

async function assertNoEndpoints(context, userId) {
  const rows = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${userId}&select=endpoint_id`
  );
  safeCheck(
    rows.length === 0,
    "endpoint_removal",
    "NOTIFICATION_ENDPOINT_REMAINS"
  );
}

async function verifyMetadataAllowlist(context, userId) {
  const result = await serviceRequest(
    context,
    "/rest/v1/notification_audit_events",
    {
      method: "POST",
      allowFailure: true,
      body: {
        user_id: userId,
        event_type: "preference_disabled",
        metadata: {
          message: "forbidden content"
        }
      }
    }
  );
  safeCheck(
    !result.ok,
    "metadata_allowlist",
    "NOTIFICATION_METADATA_ACCEPTED"
  );
}

function makeDummyToken(runId, label) {
  return `S2_DUMMY_TOKEN_${runId}_${label}`;
}
