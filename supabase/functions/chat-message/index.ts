import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createClient } from "@supabase/supabase-js";
import { buildSafeChatChartContext } from "../../../packages/astrology/src/chat-chart-context.ts";
import { ROUTE_CREDITS as SHARED_ROUTE_CREDITS } from "../../../packages/shared/src/config/routes.ts";
import type { ChartV2 } from "../../../packages/shared/src/types/chart.ts";

type ChatRoute =
  | "casual"
  | "knowledge"
  | "dice"
  | "astro_timing"
  | "astro_deep"
  | "out_of_scope"
  | "safety";

type PersonaStyle = "acceptance" | "spark" | "awareness";

type ChartContext = {
  precision?: string;
  sun?: string;
  moon?: string;
  rising?: string;
};

type ChatMessageRequest = {
  message?: string;
  persona_style?: PersonaStyle;
  force_new_thread?: boolean;
  thread_id?: string | null;
  chart_context?: ChartContext;
};

type PersistedChatContext = {
  threadId: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  aiProfileId: number;
  chartVersion: number;
};

type AiProfileRow = {
  id: number;
  chart_version: number;
  chart_json: ChartV2 | null;
};

type AuthenticatedChatContext = {
  userId: string;
  serviceClient: ReturnType<typeof createClient>;
  profile: AiProfileRow | null;
  chartContext: ChartContext;
};

type AuthenticatedChatContextResult = {
  context: AuthenticatedChatContext | null;
  error: string | null;
};

type PersistScaffoldChatTurnResponse = {
  ok?: boolean;
  error_code?: string;
  thread_id?: string;
  user_message_id?: string | null;
  assistant_message_id?: string | null;
  ai_profile_id?: number;
  chart_version?: number;
};

const SAFE_PERSISTENCE_ERROR_CODES = new Set([
  "ACTIVE_PROFILE_REQUIRED",
  "CHAT_PERSISTENCE_INVALID_INPUT",
  "REFLECTION_THREAD_NOT_AVAILABLE"
]);

const ROUTE_CREDITS = Object.fromEntries(
  SHARED_ROUTE_CREDITS.map(({ route, credits }) => [route, credits])
) as Record<ChatRoute, number>;

Deno.serve(async (request) => {
  const corsPreflight = handleCorsPreflight(request);

  if (corsPreflight) {
    return corsPreflight;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  const acceptsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;
  const body = (await request.json().catch(() => ({}))) as ChatMessageRequest;
  const serverContextResult = await safeLoadAuthenticatedChatContext(request);
  const serverContext = serverContextResult.context;
  const chartContext =
    serverContext?.profile ? serverContext.chartContext : serverContext ? {} : body.chart_context;
  const response = buildChatResponse({ ...body, chart_context: chartContext });
  const persistence = serverContextResult.error
    ? { persisted: null, error: serverContextResult.error }
    : await safePersistScaffoldChatTurn(serverContext, body, response);
  const persisted = persistence.persisted;
  const responseWithPersistence = {
    ...response,
    thread_id: persisted?.threadId ?? null,
    ai_profile_id: persisted?.aiProfileId ?? null,
    chart_version: persisted?.chartVersion ?? null,
    persistence_mode: persisted ? "supabase_scaffold" : "not_persisted",
    persistence_error: persistence.error
  };

  if (!acceptsStream) {
    return jsonResponse(responseWithPersistence);
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: meta\ndata: ${JSON.stringify({
            route: response.route,
            credits_cost: response.credits_cost,
            billing_mode: response.billing_mode,
            thread_id: persisted?.threadId ?? null,
            persistence_mode: persisted ? "supabase_scaffold" : "not_persisted",
            persistence_error: persistence.error
          })}\n\n`
        )
      );
      controller.enqueue(
        encoder.encode(`event: token\ndata: ${JSON.stringify({ t: response.reply })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(
          `event: done\ndata: ${JSON.stringify({
            credits_charged: 0,
            estimated_credits_cost: response.credits_cost,
            remaining_credits: response.remaining_credits,
            billing_mode: response.billing_mode,
            thread_id: persisted?.threadId ?? null,
            persistence_mode: persisted ? "supabase_scaffold" : "not_persisted",
            persistence_error: persistence.error
          })}\n\n`
        )
      );
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
});

async function safeLoadAuthenticatedChatContext(
  request: Request
): Promise<AuthenticatedChatContextResult> {
  try {
    return {
      context: await loadAuthenticatedChatContext(request),
      error: null
    };
  } catch (error) {
    console.error("CHAT_PERSISTENCE_FAILED", error);

    return {
      context: null,
      error: "CHAT_PERSISTENCE_FAILED"
    };
  }
}

async function safePersistScaffoldChatTurn(
  serverContext: AuthenticatedChatContext | null,
  body: ChatMessageRequest,
  response: ReturnType<typeof buildChatResponse>
): Promise<{ persisted: PersistedChatContext | null; error: string | null }> {
  try {
    return {
      persisted: await persistScaffoldChatTurn(serverContext, body, response),
      error: serverContext && !serverContext.profile ? "ACTIVE_PROFILE_REQUIRED" : null
    };
  } catch (error) {
    console.error("CHAT_PERSISTENCE_FAILED", error);

    return {
      persisted: null,
      error: getSafePersistenceErrorCode(error)
    };
  }
}

async function persistScaffoldChatTurn(
  serverContext: AuthenticatedChatContext | null,
  body: ChatMessageRequest,
  response: ReturnType<typeof buildChatResponse>
): Promise<PersistedChatContext | null> {
  const message = body.message?.trim();

  if (!serverContext || !serverContext.profile || !message) {
    return null;
  }

  const { data, error } = await serverContext.serviceClient.rpc("persist_scaffold_chat_turn", {
    p_user_id: serverContext.userId,
    p_ai_profile_id: serverContext.profile.id,
    p_chart_version: serverContext.profile.chart_version,
    p_persona_style: body.persona_style ?? "acceptance",
    p_route: response.route,
    p_title: buildThreadTitle(message),
    p_user_message: message,
    p_assistant_message: response.reply,
    p_force_new_thread: body.force_new_thread ?? false,
    p_thread_id: body.thread_id ?? null
  });

  if (error) {
    throw new Error(error.message);
  }

  const persisted = data as PersistScaffoldChatTurnResponse | null;

  if (!persisted?.ok || !persisted.thread_id || !persisted.ai_profile_id || !persisted.chart_version) {
    throw new Error(persisted?.error_code ?? "CHAT_PERSISTENCE_FAILED");
  }

  return {
    threadId: persisted.thread_id,
    userMessageId: persisted.user_message_id ?? null,
    assistantMessageId: persisted.assistant_message_id ?? null,
    aiProfileId: persisted.ai_profile_id,
    chartVersion: persisted.chart_version
  };
}

async function loadAuthenticatedChatContext(
  request: Request
): Promise<AuthenticatedChatContext | null> {
  const authHeader = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return null;
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return null;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const profile = await loadActiveProfile(serviceClient, authData.user.id);

  return {
    userId: authData.user.id,
    serviceClient,
    profile,
    chartContext: buildSafeChatChartContext(profile?.chart_json ?? null)
  };
}

async function loadActiveProfile(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<AiProfileRow | null> {
  const { data, error } = await serviceClient
    .from("ai_profiles")
    .select("id, chart_version, chart_json")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("chart_version", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiProfileRow | null;
}

function buildThreadTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();

  return cleaned.length <= 48 ? cleaned : `${cleaned.slice(0, 45)}...`;
}

function getSafePersistenceErrorCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return SAFE_PERSISTENCE_ERROR_CODES.has(code) ? code : "CHAT_PERSISTENCE_FAILED";
}

function buildChatResponse(body: ChatMessageRequest) {
  const route = classifyChatRoute(body.message ?? "");
  const credits = ROUTE_CREDITS[route];
  const chartPhrase =
    body.chart_context?.sun && body.chart_context?.moon
      ? `With your ${body.chart_context.sun} Sun and ${body.chart_context.moon} Moon in view, `
      : "";
  const stylePhrase =
    body.persona_style === "spark"
      ? " Let us find the fresh angle."
      : body.persona_style === "awareness"
        ? " Let us notice the pattern underneath."
        : " Let us move gently and steadily.";

  return {
    route,
    credits_cost: credits,
    credits_charged: 0,
    estimated_credits_cost: credits,
    remaining_credits: null,
    billing_mode: "scaffold_no_charge",
    reply: buildReplyText(route, chartPhrase, stylePhrase)
  };
}

function classifyChatRoute(message: string): ChatRoute {
  const normalized = message.toLowerCase();

  if (/(self harm|suicide|kill myself|hurt myself|危險|自殺|傷害自己)/i.test(normalized)) {
    return "safety";
  }

  if (/(medical|legal|tax|investment|diagnose|醫療|法律|投資|診斷)/i.test(normalized)) {
    return "out_of_scope";
  }

  if (/(dice|roll|骰|骰子)/i.test(normalized)) {
    return "dice";
  }

  if (/(transit|timing|solar return|this month|this week|forecast|今年|本月|流年|時機|運勢)/i.test(normalized)) {
    return "astro_timing";
  }

  if (/(deep|chart|birth chart|natal|pattern|moon|sun|rising|house|aspect|深入|星盤|模式|上升)/i.test(normalized)) {
    return "astro_deep";
  }

  if (/(what is|explain|meaning|astrology|planet|zodiac|venus|mars|意思|解釋|占星)/i.test(normalized)) {
    return "knowledge";
  }

  return "casual";
}

function buildReplyText(route: ChatRoute, chartPhrase: string, stylePhrase: string): string {
  if (route === "safety") {
    return "I am really sorry this feels so heavy. Lumis cannot handle crisis support alone. Please contact local emergency services or someone you trust right now.";
  }

  if (route === "out_of_scope") {
    return "That sits outside what Lumis should answer directly. I can help you reflect on the feelings and timing around it, but not replace medical, legal, financial, or emergency advice.";
  }

  return `${chartPhrase}I hear this question.${stylePhrase}`;
}
