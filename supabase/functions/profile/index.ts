import {
  CHART_WORKER_CONTRACT,
  type SignedChartWorkerRequest
} from "../../../packages/astrology/src/chart-worker-contract.ts";
import { allowsFixtureFallbackForEnvironment } from "../../../packages/astrology/src/chart-worker-config.ts";
import { sanitizeChartForClient } from "../../../packages/astrology/src/chart-sanitizer.ts";
import { decideProfilePreflight } from "../../../packages/astrology/src/profile-preflight.ts";
import { createClient } from "@supabase/supabase-js";
import type { ChartV2 } from "../../../packages/shared/src/types/chart.ts";
import { isValidBirthDate } from "../../../packages/shared/src/config/birth-date.ts";

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

type ProfileRequest = {
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
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) {
    return corsPreflight;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
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

  if (!isValidBirthDate(body.birth_date)) {
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

  if (!body.country_code || body.lat == null || body.lng == null || !body.tz_str) {
    return jsonResponse(
      {
        error: {
          code: "LOCATION_UNRESOLVED",
          message: "country_code, lat, lng, and tz_str are required before chart generation"
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
      tz_str: body.tz_str
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

  let chartResult: ChartGenerationResult;

  try {
    chartResult = await generateChart({
      chartRequest: { ...chartRequest, user_id: userId },
      body
    });
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: "CHART_WORKER_FAILED",
          message: error instanceof Error ? error.message : "Unable to generate this Lumis chart."
        }
      },
      { status: 502 }
    );
  }

  const chart = chartResult.chart;
  const role = personaStyleToInternalRole.acceptance;

  const { data: onboardingData, error: onboardingError } = await serviceClient.rpc(
    "complete_profile_onboarding",
    {
      p_user_id: userId,
      p_display_name: body.display_name ?? "Lumis user",
      p_birth_date: body.birth_date,
      p_birth_time: body.time_unknown ? null : body.birth_time,
      p_time_unknown: body.time_unknown ?? false,
      p_place_name: body.place_name,
      p_country_code: body.country_code,
      p_lat: body.lat,
      p_lng: body.lng,
      p_tz_str: body.tz_str,
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
    return jsonResponse(
      { error: { code: "PROFILE_ONBOARDING_FAILED", message: onboardingError.message } },
      { status: 500 }
    );
  }

  const onboarding = onboardingData as OnboardingRpcResponse;

  if (!onboarding.ok) {
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
    next_step: chartResult.nextStep
  });
});

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
    return jsonResponse(
      { error: { code: "PROFILE_ONBOARDING_FAILED", message: onboardingError.message } },
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

  const requestId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();
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
