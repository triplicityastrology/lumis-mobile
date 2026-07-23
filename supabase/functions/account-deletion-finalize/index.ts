import { createClient } from "npm:@supabase/supabase-js@2.52.0";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

type DeletionClaim = {
  request_id: string;
  user_id: string;
  attempt_count: number;
};

Deno.serve(async (request) => {
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) return corsPreflight;

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  if (!isAuthorizedCronRequest(request)) {
    return jsonResponse(
      { error: { code: "INTERNAL_DELETION_AUTH_REQUIRED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  if (Deno.env.get("INTERNAL_ACCOUNT_DELETION_ENABLED") !== "true") {
    return jsonResponse({ enabled: false, claimed: 0, results: [] });
  }

  const supabaseUrl = requireEnvironment("SUPABASE_URL");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await serviceClient.rpc("claim_internal_account_deletions", {
    p_limit: 10
  });

  if (error) {
    console.error("INTERNAL_DELETION_CLAIM_FAILED", { code: error.code });
    return jsonResponse(
      { error: { code: "INTERNAL_DELETION_CLAIM_FAILED", message: "Unable to claim deletions" } },
      { status: 500 }
    );
  }

  const claims = (data ?? []) as DeletionClaim[];
  const results = [];

  for (const claim of claims) {
    results.push(await finalizeClaim(serviceClient, claim));
  }

  return jsonResponse({ enabled: true, claimed: claims.length, results });
});

async function finalizeClaim(
  serviceClient: ReturnType<typeof createClient>,
  claim: DeletionClaim
) {
  try {
    const { data: preparation, error: preparationError } = await serviceClient.rpc(
      "prepare_internal_account_deletion",
      {
        p_request_id: claim.request_id,
        p_user_id: claim.user_id
      }
    );

    if (preparationError || !(preparation as { ok?: boolean } | null)?.ok) {
      throw new Error("APPLICATION_DATA_PREPARE_FAILED");
    }

    const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(claim.user_id);

    if (authDeleteError && authDeleteError.status !== 404) {
      throw new Error("AUTH_USER_DELETE_FAILED");
    }

    const { data, error } = await serviceClient.rpc("complete_internal_account_deletion", {
      p_request_id: claim.request_id,
      p_user_id: claim.user_id
    });

    if (error || !(data as { ok?: boolean } | null)?.ok) {
      throw new Error("APPLICATION_DATA_DELETE_FAILED");
    }

    return {
      request_id: claim.request_id,
      status: "internally_deleted",
      attempt_count: claim.attempt_count
    };
  } catch (error) {
    const errorCode = safeDeletionError(error);
    console.error("INTERNAL_ACCOUNT_DELETION_FAILED", {
      request_id: claim.request_id,
      attempt_count: claim.attempt_count,
      code: errorCode
    });

    const { data, error: failureRecordError } = await serviceClient.rpc(
      "fail_internal_account_deletion",
      {
        p_request_id: claim.request_id,
        p_error_code: errorCode
      }
    );

    if (failureRecordError) {
      console.error("INTERNAL_DELETION_FAILURE_RECORD_FAILED", {
        request_id: claim.request_id,
        code: failureRecordError.code
      });
    }

    return {
      request_id: claim.request_id,
      status: (data as { status?: string } | null)?.status ?? "failure_record_failed",
      attempt_count: claim.attempt_count,
      error_code: errorCode
    };
  }
}

function isAuthorizedCronRequest(request: Request): boolean {
  const expected = Deno.env.get("INTERNAL_ACCOUNT_DELETION_CRON_SECRET");
  const provided = request.headers.get("X-Lumis-Internal-Deletion-Secret");
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

function safeDeletionError(error: unknown): string {
  if (!(error instanceof Error)) return "INTERNAL_DELETION_FAILED";
  if (error.message === "APPLICATION_DATA_PREPARE_FAILED") return error.message;
  if (error.message === "AUTH_USER_DELETE_FAILED") return error.message;
  if (error.message === "APPLICATION_DATA_DELETE_FAILED") return error.message;
  return "INTERNAL_DELETION_FAILED";
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
