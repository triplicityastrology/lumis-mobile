import { buildProfileChartDraft, CHART_WORKER_CONTRACT } from "@lumis/astrology";

import { getSupabaseClient } from "./supabase";

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

export type ChartProfileResult =
  | (PreparedChartProfileRequest & {
      mode: "local";
      message: string;
    })
  | {
      mode: "supabase";
      status: "submitted";
      data: unknown;
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

export async function submitChartProfile(form: BirthProfileForm): Promise<ChartProfileResult> {
  const preparedRequest = prepareChartProfileRequest(form);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      ...preparedRequest,
      mode: "local",
      message:
        "Supabase is not configured yet. The chart request is prepared locally and ready to submit once env vars are set."
    };
  }

  const { data, error } = await supabase.functions.invoke("profile", {
    body: preparedRequest.payload
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    mode: "supabase",
    status: "submitted",
    data
  };
}
