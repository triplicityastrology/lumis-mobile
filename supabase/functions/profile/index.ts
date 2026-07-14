import { CHART_WORKER_CONTRACT, type SignedChartWorkerRequest } from "@lumis/astrology";
import { createClient } from "@supabase/supabase-js";
import type { ChartV2 } from "@lumis/shared";

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
  const chart = buildFixtureChart(body);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
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
        status: "worker_pending",
        chart_worker_contract: { ...chartRequest, user_id: userId }
      },
      p_precision: chart.precision,
      p_model: "fixture_until_worker_connected"
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
    chart_worker_contract: { ...chartRequest, user_id: userId },
    chart,
    next_step: "Replace fixture chart with signed Cloudflare Worker chart_v2 response."
  });
});

function buildFixtureChart(body: ProfileRequest): ChartV2 {
  return {
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
        sign: body.time_unknown ? "Unknown" : "Libra",
        degree: body.time_unknown ? 0 : 6,
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
}
