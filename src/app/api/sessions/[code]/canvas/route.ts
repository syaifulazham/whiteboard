import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sseBroadcast } from "@/lib/sse";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (board.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { snapshot } = await req.json();
  await db.whiteboardSession.update({
    where: { id: board.id },
    data: { canvasState: snapshot },
  });

  // Push to all connected SSE participants
  sseBroadcast(params.code, JSON.stringify({ type: "canvas", snapshot }));

  return NextResponse.json({ ok: true });
}
