const command = process.argv[2] ?? "report";
const eventId = process.argv[3];
const actor = process.argv[4];
const supabaseUrl = requireEnvironment("SUPABASE_URL").replace(/\/+$/, "");
const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");

if (command === "report") {
  const response = await request(
    "/rest/v1/external_sync_events?select=event_id,chart_session_id,destination,idempotency_key,status,attempt_count,manual_replay_count,last_attempt_at,next_retry_at,last_error,resolved_by,resolved_at,created_at&status=eq.failed_final&order=created_at.asc"
  );
  const events = await response.json();
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), failed_final: events }, null, 2));
} else if (command === "replay") {
  if (!eventId) throw new Error("Usage: external-sync-admin.mjs replay <event_id>");
  const response = await request("/rest/v1/rpc/replay_external_sync_event", {
    method: "POST",
    body: JSON.stringify({ p_event_id: eventId })
  });
  console.log(JSON.stringify(await response.json(), null, 2));
} else if (command === "resolve") {
  if (!eventId || !actor) {
    throw new Error("Usage: external-sync-admin.mjs resolve <event_id> <resolved_by>");
  }
  const response = await request("/rest/v1/rpc/resolve_external_sync_event", {
    method: "POST",
    body: JSON.stringify({ p_event_id: eventId, p_resolved_by: actor })
  });
  console.log(JSON.stringify(await response.json(), null, 2));
} else {
  throw new Error("Supported commands: report, replay <event_id>, resolve <event_id> <resolved_by>");
}

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) throw new Error(`Supabase request failed with status ${response.status}`);
  return response;
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
