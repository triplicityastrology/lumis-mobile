import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

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

  if (!acceptsStream) {
    return jsonResponse(response);
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: meta\ndata: ${JSON.stringify({
            route: response.route,
            credits_cost: response.credits_cost,
            billing_mode: response.billing_mode
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
            billing_mode: response.billing_mode
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
