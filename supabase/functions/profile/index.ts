import type { SignedChartWorkerRequest } from "@lumis/astrology";

type ProfileRequest = {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
  country_code: string;
  lat: number;
  lng: number;
  tz_str: string;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  const body = (await request.json()) as ProfileRequest;
  const chartRequest: SignedChartWorkerRequest = {
    user_id: "TODO_FROM_SUPABASE_JWT",
    calculation_version: "mobile_natal_v1",
    birth_data: {
      name: "Lumis user",
      birth_date: body.birth_date,
      birth_time: body.birth_time,
      time_unknown: body.time_unknown,
      place_name: body.place_name,
      country_code: body.country_code,
      lat: body.lat,
      lng: body.lng,
      tz_str: body.tz_str
    }
  };

  return Response.json({
    profile_version: 0,
    precision: body.time_unknown ? "no_birth_time" : "full",
    chart_worker_contract: chartRequest,
    next_step: "Wire signed Cloudflare Worker wrapper and persist chart_v2 in Supabase."
  });
});

