import {
  PROFILE_TEST_PROJECT_REF, discoverProfileTestUsers, validateProfileTestPair,
  validateProfileTestRunId, validateProfileTestSetup,
} from "./lib/profile-test-account-operator.mjs";

let runId = "invalid";
try {
  const args = parseArgs(process.argv.slice(2));
  runId = args.runId;
  if (!args.execute) {
    process.stdout.write("READY_FOR_PROFILE_TEST_KEY\nproject_ref=bmqhwofmdgebpcihjlnb\naccounts_planned=2\nnetwork_calls=0 credentials_requested=0 accounts_created=0\n");
  } else {
    await execute(args);
  }
} catch {
  process.stderr.write(`STOP_S2_T110_OPERATION_FAILED run_id=${safeRunId(runId)}\n`);
  process.exitCode = 1;
} finally {
  for (const name of ["S2_T110_QA_KEY", "S2_T110_TIMED_EMAIL", "S2_T110_TIMED_PASSWORD", "S2_T110_NO_TIME_EMAIL", "S2_T110_NO_TIME_PASSWORD"]) delete process.env[name];
}

async function execute(args) {
  validateProfileTestRunId(args.runId);
  if (args.projectRef !== PROFILE_TEST_PROJECT_REF || process.env.S2_T110_EXECUTE !== "CONFIRMED") throw new Error("STOP");
  const key = requireEnv("S2_T110_QA_KEY", "sb_secret_");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(`https://${PROFILE_TEST_PROJECT_REF}.supabase.co`, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  if (args.action === "setup") await setup(client, args);
  else if (args.action === "cleanup") await cleanup(client, args.runId);
  else throw new Error("STOP");
}

async function setup(client, args) {
  const input = {
    runId: args.runId, projectRef: args.projectRef,
    timedEmail: requireEnv("S2_T110_TIMED_EMAIL"), timedPassword: requireEnv("S2_T110_TIMED_PASSWORD"),
    noTimeEmail: requireEnv("S2_T110_NO_TIME_EMAIL"), noTimePassword: requireEnv("S2_T110_NO_TIME_PASSWORD"),
  };
  validateProfileTestSetup(input);
  if ((await findUsers(client, args.runId)).length !== 0) throw new Error("STOP");
  const created = [];
  try {
    created.push(await createUser(client, "timed", input.timedEmail, input.timedPassword));
    created.push(await createUser(client, "no_time", input.noTimeEmail, input.noTimePassword));
    await setAndVerifyEmptyStandardAccounts(client, created);
    process.stdout.write(`S2_T110_SETUP_READY\nrun_id=${args.runId}\naccounts_created=2\nempty_profile_accounts_verified=2\ncredentials_stored=0\n`);
  } catch (error) {
    await removeUsers(client, created);
    throw error;
  }
}

async function cleanup(client, targetRunId) {
  const users = validateProfileTestPair(await findUsers(client, targetRunId));
  const ids = users.map((user) => user.id);
  await removeUsers(client, ids);
  if ((await findUsers(client, targetRunId)).length !== 0) throw new Error("STOP");
  for (const table of ["users", "birth_data", "birth_data_history", "ai_profiles", "chat_threads", "chat_messages", "account_entitlements"]) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).in(table === "users" ? "id" : "user_id", ids);
    if (error || count !== 0) throw new Error("STOP");
  }
  process.stdout.write(`S2_T110_CLEANUP_COMPLETE\nrun_id=${targetRunId}\nauth_accounts_remaining=0\nrun_rows_remaining=0\n`);
}

async function createUser(client, role, email, password) {
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { s2_evidence_suite: "s2t110", s2_evidence_run_id: runId, s2_evidence_role: role } });
  if (error || !data.user) throw new Error("STOP");
  return data.user.id;
}

async function setAndVerifyEmptyStandardAccounts(client, ids) {
  const { error: updateError } = await client.from("users").update({ account_mode: "standard" }).in("id", ids);
  if (updateError) throw new Error("STOP");
  const { data: users, error: usersError } = await client.from("users").select("id,account_mode").in("id", ids);
  if (usersError || users?.length !== 2 || users.some((user) => user.account_mode !== "standard")) throw new Error("STOP");
  for (const table of ["birth_data", "birth_data_history", "ai_profiles", "chat_threads"]) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).in("user_id", ids);
    if (error || count !== 0) throw new Error("STOP");
  }
}

async function findUsers(client, targetRunId) {
  return discoverProfileTestUsers(async (page, perPage) => {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("STOP");
    return { users: data.users, total: data.total, lastPage: data.lastPage };
  }, targetRunId);
}

async function removeUsers(client, ids) {
  for (const id of [...ids].reverse()) {
    await client.from("users").delete().eq("id", id);
    const { error } = await client.auth.admin.deleteUser(id);
    if (error) throw new Error("STOP");
  }
}

function requireEnv(name, prefix = "") {
  const value = process.env[name];
  if (!value || (prefix && !value.startsWith(prefix))) throw new Error("STOP");
  return value;
}

function parseArgs(values) {
  const result = { execute: false, action: "", projectRef: "", runId: "" };
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === "--execute") result.execute = true;
    else if (values[i] === "--action") result.action = values[++i] ?? "";
    else if (values[i] === "--project-ref") result.projectRef = values[++i] ?? "";
    else if (values[i] === "--run-id") result.runId = values[++i] ?? "";
    else throw new Error("STOP");
  }
  if (result.projectRef !== PROFILE_TEST_PROJECT_REF) throw new Error("STOP");
  return result;
}

function safeRunId(value) { return /^s2t110-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(value) ? value : "invalid"; }
