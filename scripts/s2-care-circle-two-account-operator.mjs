import { createClient } from "@supabase/supabase-js";

import {
  discoverExactRunUsers,
  TWO_ACCOUNT_PROJECT_REF,
  validateExactRunPair,
  validateRunId,
  validateSetupInput
} from "./lib/care-circle-two-account-operator.mjs";

let args = { execute: false, action: "", projectRef: "", runId: "" };
let runId = "not-started";
try {
  args = parseArgs(process.argv.slice(2));
  runId = args.runId || "not-started";
  if (!args.execute) {
    process.stdout.write("S2_T75_LOCAL_PREFLIGHT_PASS\nnetwork_calls=0\naccounts_created=0\n");
  } else {
    await execute();
  }
} catch {
  process.stderr.write(`STOP_S2_T75_OPERATION_FAILED run_id=${safeRunId(runId)}\n`);
  process.exitCode = 1;
}

async function execute() {
  validateRunId(runId);
  if (args.projectRef !== TWO_ACCOUNT_PROJECT_REF) throw new Error("STOP_S2_T75_WRONG_PROJECT");
  if (process.env.S2_T75_EXECUTE !== "CONFIRMED") throw new Error("STOP_S2_T75_EXECUTE_DISABLED");
  const secretKey = requireEnvironment("S2_T75_SECRET_KEY", "sb_secret_");
  const client = createClient(`https://${TWO_ACCOUNT_PROJECT_REF}.supabase.co`, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  if (args.action === "setup") await setup(client);
  else if (args.action === "cleanup") await cleanup(client);
  else throw new Error("STOP_S2_T75_ACTION_INVALID");
}

async function setup(client) {
  const input = {
    runId,
    projectRef: args.projectRef,
    careeEmail: requireEnvironment("S2_T75_CAREE_EMAIL"),
    careePassword: requireEnvironment("S2_T75_CAREE_PASSWORD"),
    carerEmail: requireEnvironment("S2_T75_CARER_EMAIL"),
    carerPassword: requireEnvironment("S2_T75_CARER_PASSWORD")
  };
  validateSetupInput(input);
  const existing = await findRunUsers(client);
  if (existing.length !== 0) throw new Error("STOP_S2_T75_RUN_ALREADY_EXISTS");
  const created = [];
  try {
    created.push(await createUser(client, "caree", input.careeEmail, input.careePassword));
    created.push(await createUser(client, "carer", input.carerEmail, input.carerPassword));
    await prepareCapabilities(client, created[0], created[1]);
    await verifyCapabilities(client, created[0], created[1]);
    process.stdout.write(`S2_T75_SETUP_READY\nrun_id=${runId}\naccounts_created=2\naccount_modes_verified=2\ncredentials_stored=0\n`);
  } catch (error) {
    await removeUsers(client, created);
    throw error;
  }
}

async function cleanup(client) {
  const users = validateExactRunPair(await findRunUsers(client));
  await removeUsers(client, users.map((user) => user.id));
  const remaining = await findRunUsers(client);
  if (remaining.length !== 0) throw new Error("STOP_S2_T75_AUTH_CLEANUP_INCOMPLETE");
  for (const [table, columns] of [
    ["care_relationships", ["caree_user_id", "carer_user_id"]],
    ["care_relationship_events", ["actor_user_id"]],
    ["care_link_codes", ["caree_user_id", "consumed_by_user_id"]],
    ["care_pairing_code_events", ["caree_user_id", "actor_user_id"]],
    ["care_operation_requests", ["user_id"]],
    ["care_check_settings", ["user_id"]],
    ["care_checkin_rounds", ["caree_user_id"]],
    ["chat_threads", ["user_id"]],
    ["chat_messages", ["user_id"]],
    ["ai_profiles", ["user_id"]],
    ["birth_data", ["user_id"]],
    ["birth_data_history", ["user_id"]],
    ["account_entitlements", ["user_id"]],
    ["users", ["id"]]
  ]) {
    const count = await countRows(client, table, columns, users.map((user) => user.id));
    if (count !== 0) throw new Error("STOP_S2_T75_DATABASE_CLEANUP_INCOMPLETE");
  }
  process.stdout.write(`S2_T75_CLEANUP_COMPLETE\nrun_id=${runId}\nauth_accounts_remaining=0\nrun_rows_remaining=0\n`);
}

async function createUser(client, role, email, password) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { s2_evidence_suite: "s2t75", s2_evidence_run_id: runId, s2_evidence_role: role }
  });
  if (error || !data.user) throw new Error("STOP_S2_T75_ACCOUNT_CREATE_FAILED");
  return data.user.id;
}

async function prepareCapabilities(client, careeId, carerId) {
  await mustSucceed(client.from("users").update({ display_name: "Disposable Caree", account_mode: "standard" }).eq("id", careeId));
  await mustSucceed(client.from("users").update({ display_name: "Disposable Carer", account_mode: "carer_only" }).eq("id", carerId));
  await mustSucceed(client.from("account_entitlements").upsert({
    user_id: careeId,
    plan_tier: "essential",
    product_code: "ESSENTIAL_M",
    status: "active",
    source: "admin"
  }));
  await mustSucceed(client.from("care_check_settings").upsert({
    user_id: careeId,
    enabled: false,
    cadence_days: 2,
    grace_hours: 24,
    timezone: "Etc/UTC"
  }));
}

async function verifyCapabilities(client, careeId, carerId) {
  const { data: users, error: userError } = await client
    .from("users")
    .select("id,account_mode")
    .in("id", [careeId, carerId]);
  if (userError || !Array.isArray(users) || users.length !== 2) {
    throw new Error("STOP_S2_T75_CAPABILITY_VERIFY_FAILED");
  }
  const modes = new Map(users.map((user) => [user.id, user.account_mode]));
  if (modes.get(careeId) !== "standard" || modes.get(carerId) !== "carer_only") {
    throw new Error("STOP_S2_T75_CAPABILITY_VERIFY_FAILED");
  }
  const { count: entitlementCount, error: entitlementError } = await client
    .from("account_entitlements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", careeId)
    .eq("status", "active");
  const { count: settingsCount, error: settingsError } = await client
    .from("care_check_settings")
    .select("*", { count: "exact", head: true })
    .eq("user_id", careeId)
    .eq("enabled", false);
  if (
    entitlementError ||
    settingsError ||
    entitlementCount !== 1 ||
    settingsCount !== 1
  ) {
    throw new Error("STOP_S2_T75_CAPABILITY_VERIFY_FAILED");
  }
}

async function findRunUsers(client) {
  return discoverExactRunUsers(async (page, perPage) => {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("STOP_S2_T75_AUTH_LIST_FAILED");
    return {
      users: data.users,
      total: data.total,
      lastPage: data.lastPage
    };
  }, runId);
}

async function removeUsers(client, ids) {
  for (const id of [...ids].reverse()) {
    await client.from("users").delete().eq("id", id);
    const { error } = await client.auth.admin.deleteUser(id);
    if (error) throw new Error("STOP_S2_T75_ACCOUNT_DELETE_FAILED");
  }
}

async function countRows(client, table, columns, ids) {
  if (ids.length === 0) return 0;
  let total = 0;
  for (const column of columns) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).in(column, ids);
    if (error) throw new Error("STOP_S2_T75_CLEANUP_COUNT_FAILED");
    total += count ?? 0;
  }
  return total;
}

async function mustSucceed(operation) {
  const { error } = await operation;
  if (error) throw new Error("STOP_S2_T75_CAPABILITY_SETUP_FAILED");
}

function requireEnvironment(name, prefix = "") {
  const value = process.env[name];
  if (!value || (prefix && !value.startsWith(prefix))) throw new Error("STOP_S2_T75_HIDDEN_INPUT_REQUIRED");
  return value;
}

function parseArgs(values) {
  const parsed = { execute: false, action: "", projectRef: "", runId: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--execute") parsed.execute = true;
    else if (value === "--action") parsed.action = values[++index] ?? "";
    else if (value === "--project-ref") parsed.projectRef = values[++index] ?? "";
    else if (value === "--run-id") parsed.runId = values[++index] ?? "";
    else throw new Error("STOP_S2_T75_ARGUMENT_INVALID");
  }
  return parsed;
}

function safeRunId(value) {
  return /^s2t75-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(value) ? value : "invalid";
}
