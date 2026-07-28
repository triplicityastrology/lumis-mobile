import { createClient } from "npm:@supabase/supabase-js@2.52.0";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

type RegistrationBody = {
  action?: "register" | "unregister" | "permission_revoked" | "logout";
  request_id?: string;
  installation_id?: string;
  platform?: "ios" | "android";
  provider?: "expo" | "apns" | "fcm";
  provider_token?: string;
  permission_status?: "granted" | "provisional";
  app_version?: string;
  device_locale?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  const corsPreflight = handleCorsPreflight(request);
  if (corsPreflight) return corsPreflight;

  if (request.method !== "POST") {
    return safeError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const configuration = getConfiguration();
  if (!configuration) {
    return safeError(
      503,
      "NOTIFICATION_CONFIGURATION_REQUIRED",
      "Notification registration is not available."
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return safeError(401, "AUTH_REQUIRED", "Sign in is required.");
  }

  const userClient = createClient(configuration.supabaseUrl, configuration.anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return safeError(401, "AUTH_REQUIRED", "Sign in is required.");
  }

  const body = await request.json().catch(() => null) as RegistrationBody | null;
  const validation = validateBody(body);
  if (!validation.ok) {
    return safeError(400, "NOTIFICATION_REQUEST_INVALID", validation.message);
  }

  const serviceClient = createClient(
    configuration.supabaseUrl,
    configuration.serviceRoleKey
  );

  try {
    if (body!.action === "register") {
      const tokenFingerprint = await sha256Hex(body!.provider_token!);
      const requestDigest = await digestRegistrationRequest(body!, tokenFingerprint);
      const tokenCiphertext = await encryptProviderToken(
        body!.provider_token!,
        configuration.encryptionKey
      );
      const { data, error } = await serviceClient.rpc(
        "register_notification_device_endpoint",
        {
          p_user_id: authData.user.id,
          p_request_id: body!.request_id,
          p_request_digest: requestDigest,
          p_installation_id: body!.installation_id,
          p_platform: body!.platform,
          p_provider: body!.provider,
          p_token_fingerprint: tokenFingerprint,
          p_token_ciphertext: tokenCiphertext,
          p_permission_status: body!.permission_status,
          p_app_version: body!.app_version?.trim() || null,
          p_device_locale: body!.device_locale?.trim() || null
        }
      );

      if (error) {
        return mapRpcError(error.code);
      }

      return jsonResponse(data, { status: 200 });
    }

    const reason = body!.action === "logout"
      ? "logout"
      : body!.action;
    const requestDigest = await digestUnregistrationRequest(body!, reason);
    const { data, error } = await serviceClient.rpc(
      "unregister_notification_device_endpoint",
      {
        p_user_id: authData.user.id,
        p_request_id: body!.request_id,
        p_request_digest: requestDigest,
        p_installation_id: body!.installation_id,
        p_reason: reason
      }
    );

    if (error) {
      return mapRpcError(error.code);
    }

    return jsonResponse(data, { status: 200 });
  } catch {
    return safeError(
      503,
      "NOTIFICATION_REGISTRATION_FAILED",
      "Notification registration could not be updated."
    );
  }
});

function getConfiguration(): {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  encryptionKey: Uint8Array;
} | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const encodedKey = Deno.env.get("NOTIFICATION_TOKEN_ENCRYPTION_KEY")?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !encodedKey) return null;

  try {
    const encryptionKey = Uint8Array.from(atob(encodedKey), (character) =>
      character.charCodeAt(0)
    );
    return encryptionKey.length === 32
      ? { supabaseUrl, anonKey, serviceRoleKey, encryptionKey }
      : null;
  } catch {
    return null;
  }
}

function validateBody(body: RegistrationBody | null):
  | { ok: true }
  | { ok: false; message: string } {
  if (
    !body
    || !["register", "unregister", "permission_revoked", "logout"].includes(
      body.action ?? ""
    )
    || !UUID_PATTERN.test(body.request_id ?? "")
    || !UUID_PATTERN.test(body.installation_id ?? "")
  ) {
    return { ok: false, message: "The notification registration request is invalid." };
  }

  if (body.action === "register") {
    if (
      !["ios", "android"].includes(body.platform ?? "")
      || !["expo", "apns", "fcm"].includes(body.provider ?? "")
      || !["granted", "provisional"].includes(body.permission_status ?? "")
      || !body.provider_token
      || body.provider_token.length > 4096
      || (body.app_version?.length ?? 0) > 64
      || (body.device_locale?.length ?? 0) > 32
    ) {
      return { ok: false, message: "The notification registration request is invalid." };
    }
  }

  return { ok: true };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digestRegistrationRequest(
  body: RegistrationBody,
  tokenFingerprint: string
): Promise<string> {
  return sha256Hex([
    "register",
    body.installation_id,
    body.platform,
    body.provider,
    tokenFingerprint,
    body.permission_status,
    body.app_version?.trim() ?? "",
    body.device_locale?.trim() ?? ""
  ].join("\n"));
}

async function digestUnregistrationRequest(
  body: RegistrationBody,
  reason: string | undefined
): Promise<string> {
  return sha256Hex([
    body.action,
    body.installation_id,
    reason
  ].join("\n"));
}

async function encryptProviderToken(
  token: string,
  rawKey: Uint8Array
): Promise<string> {
  const initializationVector = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      new TextEncoder().encode(token)
    )
  );
  const payload = new Uint8Array(initializationVector.length + encrypted.length);
  payload.set(initializationVector);
  payload.set(encrypted, initializationVector.length);
  return btoa(String.fromCharCode(...payload));
}

function mapRpcError(code?: string): Response {
  if (code === "23505") {
    return safeError(
      409,
      "NOTIFICATION_REQUEST_ID_CONFLICT",
      "This notification request conflicts with an earlier request."
    );
  }
  if (code === "22023") {
    return safeError(
      400,
      "NOTIFICATION_REQUEST_INVALID",
      "The notification registration request is invalid."
    );
  }
  if (code === "42501") {
    return safeError(403, "NOTIFICATION_FORBIDDEN", "This action is not allowed.");
  }
  return safeError(
    503,
    "NOTIFICATION_REGISTRATION_FAILED",
    "Notification registration could not be updated."
  );
}

function safeError(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, { status });
}
