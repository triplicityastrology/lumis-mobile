import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createClient } from "@supabase/supabase-js";

type ChatRoute =
  | "casual"
  | "knowledge"
  | "dice"
  | "astro_timing"
  | "astro_deep"
  | "out_of_scope"
  | "safety";

type ChatMessageRequest = {
  message?: string;
  persona_style?: "acceptance" | "spark" | "awareness";
  chart_context?: {
    precision?: string;
    sun?: string;
    moon?: string;
    rising?: string;
  };
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
};

type ChatThreadRow = {
  id: string;
};

// Staging scaffold copy of the mobile/shared router table. Keep this aligned
// with packages/shared route fixtures until CHAT-1 moves routing into a
// transactional backend implementation.
const ROUTE_CREDITS: Record<ChatRoute, number> = {
  casual: 1,
  knowledge: 3,
  dice: 5,
  astro_timing: 5,
  astro_deep: 5,
  out_of_scope: 1,
  safety: 1
};

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
  const response = buildChatResponse(body);
  const persistence = await safePersistScaffoldChatTurn(request, body, response);
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

async function safePersistScaffoldChatTurn(
  request: Request,
  body: ChatMessageRequest,
  response: ReturnType<typeof buildChatResponse>
): Promise<{ persisted: PersistedChatContext | null; error: string | null }> {
  try {
    return {
      persisted: await persistScaffoldChatTurn(request, body, response),
      error: null
    };
  } catch (error) {
    return {
      persisted: null,
      error: error instanceof Error ? error.message : "Chat persistence failed."
    };
  }
}

async function persistScaffoldChatTurn(
  request: Request,
  body: ChatMessageRequest,
  response: ReturnType<typeof buildChatResponse>
): Promise<PersistedChatContext | null> {
  const authHeader = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const message = body.message?.trim();

  if (!authHeader || !supabaseUrl || !anonKey || !serviceRoleKey || !message) {
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

  const userId = authData.user.id;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const profile = await loadActiveProfile(serviceClient, userId);

  if (!profile) {
    return null;
  }

  const thread = await loadOrCreateThread(serviceClient, {
    userId,
    aiProfileId: profile.id,
    chartVersion: profile.chart_version,
    personaStyle: body.persona_style ?? "acceptance",
    route: response.route,
    title: buildThreadTitle(message)
  });
  const userMessageId = await insertChatMessage(serviceClient, {
    threadId: thread.id,
    userId,
    role: "user",
    content: message,
    route: response.route,
    creditsCost: 0
  });
  const assistantMessageId = await insertChatMessage(serviceClient, {
    threadId: thread.id,
    userId,
    role: "assistant",
    content: response.reply,
    route: response.route,
    creditsCost: 0
  });

  const { error: threadUpdateError } = await serviceClient
    .from("chat_threads")
    .update({
      updated_at: new Date().toISOString(),
      route: response.route
    })
    .eq("id", thread.id);

  if (threadUpdateError) {
    throw new Error(threadUpdateError.message);
  }

  return {
    threadId: thread.id,
    userMessageId,
    assistantMessageId,
    aiProfileId: profile.id,
    chartVersion: profile.chart_version
  };
}

async function loadActiveProfile(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<AiProfileRow | null> {
  const { data, error } = await serviceClient
    .from("ai_profiles")
    .select("id, chart_version")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("chart_version", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data as AiProfileRow;
  }

  const fallback = await serviceClient
    .from("ai_profiles")
    .select("id, chart_version")
    .eq("user_id", userId)
    .order("chart_version", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return fallback.data as AiProfileRow | null;
}

async function loadOrCreateThread(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    userId: string;
    aiProfileId: number;
    chartVersion: number;
    personaStyle: "acceptance" | "spark" | "awareness";
    route: ChatRoute;
    title: string;
  }
): Promise<ChatThreadRow> {
  const { data: existingThread, error: existingError } = await serviceClient
    .from("chat_threads")
    .select("id")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("chart_version", input.chartVersion)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingThread) {
    return existingThread as ChatThreadRow;
  }

  const { data, error } = await serviceClient
    .from("chat_threads")
    .insert({
      user_id: input.userId,
      ai_profile_id: input.aiProfileId,
      chart_version: input.chartVersion,
      persona_style: input.personaStyle,
      route: input.route,
      title: input.title
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ChatThreadRow;
}

async function insertChatMessage(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    threadId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    route: ChatRoute;
    creditsCost: number;
  }
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from("chat_messages")
    .insert({
      thread_id: input.threadId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      route: input.route,
      credits_cost: input.creditsCost
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id?: string } | null)?.id ?? null;
}

function buildThreadTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();

  return cleaned.length <= 48 ? cleaned : `${cleaned.slice(0, 45)}...`;
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
