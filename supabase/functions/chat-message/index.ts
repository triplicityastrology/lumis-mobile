Deno.serve(() => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode('event: meta\ndata: {"route":"casual","credits_cost":1}\n\n')
      );
      controller.enqueue(
        encoder.encode('event: token\ndata: {"t":"Lumis chat streaming scaffold is ready."}\n\n')
      );
      controller.enqueue(
        encoder.encode('event: done\ndata: {"credits_charged":0,"remaining_credits":50}\n\n')
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

