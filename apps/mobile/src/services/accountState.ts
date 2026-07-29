import {
  isAppLanguagePreference,
  type AppLanguagePreference,
  type ChartV2,
  type PersonaStyleKey,
  type PlanTier
} from "@lumis/shared";
import { sanitizeChartForClient } from "@lumis/astrology";

import type { SendChatMessageResult } from "./chat";
import { getSupabaseClient } from "./supabase";
import type { BirthProfileForm } from "./profile";

type UserRow = {
  buddy_avatar_key: string;
  buddy_name: string;
  display_name: string | null;
  focus: string | null;
  persona_style: PersonaStyleKey | null;
};

type LanguagePreferenceRow = {
  lang: string;
  language_preference_set_at: string | null;
};

type BirthDataRow = {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
  active_chart_version: number;
  successful_change_count: number;
};

type AiProfileRow = {
  chart_json: ChartV2;
  chart_version: number;
  is_active: boolean;
};

type BalanceRow = {
  remaining: number;
};

type ChatThreadRow = {
  id: string;
  persona_style: PersonaStyleKey | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  chart_version: number;
  status: string;
};

type ChatMessageRow = {
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  route: SendChatMessageResult["route"];
  credits_cost: number;
  created_at: string;
};

export type RestoredChatTurn = {
  id: string;
  userMessage: string;
  result: SendChatMessageResult | null;
  error: string;
};

export type RestoredReflectionThread = {
  id: string;
  title: string;
  personaStyle: PersonaStyleKey;
  chartVersion: number;
  createdAt: string;
  updatedAt: string;
  canContinue: boolean;
  unavailableReason: string | null;
  turns: RestoredChatTurn[];
};

export type SupabaseAccountState = {
  status: "loaded" | "empty";
  profileData: BirthProfileForm | null;
  chartProfile: ChartV2 | null;
  personaStyle: PersonaStyleKey;
  buddyName: string;
  buddyAvatarKey: string;
  chatTurns: RestoredChatTurn[];
  reflectionThreads: RestoredReflectionThread[];
  reflectionHistoryStatus: "loaded" | "unavailable";
  appLanguagePreference: AppLanguagePreference | null;
  mainFocus: string | null;
  planTier: PlanTier;
  remainingCredits: number | null;
  successfulBirthDetailChanges: number;
  message: string;
};

export type AccountRestoreErrorCode =
  | "ACCOUNT_CONFIGURATION_REQUIRED"
  | "ACCOUNT_AUTH_REQUIRED"
  | "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE"
  | "ACCOUNT_DATA_UNAVAILABLE"
  | "ACCOUNT_DATA_INCOMPLETE";

export class AccountRestoreError extends Error {
  constructor(
    readonly code: AccountRestoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AccountRestoreError";
  }
}

export function isTransientAccountRestoreError(error: unknown): boolean {
  return (
    error instanceof AccountRestoreError &&
    error.code === "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE"
  );
}

export async function loadSupabaseAccountState(
  authenticatedUserId?: string
): Promise<SupabaseAccountState> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new AccountRestoreError(
      "ACCOUNT_CONFIGURATION_REQUIRED",
      "Secure account access is not available in this build."
    );
  }

  let userId = authenticatedUserId;

  if (!userId) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new AccountRestoreError(
        "ACCOUNT_AUTH_REQUIRED",
        "Lumis could not verify this session. Please sign in again."
      );
    }

    userId = sessionData.session?.user.id;
  }

  if (!userId) {
    throw new AccountRestoreError(
      "ACCOUNT_AUTH_REQUIRED",
      "Please sign in to restore your Lumis profile."
    );
  }

  const [userResult, birthResult, profileResult] = await Promise.all([
    supabase
      .from("users")
      .select("display_name, focus, persona_style, buddy_name, buddy_avatar_key")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("birth_data")
      .select("birth_date, birth_time, time_unknown, place_name, active_chart_version, successful_change_count")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("ai_profiles")
      .select("chart_json, chart_version, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("chart_version", { ascending: false })
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const requiredError = userResult.error ?? birthResult.error ?? profileResult.error;

  if (requiredError) {
    throw new AccountRestoreError(
      isTransientRequiredReadError(requiredError)
        ? "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE"
        : "ACCOUNT_DATA_UNAVAILABLE",
      "Lumis could not load your saved account right now. Your data was not changed."
    );
  }

  const user = userResult.data as UserRow | null;
  const birthData = birthResult.data as BirthDataRow | null;
  const profile = profileResult.data as AiProfileRow | null;

  if (!birthData && !profile) {
    return emptyAccountState(
      "No Lumis chart has been created for this account yet."
    );
  }

  if (
    !user ||
    !birthData ||
    !profile?.chart_json ||
    birthData.active_chart_version !== profile.chart_version
  ) {
    throw new AccountRestoreError(
      "ACCOUNT_DATA_INCOMPLETE",
      "Your saved Lumis profile needs a safe reload. No chart or account data was changed."
    );
  }

  // These reads enrich an already-authoritative chart. A temporary history,
  // balance, or plan failure must not turn a valid chart account into an empty
  // account or chart-creation path.
  const [balanceResult, threadsResult, planResult, languageResult] =
    await Promise.all([
      supabase
        .from("monthly_balance")
        .select("remaining")
        .eq("user_id", userId)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("chat_threads")
        .select("id, persona_style, title, created_at, updated_at, chart_version, status")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase.rpc("resolve_active_plan_tier", { p_user_id: userId }),
      supabase
        .from("users")
        .select("lang, language_preference_set_at")
        .eq("id", userId)
        .maybeSingle()
    ]);

  const balance = balanceResult.data as BalanceRow | null;
  const languagePreference = languageResult.error
    ? null
    : languageResult.data as LanguagePreferenceRow | null;
  const threads = threadsResult.error ? [] : (threadsResult.data ?? []) as ChatThreadRow[];
  let reflectionHistoryUnavailable = Boolean(threadsResult.error);
  const reflectionThreads = await Promise.all(
    threads.map(async (thread) => {
      let turns: RestoredChatTurn[] = [];
      let threadUnavailable = false;

      try {
        turns = await loadThreadTurns(thread.id);
      } catch {
        threadUnavailable = true;
        reflectionHistoryUnavailable = true;
      }

      return {
        id: thread.id,
        title: thread.title?.trim() || turns[0]?.userMessage || "Lumis reflection",
        personaStyle: thread.persona_style ?? "acceptance",
        chartVersion: thread.chart_version,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        canContinue:
          !threadUnavailable &&
          thread.status === "active" &&
          thread.chart_version === profile.chart_version,
        unavailableReason:
          threadUnavailable
            ? "This reflection is temporarily unavailable and remains saved."
            : thread.status !== "active"
            ? "This reflection is archived and available to read only."
            : thread.chart_version !== profile.chart_version
              ? "This reflection uses an earlier chart and is available to read only."
              : null,
        turns
      } satisfies RestoredReflectionThread;
    })
  );
  const latestContinuableThread = reflectionThreads.find((thread) => thread.canContinue);
  const chatTurns = latestContinuableThread?.turns ?? [];
  const personaStyle = user?.persona_style ?? latestContinuableThread?.personaStyle ?? "acceptance";

  return {
    status: "loaded",
    profileData: {
      name: user?.display_name ?? "Lumis user",
      birthDate: birthData.birth_date,
      birthTime: birthData.birth_time?.slice(0, 5) ?? "",
      timeUnknown: birthData.time_unknown,
      birthPlace: birthData.place_name
    },
    chartProfile: sanitizeChartForClient(profile.chart_json, birthData.time_unknown),
    personaStyle,
    buddyName: user?.buddy_name?.trim() || "Lumis",
    buddyAvatarKey: user?.buddy_avatar_key?.trim() || "psyche",
    chatTurns,
    reflectionThreads,
    reflectionHistoryStatus: reflectionHistoryUnavailable ? "unavailable" : "loaded",
    appLanguagePreference:
      languagePreference?.language_preference_set_at &&
      isAppLanguagePreference(languagePreference.lang)
        ? languagePreference.lang
        : null,
    mainFocus: user?.focus?.trim() || null,
    planTier: planResult.error ? "starter" : normalizePlanTier(planResult.data),
    remainingCredits: balanceResult.error ? null : balance?.remaining ?? null,
    successfulBirthDetailChanges: birthData.successful_change_count,
    message:
      reflectionHistoryUnavailable
        ? "Your chart is ready. Past Reflections could not be refreshed and remain unchanged."
        : reflectionThreads.length > 0
        ? "Your chart and Past Reflections are ready."
        : "Your chart is ready. No Past Reflections have been saved yet."
  };
}

function isTransientRequiredReadError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
    status?: unknown;
  };
  const status = typeof candidate.status === "number" ? candidate.status : null;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const safeDiagnostic = [candidate.message, candidate.details]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (
    (status !== null && (status === 408 || status === 429 || status >= 500)) ||
    /^(?:PGRST00[0-3]|53300|57014|57P0[123])$/.test(code) ||
    /network request failed|failed to fetch|networkerror|load failed|timed? out|connection (?:closed|reset|refused|interrupted)/i.test(
      safeDiagnostic
    )
  );
}

function normalizePlanTier(value: unknown): PlanTier {
  return value === "essential" || value === "prime" ? value : "starter";
}

async function loadThreadTurns(threadId: string): Promise<RestoredChatTurn[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("thread_id, role, content, route, credits_cost, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AccountRestoreError(
      "ACCOUNT_DATA_UNAVAILABLE",
      "Lumis could not load your Past Reflections right now. Your saved conversations were not changed."
    );
  }

  const messages = (data ?? []) as ChatMessageRow[];
  const turns: RestoredChatTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        id: `${message.thread_id}-${message.created_at}`,
        userMessage: message.content,
        result: null,
        error: ""
      });
      continue;
    }

    if (message.role === "assistant" && turns.length > 0) {
      const latestTurn = turns[turns.length - 1];
      latestTurn.result = {
        mode: "supabase",
        route: message.route,
        creditsCost: message.credits_cost,
        remainingCredits: null,
        billingMode: "scaffold_no_charge",
        reply: message.content
      };
    }
  }

  return turns;
}

function emptyAccountState(message: string): SupabaseAccountState {
  return {
    status: "empty",
    profileData: null,
    chartProfile: null,
    personaStyle: "acceptance",
    buddyName: "Lumis",
    buddyAvatarKey: "psyche",
    chatTurns: [],
    reflectionThreads: [],
    reflectionHistoryStatus: "loaded",
    appLanguagePreference: null,
    mainFocus: null,
    planTier: "starter",
    remainingCredits: null,
    successfulBirthDetailChanges: 0,
    message
  };
}
