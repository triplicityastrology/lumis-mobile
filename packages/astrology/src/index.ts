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

export type ProfileChartDraft = {
  display_name: string;
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
};

export function buildProfileChartDraft(input: {
  name: string;
  birthDate: string;
  birthTime: string;
  timeUnknown?: boolean;
  birthPlace: string;
}): ProfileChartDraft {
  return {
    display_name: input.name.trim(),
    birth_date: input.birthDate.trim(),
    birth_time: input.timeUnknown ? null : input.birthTime.trim(),
    time_unknown: input.timeUnknown ?? false,
    place_name: input.birthPlace.trim()
  };
}

export const CHART_WORKER_CONTRACT = {
  supabaseFunction: "/profile",
  endpoint: "/mobile/natal-chart",
  auth: "HMAC signature from Supabase Edge Function",
  source: "Cloudflare Worker wrapper based on website worker.js",
  storesTruthIn: "Supabase, not Cloudflare KV"
} as const;

export {
  decideProfilePreflight,
  type ProfilePreflightDecision,
  type ProfilePreflightState
} from "./profile-preflight";
export { sanitizeChartForClient } from "./chart-sanitizer";
export { allowsFixtureFallbackForEnvironment } from "./chart-worker-config";
