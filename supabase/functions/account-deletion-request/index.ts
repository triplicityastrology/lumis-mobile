import { createClient } from "npm:@supabase/supabase-js@2.52.0";

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

  if (!isRecentAuthentication(authData.user.last_sign_in_at)) {
    return jsonResponse(
      { error: { code: "RECENT_AUTH_REQUIRED", message: "Please sign in again before deleting your account" } },
      { status: 403 }
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await serviceClient.rpc("enqueue_account_deletion_external_sync", {
    p_user_id: authData.user.id
  });

  if (error) {
    console.error("ACCOUNT_DELETION_QUEUE_FAILED", { code: error.code, user_id: authData.user.id });
    const includeDiagnostics = Deno.env.get("LUMIS_ENV")?.trim().toLowerCase() === "staging";
    const diagnosticCode = includeDiagnostics ? error.code : undefined;
    const diagnosticMessage = includeDiagnostics
      ? [error.message, error.details, error.hint].filter(Boolean).join(" | ").slice(0, 500)
      : undefined;
    return jsonResponse(
      {
        error: {
          code: "ACCOUNT_DELETION_QUEUE_FAILED",
          message: "Unable to queue account deletion",
          ...(diagnosticCode ? { diagnostic_code: diagnosticCode } : {}),
          ...(diagnosticMessage ? { diagnostic_message: diagnosticMessage } : {})
        }
      },
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

function isRecentAuthentication(lastSignInAt?: string): boolean {
  const lastSignInTime = Date.parse(lastSignInAt ?? "");
  return Number.isFinite(lastSignInTime) && Date.now() - lastSignInTime <= 10 * 60 * 1000;
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
