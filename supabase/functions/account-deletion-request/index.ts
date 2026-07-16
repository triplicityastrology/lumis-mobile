import { createClient } from "@supabase/supabase-js";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

type AccountDeletionRpcResponse = {
  ok?: boolean;
  error_code?: string;
  request_id?: string;
  status?: string;
  external_event_count?: number;
};

Deno.serve(async (request) => {
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) return corsPreflight;

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  const body = await request.json().catch(() => ({})) as { confirmation?: string };

  if (body.confirmation !== "DELETE MY LUMIS ACCOUNT") {
    return jsonResponse(
      { error: { code: "DELETION_CONFIRMATION_REQUIRED", message: "Deletion confirmation is required" } },
      { status: 400 }
    );
  }

  const authHeader = request.headers.get("Authorization");
  const supabaseUrl = requireEnvironment("SUPABASE_URL");
  const anonKey = requireEnvironment("SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader) {
    return jsonResponse({ error: { code: "AUTH_REQUIRED", message: "Sign in is required" } }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse({ error: { code: "AUTH_REQUIRED", message: "Sign in is required" } }, { status: 401 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await serviceClient.rpc("enqueue_account_deletion_external_sync", {
    p_user_id: authData.user.id,
    p_email_hash: authData.user.email ? await sha256(authData.user.email.trim().toLowerCase()) : null
  });

  if (error) {
    console.error("ACCOUNT_DELETION_QUEUE_FAILED", { code: error.code, user_id: authData.user.id });
    return jsonResponse(
      { error: { code: "ACCOUNT_DELETION_QUEUE_FAILED", message: "Unable to queue account deletion" } },
      { status: 500 }
    );
  }

  const result = data as AccountDeletionRpcResponse | null;

  if (!result?.ok) {
    const code = result?.error_code === "ACCOUNT_NOT_FOUND" ? "ACCOUNT_NOT_FOUND" : "ACCOUNT_DELETION_QUEUE_FAILED";
    return jsonResponse({ error: { code, message: "Unable to queue account deletion" } }, { status: 400 });
  }

  return jsonResponse(
    {
      request_id: result.request_id,
      status: result.status,
      external_event_count: result.external_event_count
    },
    { status: 202 }
  );
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
