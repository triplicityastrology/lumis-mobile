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
};

export const CHART_WORKER_CONTRACT = {
  endpoint: "/mobile/natal-chart",
  auth: "HMAC signature from Supabase Edge Function",
  source: "Cloudflare Worker wrapper based on website worker.js",
  storesTruthIn: "Supabase, not Cloudflare KV"
} as const;

