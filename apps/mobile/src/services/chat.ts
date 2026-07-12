import type { ChartV2, ChatRoute, PersonaStyleKey } from "@lumis/shared";

import { getSupabaseClient } from "./supabase";

export type SendChatMessageInput = {
  message: string;
  personaStyle: PersonaStyleKey;
  chart: ChartV2 | null;
};

export type SendChatMessageResult = {
  mode: "local" | "supabase";
  route: ChatRoute;
  creditsCost: number;
  remainingCredits: number;
  reply: string;
};

type ChatFunctionResponse = {
  route?: ChatRoute;
  credits_cost?: number;
  remaining_credits?: number;
  reply?: string;
};

export async function sendChatMessage(input: SendChatMessageInput): Promise<SendChatMessageResult> {
  const cleanedMessage = input.message.trim();
  const supabase = getSupabaseClient();

  if (!supabase) {
    return buildLocalChatReply(input);
  }

  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return buildLocalChatReply(input);
  }

  const { data, error } = await supabase.functions.invoke("chat-message", {
    body: {
      message: cleanedMessage,
      persona_style: input.personaStyle,
      chart_context: buildChartContext(input.chart)
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  const response = data as ChatFunctionResponse;

  return {
    mode: "supabase",
    route: response.route ?? "casual",
    creditsCost: response.credits_cost ?? 1,
    remainingCredits: response.remaining_credits ?? 49,
    reply:
      response.reply ??
      "I hear that. Let us begin with the part that feels most present, then connect it back to your chart gently."
  };
}

function buildLocalChatReply(input: SendChatMessageInput): SendChatMessageResult {
  const chartContext = buildChartContext(input.chart);
  const chartPhrase =
    chartContext.sun && chartContext.moon
      ? ` With your ${chartContext.sun} Sun and ${chartContext.moon} Moon in view,`
      : "";

  return {
    mode: "local",
    route: "casual",
    creditsCost: 1,
    remainingCredits: 50,
    reply: `${chartPhrase} I hear the question. Let us start with what feels most alive right now, then let Lumis connect it back to your pattern gently.`
  };
}

function buildChartContext(chart: ChartV2 | null) {
  const sun = chart?.planets.find((planet) => planet.key === "sun");
  const moon = chart?.planets.find((planet) => planet.key === "moon");
  const ascendant = chart?.angles.ascendant;

  return {
    precision: chart?.precision ?? "unknown",
    sun: sun?.sign,
    moon: moon?.sign,
    rising: ascendant?.sign
  };
}
