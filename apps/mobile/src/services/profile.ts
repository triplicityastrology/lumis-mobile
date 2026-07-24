import { buildProfileChartDraft, CHART_WORKER_CONTRACT } from "@lumis/astrology";
import { isValidBirthDate, PERSONA_STYLES, type ChartV2, type PersonaStyleKey } from "@lumis/shared";

import { resolveBirthPlace, type BirthPlaceResolution } from "./location";
import { getSupabaseClient, getSupabaseConfig } from "./supabase";

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

export type BirthDetailsChangeResult = {
  status: "birth_details_regenerated" | "birth_details_already_regenerated";
  chart_version: number;
  profile_version?: number;
  ai_profile_id: number;
  birth_data_history_id: number;
  successful_change_count: number;
  remaining_changes: number;
  precision?: "full" | "no_birth_time";
  chart?: ChartV2;
  request_id?: string;
};

export class BirthDetailsChangeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly successfulChangeCount?: number,
    readonly remainingChanges?: number
  ) {
    super(message);
    this.name = "BirthDetailsChangeError";
  }
}

export type PersonaPreferenceResult = {
  mode: "local" | "supabase";
  status: "saved" | "skipped";
};

export type PersonaIdentityPreference = {
  buddyName: string;
  avatarKey: string;
  mainFocus: string | null;
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

  if (!isValidBirthDate(birthDate, new Date(), location.timezone)) {
    return {
      isValid: false,
      message: "Please enter a real birth date that is not in the future."
    };
  }

  if (!form.timeUnknown && !isValidBirthTime(birthTime)) {
    return {
      isValid: false,
      message: "Please enter birth time as HH:MM using 24-hour time."
    };
  }

  return { isValid: true };
}

export function isValidBirthTime(value: string): boolean {
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
      message: "Your chart is ready for this private session.",
      chart: buildFixtureChart(form)
    };
  }

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      ...preparedRequest,
      mode: "local",
      message: "Your chart is ready for this private session. Sign in later to save it.",
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
        message: "Your chart is ready for this session, but it could not be saved. Please try again later.",
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
        ? "Your chart and Lumis profile have been saved."
        : "Your chart and Lumis profile are ready."),
    chart: response.chart ?? buildFixtureChart(form),
    data: response
  };
}

export async function regenerateBirthDetails(
  form: BirthProfileForm,
  clientRequestId: string
): Promise<BirthDetailsChangeResult> {
  const normalizedForm = {
    ...form,
    birthTime: normalizeBirthTimeForApi(form.birthTime)
  };
  const validation = validateBirthProfileForm(normalizedForm);

  if (!validation.isValid) {
    throw new BirthDetailsChangeError(
      validation.message ?? "Please check the birth details and try again.",
      "49002"
    );
  }

  const prepared = prepareChartProfileRequest(normalizedForm);
  const supabase = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!supabase || !config.url || !config.anonKey) {
    throw new BirthDetailsChangeError(
      "Lumis account services are not configured on this device.",
      "PROFILE_CONFIGURATION_REQUIRED"
    );
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new BirthDetailsChangeError(
      "Please sign in again before changing your birth details.",
      "PROFILE_AUTH_REQUIRED"
    );
  }

  const response = await fetch(`${config.url}/functions/v1/profile/birth-details/change`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...prepared.payload,
      client_request_id: clientRequestId
    })
  });
  const data = (await response.json()) as BirthDetailsChangeResult & {
    error?: { code?: string; message?: string };
    successful_change_count?: number;
    remaining_changes?: number;
  };

  if (!response.ok) {
    throw new BirthDetailsChangeError(
      data.error?.message ?? "Your previous chart is still active. Please try again.",
      data.error?.code ?? "49003",
      data.successful_change_count,
      data.remaining_changes
    );
  }

  if (
    !data.chart_version ||
    !data.ai_profile_id ||
    !data.birth_data_history_id ||
    typeof data.successful_change_count !== "number" ||
    typeof data.remaining_changes !== "number"
  ) {
    throw new BirthDetailsChangeError(
      "The regenerated chart response was incomplete. Your previous chart remains active.",
      "49003"
    );
  }

  return data;
}

function normalizeBirthTimeForApi(value: string): string {
  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (twentyFourHour) {
    return `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());

  if (!twelveHour) return value.trim();
  let hour = Number(twelveHour[1]) % 12;
  if (twelveHour[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${twelveHour[2]}`;
}

function isEdgeFunctionTransportError(message: string): boolean {
  return /failed to send|fetch|network|cors/i.test(message);
}

export async function savePersonaStylePreference(
  personaStyle: PersonaStyleKey,
  identity: PersonaIdentityPreference
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
  const { error } = await supabase.rpc("update_lumis_persona", {
    p_persona_style: selectedPersona.key,
    p_buddy_name: identity.buddyName,
    p_buddy_avatar_key: identity.avatarKey,
    p_focus: identity.mainFocus
  });

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
