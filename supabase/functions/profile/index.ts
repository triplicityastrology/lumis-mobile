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

  const { data: existingBirthData, error: existingBirthDataError } = await serviceClient
    .from("birth_data")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingBirthDataError) {
    return jsonResponse(
      { error: { code: "PROFILE_LOOKUP_FAILED", message: existingBirthDataError.message } },
      { status: 500 }
    );
  }

  if (existingBirthData) {
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

  const { error: userError } = await serviceClient.from("users").upsert({
    id: userId,
    display_name: body.display_name ?? "Lumis user",
    buddy_name: "Lumis",
    persona_style: "acceptance",
    role
  });

  if (userError) {
    return jsonResponse({ error: { code: "USER_SAVE_FAILED", message: userError.message } }, { status: 500 });
  }

  const { error: birthError } = await serviceClient.from("birth_data").insert({
    user_id: userId,
    birth_date: body.birth_date,
    birth_time: body.time_unknown ? null : body.birth_time,
    time_unknown: body.time_unknown ?? false,
    place_name: body.place_name,
    country_code: body.country_code,
    lat: body.lat,
    lng: body.lng,
    tz_str: body.tz_str
  });

  if (birthError) {
    if (birthError.code === "23505") {
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

    return jsonResponse({ error: { code: "BIRTH_SAVE_FAILED", message: birthError.message } }, { status: 500 });
  }

  const { data: latestProfile } = await serviceClient
    .from("ai_profiles")
    .select("version")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const profileVersion = (latestProfile?.version ?? 0) + 1;
  const { data: profile, error: profileError } = await serviceClient
    .from("ai_profiles")
    .insert({
      user_id: userId,
      version: profileVersion,
      chart_json: chart,
      raw_chart_json: {
        status: "worker_pending",
        chart_worker_contract: { ...chartRequest, user_id: userId }
      },
      precision: chart.precision,
      model: "fixture_until_worker_connected"
    })
    .select("id, version")
    .single();

  if (profileError) {
    return jsonResponse({ error: { code: "PROFILE_SAVE_FAILED", message: profileError.message } }, { status: 500 });
  }

  const { error: starterGrantError } = await serviceClient.from("monthly_balance").insert({
    user_id: userId,
    grant_type: "starter_onboarding",
    allocated: 50,
    remaining: 50
  });

  if (starterGrantError && starterGrantError.code !== "23505") {
    return jsonResponse(
      { error: { code: "STARTER_GRANT_FAILED", message: starterGrantError.message } },
      { status: 500 }
    );
  }

  return jsonResponse({
    profile_version: profile.version,
    status: "profile_persisted",
    precision: chartRequest.birth_data.time_unknown ? "no_birth_time" : "full",
    contract: CHART_WORKER_CONTRACT,
    ai_profile_id: profile.id,
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
