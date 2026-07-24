import { createClient } from "@supabase/supabase-js";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "bmqhwofmdgebpcihjlnb";
const supabaseUrl = `https://${projectRef}.supabase.co`;
const secretKey = requireSecretKey();
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
const runId = process.argv[2];

if (!/^\d{13}-[a-f0-9]+$/.test(runId ?? "")) {
  throw new Error("A valid hosted QA run ID is required.");
}

const users = await listQaUsers();
const matchingUsers = users.filter((user) =>
  typeof user.email === "string" && user.email.endsWith(`.${runId}@example.com`)
);

if (matchingUsers.length === 0) {
  console.log(`No disposable users remain for hosted QA run ${runId}.`);
} else {
  for (const user of matchingUsers) {
    await cleanupUser(user.id);
  }
  console.log(`Removed ${matchingUsers.length} disposable user(s) for hosted QA run ${runId}.`);
}

async function listQaUsers() {
  const users = [];
  const perPage = 100;

  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    assert(!error, `Unable to list Auth users: ${error?.code ?? "AUTH_ADMIN_FAILED"}.`);
    const pageUsers = Array.isArray(data.users) ? data.users : [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) return users;
  }
}

async function cleanupUser(userId) {
  await deleteRows("external_sync_events", `user_id=eq.${userId}`);
  await deleteRows("account_deletion_requests", `user_id=eq.${userId}`);
  await deleteRows("users", `id=eq.${userId}`);

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  assert(!error || error.status === 404, `Unable to delete disposable Auth user: ${error?.code ?? "AUTH_ADMIN_FAILED"}.`);
}

async function deleteRows(table, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: serviceHeaders()
  });
  assert(response.ok, `Unable to clean ${table}: HTTP ${response.status}.`);
}

function serviceHeaders() {
  return {
    apikey: secretKey,
    "Content-Type": "application/json"
  };
}

function requireSecretKey() {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value?.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be a separately revocable sb_secret_ key.");
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
