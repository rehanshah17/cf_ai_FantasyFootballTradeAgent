export class StreamHub {
  private waitingWriter?: {
    writer: WritableStreamDefaultWriter<Uint8Array>;
    keepAlive?: ReturnType<typeof setInterval>;
  };

  private pendingPayload?: unknown;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect" && request.method === "GET") {
      return this.handleConnect(request);
    }

    if (url.pathname === "/emit" && request.method === "POST") {
      return this.handleEmit(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleConnect(request: Request): Promise<Response> {
    await this.closeWaitingWriter();

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const cleanup = async () => {
      if (this.waitingWriter?.writer === writer) {
        if (this.waitingWriter.keepAlive) clearInterval(this.waitingWriter.keepAlive);
        this.waitingWriter = undefined;
      }
      try {
        await writer.close();
      } catch (err) {
        console.warn("[StreamHub] Failed to close writer", err);
      }
    };

    const heartbeat = setInterval(async () => {
      try {
        await writer.write(encoder.encode(": keep-alive\n\n"));
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    request.signal.addEventListener("abort", () => {
      clearInterval(heartbeat);
      cleanup().catch(() => undefined);
    });

    await writer.write(encoder.encode("retry: 1000\n\n"));

    if (this.pendingPayload) {
      await writer.write(encoder.encode(`data: ${JSON.stringify(this.pendingPayload)}\n\n`));
      this.pendingPayload = undefined;
      clearInterval(heartbeat);
      await cleanup();
    } else {
      this.waitingWriter = { writer, keepAlive: heartbeat };
    }

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  private async handleEmit(request: Request): Promise<Response> {
    const payload = await request.json();

    if (this.waitingWriter) {
      const { writer, keepAlive } = this.waitingWriter;
      this.waitingWriter = undefined;
      if (keepAlive) clearInterval(keepAlive);
      try {
        await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
        await writer.close();
      } catch (err) {
        console.warn("[StreamHub] Failed to deliver payload to listener", err);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    this.pendingPayload = payload;
    return new Response(JSON.stringify({ ok: true, buffered: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  private async closeWaitingWriter() {
    if (!this.waitingWriter) return;
    try {
      await this.waitingWriter.writer.close();
    } catch (err) {
      console.warn("[StreamHub] Failed to close previous writer", err);
    }
    if (this.waitingWriter.keepAlive) clearInterval(this.waitingWriter.keepAlive);
    this.waitingWriter = undefined;
  }
}
