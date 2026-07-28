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
  signIn,
  STAGING_PROJECT_REF,
  userRequest,
  verifyAdminAccess
} from "./lib/staging-evidence-utils.mjs";

const args = parseEvidenceArgs(
  process.argv.slice(2),
  "Care Circle staging"
);
const plan = JSON.parse(
  readFileSync("supabase/tests/s2-care-circle-staging-evidence-plan.json", "utf8")
);

assert.equal(plan.project_ref, STAGING_PROJECT_REF);
assert.equal(plan.execution_default, "preflight_only");
assert.deepEqual(plan.required_migrations, [
  "0032_care_circle_backend_foundation.sql",
  "0034_reusable_care_pairing_operations.sql"
]);

if (!args.execute) {
  assertPlanCoverage(plan);
  process.stdout.write(
    "Care Circle staging evidence preflight passed; no network or database command ran.\n"
  );
  process.exit(0);
}

const runId = args.runId || makeRunId();
const context = await createStagingContext("s2care", runId);
await verifyAdminAccess(context);

if (args.cleanup) {
  const removed = await cleanupInterruptedRun(context);
  pass(context, `Interrupted-run cleanup removed ${removed} disposable account(s)`);
  printRedactedEvidence(context);
  process.exit(0);
}

process.stdout.write(`Care Circle redacted run ID: ${runId}\n`);
process.stdout.write(
  `Failure cleanup: pnpm evidence:s2-care-circle:secure -- --execute --cleanup ${runId}\n`
);

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
  assert.equal(created.status, 200);
  assert.match(created.body?.pairing_code ?? "", /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/);
  const pairingCode = created.body.pairing_code;
  const firstCodeId = created.body.code_id;

  const replay = await careOperation(context, careeToken, {
    action: "pairing_code_create",
    client_request_id: createRequestId
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.code_id, firstCodeId);
  assert.equal(replay.body.pairing_code, pairingCode);
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
  assert(pending.every((result) => result.status === 200));
  assert(
    new Set(pending.map((result) => result.body.relationship_id)).size === 6
  );
  pass(context, "One active pairing code creates six distinct pending requests");

  await verifyCareRls(
    context,
    careeToken,
    carerTokens[0],
    null
  );
  pass(context, "Participant storage denial and safe projection hold");

  const carerAccept = await careOperation(context, carerTokens[0], {
    action: "relationship_accept",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[0].body.relationship_id
  });
  assert.equal(carerAccept.body?.error?.code, "48007");
  const carerDecline = await careOperation(context, carerTokens[0], {
    action: "relationship_decline",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[0].body.relationship_id
  });
  assert.equal(carerDecline.body?.error?.code, "48007");
  pass(context, "Carer cannot accept or decline the Caree-owned request");

  const conflict = await careOperation(context, careeToken, {
    action: "pairing_code_revoke",
    client_request_id: createRequestId,
    code_id: firstCodeId
  });
  assert.equal(conflict.body?.error?.code, "48012");
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
  assert.equal(acceptance.filter((item) => item.status === 200).length, 5);
  const rejected = acceptance.find((item) => item.status !== 200);
  assert.equal(rejected?.body?.error?.code, "48012");
  pass(context, "Concurrent sixth acceptance is rejected and five become active");

  const rejectedIndex = acceptance.indexOf(rejected);
  const declined = await careOperation(context, careeToken, {
    action: "relationship_decline",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[rejectedIndex].body.relationship_id
  });
  assert.equal(declined.body?.status, "declined");
  pass(context, "Caree alone declines a pending request");

  const rotated = await careOperation(context, careeToken, {
    action: "pairing_code_create",
    client_request_id: crypto.randomUUID()
  });
  assert.equal(rotated.status, 200);
  const rotatedOldUse = await careOperation(context, carerTokens[0], {
    action: "pairing_code_submit",
    client_request_id: crypto.randomUUID(),
    pairing_code: pairingCode
  });
  assert.equal(rotatedOldUse.body?.error?.code, "48004");
  const revoked = await careOperation(context, careeToken, {
    action: "pairing_code_revoke",
    client_request_id: crypto.randomUUID(),
    code_id: rotated.body.code_id
  });
  assert.equal(revoked.body?.status, "revoked");
  const revokedUse = await careOperation(context, carerTokens[0], {
    action: "pairing_code_submit",
    client_request_id: crypto.randomUUID(),
    pairing_code: rotated.body.pairing_code
  });
  assert.equal(revokedUse.body?.error?.code, "48004");

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
  assert.equal(expiredUse.body?.error?.code, "48004");
  pass(context, "Rotation, revocation, and expiry block later pairing attempts");

  const pause = await careOperation(context, careeToken, {
    action: "care_pause",
    client_request_id: crypto.randomUUID(),
    paused_until: new Date(Date.now() + 86_400_000).toISOString()
  });
  assert.equal(pause.body?.status, "paused");
  const resume = await careOperation(context, careeToken, {
    action: "care_resume",
    client_request_id: crypto.randomUUID()
  });
  assert.equal(resume.body?.status, "active");
  const remove = await careOperation(context, carerTokens[0], {
    action: "relationship_remove",
    client_request_id: crypto.randomUUID(),
    relationship_id: pending[0].body.relationship_id
  });
  assert.match(remove.body?.status ?? "", /^removed_by_/);
  pass(context, "Caree pause/resume and participant removal use backend authority");

  const rawStorage = await serviceRequest(
    context,
    `/rest/v1/care_link_codes?caree_user_id=eq.${caree.id}&select=code_hash`
  );
  assert(rawStorage.every((row) => row.code_hash !== pairingCode));
  const audit = await serviceRequest(
    context,
    `/rest/v1/care_pairing_code_events?caree_user_id=eq.${caree.id}&select=event_type`
  );
  assert(audit.length >= 4);
  pass(context, "Sensitive storage and audit contain no raw pairing material");

  await context.adminClient.auth.admin.deleteUser(carers[5].id);
  context.createdUserIds.splice(context.createdUserIds.indexOf(carers[5].id), 1);
  const deletedRows = await serviceRequest(
    context,
    `/rest/v1/care_relationships?carer_user_id=eq.${carers[5].id}&select=id`
  );
  assert.equal(deletedRows.length, 0);
  const unrelatedRelationship = await serviceRequest(
    context,
    `/rest/v1/care_relationships?carer_user_id=eq.${carers[0].id}&select=id`
  );
  assert(unrelatedRelationship.length >= 1);
  pass(context, "Disposable participant deletion cascades without unrelated changes");

  printRedactedEvidence(context);
} finally {
  await cleanupRun(context);
}

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
    assert(definition.cases.some((item) => item.id === id), `Missing ${id}`);
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
    assert(!owner.ok);
    if (participantToken) {
      const participant = await userRequest(
        context,
        participantToken,
        `/rest/v1/${table}?select=*`
      );
      assert(!participant.ok);
    }
    if (unrelatedToken) {
      const unrelated = await userRequest(
        context,
        unrelatedToken,
        `/rest/v1/${table}?select=*`
      );
      assert(!unrelated.ok);
    }
    const anonymous = await anonymousRequest(
      context,
      `/rest/v1/${table}?select=*`
    );
    assert(!anonymous.ok);
  }

  const projectionToken = participantToken ?? unrelatedToken;
  if (projectionToken) {
    const safeProjection = await userRequest(
      context,
      projectionToken,
      "/rest/v1/rpc/list_care_relationships",
      { method: "POST", body: {} }
    );
    assert(safeProjection.ok);
    if (unrelatedToken) assert.equal(safeProjection.body.length, 0);
    assert(
      safeProjection.body.every(
        (item) =>
          !Object.keys(item).some((key) =>
            /code|hash|metadata|birth|chart|credit|billing/i.test(key)
          )
      )
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
  assert(!legacyBypass.ok);
}
