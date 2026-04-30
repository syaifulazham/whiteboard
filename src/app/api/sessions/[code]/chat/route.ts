import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sseBroadcast } from "@/lib/sse";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.chatMessage.findMany({
    where: { sessionId: board.id },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json(messages.map((m) => ({
    id: m.id,
    userId: m.userId,
    userName: m.user.name,
    userImage: m.user.image,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  })));
}

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({
    where: { inviteCode: params.code },
    include: { owner: { select: { id: true } } },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true, image: true } });

  const message = await db.chatMessage.create({
    data: { sessionId: board.id, userId: session.user.id, content: content.trim() },
  });

  const payload = {
    id: message.id,
    userId: session.user.id,
    userName: user?.name ?? null,
    userImage: user?.image ?? null,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };

  // Real-time broadcast to all connected clients
  sseBroadcast(params.code, JSON.stringify({ type: "chat", message: payload }));

  // Optional webhook: supports Slack (`text`), Discord (`content`), and generic consumers
  if (board.webhookUrl) {
    const label = `*${user?.name ?? "Someone"}* on board *${board.title}* (\`${board.inviteCode}\`)`;
    fetch(board.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `${label}:\n${message.content}`,          // Slack
        content: `${label}:\n${message.content}`,       // Discord
        event: "chat_message",
        board: { title: board.title, code: board.inviteCode },
        author: user?.name ?? null,
        message: message.content,
        timestamp: message.createdAt.toISOString(),
      }),
    }).catch(() => {});
  }

  return NextResponse.json(payload);
}
