import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.participant.upsert({
    where: { sessionId_userId: { sessionId: board.id, userId: session.user.id } },
    create: { sessionId: board.id, userId: session.user.id },
    update: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true, inviteCode: board.inviteCode });
}
