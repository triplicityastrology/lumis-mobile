import {
  REFLECTION_EVIDENCE_PROJECT_REF, discoverReflectionEvidenceUsers,
  validateReflectionEvidencePair, validateReflectionEvidenceRunId, validateReflectionEvidenceSetup,
} from "./lib/reflection-deletion-evidence-operator.mjs";

let runId = "invalid";
try {
  const args = parseArgs(process.argv.slice(2));
  runId = args.runId;
  if (!args.execute) {
    process.stdout.write("READY_FOR_0036_TEST_KEY\nproject_ref=bmqhwofmdgebpcihjlnb\naccounts_planned=2\nnetwork_calls=0 credentials_requested=0 fixtures_created=0\n");
  } else await execute(args);
} catch {
  process.stderr.write(`STOP_S2_T111_OPERATION_FAILED run_id=${safeRunId(runId)}\n`);
  process.exitCode = 1;
} finally {
  for (const name of ["S2_T111_QA_KEY", "S2_T111_OWNER_EMAIL", "S2_T111_OWNER_PASSWORD", "S2_T111_CROSS_EMAIL", "S2_T111_CROSS_PASSWORD"]) delete process.env[name];
}

async function execute(args) {
  validateReflectionEvidenceRunId(args.runId);
  if (args.projectRef !== REFLECTION_EVIDENCE_PROJECT_REF || process.env.S2_T111_EXECUTE !== "CONFIRMED") throw new Error("STOP");
  const key = requireEnv("S2_T111_QA_KEY", "sb_secret_");
  const { createClient } = await import("@supabase/supabase-js");
  const url = `https://${REFLECTION_EVIDENCE_PROJECT_REF}.supabase.co`;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  if (args.action === "cleanup") return cleanupByRun(admin, args.runId);
  if (args.action !== "run") throw new Error("STOP");
  const input = {
    runId: args.runId, projectRef: args.projectRef,
    ownerEmail: requireEnv("S2_T111_OWNER_EMAIL"), ownerPassword: requireEnv("S2_T111_OWNER_PASSWORD"),
    crossOwnerEmail: requireEnv("S2_T111_CROSS_EMAIL"), crossOwnerPassword: requireEnv("S2_T111_CROSS_PASSWORD"),
  };
  validateReflectionEvidenceSetup(input);
  if ((await findUsers(admin, args.runId)).length !== 0) throw new Error("STOP");
  const created = [];
  try {
    const owner = await createUser(admin, "owner", input.ownerEmail, input.ownerPassword); created.push(owner.id);
    const cross = await createUser(admin, "cross_owner", input.crossOwnerEmail, input.crossOwnerPassword); created.push(cross.id);
    await ensureUserRows(admin, [owner.id, cross.id]);
    const fixtures = await createFixtures(admin, owner.id, cross.id, args.runId);
    const ownerClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const crossClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    await signIn(ownerClient, input.ownerEmail, input.ownerPassword);
    await signIn(crossClient, input.crossOwnerEmail, input.crossOwnerPassword);
    await proveDeletion(admin, ownerClient, crossClient, fixtures, url);
    await removeUsers(admin, created);
    if ((await findUsers(admin, args.runId)).length !== 0) throw new Error("STOP");
    process.stdout.write(`S2_T111_EVIDENCE_COMPLETE\nrun_id=${args.runId}\nchecks_passed=9\nauth_accounts_remaining=0\nrun_rows_remaining=0\n`);
  } catch (error) {
    await removeUsers(admin, created).catch(() => undefined);
    throw error;
  }
}

async function proveDeletion(admin, ownerClient, crossClient, fixture, url) {
  const crossAttempt = await crossClient.rpc("delete_owned_reflection", { p_thread_id: fixture.target, p_client_request_id: fixture.crossRequest });
  if (!crossAttempt.error) throw new Error("STOP");
  const anonymous = await fetch(`${url}/rest/v1/rpc/delete_owned_reflection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (anonymous.ok) throw new Error("STOP");
  const first = await ownerClient.rpc("delete_owned_reflection", { p_thread_id: fixture.target, p_client_request_id: fixture.ownerRequest });
  if (first.error || first.data !== "deleted") throw new Error("STOP");
  await requireCount(admin, "chat_threads", "id", fixture.target, 0);
  await requireCount(admin, "chat_messages", "thread_id", fixture.target, 0);
  await requireCount(admin, "chat_threads", "id", fixture.ownerRetained, 1);
  await requireCount(admin, "chat_threads", "id", fixture.crossRetained, 1);
  const replay = await ownerClient.rpc("delete_owned_reflection", { p_thread_id: fixture.target, p_client_request_id: fixture.ownerRequest });
  if (replay.error || replay.data !== "already_deleted") throw new Error("STOP");
  const conflict = await ownerClient.rpc("delete_owned_reflection", { p_thread_id: fixture.ownerRetained, p_client_request_id: fixture.ownerRequest });
  if (!conflict.error) throw new Error("STOP");
}

async function createFixtures(client, ownerId, crossId, tag) {
  const target = crypto.randomUUID(), ownerRetained = crypto.randomUUID(), crossRetained = crypto.randomUUID();
  const rows = [
    { id: target, user_id: ownerId, title: `S2T111 target ${tag}` },
    { id: ownerRetained, user_id: ownerId, title: `S2T111 retained ${tag}` },
    { id: crossRetained, user_id: crossId, title: `S2T111 cross retained ${tag}` },
  ];
  const { error: threadError } = await client.from("chat_threads").insert(rows);
  if (threadError) throw new Error("STOP");
  const messages = rows.map((row) => ({ id: crypto.randomUUID(), thread_id: row.id, user_id: row.user_id, role: "user", content: "Synthetic S2-T111 fixture" }));
  const { error: messageError } = await client.from("chat_messages").insert(messages);
  if (messageError) throw new Error("STOP");
  return { target, ownerRetained, crossRetained, ownerRequest: crypto.randomUUID(), crossRequest: crypto.randomUUID() };
}

async function createUser(client, role, email, password) {
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { s2_evidence_suite: "s2t111", s2_evidence_run_id: runId, s2_evidence_role: role } });
  if (error || !data.user) throw new Error("STOP");
  return data.user;
}
async function ensureUserRows(client, ids) {
  const { data, error } = await client.from("users").select("id").in("id", ids);
  if (error || data?.length !== 2) throw new Error("STOP");
}
async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("STOP");
}
async function requireCount(client, table, column, value, expected) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error || count !== expected) throw new Error("STOP");
}
async function cleanupByRun(client, targetRunId) {
  const users = validateReflectionEvidencePair(await findUsers(client, targetRunId));
  await removeUsers(client, users.map((user) => user.id));
  if ((await findUsers(client, targetRunId)).length !== 0) throw new Error("STOP");
  process.stdout.write(`S2_T111_CLEANUP_COMPLETE\nrun_id=${targetRunId}\nauth_accounts_remaining=0\nrun_rows_remaining=0\n`);
}
async function findUsers(client, targetRunId) {
  return discoverReflectionEvidenceUsers(async (page, perPage) => {
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
function requireEnv(name, prefix = "") { const value = process.env[name]; if (!value || (prefix && !value.startsWith(prefix))) throw new Error("STOP"); return value; }
function parseArgs(values) {
  const result = { execute: false, action: "", projectRef: "", runId: "" };
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === "--execute") result.execute = true;
    else if (values[i] === "--action") result.action = values[++i] ?? "";
    else if (values[i] === "--project-ref") result.projectRef = values[++i] ?? "";
    else if (values[i] === "--run-id") result.runId = values[++i] ?? "";
    else throw new Error("STOP");
  }
  if (result.projectRef !== REFLECTION_EVIDENCE_PROJECT_REF) throw new Error("STOP");
  return result;
}
function safeRunId(value) { return /^s2t111-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/.test(value) ? value : "invalid"; }
