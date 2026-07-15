import { createClient } from "@supabase/supabase-js";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

type SyncDestination = "salesforce_case" | "google_sheet";

type ExternalSyncEvent = {
  event_id: string;
  user_id: string;
  destination: SyncDestination;
  idempotency_key: string;
  payload_json: Record<string, unknown>;
  attempt_count: number;
};

Deno.serve(async (request) => {
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) return corsPreflight;

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  if (!isAuthorizedCronRequest(request)) {
    return jsonResponse({ error: { code: "SYNC_AUTH_REQUIRED", message: "Unauthorized" } }, { status: 401 });
  }

  const supabaseUrl = requireEnvironment("SUPABASE_URL");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const body = await request.json().catch(() => ({})) as { mode?: string };

  if (body.mode === "daily_report") {
    const { data, error } = await serviceClient.rpc("create_external_sync_daily_report");

    if (error) {
      console.error("EXTERNAL_SYNC_REPORT_FAILED", { code: error.code });
      return jsonResponse({ error: { code: "SYNC_REPORT_FAILED", message: "Unable to create report" } }, { status: 500 });
    }

    return jsonResponse({ report: data });
  }

  if (Deno.env.get("EXTERNAL_SYNC_ENABLED") !== "true") {
    return jsonResponse({ enabled: false, claimed: 0, results: [] });
  }

  const { data, error } = await serviceClient.rpc("claim_external_sync_events", { p_limit: 20 });

  if (error) {
    console.error("EXTERNAL_SYNC_CLAIM_FAILED", { code: error.code });
    return jsonResponse({ error: { code: "SYNC_CLAIM_FAILED", message: "Unable to claim events" } }, { status: 500 });
  }

  const events = (data ?? []) as ExternalSyncEvent[];
  const results = [];

  for (const event of events) {
    results.push(await deliverEvent(serviceClient, event));
  }

  return jsonResponse({ claimed: events.length, results });
});

async function deliverEvent(
  serviceClient: ReturnType<typeof createClient>,
  event: ExternalSyncEvent
) {
  let delivered = false;
  let externalRecordId: string | null = null;
  let errorCode: string | null = null;

  try {
    const response = await callSignedWorker(event);
    delivered = response.status === "delivered" || response.status === "already_delivered";
    externalRecordId = response.external_record_id ?? null;

    if (!delivered) errorCode = "SYNC_DESTINATION_REJECTED";
  } catch (error) {
    errorCode = safeDeliveryError(error);
    console.error("EXTERNAL_SYNC_DELIVERY_FAILED", {
      event_id: event.event_id,
      destination: event.destination,
      attempt_count: event.attempt_count,
      code: errorCode
    });
  }

  const { data, error } = await serviceClient.rpc("complete_external_sync_event", {
    p_event_id: event.event_id,
    p_delivered: delivered,
    p_external_record_id: externalRecordId,
    p_error_code: errorCode
  });

  if (error) {
    console.error("EXTERNAL_SYNC_COMPLETION_FAILED", { event_id: event.event_id, code: error.code });
    return { event_id: event.event_id, status: "completion_failed" };
  }

  return { event_id: event.event_id, ...(data as Record<string, unknown>) };
}

async function callSignedWorker(event: ExternalSyncEvent): Promise<{
  status?: string;
  external_record_id?: string | null;
}> {
  const workerBaseUrl = requireEnvironment("CHART_WORKER_URL")
    .replace(/\/mobile\/natal-chart\/?$/, "")
    .replace(/\/+$/, "");
  const signingSecret = requireEnvironment("CHART_WORKER_SIGNING_SECRET");
  const body = JSON.stringify({
    event_id: event.event_id,
    user_id: event.user_id,
    destination: event.destination,
    idempotency_key: event.idempotency_key,
    record: event.payload_json
  });
  const timestamp = String(Date.now());
  const signature = await sign(`${timestamp}.${body}`, signingSecret);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${workerBaseUrl}/mobile/admin-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lumis-Signature-Version": "v1",
        "X-Lumis-Timestamp": timestamp,
        "X-Lumis-Signature": signature,
        "X-Lumis-Request-Id": event.idempotency_key,
        "X-Lumis-User-Id": event.user_id
      },
      body,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error("SYNC_WORKER_REJECTED");
    return payload as { status?: string; external_record_id?: string | null };
  } finally {
    clearTimeout(timeout);
  }
}

function isAuthorizedCronRequest(request: Request): boolean {
  const expected = Deno.env.get("EXTERNAL_SYNC_CRON_SECRET");
  const provided = request.headers.get("X-Lumis-Cron-Secret");
  return Boolean(expected && provided && timingSafeEqual(expected, provided));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return `sha256=${Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function safeDeliveryError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "SYNC_WORKER_TIMEOUT";
  if (error instanceof Error && error.message === "SYNC_WORKER_REJECTED") return error.message;
  return "SYNC_DELIVERY_FAILED";
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
