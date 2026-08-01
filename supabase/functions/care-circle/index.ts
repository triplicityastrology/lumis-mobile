import { createClient } from "npm:@supabase/supabase-js@2.52.0";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import {
  type CareCircleAction,
  type CareCircleRequest,
  normalizePairingCode,
  PAIRING_CODE_ALPHABET,
  projectSafeCareCircleResponse,
  validateCareCircleRequest
} from "./operation-boundary.ts";

type Configuration = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  pairingSecret: string;
};

type RpcError = {
  code?: string;
  message?: string;
};

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
      "CARE_CIRCLE_CONFIGURATION_REQUIRED",
      "Care Circle operations are not available."
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

  const body = await request.json().catch(() => null);
  const validation = validateCareCircleRequest(body);
  if (!validation.ok) {
    return safeError(validation.status, validation.code, validation.message);
  }
  const validatedBody = validation.body;

  const actorUserId = authData.user.id;
  const serviceClient = createClient(
    configuration.supabaseUrl,
    configuration.serviceRoleKey
  );

  try {
    const operation = await buildOperation(
      validatedBody,
      actorUserId,
      configuration.pairingSecret
    );
    const { data, error } = await serviceClient.rpc(operation.rpc, operation.params);

    if (error) return mapRpcError(error);

    return jsonResponse(
      projectSafeCareCircleResponse(
        validatedBody.action!,
        data,
        operation.pairingCode
      ),
      { status: 200 }
    );
  } catch {
    return safeError(
      503,
      "CARE_CIRCLE_OPERATION_FAILED",
      "Care Circle could not complete this request."
    );
  }
});

function getConfiguration(): Configuration | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const pairingSecret = Deno.env.get("CARE_CIRCLE_PAIRING_SECRET")?.trim();

  if (
    !supabaseUrl
    || !anonKey
    || !serviceRoleKey
    || !pairingSecret
    || pairingSecret.length < 32
  ) {
    return null;
  }

  return { supabaseUrl, anonKey, serviceRoleKey, pairingSecret };
}

async function buildOperation(
  body: CareCircleRequest,
  actorUserId: string,
  pairingSecret: string
): Promise<{
  rpc: string;
  params: Record<string, unknown>;
  pairingCode?: string;
}> {
  const requestId = body.client_request_id!;
  const common = {
    p_actor_user_id: actorUserId,
    p_request_id: requestId
  };

  if (body.action === "pairing_code_create") {
    const pairingCode = await derivePairingCode(
      actorUserId,
      requestId,
      pairingSecret
    );
    const codeHash = await fingerprintPairingCode(pairingCode, pairingSecret);
    return {
      rpc: "create_care_pairing_code_backend",
      params: {
        ...common,
        p_request_digest: await digestRequest([body.action, codeHash]),
        p_code_hash: codeHash
      },
      pairingCode
    };
  }

  if (body.action === "pairing_code_revoke") {
    return {
      rpc: "revoke_care_pairing_code_backend",
      params: {
        ...common,
        p_request_digest: await digestRequest([body.action, body.code_id!]),
        p_code_id: body.code_id
      }
    };
  }

  if (body.action === "pairing_code_submit") {
    const normalizedCode = normalizePairingCode(body.pairing_code)!;
    const codeHash = await fingerprintPairingCode(
      normalizedCode,
      pairingSecret
    );
    return {
      rpc: "consume_care_pairing_code_backend",
      params: {
        ...common,
        p_request_digest: await digestRequest([body.action, codeHash]),
        p_code_hash: codeHash
      }
    };
  }

  if (body.action === "relationship_accept") {
    return relationshipOperation(
      "accept_care_relationship_backend",
      body,
      common
    );
  }

  if (body.action === "relationship_decline") {
    return relationshipOperation(
      "decline_care_relationship_backend",
      body,
      common
    );
  }

  if (body.action === "relationship_remove") {
    return relationshipOperation(
      "remove_care_relationship_backend",
      body,
      common
    );
  }

  const pausedUntil = body.action === "care_pause"
    ? new Date(body.paused_until!).toISOString()
    : null;
  return {
    rpc: "update_care_pause_backend",
    params: {
      ...common,
      p_request_digest: await digestRequest([
        body.action!,
        pausedUntil ?? ""
      ]),
      p_paused_until: pausedUntil
    }
  };
}

async function relationshipOperation(
  rpc: string,
  body: CareCircleRequest,
  common: Record<string, unknown>
): Promise<{
  rpc: string;
  params: Record<string, unknown>;
}> {
  return {
    rpc,
    params: {
      ...common,
      p_request_digest: await digestRequest([
        body.action!,
        body.relationship_id!
      ]),
      p_relationship_id: body.relationship_id
    }
  };
}

function mapRpcError(error: RpcError): Response {
  const code = approvedErrorCode(error);
  const messages: Record<string, { status: number; message: string }> = {
    "48004": {
      status: 410,
      message: "This pairing code is not valid. Ask the Caree to refresh it."
    },
    "48005": {
      status: 409,
      message: "This Care Circle relationship already exists."
    },
    "48006": {
      status: 400,
      message: "You cannot add yourself as a Carer."
    },
    "48007": {
      status: 404,
      message: "This Care Circle relationship is not available."
    },
    "48009": {
      status: 410,
      message: "This Care Circle relationship has ended."
    },
    "48012": {
      status: 409,
      message: "This Care Circle request can no longer be completed."
    },
    "48013": {
      status: 428,
      message: "Finish your Lumis Carer profile to continue."
    }
  };
  const mapped = code ? messages[code] : undefined;

  if (!mapped) {
    return safeError(
      503,
      "CARE_CIRCLE_OPERATION_FAILED",
      "Care Circle could not complete this request."
    );
  }

  return safeError(mapped.status, code!, mapped.message);
}

function approvedErrorCode(error: RpcError): string | null {
  const candidates = [error.code, error.message];
  for (const candidate of candidates) {
    const match = candidate?.match(/(?:^|\b)(4800[4-9]|4801[0-3])(?:\b|$)/);
    if (match) return match[1];
  }
  return null;
}

async function derivePairingCode(
  actorUserId: string,
  requestId: string,
  secret: string
): Promise<string> {
  const bytes = await hmacBytes(
    secret,
    `pairing-code-display\n${actorUserId}\n${requestId}`
  );
  const characters = [...bytes.slice(0, 12)].map(
    (byte) => PAIRING_CODE_ALPHABET[byte % PAIRING_CODE_ALPHABET.length]
  );
  return [
    characters.slice(0, 4).join(""),
    characters.slice(4, 8).join(""),
    characters.slice(8, 12).join("")
  ].join("-");
}

async function fingerprintPairingCode(
  pairingCode: string,
  secret: string
): Promise<string> {
  const normalized = normalizePairingCode(pairingCode);
  if (!normalized) throw new Error("Invalid pairing material");
  return hex(await hmacBytes(secret, `pairing-code-fingerprint\n${normalized}`));
}

async function hmacBytes(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  );
}

async function digestRequest(parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(parts.join("\n"))
  );
  return hex(new Uint8Array(digest));
}

function hex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeError(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, { status });
}
