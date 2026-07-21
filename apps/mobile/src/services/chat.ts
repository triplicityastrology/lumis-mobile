import {
  classifyChatRoute,
  getChatRouteDecision,
  type ChartV2,
  type ChatRoute,
  type PersonaStyleKey
} from "@lumis/shared";
import { buildSafeChatChartContext } from "@lumis/astrology";

import { getSupabaseClient } from "./supabase";

export type SendChatMessageInput = {
  message: string;
  clientMessageId?: string;
  personaStyle: PersonaStyleKey;
  chart: ChartV2 | null;
  forceNewThread?: boolean;
  threadId?: string | null;
};

export type SendChatMessageResult = {
  mode: "local" | "supabase";
  route: ChatRoute;
  creditsCost: number;
  remainingCredits: number | null;
  billingMode: "local_demo" | "scaffold_no_charge" | "charged";
  reply: string;
  threadId?: string | null;
  persistenceMode?: "supabase_scaffold" | "not_persisted";
  persistenceError?: string | null;
};

type ChatFunctionResponse = {
  route?: ChatRoute;
  credits_cost?: number;
  remaining_credits?: number | null;
  billing_mode?: "scaffold_no_charge" | "charged";
  reply?: string;
  thread_id?: string | null;
  ai_profile_id?: number | null;
  chart_version?: number | null;
  persistence_mode?: "supabase_scaffold" | "not_persisted";
  persistence_error?: string | null;
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
      client_msg_id: input.clientMessageId,
      persona_style: input.personaStyle,
      force_new_thread: input.forceNewThread ?? false,
      thread_id: input.threadId ?? null,
      chart_context: buildSafeChatChartContext(input.chart)
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
    remainingCredits: response.remaining_credits ?? null,
    billingMode: response.billing_mode ?? "scaffold_no_charge",
    threadId: response.thread_id ?? null,
    persistenceMode: response.persistence_mode ?? "not_persisted",
    persistenceError: response.persistence_error ?? null,
    reply:
      response.reply ??
      "I hear that. Let us begin with the part that feels most present, then connect it back to your chart gently."
  };
}

function buildLocalChatReply(input: SendChatMessageInput): SendChatMessageResult {
  const chartContext = buildSafeChatChartContext(input.chart);
  const route = classifyChatRoute(input.message);
  const routeDecision = getChatRouteDecision(route);
  const chartPhrase =
    chartContext.sun && chartContext.moon
      ? ` With your ${chartContext.sun} Sun and ${chartContext.moon} Moon in view,`
      : "";

  return {
    mode: "local",
    route,
    creditsCost: routeDecision.credits,
    remainingCredits: 50,
    billingMode: "local_demo",
    reply: buildLocalReplyText(route, chartPhrase, input.personaStyle)
  };
}

function buildLocalReplyText(route: ChatRoute, chartPhrase: string, personaStyle: PersonaStyleKey): string {
  const stylePhrase =
    personaStyle === "spark"
      ? " I will keep this exploratory and a little provocative."
      : personaStyle === "awareness"
        ? " I will keep this practical and growth-oriented."
        : " I will keep this gentle and grounding.";

  if (route === "safety") {
    return "I am really sorry this feels so heavy. Lumis cannot handle crisis support alone. Please contact local emergency services or someone you trust right now.";
  }

  if (route === "out_of_scope") {
    return "That sits outside what Lumis should answer directly. I can help you reflect on the feelings and timing around it, but not replace medical, legal, financial, or emergency advice.";
  }

  if (route === "dice") {
    return `${chartPhrase} Treat these symbols as a reflective prompt: what first instinct appears, what resistance appears, and what might change if you trusted the quieter answer?`;
  }

  if (route === "astro_timing") {
    return `${chartPhrase} Start by naming the window you care about, then we can explore its transits, Solar Return themes, and the question underneath the timing.${stylePhrase}`;
  }

  if (route === "astro_deep") {
    return `${chartPhrase} Let us look for the repeated pattern first, then connect it to the chart and the way it shows up in daily life.${stylePhrase}`;
  }

  if (route === "knowledge") {
    return `${chartPhrase} I can explain the astrology plainly first, then show how it may matter within your own Lumis Persona.${stylePhrase}`;
  }

  return `${chartPhrase} I hear the question. Let us start with what feels most alive right now, then let Lumis connect it back to your pattern gently.${stylePhrase}`;
}
