import {
  classifyChatRoute,
  getChatRouteDecision,
  type ChatRoute
} from "../../../packages/shared/src/config/chat-router.ts";

import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

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
            credits_cost: response.credits_cost
          })}\n\n`
        )
      );
      controller.enqueue(
        encoder.encode(`event: token\ndata: ${JSON.stringify({ t: response.reply })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(
          `event: done\ndata: ${JSON.stringify({
            credits_charged: response.credits_cost,
            remaining_credits: response.remaining_credits
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
  const routeDecision = getChatRouteDecision(route);
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
    credits_cost: routeDecision.credits,
    remaining_credits: Math.max(0, 50 - routeDecision.credits),
    reply: buildReplyText(route, chartPhrase, stylePhrase)
  };
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
