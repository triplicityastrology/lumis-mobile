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
  if (request.method !== "POST") {
    return Response.json({ error: { code: 405, message: "Method not allowed" } }, { status: 405 });
  }

  const acceptsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;
  const body = (await request.json().catch(() => ({}))) as ChatMessageRequest;
  const response = buildChatResponse(body);

  if (!acceptsStream) {
    return Response.json(response);
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
});

function buildChatResponse(body: ChatMessageRequest) {
  const chartPhrase =
    body.chart_context?.sun && body.chart_context?.moon
      ? ` With your ${body.chart_context.sun} Sun and ${body.chart_context.moon} Moon in view,`
      : "";
  const stylePhrase =
    body.persona_style === "spark"
      ? " let us find the fresh angle."
      : body.persona_style === "awareness"
        ? " let us notice the pattern underneath."
        : " let us move gently and steadily.";

  return {
    route: "casual",
    credits_cost: 1,
    remaining_credits: 49,
    reply: `${chartPhrase} I hear this question.${stylePhrase}`
  };
}
