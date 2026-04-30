import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sseSubscribe } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return new Response("Not found", { status: 404 });

  const enc = new TextEncoder();
  let unsub: (() => void) | undefined;
  let pingInterval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(ctrl) {
      const send = (data: string) => {
        try { ctrl.enqueue(enc.encode(`data: ${data}\n\n`)); } catch {}
      };
      unsub = sseSubscribe(params.code, send);

      // Send the latest persisted snapshot immediately so the participant is
      // fully caught up before any diffs arrive.
      if (board.canvasState) {
        send(JSON.stringify({ type: "canvas", snapshot: board.canvasState }));
      }

      // Keepalive every 25s to prevent proxy / browser timeout
      pingInterval = setInterval(() => send("ping"), 25_000);
    },
    cancel() {
      unsub?.();
      clearInterval(pingInterval);
    },
  });

  req.signal.addEventListener("abort", () => {
    unsub?.();
    clearInterval(pingInterval);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
