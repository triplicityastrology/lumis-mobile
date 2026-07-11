import { buildProfileChartDraft, CHART_WORKER_CONTRACT } from "@lumis/astrology";

export type BirthProfileForm = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
};

export type PreparedChartProfileRequest = {
  status: "prepared";
  endpoint: typeof CHART_WORKER_CONTRACT.supabaseFunction;
  workerEndpoint: typeof CHART_WORKER_CONTRACT.endpoint;
  payload: {
    display_name: string;
    birth_date: string;
    birth_time: string;
    place_name: string;
  };
};

export function prepareChartProfileRequest(
  form: BirthProfileForm
): PreparedChartProfileRequest {
  const payload = buildProfileChartDraft(form);

  return {
    status: "prepared",
    endpoint: CHART_WORKER_CONTRACT.supabaseFunction,
    workerEndpoint: CHART_WORKER_CONTRACT.endpoint,
    payload
  };
}
