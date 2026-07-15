const projectRef = process.env.SUPABASE_PROJECT_REF ?? "bmqhwofmdgebpcihjlnb";
const supabaseUrl = `https://${projectRef}.supabase.co`;
const anonKey = requireEnvironment("SUPABASE_ANON_KEY");
const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Lumis-QA-${crypto.randomUUID()}!`;
const createdUserIds = [];

const results = [];

try {
  await auditExistingChartVersionInvariants();

  const primary = await createConfirmedUser(`lumis.qa.primary.${runId}@example.com`, password);
  const secondary = await createConfirmedUser(`lumis.qa.secondary.${runId}@example.com`, password);
  createdUserIds.push(primary.id, secondary.id);

  const primarySession = await signIn(primary.email, password);
  const secondarySession = await signIn(secondary.email, password);
  const originalRequest = {
    display_name: "Staging QA",
    birth_date: "1986-02-20",
    birth_time: "16:55",
    time_unknown: false,
    place_name: "Hong Kong",
    country_code: "HK",
    lat: 22.3193,
    lng: 114.1694,
    tz_str: "Asia/Hong_Kong"
  };

  const firstProfile = await invokeFunction("profile", primarySession.access_token, originalRequest);
  assert(firstProfile.status === 200, `Initial profile returned HTTP ${firstProfile.status}.`);
  assert(firstProfile.body.status === "profile_persisted", "Initial profile was not persisted.");
  assert(firstProfile.body.chart_version === 1, "Initial profile did not return chart_version 1.");
  assert(firstProfile.body.ai_profile_id, "Initial profile did not return ai_profile_id.");
  assert(firstProfile.body.birth_data_history_id, "Initial profile did not return birth_data_history_id.");
  assert(!containsKey(firstProfile.body, "rawProviderResponse"), "Profile exposed raw provider output.");
  pass("Fresh onboarding persists one profile without raw provider output");

  const duplicateProfile = await invokeFunction("profile", primarySession.access_token, originalRequest);
  assert(duplicateProfile.status === 409, `Repeat onboarding returned HTTP ${duplicateProfile.status}.`);
  assert(
    duplicateProfile.body?.error?.code === "PROFILE_ALREADY_EXISTS",
    "Repeat onboarding did not return PROFILE_ALREADY_EXISTS."
  );
  const duplicateCounts = await Promise.all([
    serviceSelect("birth_data", `user_id=eq.${primary.id}&select=user_id`),
    serviceSelect("ai_profiles", `user_id=eq.${primary.id}&select=id`),
    serviceSelect("birth_data_history", `user_id=eq.${primary.id}&select=id`),
    serviceSelect("monthly_balance", `user_id=eq.${primary.id}&grant_type=eq.starter_onboarding&select=id`)
  ]);
  assert(
    duplicateCounts.every((rows) => rows.length === 1),
    "Repeat onboarding created duplicate profile data."
  );
  pass("Repeat onboarding is rejected before chart generation");

  const initialUser = await serviceSelectOne("users", primary.id);
  const initialBirth = await serviceSelectOne("birth_data", primary.id, "user_id");
  const initialProfile = await serviceSelectOne("ai_profiles", primary.id, "user_id");
  const initialChart = JSON.stringify(initialProfile.chart_json);

  await servicePatch("users", `id=eq.${primary.id}`, {
    display_name: "Saved QA Name",
    buddy_name: "Saved Lumis",
    persona_style: "spark",
    role: "spark"
  });
  await serviceDelete("monthly_balance", `user_id=eq.${primary.id}&grant_type=eq.starter_onboarding`);

  const repairRequest = {
    ...originalRequest,
    display_name: "Incoming Name Must Not Win",
    birth_date: "1999-09-09",
    birth_time: "09:09",
    place_name: "Incoming Place Must Not Win"
  };
  const repairedProfile = await invokeFunction("profile", primarySession.access_token, repairRequest);
  assert(repairedProfile.status === 200, `Legacy repair returned HTTP ${repairedProfile.status}.`);
  assert(repairedProfile.body.status === "profile_repaired", "Legacy profile was not repaired.");
  assert(!("chart_worker_contract" in repairedProfile.body), "Repair returned a Worker contract.");

  const repairedUser = await serviceSelectOne("users", primary.id);
  const repairedBirth = await serviceSelectOne("birth_data", primary.id, "user_id");
  const repairedAiProfile = await serviceSelectOne("ai_profiles", primary.id, "user_id");
  const grants = await serviceSelect(
    "monthly_balance",
    `user_id=eq.${primary.id}&grant_type=eq.starter_onboarding&select=id`
  );
  const histories = await serviceSelect(
    "birth_data_history",
    `user_id=eq.${primary.id}&status=eq.active&select=id,chart_version`
  );

  assert(repairedUser.display_name === "Saved QA Name", "Repair changed display_name.");
  assert(repairedUser.buddy_name === "Saved Lumis", "Repair changed buddy_name.");
  assert(repairedUser.persona_style === "spark", "Repair changed persona_style.");
  assert(repairedUser.role === "spark", "Repair changed role.");
  assert(repairedBirth.birth_date === initialBirth.birth_date, "Repair changed birth_date.");
  assert(repairedBirth.place_name === initialBirth.place_name, "Repair changed birthplace.");
  assert(JSON.stringify(repairedAiProfile.chart_json) === initialChart, "Repair changed the saved chart.");
  assert(grants.length === 1, `Expected one Starter grant, found ${grants.length}.`);
  assert(histories.length === 1, `Expected one active chart history, found ${histories.length}.`);
  assert(initialUser.id === repairedUser.id, "Repair changed the user identity.");
  pass("Missing-Starter repair preserves all saved user, birth, and chart data");

  const chatOne = await invokeFunction("chat-message", primarySession.access_token, {
    message: "Tell me something supportive about my chart.",
    persona_style: "spark",
    force_new_thread: true
  });
  assertSuccessfulNoChargeChat(chatOne);

  const chatTwo = await invokeFunction("chat-message", primarySession.access_token, {
    message: "Continue that reflection.",
    persona_style: "spark",
    force_new_thread: false
  });
  assertSuccessfulNoChargeChat(chatTwo);
  assert(chatTwo.body.thread_id === chatOne.body.thread_id, "Normal chat did not append to the thread.");

  const chatThree = await invokeFunction("chat-message", primarySession.access_token, {
    message: "Start a separate topic.",
    persona_style: "spark",
    force_new_thread: true
  });
  assertSuccessfulNoChargeChat(chatThree);
  assert(chatThree.body.thread_id !== chatOne.body.thread_id, "New topic reused the previous thread.");

  const threads = await serviceSelect("chat_threads", `user_id=eq.${primary.id}&select=id,chart_version`);
  const messages = await serviceSelect(
    "chat_messages",
    `user_id=eq.${primary.id}&select=id,thread_id,credits_cost,status`
  );
  assert(threads.length === 2, `Expected two chat threads, found ${threads.length}.`);
  assert(messages.length === 6, `Expected six chat messages, found ${messages.length}.`);
  assert(messages.every((message) => message.credits_cost === 0), "A scaffold message charged credits.");
  assert(messages.every((message) => message.status === "committed"), "A chat message was not committed.");
  pass("Chat appends, starts a new topic, persists atomically, and charges zero credits");

  const threadCountBeforeInvalidRpc = threads.length;
  const invalidRpc = await serviceRequest("/rest/v1/rpc/persist_scaffold_chat_turn", {
    method: "POST",
    body: {
      p_user_id: primary.id,
      p_ai_profile_id: repairedAiProfile.id,
      p_chart_version: repairedAiProfile.chart_version,
      p_persona_style: "spark",
      p_route: "casual",
      p_title: "Invalid turn",
      p_user_message: "This must not persist",
      p_assistant_message: "",
      p_force_new_thread: true
    }
  });
  assert(invalidRpc.ok === false, "Invalid RPC input unexpectedly succeeded.");
  assert(invalidRpc.error_code === "CHAT_PERSISTENCE_INVALID_INPUT", "Invalid RPC returned wrong code.");
  const threadsAfterInvalidRpc = await serviceSelect("chat_threads", `user_id=eq.${primary.id}&select=id`);
  assert(threadsAfterInvalidRpc.length === threadCountBeforeInvalidRpc, "Invalid RPC left a partial thread.");
  pass("Invalid transactional chat turn leaves no partial thread");

  const crossUserRows = await Promise.all([
    userSelect(secondarySession.access_token, "birth_data", `user_id=eq.${primary.id}&select=user_id`),
    userSelect(secondarySession.access_token, "ai_profiles", `user_id=eq.${primary.id}&select=id`),
    userSelect(
      secondarySession.access_token,
      "birth_data_history",
      `user_id=eq.${primary.id}&select=id`
    )
  ]);
  assert(crossUserRows.every((rows) => rows.length === 0), "RLS exposed another user's chart data.");

  const migrationReportsResponse = await userRequest(
    secondarySession.access_token,
    "/rest/v1/migration_reports?select=id&limit=1"
  );
  assert(!migrationReportsResponse.ok, "Authenticated user could read migration_reports.");

  const backendRpcResponse = await userRequest(
    secondarySession.access_token,
    "/rest/v1/rpc/complete_profile_onboarding",
    {
      method: "POST",
      body: {
        p_user_id: secondary.id,
        p_display_name: null,
        p_birth_date: "1986-02-20",
        p_birth_time: "16:55",
        p_time_unknown: false,
        p_place_name: "Hong Kong",
        p_country_code: "HK",
        p_lat: 22.3193,
        p_lng: 114.1694,
        p_tz_str: "Asia/Hong_Kong",
        p_role: null,
        p_chart_json: {},
        p_raw_chart_json: null,
        p_precision: "full",
        p_model: "unauthorized-test"
      }
    }
  );
  assert(!backendRpcResponse.ok, "Authenticated user could invoke backend-only onboarding RPC.");
  pass("RLS and grants block cross-user chart data, migration reports, and backend-only RPCs");

  await servicePatch("ai_profiles", `id=eq.${repairedAiProfile.id}`, { is_active: false });
  const noActiveProfileChat = await invokeFunction("chat-message", primarySession.access_token, {
    message: "This should not persist without an active chart.",
    force_new_thread: true
  });
  assert(noActiveProfileChat.status === 200, "Inactive-profile chat did not return safely.");
  assert(noActiveProfileChat.body.thread_id === null, "Inactive-profile chat persisted a thread.");
  assert(
    noActiveProfileChat.body.persistence_error === "ACTIVE_PROFILE_REQUIRED",
    "Inactive-profile chat returned the wrong safe error."
  );
  pass("Chat fails safely when no active profile exists");

  await servicePatch("ai_profiles", `id=eq.${repairedAiProfile.id}`, { is_active: true });
  const restoredSession = await signIn(primary.email, password);
  const restoredProfiles = await userSelect(
    restoredSession.access_token,
    "ai_profiles",
    `user_id=eq.${primary.id}&select=id,chart_version`
  );
  const restoredThreads = await userSelect(
    restoredSession.access_token,
    "chat_threads",
    `user_id=eq.${primary.id}&select=id,chart_version`
  );
  assert(restoredProfiles.length === 1, "Same-email sign-in could not read the saved profile.");
  assert(restoredThreads.length === 2, "Same-email sign-in could not read saved reflections.");
  pass("Same-email sign-in can reload the saved profile and Past Reflections");

  console.log(JSON.stringify({ ok: true, checks: results }, null, 2));
} finally {
  for (const userId of createdUserIds) {
    await cleanupUser(userId).catch((error) => {
      console.error(`Cleanup failed for disposable user ${userId}:`, safeError(error));
    });
  }
}

async function auditExistingChartVersionInvariants() {
  const [birthRows, profiles, histories] = await Promise.all([
    serviceSelect("birth_data", "select=user_id,active_chart_version"),
    serviceSelect(
      "ai_profiles",
      "select=id,user_id,chart_version,is_active,birth_data_history_id,chart_json"
    ),
    serviceSelect(
      "birth_data_history",
      "select=id,user_id,chart_version,status,ai_profile_id,chart_json"
    )
  ]);
  const birthByUser = new Map(birthRows.map((row) => [row.user_id, row]));
  const chartUsers = new Set(profiles.map((profile) => profile.user_id));

  for (const userId of chartUsers) {
    const userProfiles = profiles.filter((profile) => profile.user_id === userId);
    const activeProfiles = userProfiles.filter((profile) => profile.is_active === true);
    const activeHistories = histories.filter(
      (history) => history.user_id === userId && history.status === "active"
    );
    assert(activeProfiles.length === 1, "An existing chart user does not have exactly one active profile.");
    assert(activeHistories.length === 1, "An existing chart user does not have exactly one active history.");

    const activeProfile = activeProfiles[0];
    const activeHistory = activeHistories[0];
    const birth = birthByUser.get(userId);
    assert(birth, "An existing chart user has no birth_data row.");
    assert(
      activeProfile.chart_version === activeHistory.chart_version &&
        birth.active_chart_version === activeProfile.chart_version,
      "An existing chart user's active chart versions do not match."
    );
    assert(
      activeProfile.birth_data_history_id === activeHistory.id,
      "An active profile does not point to its active history."
    );
    assert(!containsKey(activeProfile.chart_json, "rawProviderResponse"), "AI profile exposes raw provider output.");
    assert(!containsKey(activeHistory.chart_json, "rawProviderResponse"), "Chart history exposes raw provider output.");
  }

  pass(`Existing chart-version invariants pass for ${chartUsers.size} staging user(s)`);
}

function pass(name) {
  results.push(name);
}

function assertSuccessfulNoChargeChat(result) {
  assert(result.status === 200, `Chat returned HTTP ${result.status}.`);
  assert(result.body.thread_id, "Chat did not return a persisted thread.");
  assert(result.body.persistence_mode === "supabase_scaffold", "Chat was not persisted in scaffold mode.");
  assert(result.body.billing_mode === "scaffold_no_charge", "Chat billing mode was not scaffold_no_charge.");
  assert(result.body.credits_charged === 0, "Chat charged credits.");
  assert(result.body.remaining_credits === null, "Chat exposed an authoritative scaffold balance.");
}

async function createConfirmedUser(email, userPassword) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ email, password: userPassword, email_confirm: true })
  });
  const body = await response.json();
  assert(response.ok, `Unable to create disposable Auth user: ${body.message ?? response.status}.`);
  return { id: body.id, email };
}

async function signIn(email, userPassword) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password: userPassword })
  });
  const body = await response.json();
  assert(response.ok, `Unable to sign in disposable user: ${body.error_description ?? response.status}.`);
  return body;
}

async function invokeFunction(name, accessToken, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
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

async function serviceSelectOne(table, id, key = "id") {
  const rows = await serviceSelect(table, `${key}=eq.${id}&select=*`);
  assert(rows.length === 1, `Expected one ${table} row, found ${rows.length}.`);
  return rows[0];
}

async function serviceSelect(table, query) {
  return serviceRequest(`/rest/v1/${table}?${query}`);
}

async function userSelect(accessToken, table, query) {
  const response = await userRequest(accessToken, `/rest/v1/${table}?${query}`);
  assert(response.ok, `User query for ${table} failed with HTTP ${response.status}.`);
  return response.body;
}

async function userRequest(accessToken, path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null };
}

async function servicePatch(table, query, body) {
  await serviceRequest(`/rest/v1/${table}?${query}`, {
    method: "PATCH",
    body,
    prefer: "return=minimal"
  });
}

async function serviceDelete(table, query) {
  await serviceRequest(`/rest/v1/${table}?${query}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}

async function serviceRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...serviceHeaders(),
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert(response.ok, `Service request ${path} failed with HTTP ${response.status}: ${safeError(body)}.`);
  return body;
}

async function cleanupUser(userId) {
  await serviceDelete("users", `id=eq.${userId}`);
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: serviceHeaders()
  });
  assert(response.ok, `Unable to delete disposable Auth user ${userId}.`);
}

function serviceHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function containsKey(value, target) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, target)) return true;
  return Object.values(value).some((child) => containsKey(child, target));
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the staging backend smoke test.`);
  return value;
}

function safeError(value) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
