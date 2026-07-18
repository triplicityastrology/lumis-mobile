import type { ChartV2, PersonaStyleKey, PlanTier } from "@lumis/shared";

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

type BirthDataRow = {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  place_name: string;
  active_chart_version: number;
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
  mainFocus: string | null;
  planTier: PlanTier;
  remainingCredits: number | null;
  message: string;
};

export async function loadSupabaseAccountState(): Promise<SupabaseAccountState> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return emptyAccountState("Secure account access is not available in this build.");
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    return emptyAccountState("Please sign in to restore your Lumis profile.");
  }

  const [
    userResult,
    birthResult,
    profileResult,
    balanceResult,
    threadsResult,
    planResult
  ] = await Promise.all([
    supabase
      .from("users")
      .select("display_name, focus, persona_style, buddy_name, buddy_avatar_key")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("birth_data")
      .select("birth_date, birth_time, time_unknown, place_name, active_chart_version")
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
      .maybeSingle(),
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
    supabase.rpc("resolve_active_plan_tier", { p_user_id: userId })
  ]);

  const firstError = userResult.error ?? birthResult.error ?? profileResult.error ?? balanceResult.error ?? threadsResult.error ?? planResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const birthData = birthResult.data as BirthDataRow | null;
  const profile = profileResult.data as AiProfileRow | null;

  if (!birthData || !profile?.chart_json) {
    return emptyAccountState(
      "No Lumis chart has been created for this account yet."
    );
  }

  const user = userResult.data as UserRow | null;
  const balance = balanceResult.data as BalanceRow | null;
  const threads = (threadsResult.data ?? []) as ChatThreadRow[];
  const reflectionThreads = await Promise.all(
    threads.map(async (thread) => {
      const turns = await loadThreadTurns(thread.id);

      return {
        id: thread.id,
        title: thread.title?.trim() || turns[0]?.userMessage || "Lumis reflection",
        personaStyle: thread.persona_style ?? "acceptance",
        chartVersion: thread.chart_version,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        canContinue: thread.status === "active" && thread.chart_version === profile.chart_version,
        unavailableReason:
          thread.status !== "active"
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
    chartProfile: profile.chart_json,
    personaStyle,
    buddyName: user?.buddy_name?.trim() || "Lumis",
    buddyAvatarKey: user?.buddy_avatar_key?.trim() || "psyche",
    chatTurns,
    reflectionThreads,
    mainFocus: user?.focus?.trim() || null,
    planTier: normalizePlanTier(planResult.data),
    remainingCredits: balance?.remaining ?? null,
    message:
      reflectionThreads.length > 0
        ? "Your chart and Past Reflections are ready."
        : "Your chart is ready. No Past Reflections have been saved yet."
  };
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
    throw new Error(error.message);
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
    mainFocus: null,
    planTier: "starter",
    remainingCredits: null,
    message
  };
}
