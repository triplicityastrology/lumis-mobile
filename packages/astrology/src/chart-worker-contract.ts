export type ChartWorkerBirthData = {
  name?: string;
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
  country_code: string;
  lat: number;
  lng: number;
  tz_str: string;
};

export type SignedChartWorkerRequest = {
  user_id: string;
  birth_data: ChartWorkerBirthData;
  calculation_version: "mobile_natal_v1";
  audit?: {
    source: "mobile_app";
    product: "Lumis";
    flow: "onboarding_chart_generation" | "birth_details_regeneration";
    email?: string;
    plan: string;
    chart_type: "natal";
  };
};

export const CHART_WORKER_CONTRACT = {
  supabaseFunction: "/profile",
  endpoint: "/mobile/natal-chart",
  auth: "HMAC signature from Supabase Edge Function",
  source: "Cloudflare Worker wrapper based on website worker.js",
  storesTruthIn: "Supabase, not Cloudflare KV"
} as const;
