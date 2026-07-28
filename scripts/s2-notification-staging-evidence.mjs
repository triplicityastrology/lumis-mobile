import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

assert.equal(plan.project_ref, STAGING_PROJECT_REF);
assert.equal(plan.execution_default, "preflight_only");
assert.deepEqual(plan.required_migrations, [
  "0033_inactive_notification_foundation.sql"
]);

if (!args.execute) {
  assertPlanCoverage(plan);
  process.stdout.write(
    "Notification staging evidence preflight passed; no network or database command ran.\n"
  );
  process.exit(0);
}

const runId = args.runId || makeRunId();
const context = await createStagingContext("s2notify", runId);
await verifyAdminAccess(context);

if (args.cleanup) {
  const removed = await cleanupInterruptedRun(context);
  pass(context, `Interrupted-run cleanup removed ${removed} disposable account(s)`);
  printRedactedEvidence(context);
  process.exit(0);
}

process.stdout.write(`Notification redacted run ID: ${runId}\n`);
process.stdout.write(
  `Failure cleanup: pnpm evidence:s2-notification:secure -- --execute --cleanup ${runId}\n`
);

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
  assert(raceResults.every((result) => result.status === 200));
  assert(
    raceResults[0].body?.endpoint_id === raceResults[1].body?.endpoint_id,
    "Concurrent registration returned different endpoint records."
  );
  const raceEndpoints = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${secondUser.id}&select=endpoint_id`
  );
  assert.equal(raceEndpoints.length, 1);
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
  assert.equal(registered.status, 200);
  assert.equal(registered.body?.registered, true);
  const replay = await notificationOperation(context, ownerToken, registerBody);
  assert.equal(replay.status, 200);
  assert(
    replay.body?.endpoint_id === registered.body?.endpoint_id,
    "Registration replay returned a different endpoint record."
  );
  const conflict = await notificationOperation(context, ownerToken, {
    ...registerBody,
    provider_token: makeDummyToken(runId, "changed")
  });
  assert.equal(conflict.status, 409);
  assert.equal(
    conflict.body?.error?.code,
    "NOTIFICATION_REQUEST_ID_CONFLICT"
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
  assert.equal(rotated.status, 200);
  const endpointsAfterRotation = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${owner.id}&select=endpoint_id,token_fingerprint,token_ciphertext`
  );
  assert.equal(endpointsAfterRotation.length, 1);
  assert(
    endpointsAfterRotation[0].token_fingerprint
      === await sha256(rotatedDummyToken),
    "Rotated endpoint fingerprint did not match the dummy token digest."
  );
  assert(!endpointsAfterRotation[0].token_ciphertext.includes(rotatedDummyToken));
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
  assert.equal(auditRows.length, 1);
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
  assert.equal(oldAudit.length, 0);
  const oldRequests = await serviceRequest(
    context,
    `/rest/v1/notification_registration_requests?user_id=eq.${owner.id}&created_at=lte.${encodeURIComponent(new Date(Date.now() - 90 * 86_400_000).toISOString())}&select=request_id`
  );
  assert.equal(oldRequests.length, 0);
  pass(context, "Controlled clock proves 90-day endpoint and metadata pruning");

  printRedactedEvidence(context);
} finally {
  await cleanupRun(context);
}

function assertPlanCoverage(value) {
  assert.equal(value.actors.disposable_users, 2);
  assert.equal(value.actors.existing_accounts_allowed, false);
  assert.equal(value.actors.real_device_tokens_allowed, false);
  assert.equal(value.boundaries.provider_delivery, false);
  assert.equal(value.boundaries.permission_request, false);
  assert.equal(value.boundaries.scheduler, false);
  assert.equal(value.boundaries.notification_send, false);
  assert.equal(value.boundaries.migration_apply, false);
  assert.equal(value.boundaries.function_deploy, false);
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
    assert(value.checks.includes(required), `Missing notification check ${required}`);
  }
}

async function verifyRegistryAndRls(context, ownerToken, secondToken) {
  const registry = await serviceRequest(
    context,
    "/rest/v1/notification_type_registry?select=notification_type,enabled&order=notification_type.asc"
  );
  assert.deepEqual(registry, [
    { notification_type: "care_circle_check_in", enabled: false },
    { notification_type: "care_circle_reminder", enabled: false }
  ]);

  for (const path of [
    "/rest/v1/notification_device_endpoints?select=endpoint_id",
    "/rest/v1/notification_registration_requests?select=request_id",
    "/rest/v1/notification_audit_events?select=event_id"
  ]) {
    const ownerResult = await userRequest(context, ownerToken, path);
    const secondResult = await userRequest(context, secondToken, path);
    const anonymousResult = await anonymousRequest(context, path);
    assert(!ownerResult.ok);
    assert(!secondResult.ok);
    assert(!anonymousResult.ok);
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
  assert(!rejectedType.ok);
}

async function notificationOperation(context, token, body) {
  return invokeFunction(context, "notification-device", token, body);
}

async function verifyEncryptedStorage(context, userId, dummyToken) {
  const rows = await serviceRequest(
    context,
    `/rest/v1/notification_device_endpoints?user_id=eq.${userId}&select=token_fingerprint,token_ciphertext`
  );
  assert.equal(rows.length, 1);
  assert(
    rows[0].token_fingerprint === await sha256(dummyToken),
    "Stored fingerprint did not match the dummy token digest."
  );
  assert.notEqual(rows[0].token_ciphertext, dummyToken);
  assert(!rows[0].token_ciphertext.includes(dummyToken));
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
  assert.equal(result.status, 200);
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
  assert.equal(result.status, 200);
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
  assert.equal(rows.length, 0);
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
  assert(!result.ok);
}

function makeDummyToken(runId, label) {
  return `S2_DUMMY_TOKEN_${runId}_${label}`;
}
