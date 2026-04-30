import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [owned, joined] = await Promise.all([
    db.whiteboardSession.findMany({
      where: { ownerId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    db.participant.findMany({
      where: { userId: session.user.id },
      include: { session: true },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ owned, joined: joined.map((p) => p.session) });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.create({
    data: {
      inviteCode: nanoid(6).toUpperCase(),
      ownerId: session.user.id,
    },
  });

  return NextResponse.json({ id: board.id, inviteCode: board.inviteCode });
}
