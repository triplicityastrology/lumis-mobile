import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "bmqhwofmdgebpcihjlnb";
const supabaseUrl = `https://${projectRef}.supabase.co`;
const anonKey = requireEnvironment("SUPABASE_ANON_KEY");
const secretKey = requireSecretKey();
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `lumis.qa.prof2-worker-config.${runId}@example.com`;
const password = `Lumis-QA-${crypto.randomUUID()}!`;
const workerUrl = "https://lumis-chart-staging.triplicityastrology.workers.dev";
const pnpm = "/Users/rubyku/.local/node22/bin/pnpm";
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
let userId = null;
let workerUrlRemoved = false;

console.log(`Hosted missing-Worker proof run ID: ${runId}`);
console.log(
  `Emergency restore command: ${pnpm} dlx supabase@latest secrets set CHART_WORKER_URL=${workerUrl} --project-ref ${projectRef}`
);

try {
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  assert(!createError && created.user, `Unable to create proof user: ${createError?.code ?? "AUTH_ADMIN_FAILED"}.`);
  userId = created.user.id;

  const session = await signIn(email, password);
  const onboarding = await invokeProfile(session.access_token, {
    display_name: "Staging rollback proof",
    birth_date: "1986-02-20",
    birth_time: "16:55",
    time_unknown: false,
    place_name: "Hong Kong",
    country_code: "HK",
    lat: 22.3193,
    lng: 114.1694,
    tz_str: "Asia/Hong_Kong"
  });
  assert(onboarding.status === 200 && onboarding.body?.chart_version === 1, "Proof onboarding failed.");

  const before = await loadAuthoritativeState(userId);
  assert(before.birth.successful_change_count === 0, "Proof user did not start with zero changes.");
  assert(before.histories.length === 1 && before.profiles.length === 1, "Proof user did not start at version one.");

  runSupabaseCli(["secrets", "unset", "CHART_WORKER_URL", "--project-ref", projectRef, "--yes"]);
  workerUrlRemoved = true;
  await sleep(20_000);

  const requestId = crypto.randomUUID();
  const failedChange = await invokeProfile(session.access_token, {
    client_request_id: requestId,
    birth_date: "1986-02-21",
    birth_time: "09:30",
    time_unknown: false,
    place_name: "London, UK",
    country_code: "GB",
    lat: 51.5072,
    lng: -0.1276,
    tz_str: "Europe/London"
  }, "/birth-details/change");
  assert(
    failedChange.status === 502 && failedChange.body?.error?.code === "49003",
    `Missing Worker configuration returned HTTP ${failedChange.status} / ${failedChange.body?.error?.code ?? "UNKNOWN"}.`
  );

  const after = await loadAuthoritativeState(userId);
  assert(after.birth.successful_change_count === 0, "Worker configuration failure consumed a lifetime change.");
  assert(after.birth.active_chart_version === 1, "Worker configuration failure changed the active chart.");
  assert(after.histories.length === 1 && after.profiles.length === 1, "Worker configuration failure committed a new version.");
  assert(
    !containsFixture(after.histories) && !containsFixture(after.profiles),
    "Worker configuration failure committed fixture data."
  );

  const requests = await serviceSelect(
    "birth_detail_change_requests",
    `user_id=eq.${userId}&request_id=eq.${requestId}&select=status,error_code`
  );
  assert(
    requests.length === 1 && requests[0].status === "failed" && requests[0].error_code === "CHART_WORKER_FAILED",
    "Worker configuration failure did not release the reservation safely."
  );

  console.log(JSON.stringify({
    ok: true,
    scope: "prof2_missing_worker_configuration",
    checks: [
      "Missing Worker configuration returns 49003",
      "Previous chart and profile remain active",
      "Lifetime change count remains unchanged",
      "No chart/profile version or fixture is committed",
      "Failed reservation records only a safe error code"
    ]
  }, null, 2));
} finally {
  let restoreError = null;
  if (workerUrlRemoved) {
    try {
      runSupabaseCli([
        "secrets",
        "set",
        `CHART_WORKER_URL=${workerUrl}`,
        "--project-ref",
        projectRef
      ]);
      await sleep(20_000);
    } catch (error) {
      restoreError = error;
    }
  }
  if (userId) {
    await cleanupUser(userId).catch((error) => {
      console.error("Proof-user cleanup requires the printed run ID.", error instanceof Error ? error.message : "CLEANUP_FAILED");
    });
  }
  if (restoreError) {
    throw new Error("CHART_WORKER_URL restoration failed. Run the printed emergency restore command immediately.");
  }
}

async function signIn(userEmail, userPassword) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: userEmail, password: userPassword })
  });
  const body = await response.json();
  assert(response.ok, `Unable to sign in proof user: ${body?.error_code ?? response.status}.`);
  return body;
}

async function invokeProfile(accessToken, body, suffix = "") {
  const response = await fetch(`${supabaseUrl}/functions/v1/profile${suffix}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function loadAuthoritativeState(targetUserId) {
  const [birthRows, histories, profiles] = await Promise.all([
    serviceSelect(
      "birth_data",
      `user_id=eq.${targetUserId}&select=successful_change_count,active_chart_version`
    ),
    serviceSelect(
      "birth_data_history",
      `user_id=eq.${targetUserId}&select=chart_version,status,chart_json`
    ),
    serviceSelect(
      "ai_profiles",
      `user_id=eq.${targetUserId}&select=chart_version,is_active,chart_json`
    )
  ]);
  assert(birthRows.length === 1, "Authoritative birth state is missing.");
  return { birth: birthRows[0], histories, profiles };
}

async function serviceSelect(table, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders()
  });
  const body = await response.json();
  assert(response.ok, `Unable to inspect ${table}: HTTP ${response.status}.`);
  return body;
}

async function cleanupUser(targetUserId) {
  for (const [table, column] of [
    ["external_sync_events", "user_id"],
    ["account_deletion_requests", "user_id"],
    ["users", "id"]
  ]) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${targetUserId}`, {
      method: "DELETE",
      headers: serviceHeaders()
    });
    assert(response.ok, `Unable to clean ${table}: HTTP ${response.status}.`);
  }

  for (let attempt = 1; attempt <= 7; attempt += 1) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
      method: "DELETE",
      headers: serviceHeaders()
    });
    const body = await response.json().catch(() => null);
    if (response.ok || response.status === 404) return;
    if (response.status === 403 && body?.error_code === "bad_jwt" && attempt < 7) {
      await sleep(5_000);
      continue;
    }
    throw new Error(`Unable to clean Auth user: ${body?.error_code ?? response.status}.`);
  }
}

function runSupabaseCli(args) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.SUPABASE_SECRET_KEY;
  delete childEnvironment.SUPABASE_ANON_KEY;
  execFileSync(pnpm, ["dlx", "supabase@latest", ...args], {
    cwd: process.cwd(),
    env: childEnvironment,
    stdio: "inherit"
  });
}

function serviceHeaders() {
  return { apikey: secretKey, "Content-Type": "application/json" };
}

function containsFixture(value) {
  return JSON.stringify(value).includes('"source":"fixture"') ||
    JSON.stringify(value).includes("fixture_worker_not_configured");
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requireSecretKey() {
  const value = requireEnvironment("SUPABASE_SECRET_KEY");
  if (!value.startsWith("sb_secret_")) throw new Error("A dedicated sb_secret_ key is required.");
  return value;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
