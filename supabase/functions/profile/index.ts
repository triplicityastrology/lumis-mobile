import {
  CHART_WORKER_CONTRACT,
  type SignedChartWorkerRequest
} from "../../../packages/astrology/src/chart-worker-contract.ts";
import { allowsFixtureFallbackForEnvironment } from "../../../packages/astrology/src/chart-worker-config.ts";
import { sanitizeChartForClient } from "../../../packages/astrology/src/chart-sanitizer.ts";
import { decideProfilePreflight } from "../../../packages/astrology/src/profile-preflight.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.0";
import type { ChartV2 } from "../../../packages/shared/src/types/chart.ts";
import { isValidBirthDate } from "../../../packages/shared/src/config/birth-date.ts";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

type ProfileRequest = {
  client_request_id?: string;
  display_name?: string;
  birth_date: string;
  birth_time?: string | null;
  time_unknown?: boolean;
  place_name: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  tz_str?: string;
};

type BirthChangeRpcResponse = {
  ok?: boolean;
  duplicate?: boolean;
  reserved?: boolean;
  resumed?: boolean;
  new_reservation?: boolean;
  error_code?: string;
  message?: string;
  expected_chart_version?: number;
  profile_version?: number;
  chart_version?: number;
  ai_profile_id?: number;
  birth_data_history_id?: number;
  successful_change_count?: number;
  remaining_changes?: number;
  worker_request_id?: string;
  worker_requested_at?: string;
};

type OnboardingRpcResponse = {
  ok?: boolean;
  error_code?: string;
  message?: string;
  ai_profile_id?: number;
  profile_version?: number;
  chart_version?: number;
  birth_data_history_id?: number;
};

type ChartGenerationResult = {
  chart: ChartV2;
  rawChartJson: Record<string, unknown>;
  status: "fixture_worker_not_configured" | "worker_chart_generated";
  nextStep: string;
};

type RateLimitResult = {
  allowed?: boolean;
  retry_after_seconds?: number;
};

type TrustedBirthLocation = {
  location_key: string;
  place_name: string;
  country_code: string;
  lat: number;
  lng: number;
  tz_str: string;
};

type ExistingProfileState = {
  hasBirthData: boolean;
  hasProfile: boolean;
  hasStarterGrant: boolean;
  birthData: ExistingBirthData | null;
  profile: ExistingAiProfile | null;
};

type MobileChartWorkerPayload = SignedChartWorkerRequest & {
  request_id: string;
  requested_at: string;
  client: {
    source: "lumis_mobile_supabase";
    environment: string;
  };
};

type ExistingBirthData = {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
  country_code: string;
  lat: number;
  lng: number;
  tz_str: string;
};

type ExistingAiProfile = {
  id: number;
  version: number;
  chart_version: number;
  birth_data_history_id: number | null;
  chart_json: ChartV2;
  raw_chart_json: Record<string, unknown> | null;
  precision: "full" | "no_birth_time";
  model: string | null;
};

const personaStyleToInternalRole = {
  acceptance: "support",
  spark: "spark",
  awareness: "growth"
} as const;

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) {
    return corsPreflight;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  if (new URL(request.url).pathname.endsWith("/birth-details/change")) {
    return handleBirthDetailsChange({ request, requestId, startedAt });
  }

  const body = (await request.json()) as ProfileRequest;

  if (!body.birth_date || !body.place_name || (!body.birth_time && !body.time_unknown)) {
    return jsonResponse(
      {
        error: {
          code: "PROFILE_INCOMPLETE",
          message: "birth_date, birth_time or time_unknown, and place_name are required"
        }
      },
      { status: 400 }
    );
  }

  if (!body.country_code || body.lat == null || body.lng == null) {
    return jsonResponse(
      {
        error: {
          code: "LOCATION_UNRESOLVED",
          message: "country_code, lat, and lng are required before chart generation"
        }
      },
      { status: 400 }
    );
  }

  const chartRequest: SignedChartWorkerRequest = {
    user_id: "pending_auth_user",
    calculation_version: "mobile_natal_v1",
    birth_data: {
      name: body.display_name ?? "Lumis user",
      birth_date: body.birth_date,
      birth_time: body.birth_time ?? null,
      time_unknown: body.time_unknown ?? false,
      place_name: body.place_name,
      country_code: body.country_code,
      lat: body.lat,
      lng: body.lng,
      tz_str: body.tz_str ?? "UTC"
    },
    audit: {
      source: "mobile_app",
      product: "Lumis",
      flow: "onboarding_chart_generation",
      plan: "starter",
      chart_type: "natal"
    }
  };

  const authHeader = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !anonKey || !serviceRoleKey) {
    if (!body.tz_str) {
      return jsonResponse(
        { error: { code: "LOCATION_UNRESOLVED", message: "A resolved timezone is required in local preview mode." } },
        { status: 400 }
      );
    }

    if (!isValidBirthDate(body.birth_date, new Date(), body.tz_str)) {
      return invalidBirthDateResponse();
    }

    return jsonResponse({
      profile_version: 0,
      status: "profile_request_prepared",
      precision: chartRequest.birth_data.time_unknown ? "no_birth_time" : "full",
      contract: CHART_WORKER_CONTRACT,
      chart_worker_contract: chartRequest,
      chart: buildFixtureChart(body),
      next_step: "Create Supabase project, enable Auth, then deploy this function for persistence."
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse(
      {
        error: {
          code: "PROFILE_AUTH_REQUIRED",
          message: "Sign in before saving a Lumis profile."
        }
      },
      { status: 401 }
    );
  }

  const userId = authData.user.id;
  chartRequest.audit = {
    ...chartRequest.audit!,
    email: authData.user.email
  };
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const existingProfile = await loadExistingProfileState(serviceClient, userId);
  const preflightDecision = decideProfilePreflight(existingProfile);

  if (preflightDecision === "already_complete") {
    return jsonResponse(
      {
        error: {
          code: "PROFILE_ALREADY_EXISTS",
          message:
            "This account already has a chart profile. Birth-detail edits must use the controlled regeneration flow."
        }
      },
      { status: 409 }
    );
  }

  if (preflightDecision === "repair_missing_starter") {
    return repairExistingProfile({
      existingProfile,
      serviceClient,
      userId
    });
  }

  let profileRateLimit: RateLimitResult;

  try {
    profileRateLimit = await consumeProfileRateLimit(serviceClient, userId);
  } catch (error) {
    console.error("PROFILE_RATE_LIMIT_CHECK_FAILED", {
      request_id: requestId,
      user_id: userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return jsonResponse(
      { error: { code: "PROFILE_RATE_LIMIT_UNAVAILABLE", message: "Chart creation is briefly unavailable. Please try again." }, request_id: requestId },
      { status: 503, headers: { "X-Lumis-Request-Id": requestId } }
    );
  }

  if (!profileRateLimit.allowed) {
    const retryAfter = Math.max(1, profileRateLimit.retry_after_seconds ?? 600);
    await recordProfileRuntimeEvent(serviceClient, {
      requestId,
      userId,
      outcome: "rejected",
      statusCode: 429,
      errorCode: "PROFILE_RATE_LIMITED",
      durationMs: Date.now() - startedAt
    });
    return jsonResponse(
      { error: { code: "PROFILE_RATE_LIMITED", message: "Please wait before trying to create another chart." }, request_id: requestId },
      { status: 429, headers: { "Retry-After": String(retryAfter), "X-Lumis-Request-Id": requestId } }
    );
  }

  const trustedLocationResult = await serviceClient.rpc("resolve_trusted_birth_location", {
    p_place_name: body.place_name,
    p_country_code: body.country_code,
    p_lat: body.lat,
    p_lng: body.lng
  });

  if (trustedLocationResult.error) {
    console.error("PROFILE_LOCATION_RESOLUTION_FAILED", {
      user_id: userId,
      code: trustedLocationResult.error.code
    });
    return jsonResponse(
      { error: { code: "LOCATION_RESOLUTION_FAILED", message: "Unable to verify this birthplace right now." } },
      { status: 503 }
    );
  }

  const trustedLocation = trustedLocationResult.data as TrustedBirthLocation | null;

  if (!trustedLocation) {
    return jsonResponse(
      { error: { code: "LOCATION_UNRESOLVED", message: "Please choose a supported birthplace and try again." } },
      { status: 400 }
    );
  }

  chartRequest.birth_data = {
    ...chartRequest.birth_data,
    place_name: trustedLocation.place_name,
    country_code: trustedLocation.country_code,
    lat: trustedLocation.lat,
    lng: trustedLocation.lng,
    tz_str: trustedLocation.tz_str
  };

  if (!isValidBirthDate(body.birth_date, new Date(), trustedLocation.tz_str)) {
    return invalidBirthDateResponse();
  }

  let chartResult: ChartGenerationResult;

  try {
    chartResult = await generateChart({
      chartRequest: { ...chartRequest, user_id: userId },
      body
    });
  } catch (error) {
    console.error("PROFILE_CHART_WORKER_FAILED", {
      request_id: requestId,
      user_id: userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    await recordProfileRuntimeEvent(serviceClient, {
      requestId,
      userId,
      outcome: "failed",
      statusCode: 502,
      errorCode: "CHART_WORKER_FAILED",
      durationMs: Date.now() - startedAt
    });
    return jsonResponse(
      {
        error: {
          code: "CHART_WORKER_FAILED",
          message: "Unable to generate this Lumis chart right now. Please try again."
        }
      },
      { status: 502 }
    );
  }

  const chart = chartResult.chart;
  const providerRequestId =
    chartResult.status === "worker_chart_generated" && typeof chartResult.rawChartJson.request_id === "string"
      ? chartResult.rawChartJson.request_id
      : null;

  if (providerRequestId) {
    const workerSummary = chartResult.rawChartJson.worker_response_summary as
      | Record<string, unknown>
      | undefined;
    await recordProviderCallOutcome(serviceClient, {
      requestId: providerRequestId,
      userId,
      status: "generated",
      workerDisposition:
        workerSummary?.provider_disposition === "generated" ||
        workerSummary?.provider_disposition === "already_generated"
          ? workerSummary.provider_disposition
          : undefined,
      providerCallCount:
        typeof workerSummary?.provider_call_count === "number"
          ? workerSummary.provider_call_count
          : undefined
    });
  }
  const role = personaStyleToInternalRole.acceptance;

  const { data: onboardingData, error: onboardingError } = await serviceClient.rpc(
    "complete_profile_onboarding",
    {
      p_user_id: userId,
      p_display_name: body.display_name ?? "Lumis user",
      p_birth_date: body.birth_date,
      p_birth_time: body.time_unknown ? null : body.birth_time,
      p_time_unknown: body.time_unknown ?? false,
      p_place_name: trustedLocation.place_name,
      p_country_code: trustedLocation.country_code,
      p_lat: trustedLocation.lat,
      p_lng: trustedLocation.lng,
      p_tz_str: trustedLocation.tz_str,
      p_role: role,
      p_chart_json: chart,
      p_raw_chart_json: {
        ...chartResult.rawChartJson,
        status: chartResult.status,
        chart_worker_contract: { ...chartRequest, user_id: userId }
      },
      p_precision: chart.precision,
      p_model:
        chartResult.status === "worker_chart_generated"
          ? "cloudflare_worker_mobile_natal_v1"
          : "fixture_until_worker_connected"
    }
  );

  if (onboardingError) {
    if (providerRequestId) {
      await Promise.all([
        recordProviderCallOutcome(serviceClient, {
          requestId: providerRequestId,
          userId,
          status: "persistence_failed",
          errorCode: "PROFILE_ONBOARDING_FAILED"
        }),
        recordWorkerPersistenceOutcome({
          requestId: providerRequestId,
          userId,
          outcome: "persistence_failed",
          errorCode: "PROFILE_ONBOARDING_FAILED"
        })
      ]);
    }
    await recordProfileRuntimeEvent(serviceClient, {
      requestId,
      userId,
      outcome: "failed",
      statusCode: 500,
      errorCode: "PROFILE_ONBOARDING_FAILED",
      durationMs: Date.now() - startedAt
    });
    return jsonResponse(
      { error: { code: "PROFILE_ONBOARDING_FAILED", message: "The chart was generated but could not be saved. Please contact support before retrying." }, request_id: requestId },
      { status: 500 }
    );
  }

  const onboarding = onboardingData as OnboardingRpcResponse;

  if (!onboarding.ok) {
    if (providerRequestId) {
      await Promise.all([
        recordProviderCallOutcome(serviceClient, {
          requestId: providerRequestId,
          userId,
          status: "persistence_failed",
          errorCode: onboarding.error_code ?? "PROFILE_ONBOARDING_REJECTED"
        }),
        recordWorkerPersistenceOutcome({
          requestId: providerRequestId,
          userId,
          outcome: "persistence_failed",
          errorCode: onboarding.error_code ?? "PROFILE_ONBOARDING_REJECTED"
        })
      ]);
    }
    await recordProfileRuntimeEvent(serviceClient, {
      requestId,
      userId,
      outcome: "rejected",
      statusCode: onboarding.error_code === "PROFILE_ALREADY_EXISTS" ? 409 : 400,
      errorCode: onboarding.error_code ?? "PROFILE_ONBOARDING_REJECTED",
      durationMs: Date.now() - startedAt
    });
    return jsonResponse(
      {
        error: {
          code: onboarding.error_code ?? "PROFILE_ONBOARDING_REJECTED",
          message: onboarding.message ?? "Unable to create this Lumis profile."
        }
      },
      { status: onboarding.error_code === "PROFILE_ALREADY_EXISTS" ? 409 : 400 }
    );
  }

  if (providerRequestId) {
    await Promise.all([
      recordProviderCallOutcome(serviceClient, {
        requestId: providerRequestId,
        userId,
        status: "committed"
      }),
      recordWorkerPersistenceOutcome({
        requestId: providerRequestId,
        userId,
        outcome: "committed"
      })
    ]);
  }
  await recordProfileRuntimeEvent(serviceClient, {
    requestId,
    userId,
    outcome: "success",
    statusCode: 200,
    errorCode: null,
    durationMs: Date.now() - startedAt
  });

  return jsonResponse({
    profile_version: onboarding.profile_version,
    status: "profile_persisted",
    precision: chartRequest.birth_data.time_unknown ? "no_birth_time" : "full",
    contract: CHART_WORKER_CONTRACT,
    ai_profile_id: onboarding.ai_profile_id,
    chart_version: onboarding.chart_version,
    birth_data_history_id: onboarding.birth_data_history_id,
    chart_worker_contract: { ...chartRequest, user_id: userId },
    chart,
    next_step: chartResult.nextStep,
    request_id: requestId
  }, { headers: { "X-Lumis-Request-Id": requestId } });
});

async function handleBirthDetailsChange(input: {
  request: Request;
  requestId: string;
  startedAt: number;
}): Promise<Response> {
  let rawBody: unknown;

  try {
    rawBody = await input.request.json();
  } catch {
    return birthChangeError("49002", "Please submit valid birth details.", 400, input.requestId);
  }

  const validatedBody = validateBirthChangeRequest(rawBody);

  if ("message" in validatedBody) {
    return birthChangeError("49002", validatedBody.message, 400, input.requestId);
  }

  const body = validatedBody.body;
  const endpoint = "/profile/birth-details/change";
  const authHeader = input.request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return birthChangeError("PROFILE_AUTH_REQUIRED", "Sign in before changing birth details.", 401, input.requestId);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return birthChangeError("PROFILE_AUTH_REQUIRED", "Sign in before changing birth details.", 401, input.requestId);
  }

  const userId = authData.user.id;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const [birthResult, trustedLocationResult] = await Promise.all([
    serviceClient
      .from("birth_data")
      .select("birth_date, birth_time, time_unknown, place_name, country_code, lat, lng, tz_str, active_chart_version, successful_change_count")
      .eq("user_id", userId)
      .maybeSingle(),
    serviceClient.rpc("resolve_trusted_birth_location", {
      p_place_name: body.place_name,
      p_country_code: body.country_code,
      p_lat: body.lat,
      p_lng: body.lng
    })
  ]);

  if (birthResult.error || trustedLocationResult.error) {
    console.error("BIRTH_CHANGE_PREFLIGHT_FAILED", {
      request_id: input.requestId,
      user_id: userId,
      birth_code: birthResult.error?.code,
      location_code: trustedLocationResult.error?.code
    });
    return birthChangeError("49003", "Unable to verify the current chart right now.", 503, input.requestId);
  }

  const currentBirth = birthResult.data;
  const trustedLocation = trustedLocationResult.data as TrustedBirthLocation | null;

  if (!currentBirth || !trustedLocation) {
    return birthChangeError("49002", "Please choose a supported birthplace and try again.", 400, input.requestId);
  }

  if (!isValidBirthDate(body.birth_date, new Date(), trustedLocation.tz_str)) {
    return birthChangeError("49002", "Birth date must be real and cannot be in the future.", 400, input.requestId);
  }

  const normalizedBirthTime = body.time_unknown ? null : normalizeBirthTime(body.birth_time);
  const detailsAreUnchanged =
    currentBirth.birth_date === body.birth_date &&
    normalizeBirthTime(currentBirth.birth_time) === normalizedBirthTime &&
    currentBirth.time_unknown === Boolean(body.time_unknown) &&
    currentBirth.place_name === trustedLocation.place_name &&
    currentBirth.country_code === trustedLocation.country_code &&
    Number(currentBirth.lat) === Number(trustedLocation.lat) &&
    Number(currentBirth.lng) === Number(trustedLocation.lng) &&
    currentBirth.tz_str === trustedLocation.tz_str;

  const clientRequestId = body.client_request_id;
  const requestDigest = await birthChangeDigest({
    birthDate: body.birth_date,
    birthTime: normalizedBirthTime,
    timeUnknown: Boolean(body.time_unknown),
    location: trustedLocation
  });
  const { data: reservationData, error: reservationError } = await serviceClient.rpc(
    "reserve_birth_details_change",
    {
      p_user_id: userId,
      p_request_id: clientRequestId,
      p_request_digest: requestDigest
    }
  );

  if (reservationError) {
    console.error("BIRTH_CHANGE_RESERVATION_FAILED", {
      request_id: input.requestId,
      user_id: userId,
      code: reservationError.code
    });
    return birthChangeError("49003", "Unable to reserve this chart change. Please try again.", 503, input.requestId);
  }

  const reservation = reservationData as BirthChangeRpcResponse;

  if (!reservation.ok) {
    return birthChangeRpcError(reservation, input.requestId);
  }

  if (reservation.duplicate) {
    const authoritative = await loadAuthoritativeBirthChangeState(serviceClient, userId);

    if (!authoritative) {
      return birthChangeError("49003", "The updated chart could not be reloaded. Your saved chart remains active.", 503, input.requestId);
    }

    return jsonResponse(
      { status: "birth_details_already_regenerated", ...authoritative, request_id: input.requestId },
      { headers: { "X-Lumis-Request-Id": input.requestId } }
    );
  }

  if (reservation.new_reservation) {
    let rateLimit: RateLimitResult;

    try {
      rateLimit = await consumeProfileRateLimit(serviceClient, userId, endpoint, 3, 600);
    } catch (error) {
      await failBirthChangeReservation(serviceClient, userId, clientRequestId, "49003");
      console.error("BIRTH_CHANGE_RATE_LIMIT_CHECK_FAILED", {
        request_id: input.requestId,
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown"
      });
      return birthChangeError("49003", "Birth-detail changes are briefly unavailable. Please try again.", 503, input.requestId);
    }

    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.retry_after_seconds ?? 600);
      await failBirthChangeReservation(serviceClient, userId, clientRequestId, "BIRTH_CHANGE_RATE_LIMITED");
      await recordProfileRuntimeEvent(serviceClient, {
        requestId: input.requestId,
        userId,
        endpoint,
        outcome: "rejected",
        statusCode: 429,
        errorCode: "BIRTH_CHANGE_RATE_LIMITED",
        durationMs: Date.now() - input.startedAt
      });
      return jsonResponse(
        {
          error: { code: "BIRTH_CHANGE_RATE_LIMITED", message: "Please wait before trying again." },
          request_id: input.requestId
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter), "X-Lumis-Request-Id": input.requestId }
        }
      );
    }
  }

  if (detailsAreUnchanged) {
    await failBirthChangeReservation(serviceClient, userId, clientRequestId, "NO_BIRTH_DETAILS_CHANGED");
    return birthChangeError("49002", "No birth details changed.", 400, input.requestId);
  }

  const chartRequest: SignedChartWorkerRequest = {
    user_id: userId,
    calculation_version: "mobile_natal_v1",
    birth_data: {
      birth_date: body.birth_date,
      birth_time: normalizedBirthTime,
      time_unknown: Boolean(body.time_unknown),
      place_name: trustedLocation.place_name,
      country_code: trustedLocation.country_code,
      lat: trustedLocation.lat,
      lng: trustedLocation.lng,
      tz_str: trustedLocation.tz_str
    },
    audit: {
      source: "mobile_app",
      product: "Lumis",
      flow: "birth_details_regeneration",
      plan: "current",
      chart_type: "natal"
    }
  };

  let chartResult: ChartGenerationResult;

  try {
    chartResult = await generateChart({
      chartRequest,
      body,
      workerRequestId: reservation.worker_request_id ?? clientRequestId,
      requestedAt: reservation.worker_requested_at
    });
  } catch (error) {
    await failBirthChangeReservation(serviceClient, userId, clientRequestId, "CHART_WORKER_FAILED");
    console.error("BIRTH_CHANGE_CHART_WORKER_FAILED", {
      request_id: input.requestId,
      user_id: userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    await recordProfileRuntimeEvent(serviceClient, {
      requestId: input.requestId,
      userId,
      endpoint,
      outcome: "failed",
      statusCode: 502,
      errorCode: "49003",
      durationMs: Date.now() - input.startedAt
    });
    return birthChangeError("49003", "Chart regeneration failed. Your previous chart is still active.", 502, input.requestId);
  }

  const providerRequestId =
    chartResult.status === "worker_chart_generated" && typeof chartResult.rawChartJson.request_id === "string"
      ? chartResult.rawChartJson.request_id
      : null;

  if (providerRequestId) {
    const workerSummary = chartResult.rawChartJson.worker_response_summary as Record<string, unknown> | undefined;
    await recordProviderCallOutcome(serviceClient, {
      requestId: providerRequestId,
      userId,
      status: "generated",
      workerDisposition:
        workerSummary?.provider_disposition === "generated" || workerSummary?.provider_disposition === "already_generated"
          ? workerSummary.provider_disposition
          : undefined,
      providerCallCount:
        typeof workerSummary?.provider_call_count === "number" ? workerSummary.provider_call_count : undefined
    });
  }

  const { data: completionData, error: completionError } = await serviceClient.rpc(
    "complete_birth_details_change",
    {
      p_user_id: userId,
      p_request_id: clientRequestId,
      p_birth_date: body.birth_date,
      p_birth_time: normalizedBirthTime,
      p_time_unknown: Boolean(body.time_unknown),
      p_place_name: trustedLocation.place_name,
      p_country_code: trustedLocation.country_code,
      p_lat: trustedLocation.lat,
      p_lng: trustedLocation.lng,
      p_tz_str: trustedLocation.tz_str,
      p_chart_json: chartResult.chart,
      p_raw_chart_json: {
        status: chartResult.status,
        request_id: providerRequestId,
        worker_response_summary: chartResult.rawChartJson.worker_response_summary
      },
      p_precision: chartResult.chart.precision,
      p_model:
        chartResult.status === "worker_chart_generated"
          ? "cloudflare_worker_mobile_natal_v1"
          : "fixture_until_worker_connected"
    }
  );
  const completion = completionData as BirthChangeRpcResponse | null;

  if (completionError || !completion?.ok) {
    const errorCode = completion?.error_code ?? "49003";
    await failBirthChangeReservation(serviceClient, userId, clientRequestId, errorCode);
    if (providerRequestId) {
      await Promise.all([
        recordProviderCallOutcome(serviceClient, {
          requestId: providerRequestId,
          userId,
          status: "persistence_failed",
          errorCode
        }),
        recordWorkerPersistenceOutcome({ requestId: providerRequestId, userId, outcome: "persistence_failed", errorCode })
      ]);
    }
    console.error("BIRTH_CHANGE_COMMIT_FAILED", {
      request_id: input.requestId,
      user_id: userId,
      code: completionError?.code ?? errorCode
    });
    return birthChangeRpcError(completion ?? { error_code: "49003" }, input.requestId);
  }

  if (providerRequestId) {
    await Promise.all([
      recordProviderCallOutcome(serviceClient, { requestId: providerRequestId, userId, status: "committed" }),
      recordWorkerPersistenceOutcome({ requestId: providerRequestId, userId, outcome: "committed" })
    ]);
  }
  await recordProfileRuntimeEvent(serviceClient, {
    requestId: input.requestId,
    userId,
    endpoint,
    outcome: "success",
    statusCode: 200,
    errorCode: null,
    durationMs: Date.now() - input.startedAt
  });

  return jsonResponse(
    {
      status: "birth_details_regenerated",
      chart_version: completion.chart_version,
      profile_version: completion.profile_version,
      ai_profile_id: completion.ai_profile_id,
      birth_data_history_id: completion.birth_data_history_id,
      successful_change_count: completion.successful_change_count,
      remaining_changes: completion.remaining_changes,
      precision: chartResult.chart.precision,
      chart: chartResult.chart,
      request_id: input.requestId
    },
    { headers: { "X-Lumis-Request-Id": input.requestId } }
  );
}

function validateBirthChangeRequest(
  value: unknown
): { ok: true; body: ProfileRequest & { client_request_id: string; time_unknown: boolean; country_code: string; lat: number; lng: number } } | { ok: false; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Please submit valid birth details." };
  }

  const body = value as Record<string, unknown>;
  const requestId = body.client_request_id;
  const birthDate = body.birth_date;
  const birthTime = body.birth_time;
  const timeUnknown = body.time_unknown;
  const placeName = body.place_name;
  const countryCode = body.country_code;
  const lat = body.lat;
  const lng = body.lng;

  if (typeof requestId !== "string" || !isUuid(requestId)) {
    return { ok: false, message: "The birth-detail request ID is invalid." };
  }
  if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { ok: false, message: "Please enter a valid birth date." };
  }
  if (typeof timeUnknown !== "boolean") {
    return { ok: false, message: "Please confirm whether the birth time is known." };
  }
  if (!timeUnknown && (typeof birthTime !== "string" || !isStrictBirthTime(birthTime))) {
    return { ok: false, message: "Please enter a valid birth time." };
  }
  if (timeUnknown && birthTime !== null && birthTime !== undefined) {
    return { ok: false, message: "Birth time must be empty when it is marked unknown." };
  }
  if (typeof placeName !== "string" || placeName.trim().length === 0) {
    return { ok: false, message: "Please choose a supported birthplace." };
  }
  if (typeof countryCode !== "string" || !/^[A-Za-z]{2}$/.test(countryCode)) {
    return { ok: false, message: "The birthplace country code is invalid." };
  }
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, message: "The birthplace latitude is invalid." };
  }
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, message: "The birthplace longitude is invalid." };
  }
  if (body.display_name !== undefined && typeof body.display_name !== "string") {
    return { ok: false, message: "The display name is invalid." };
  }

  return {
    ok: true,
    body: {
      client_request_id: requestId,
      display_name: typeof body.display_name === "string" ? body.display_name : undefined,
      birth_date: birthDate,
      birth_time: timeUnknown ? null : birthTime as string,
      time_unknown: timeUnknown,
      place_name: placeName.trim(),
      country_code: countryCode.toUpperCase(),
      lat,
      lng,
      tz_str: typeof body.tz_str === "string" ? body.tz_str : undefined
    }
  };
}

function isStrictBirthTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

async function loadAuthoritativeBirthChangeState(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<Record<string, unknown> | null> {
  const { data: birthData, error: birthError } = await serviceClient
    .from("birth_data")
    .select("active_chart_version, successful_change_count, time_unknown")
    .eq("user_id", userId)
    .maybeSingle();

  if (birthError || !birthData) return null;

  const { data: profile, error: profileError } = await serviceClient
    .from("ai_profiles")
    .select("id, version, chart_version, birth_data_history_id, chart_json, precision")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("chart_version", birthData.active_chart_version)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError || !profile) return null;

  return {
    chart_version: profile.chart_version,
    profile_version: profile.version,
    ai_profile_id: profile.id,
    birth_data_history_id: profile.birth_data_history_id,
    successful_change_count: Number(birthData.successful_change_count),
    remaining_changes: Math.max(0, 3 - Number(birthData.successful_change_count)),
    precision: profile.precision,
    chart: sanitizeChartForClient(profile.chart_json, Boolean(birthData.time_unknown))
  };
}

function birthChangeError(code: string, message: string, status: number, requestId: string): Response {
  return jsonResponse(
    { error: { code, message }, request_id: requestId },
    { status, headers: { "X-Lumis-Request-Id": requestId } }
  );
}

function birthChangeRpcError(result: BirthChangeRpcResponse, requestId: string): Response {
  const code = result.error_code ?? "49003";
  const status = code === "49002" ? 400 : code === "49001" ? 409 : 409;
  const fallback =
    code === "49001"
      ? "Birth details have already been changed three times."
      : code === "49002"
        ? "Please correct the birth details and try again."
        : "Chart regeneration could not finish. Your previous chart is still active.";

  return jsonResponse(
    {
      error: { code, message: result.message ?? fallback },
      successful_change_count: result.successful_change_count,
      remaining_changes: result.remaining_changes,
      request_id: requestId
    },
    { status, headers: { "X-Lumis-Request-Id": requestId } }
  );
}

async function failBirthChangeReservation(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
  errorCode: string
): Promise<void> {
  const { error } = await serviceClient.rpc("fail_birth_details_change", {
    p_user_id: userId,
    p_request_id: requestId,
    p_error_code: errorCode
  });

  if (error) {
    console.error("BIRTH_CHANGE_RESERVATION_RELEASE_FAILED", {
      request_id: requestId,
      user_id: userId,
      code: error.code
    });
  }
}

async function birthChangeDigest(input: {
  birthDate: string;
  birthTime: string | null;
  timeUnknown: boolean;
  location: TrustedBirthLocation;
}): Promise<string> {
  const canonical = JSON.stringify([
    input.birthDate,
    input.birthTime,
    input.timeUnknown,
    input.location.location_key,
    input.location.place_name,
    input.location.country_code,
    input.location.lat,
    input.location.lng,
    input.location.tz_str
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return bytesToHex(new Uint8Array(digest));
}

function normalizeBirthTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function consumeProfileRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  endpoint = "/profile",
  maxRequests = 5,
  windowSeconds = 600
): Promise<RateLimitResult> {
  const { data, error } = await serviceClient.rpc("check_api_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds
  });

  if (error) {
    throw new Error(error.code ?? "PROFILE_RATE_LIMIT_CHECK_FAILED");
  }

  return (data ?? {}) as RateLimitResult;
}

async function recordProviderCallOutcome(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    requestId: string;
    userId: string;
    status: "generated" | "committed" | "persistence_failed";
    errorCode?: string;
    workerDisposition?: "generated" | "already_generated";
    providerCallCount?: number;
  }
): Promise<void> {
  const { data, error } = await serviceClient.rpc("record_chart_provider_call_event", {
    p_request_id: input.requestId,
    p_user_id: input.userId,
    p_status: input.status,
    p_error_code: input.errorCode ?? null,
    p_worker_disposition: input.workerDisposition ?? null,
    p_provider_call_count: input.providerCallCount ?? null
  });

  if (error || !(data as { ok?: boolean } | null)?.ok) {
    console.error("PROFILE_PROVIDER_OUTCOME_WRITE_FAILED", {
      request_id: input.requestId,
      user_id: input.userId,
      status: input.status,
      code: error?.code ?? (data as { error_code?: string } | null)?.error_code ?? "PROVIDER_EVENT_WRITE_REJECTED"
    });
  }
}

async function recordWorkerPersistenceOutcome(input: {
  requestId: string;
  userId: string;
  outcome: "committed" | "persistence_failed";
  errorCode?: string;
}): Promise<void> {
  const workerUrl = chartWorkerUrl();
  const signingSecret = Deno.env.get("CHART_WORKER_SIGNING_SECRET");

  if (!workerUrl || !signingSecret) {
    return;
  }

  const outcomeUrl = workerUrl.replace(/\/mobile\/natal-chart\/?$/, "/mobile/chart-persistence-outcome");
  const bodyText = JSON.stringify({
    request_id: input.requestId,
    user_id: input.userId,
    outcome: input.outcome,
    error_code: input.errorCode ?? null
  });
  const timestamp = String(Date.now());
  const signature = await signChartWorkerRequest({ bodyText, signingSecret, timestamp });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(outcomeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lumis-Signature-Version": "v1",
        "X-Lumis-Timestamp": timestamp,
        "X-Lumis-Signature": signature,
        "X-Lumis-Request-Id": input.requestId,
        "X-Lumis-User-Id": input.userId
      },
      body: bodyText,
      signal: controller.signal
    });

    if (!response.ok) {
      console.error("PROFILE_WORKER_OUTCOME_WRITE_FAILED", {
        request_id: input.requestId,
        user_id: input.userId,
        outcome: input.outcome,
        status: response.status
      });
    }
  } catch (error) {
    console.error("PROFILE_WORKER_OUTCOME_WRITE_FAILED", {
      request_id: input.requestId,
      user_id: input.userId,
      outcome: input.outcome,
      code: error instanceof DOMException && error.name === "AbortError"
        ? "WORKER_OUTCOME_TIMEOUT"
        : "WORKER_OUTCOME_REQUEST_FAILED"
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function recordProfileRuntimeEvent(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    requestId: string;
    endpoint?: string;
    userId: string;
    outcome: "success" | "rejected" | "failed";
    statusCode: number;
    errorCode: string | null;
    durationMs: number;
  }
): Promise<void> {
  const { error } = await serviceClient.rpc("record_runtime_request_event", {
    p_request_id: input.requestId,
    p_endpoint: input.endpoint ?? "/profile",
    p_user_id: input.userId,
    p_outcome: input.outcome,
    p_status_code: input.statusCode,
    p_error_code: input.errorCode,
    p_duration_ms: input.durationMs
  });

  if (error) {
    console.error("PROFILE_RUNTIME_EVENT_WRITE_FAILED", {
      request_id: input.requestId,
      code: error.code
    });
  }
}

function invalidBirthDateResponse(): Response {
  return jsonResponse(
    {
      error: {
        code: "PROFILE_BIRTH_DATE_INVALID",
        message: "Birth date must be a real date and cannot be in the future."
      }
    },
    { status: 400 }
  );
}

async function loadExistingProfileState(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<ExistingProfileState> {
  const [birthResult, profileResult, grantResult] = await Promise.all([
    serviceClient
      .from("birth_data")
      .select("birth_date, birth_time, time_unknown, place_name, country_code, lat, lng, tz_str")
      .eq("user_id", userId)
      .maybeSingle(),
    serviceClient
      .from("ai_profiles")
      .select("id, version, chart_version, birth_data_history_id, chart_json, raw_chart_json, precision, model")
      .eq("user_id", userId)
      .order("chart_version", { ascending: false })
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceClient
      .from("monthly_balance")
      .select("id")
      .eq("user_id", userId)
      .eq("grant_type", "starter_onboarding")
      .limit(1)
      .maybeSingle()
  ]);

  if (birthResult.error) {
    throw new Error(birthResult.error.message);
  }

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (grantResult.error) {
    throw new Error(grantResult.error.message);
  }

  return {
    hasBirthData: birthResult.data != null,
    hasProfile: profileResult.data != null,
    hasStarterGrant: grantResult.data != null,
    birthData: birthResult.data as ExistingBirthData | null,
    profile: profileResult.data as ExistingAiProfile | null
  };
}

async function repairExistingProfile(input: {
  existingProfile: ExistingProfileState;
  serviceClient: ReturnType<typeof createClient>;
  userId: string;
}): Promise<Response> {
  if (!input.existingProfile.birthData || !input.existingProfile.profile) {
    return jsonResponse(
      {
        error: {
          code: "PROFILE_RECOVERY_INCOMPLETE",
          message: "Saved birth data and chart profile are required for Starter grant repair."
        }
      },
      { status: 409 }
    );
  }

  const birthData = input.existingProfile.birthData;
  const profile = input.existingProfile.profile;
  const { data: onboardingData, error: onboardingError } = await input.serviceClient.rpc(
    "complete_profile_onboarding",
    {
      p_user_id: input.userId,
      p_display_name: null,
      p_birth_date: birthData.birth_date,
      p_birth_time: birthData.time_unknown ? null : birthData.birth_time,
      p_time_unknown: birthData.time_unknown,
      p_place_name: birthData.place_name,
      p_country_code: birthData.country_code,
      p_lat: birthData.lat,
      p_lng: birthData.lng,
      p_tz_str: birthData.tz_str,
      p_role: null,
      p_chart_json: sanitizeChartForClient(profile.chart_json, birthData.time_unknown),
      p_raw_chart_json: null,
      p_precision: profile.precision,
      p_model: profile.model ?? "recovered_existing_profile"
    }
  );

  if (onboardingError) {
    console.error("PROFILE_RECOVERY_FAILED", {
      user_id: input.userId,
      code: onboardingError.code
    });
    return jsonResponse(
      { error: { code: "PROFILE_ONBOARDING_FAILED", message: "Unable to repair this Lumis profile right now." } },
      { status: 500 }
    );
  }

  const onboarding = onboardingData as OnboardingRpcResponse;

  if (!onboarding.ok) {
    return jsonResponse(
      {
        error: {
          code: onboarding.error_code ?? "PROFILE_ONBOARDING_REJECTED",
          message: onboarding.message ?? "Unable to repair this Lumis profile."
        }
      },
      { status: onboarding.error_code === "PROFILE_ALREADY_EXISTS" ? 409 : 400 }
    );
  }

  return jsonResponse({
    profile_version: onboarding.profile_version,
    status: "profile_repaired",
    precision: profile.precision,
    contract: CHART_WORKER_CONTRACT,
    ai_profile_id: onboarding.ai_profile_id,
    chart_version: onboarding.chart_version,
    birth_data_history_id: onboarding.birth_data_history_id,
    chart: sanitizeChartForClient(profile.chart_json, birthData.time_unknown),
    next_step:
      "Recovered missing Starter grant and chart-history linkage from the existing saved chart profile without calling the chart Worker."
  });
}

async function generateChart(input: {
  chartRequest: SignedChartWorkerRequest;
  body: ProfileRequest;
  workerRequestId?: string;
  requestedAt?: string;
}): Promise<ChartGenerationResult> {
  const workerUrl = chartWorkerUrl();
  const signingSecret = Deno.env.get("CHART_WORKER_SIGNING_SECRET");

  if (!workerUrl || !signingSecret) {
    if (!allowsFixtureFallback()) {
      throw new Error(
        "Chart Worker is not configured. Production deployments must set CHART_WORKER_URL and CHART_WORKER_SIGNING_SECRET."
      );
    }

    return {
      chart: buildFixtureChart(input.body),
      rawChartJson: {
        status: "fixture_worker_not_configured",
        reason: "CHART_WORKER_URL and CHART_WORKER_SIGNING_SECRET are required for live chart generation"
      },
      status: "fixture_worker_not_configured",
      nextStep:
        "Configure CHART_WORKER_URL and CHART_WORKER_SIGNING_SECRET to replace the fixture with the signed Cloudflare Worker chart_v2 response."
    };
  }

  const requestId = input.workerRequestId ?? crypto.randomUUID();
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const payload: MobileChartWorkerPayload = {
    ...input.chartRequest,
    request_id: requestId,
    requested_at: requestedAt,
    client: {
      source: "lumis_mobile_supabase",
      environment: lumisEnvironment()
    }
  };
  const bodyText = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = await signChartWorkerRequest({
    bodyText,
    signingSecret,
    timestamp
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), chartWorkerTimeoutMs());

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lumis-Signature-Version": "v1",
        "X-Lumis-Timestamp": timestamp,
        "X-Lumis-Signature": signature,
        "X-Lumis-Request-Id": requestId,
        "X-Lumis-User-Id": input.chartRequest.user_id
      },
      body: bodyText,
      signal: controller.signal
    });
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Chart Worker returned ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const workerResponse = JSON.parse(responseText) as Record<string, unknown>;
    const chart = extractChartV2(workerResponse);

    return {
      chart: sanitizeChartForClient(chart, input.chartRequest.birth_data.time_unknown),
      rawChartJson: {
        status: "worker_chart_generated",
        request_id: requestId,
        worker_response_summary: summarizeWorkerResponse(workerResponse)
      },
      status: "worker_chart_generated",
      nextStep: "Signed Cloudflare Worker chart_v2 response generated and saved."
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Chart Worker request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function allowsFixtureFallback(): boolean {
  return allowsFixtureFallbackForEnvironment(lumisEnvironment());
}

function lumisEnvironment(): string {
  return (Deno.env.get("LUMIS_ENV") ?? "production").toLowerCase();
}

function chartWorkerUrl(): string | null {
  const configuredUrl = Deno.env.get("CHART_WORKER_URL")?.trim();

  if (!configuredUrl) {
    return null;
  }

  if (/\/mobile\/natal-chart\/?$/.test(configuredUrl)) {
    return configuredUrl;
  }

  const endpoint = Deno.env.get("CHART_WORKER_ENDPOINT")?.trim() || CHART_WORKER_CONTRACT.endpoint;
  return `${configuredUrl.replace(/\/+$/, "")}${endpoint}`;
}

function chartWorkerTimeoutMs(): number {
  const configuredTimeout = Number(Deno.env.get("CHART_WORKER_TIMEOUT_MS"));

  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 15_000;
}

async function signChartWorkerRequest(input: {
  bodyText: string;
  signingSecret: string;
  timestamp: string;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${input.timestamp}.${input.bodyText}`)
  );

  return `sha256=${bytesToHex(new Uint8Array(signature))}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function extractChartV2(workerResponse: Record<string, unknown>): ChartV2 {
  const candidate = (workerResponse.chart_v2 ?? workerResponse.chart) as ChartV2 | undefined;

  if (!candidate || candidate.version !== "chart_v2" || !Array.isArray(candidate.planets)) {
    throw new Error("Chart Worker response did not include a valid chart_v2 payload.");
  }

  return candidate;
}

function summarizeWorkerResponse(workerResponse: Record<string, unknown>): Record<string, unknown> {
  const chart = (workerResponse.chart_v2 ?? workerResponse.chart) as ChartV2 | undefined;

  return {
    request_id: workerResponse.request_id,
    chart_version: chart?.version,
    precision: chart?.precision,
    source: chart?.source,
    provider_disposition:
      (workerResponse.provider_telemetry as Record<string, unknown> | undefined)?.disposition,
    provider_call_count:
      (workerResponse.provider_telemetry as Record<string, unknown> | undefined)?.provider_call_count,
    calculatedAt: chart?.calculatedAt,
    planet_count: Array.isArray(chart?.planets) ? chart.planets.length : null,
    house_count: Array.isArray(chart?.houses) ? chart.houses.length : null
  };
}

function buildFixtureChart(body: ProfileRequest): ChartV2 {
  const chart: ChartV2 = {
    version: "chart_v2",
    precision: body.time_unknown ? "no_birth_time" : "full",
    source: "fixture",
    calculatedAt: new Date().toISOString(),
    planets: [
      {
        key: "sun",
        label: "Sun",
        sign: "Capricorn",
        degree: 10,
        house: body.time_unknown ? undefined : 1
      },
      {
        key: "moon",
        label: "Moon",
        sign: "Cancer",
        degree: 18,
        house: body.time_unknown ? undefined : 7
      },
      {
        key: "ascendant",
        label: "Ascendant",
        sign: "Libra",
        degree: 6,
        house: body.time_unknown ? undefined : 1
      }
    ],
    houses: [],
    angles: {
      ascendant: body.time_unknown
        ? undefined
        : {
            key: "ascendant",
            label: "Ascendant",
            sign: "Libra",
            degree: 6,
            house: 1
          }
    }
  };

  return sanitizeChartForClient(chart, body.time_unknown ?? false);
}
