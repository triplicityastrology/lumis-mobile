import assert from "node:assert/strict";

export const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";

export function parseEvidenceArgs(values, suiteName) {
  const args = {
    execute: false,
    cleanup: false,
    projectRef: "",
    runId: ""
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--execute") args.execute = true;
    else if (value === "--cleanup") args.cleanup = true;
    else if (value === "--project-ref") args.projectRef = values[++index] ?? "";
    else if (value === "--run-id") args.runId = values[++index] ?? "";
    else throw new Error(`Unknown ${suiteName} evidence argument.`);
  }

  assert.equal(
    args.projectRef,
    STAGING_PROJECT_REF,
    "Refusing evidence harness: project ref is not the approved Lumis staging project."
  );

  if (args.cleanup && !args.execute) {
    throw new Error("Cleanup requires the explicit --execute gate.");
  }
  if (args.cleanup && !/^[0-9]{13}-[a-f0-9]+$/.test(args.runId)) {
    throw new Error("Cleanup requires a valid redacted run ID.");
  }
  if (args.execute && process.env.S2_EVIDENCE_EXECUTE !== "CONFIRMED") {
    throw new Error(
      "Execute mode is disabled. Use the hidden-input staging wrapper after PM authorization."
    );
  }

  return args;
}

export async function createStagingContext(suite, runId) {
  const secretKey = requireHiddenEnvironment("S2_STAGING_SECRET_KEY", "sb_secret_");
  const publishableKey = requireHiddenEnvironment(
    "S2_STAGING_PUBLISHABLE_KEY",
    "sb_publishable_"
  );
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return {
    suite,
    runId,
    supabaseUrl,
    secretKey,
    publishableKey,
    adminClient,
    createdUserIds: [],
    checks: []
  };
}

export async function verifyAdminAccess(context) {
  const { error } = await context.adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1
  });
  assert(!error, "Dedicated staging QA key cannot use Auth Admin.");
}

export async function createDisposableUser(context, role, password) {
  const email = `lumis.${context.suite}.${role}.${context.runId}@example.com`;
  const { data, error } = await context.adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      s2_evidence_suite: context.suite,
      s2_evidence_run_id: context.runId,
      s2_evidence_role: role
    }
  });
  assert(!error && data.user, `Unable to create disposable ${role} account.`);
  context.createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

export async function signIn(context, email, password) {
  const response = await fetch(
    `${context.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: context.publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    }
  );
  const body = await response.json().catch(() => null);
  assert(response.ok && body?.access_token, "Disposable account sign-in failed.");
  return body.access_token;
}

export async function invokeFunction(context, name, accessToken, body) {
  const response = await fetch(`${context.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: context.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.json().catch(() => null)
  };
}

export async function serviceRequest(context, path, options = {}) {
  const response = await fetch(`${context.supabaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: context.secretKey,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const body = await response.json().catch(() => null);
  if (options.allowFailure) {
    return { ok: response.ok, status: response.status, body };
  }
  assert(response.ok, `Service assertion failed for ${redactPath(path)}.`);
  return body;
}

export async function userRequest(
  context,
  accessToken,
  path,
  options = {}
) {
  const response = await fetch(`${context.supabaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: context.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.json().catch(() => null)
  };
}

export async function anonymousRequest(context, path) {
  const response = await fetch(`${context.supabaseUrl}${path}`, {
    headers: {
      apikey: context.publishableKey,
      "Content-Type": "application/json"
    }
  });
  return { ok: response.ok, status: response.status };
}

export async function cleanupRun(context) {
  for (const userId of [...context.createdUserIds].reverse()) {
    await deleteDisposableUser(context, userId);
  }
  context.createdUserIds.length = 0;
}

export async function cleanupInterruptedRun(context) {
  const { data, error } = await context.adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  assert(!error, "Unable to inspect disposable users for cleanup.");
  const users = data.users.filter(
    (user) =>
      user.user_metadata?.s2_evidence_suite === context.suite
      && user.user_metadata?.s2_evidence_run_id === context.runId
  );
  for (const user of users) await deleteDisposableUser(context, user.id);
  return users.length;
}

export function pass(context, assertionName) {
  context.checks.push(assertionName);
}

export function printRedactedEvidence(context) {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    suite: context.suite,
    run_id: context.runId,
    checks: context.checks
  }, null, 2)}\n`);
}

export function makeRunId() {
  return `${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function makePassword() {
  return `Lumis-S2-${crypto.randomUUID()}!`;
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function deleteDisposableUser(context, userId) {
  await serviceRequest(context, `/rest/v1/users?id=eq.${userId}`, {
    method: "DELETE",
    prefer: "return=minimal",
    allowFailure: true
  });
  const { error } = await context.adminClient.auth.admin.deleteUser(userId);
  assert(!error, "Unable to delete a disposable Auth account.");
}

function requireHiddenEnvironment(name, prefix) {
  const value = process.env[name]?.trim();
  if (!value?.startsWith(prefix)) {
    throw new Error(`${name} must be supplied through the hidden staging wrapper.`);
  }
  return value;
}

function redactPath(path) {
  return path.split("?")[0];
}
