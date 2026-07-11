import { buildProfileChartDraft, CHART_WORKER_CONTRACT } from "@lumis/astrology";

import { getSupabaseClient } from "./supabase";

export type BirthProfileForm = {
  name: string;
  birthDate: string;
  birthTime: string;
  timeUnknown: boolean;
  birthPlace: string;
};

export type PreparedChartProfileRequest = {
  status: "prepared";
  endpoint: typeof CHART_WORKER_CONTRACT.supabaseFunction;
  workerEndpoint: typeof CHART_WORKER_CONTRACT.endpoint;
  payload: {
    display_name: string;
    birth_date: string;
    birth_time: string | null;
    time_unknown: boolean;
    place_name: string;
  };
};

export type BirthProfileValidation = {
  isValid: boolean;
  message?: string;
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
  const payload = {
    ...buildProfileChartDraft(form),
    birth_time: form.timeUnknown ? null : form.birthTime.trim(),
    time_unknown: form.timeUnknown
  };

  return {
    status: "prepared",
    endpoint: CHART_WORKER_CONTRACT.supabaseFunction,
    workerEndpoint: CHART_WORKER_CONTRACT.endpoint,
    payload
  };
}

export function validateBirthProfileForm(form: BirthProfileForm): BirthProfileValidation {
  const name = form.name.trim();
  const birthDate = form.birthDate.trim();
  const birthTime = form.birthTime.trim();
  const birthPlace = form.birthPlace.trim();

  if (!name || !birthDate || !birthPlace || (!form.timeUnknown && !birthTime)) {
    return {
      isValid: false,
      message: "Please fill in all birth details before continuing."
    };
  }

  if (!isValidIsoDate(birthDate)) {
    return {
      isValid: false,
      message: "Please enter birth date as YYYY-MM-DD."
    };
  }

  if (!form.timeUnknown && !isValidTime(birthTime)) {
    return {
      isValid: false,
      message: "Please enter birth time as HH:MM using 24-hour time."
    };
  }

  if (!isUsefulPlaceInput(birthPlace)) {
    return {
      isValid: false,
      message: "Please enter a city and country/region, e.g. Hong Kong or London, UK."
    };
  }

  return { isValid: true };
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function isUsefulPlaceInput(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length < 3 || !/[a-zA-Z\u4e00-\u9fff]/.test(normalized)) {
    return false;
  }

  return normalized.includes(",") || normalized.split(" ").length >= 2;
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
