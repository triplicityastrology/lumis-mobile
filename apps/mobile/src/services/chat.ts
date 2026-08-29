import {
  classifyChatRoute,
  getChatRouteDecision,
  getOutOfScopeResponse,
  getProfessionalBoundaryResponse,
  getRouteUnavailableResponse,
  getSafetyResponse,
  getSolarReturnScopeResponse,
  isProfessionalDirectRequest,
  isSolarReturnRequest,
  type AppLanguagePreference,
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
  appLanguagePreference?: AppLanguagePreference | null;
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
    throw new Error("CHAT_REQUEST_FAILED");
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
  const route = classifyChatRoute(input.message);
  const routeDecision = getChatRouteDecision(route);

  return {
    mode: "local",
    route,
    creditsCost: routeDecision.credits,
    remainingCredits: 50,
    billingMode: "local_demo",
    reply: resolveLocalCanonicalReply(route, input.message, input.appLanguagePreference ?? null)
  };
}

// The offline/local path composes NOTHING of its own. Every disposition is selected
// from the shared canonical wording (@lumis/shared, mirrored byte-exact from the
// server fixed-template registry). Generation is owned solely by the one shared
// server-side composition/routing system; while that route is disabled
// (NO_NORMAL_CHAT_INTEGRATION_AUTHORITY) a generative request surfaces the canonical
// route-unavailable template rather than an improvised reply.
function resolveLocalCanonicalReply(
  route: ChatRoute,
  message: string,
  appLanguagePreference: AppLanguagePreference | null
): string {
  if (route === "safety") {
    return getSafetyResponse(message, appLanguagePreference);
  }

  if (isSolarReturnRequest(message)) {
    return getSolarReturnScopeResponse(message, appLanguagePreference);
  }

  if (route === "out_of_scope") {
    return isProfessionalDirectRequest(message)
      ? getProfessionalBoundaryResponse(message, appLanguagePreference)
      : getOutOfScopeResponse(message, appLanguagePreference);
  }

  return getRouteUnavailableResponse(message, appLanguagePreference);
}
