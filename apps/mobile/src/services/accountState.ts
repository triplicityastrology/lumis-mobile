import type { ChartV2, PersonaStyleKey } from "@lumis/shared";

import type { SendChatMessageResult } from "./chat";
import { getSupabaseClient } from "./supabase";
import type { BirthProfileForm } from "./profile";

type UserRow = {
  display_name: string | null;
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

export type SupabaseAccountState = {
  status: "loaded" | "empty";
  profileData: BirthProfileForm | null;
  chartProfile: ChartV2 | null;
  personaStyle: PersonaStyleKey;
  chatTurns: RestoredChatTurn[];
  remainingCredits: number | null;
  message: string;
};

export async function loadSupabaseAccountState(): Promise<SupabaseAccountState> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return emptyAccountState("Supabase is not configured in this build.");
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    return emptyAccountState("No signed-in Supabase account.");
  }

  const [
    userResult,
    birthResult,
    profileResult,
    balanceResult,
    threadsResult
  ] = await Promise.all([
    supabase
      .from("users")
      .select("display_name, persona_style")
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
      .select("id, persona_style, title, created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
  ]);

  const firstError = userResult.error ?? birthResult.error ?? profileResult.error ?? balanceResult.error ?? threadsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const birthData = birthResult.data as BirthDataRow | null;
  let profile = profileResult.data as AiProfileRow | null;

  if (!profile) {
    profile = await loadLatestProfileFallback(userId);
  }

  if (!birthData || !profile?.chart_json) {
    return emptyAccountState(
      "Signed in, but no saved Lumis chart profile was found for this account."
    );
  }

  const user = userResult.data as UserRow | null;
  const balance = balanceResult.data as BalanceRow | null;
  const threads = (threadsResult.data ?? []) as ChatThreadRow[];
  const latestThread = threads[0];
  const chatTurns = latestThread ? await loadThreadTurns(latestThread.id) : [];
  const personaStyle = user?.persona_style ?? latestThread?.persona_style ?? "acceptance";

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
    chatTurns,
    remainingCredits: balance?.remaining ?? null,
    message:
      chatTurns.length > 0
        ? "Supabase profile and latest Past Reflection loaded."
        : "Supabase profile loaded. No saved Past Reflections found yet."
  };
}

async function loadLatestProfileFallback(userId: string): Promise<AiProfileRow | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("ai_profiles")
    .select("chart_json, chart_version, is_active")
    .eq("user_id", userId)
    .order("chart_version", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiProfileRow | null;
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
        billingMode: "charged",
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
    chatTurns: [],
    remainingCredits: null,
    message
  };
}
