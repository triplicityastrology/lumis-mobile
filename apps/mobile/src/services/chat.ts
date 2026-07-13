import {
  classifyChatRoute,
  getChatRouteDecision,
  type ChartV2,
  type ChatRoute,
  type PersonaStyleKey
} from "@lumis/shared";

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
    return `${chartPhrase} The local demo would route this as a dice reading. Treat this as a symbolic prompt: what first instinct appears, what resistance appears, and what would change if you trusted the quieter answer?`;
  }

  if (route === "astro_timing") {
    return `${chartPhrase} The local demo would route this as timing work. Start by naming the window you care about, then Lumis can connect it to transits, Solar Return themes, and the question underneath the timing.${stylePhrase}`;
  }

  if (route === "astro_deep") {
    return `${chartPhrase} The local demo would route this as a deep chart reading. I would look for the repeated pattern first, then connect it to planets, houses, and the way it shows up in daily life.${stylePhrase}`;
  }

  if (route === "knowledge") {
    return `${chartPhrase} The local demo would route this as astrology knowledge. I can explain the concept plainly first, then show how it might matter in your own Lumis Persona.${stylePhrase}`;
  }

  return `${chartPhrase} I hear the question. Let us start with what feels most alive right now, then let Lumis connect it back to your pattern gently.${stylePhrase}`;
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
