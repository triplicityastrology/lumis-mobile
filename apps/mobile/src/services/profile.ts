import { buildProfileChartDraft, CHART_WORKER_CONTRACT } from "@lumis/astrology";
import { PERSONA_STYLES, type ChartV2, type PersonaStyleKey } from "@lumis/shared";

import { resolveBirthPlace, type BirthPlaceResolution } from "./location";
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
    country_code?: string;
    lat?: number;
    lng?: number;
    tz_str?: string;
  };
  location: BirthPlaceResolution;
};

export type BirthProfileValidation = {
  isValid: boolean;
  message?: string;
};

export type ChartProfileResult =
  | (PreparedChartProfileRequest & {
      mode: "local";
      message: string;
      chart: ChartV2;
    })
  | {
      mode: "supabase";
      status: "submitted";
      message: string;
      chart: ChartV2;
      data: ProfileFunctionResponse;
    };

export type ProfileFunctionResponse = {
  status?: "profile_request_prepared" | "profile_persisted" | "profile_repaired";
  profile_version?: number;
  chart_version?: number;
  birth_data_history_id?: number;
  ai_profile_id?: number;
  chart?: ChartV2;
  next_step?: string;
};

export type PersonaPreferenceResult = {
  mode: "local" | "supabase";
  status: "saved" | "skipped";
};

export function prepareChartProfileRequest(
  form: BirthProfileForm
): PreparedChartProfileRequest {
  const location = resolveBirthPlace(form.birthPlace);
  const payload = {
    ...buildProfileChartDraft(form),
    birth_time: form.timeUnknown ? null : form.birthTime.trim(),
    time_unknown: form.timeUnknown,
    ...(location.status === "resolved"
      ? {
          place_name: location.placeName,
          country_code: location.countryCode,
          lat: location.lat,
          lng: location.lng,
          tz_str: location.timezone
        }
      : {})
  };

  return {
    status: "prepared",
    endpoint: CHART_WORKER_CONTRACT.supabaseFunction,
    workerEndpoint: CHART_WORKER_CONTRACT.endpoint,
    payload,
    location
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
      message: "Please choose a supported test place for now: Hong Kong, London, UK, or New York, US."
    };
  }

  const location = resolveBirthPlace(birthPlace);

  if (location.status !== "resolved") {
    return {
      isValid: false,
      message: "Please choose a supported test place for now: Hong Kong, London, UK, or New York, US."
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
        "Supabase is not configured yet. Showing a fixture chart profile until the real chart worker is connected.",
      chart: buildFixtureChart(form)
    };
  }

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      ...preparedRequest,
      mode: "local",
      message:
        "Supabase is connected, but no user is signed in yet. Showing a fixture chart profile for local demo.",
      chart: buildFixtureChart(form)
    };
  }

  const { data, error } = await supabase.functions.invoke("profile", {
    body: preparedRequest.payload
  });

  if (error) {
    if (isEdgeFunctionTransportError(error.message)) {
      return {
        ...preparedRequest,
        mode: "local",
        message:
          "The hosted chart save function is temporarily unreachable. Showing a local chart profile so you can keep testing the flow.",
        chart: buildFixtureChart(form)
      };
    }

    throw new Error(error.message);
  }

  const response = data as ProfileFunctionResponse;

  return {
    mode: "supabase",
    status: "submitted",
    message:
      response.next_step ??
      (response.status === "profile_persisted"
        ? "Supabase saved the chart profile."
        : "Supabase prepared the chart profile request."),
    chart: response.chart ?? buildFixtureChart(form),
    data: response
  };
}

function isEdgeFunctionTransportError(message: string): boolean {
  return /failed to send|fetch|network|cors/i.test(message);
}

export async function savePersonaStylePreference(
  personaStyle: PersonaStyleKey
): Promise<PersonaPreferenceResult> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { mode: "local", status: "skipped" };
  }

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { mode: "local", status: "skipped" };
  }

  const selectedPersona = PERSONA_STYLES.find((style) => style.key === personaStyle) ?? PERSONA_STYLES[0];
  const { error } = await supabase
    .from("users")
    .update({
      persona_style: selectedPersona.key,
      role: selectedPersona.internalRole
    })
    .eq("id", authData.user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { mode: "supabase", status: "saved" };
}

function buildFixtureChart(form: BirthProfileForm): ChartV2 {
  const chart: ChartV2 = {
    version: "chart_v2",
    precision: form.timeUnknown ? "no_birth_time" : "full",
    source: "fixture",
    calculatedAt: new Date().toISOString(),
    planets: [
      {
        key: "sun",
        label: "Sun",
        sign: "Capricorn",
        degree: 10,
        house: form.timeUnknown ? undefined : 1
      },
      {
        key: "moon",
        label: "Moon",
        sign: "Cancer",
        degree: 18,
        house: form.timeUnknown ? undefined : 7
      },
      {
        key: "ascendant",
        label: "Ascendant",
        sign: "Libra",
        degree: 6,
        house: form.timeUnknown ? undefined : 1
      }
    ],
    houses: [],
    angles: {
      ascendant: form.timeUnknown
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

  return sanitizeFixtureChartForPrecision(chart, form.timeUnknown);
}

function sanitizeFixtureChartForPrecision(chart: ChartV2, timeUnknown: boolean): ChartV2 {
  if (!timeUnknown) {
    return chart;
  }

  return {
    ...chart,
    precision: "no_birth_time",
    planets: chart.planets
      .filter((planet) => planet.key !== "ascendant" && planet.key !== "medium_coeli")
      .map((planet) => {
        const { house: _house, ...planetWithoutHouse } = planet;
        return planetWithoutHouse;
      }),
    houses: [],
    angles: {}
  };
}
