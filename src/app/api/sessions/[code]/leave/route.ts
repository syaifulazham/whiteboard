import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (board.ownerId === session.user.id) return NextResponse.json({ error: "Owner cannot leave — use end session" }, { status: 400 });

  await db.participant.deleteMany({
    where: { sessionId: board.id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
