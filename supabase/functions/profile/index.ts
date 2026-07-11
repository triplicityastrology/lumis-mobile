import { CHART_WORKER_CONTRACT, type SignedChartWorkerRequest } from "@lumis/astrology";

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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  const body = (await request.json()) as ProfileRequest;

  if (!body.birth_date || !body.place_name || (!body.birth_time && !body.time_unknown)) {
    return Response.json(
      {
        error: {
          code: "PROFILE_INCOMPLETE",
          message: "birth_date, birth_time or time_unknown, and place_name are required"
        }
      },
      { status: 400 }
    );
  }

  const chartRequest: SignedChartWorkerRequest = {
    user_id: "TODO_FROM_SUPABASE_JWT",
    calculation_version: "mobile_natal_v1",
    birth_data: {
      name: body.display_name ?? "Lumis user",
      birth_date: body.birth_date,
      birth_time: body.birth_time ?? null,
      time_unknown: body.time_unknown ?? false,
      place_name: body.place_name,
      country_code: body.country_code ?? "HK",
      lat: body.lat ?? 22.3193,
      lng: body.lng ?? 114.1694,
      tz_str: body.tz_str ?? "Asia/Hong_Kong"
    }
  };

  return Response.json({
    profile_version: 0,
    status: "profile_request_prepared",
    precision: chartRequest.birth_data.time_unknown ? "no_birth_time" : "full",
    contract: CHART_WORKER_CONTRACT,
    chart_worker_contract: chartRequest,
    next_step: "Wire signed Cloudflare Worker wrapper and persist chart_v2 in Supabase."
  });
});
