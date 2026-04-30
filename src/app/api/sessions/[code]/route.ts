import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({
    where: { inviteCode: params.code },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = board.ownerId === session.user.id;
  const isParticipant = board.participants.some((p) => p.userId === session.user.id);
  if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    id: board.id,
    title: board.title,
    inviteCode: board.inviteCode,
    webhookUrl: board.webhookUrl ?? "",
    createdAt: board.createdAt,
    owner: board.owner,
    participants: board.participants.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      image: p.user.image,
      joinedAt: p.joinedAt,
      lastSeenAt: p.lastSeenAt,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (board.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, string> = {};
  if ("title" in body) data.title = (body.title ?? "").trim() || "Untitled Board";
  if ("webhookUrl" in body) data.webhookUrl = (body.webhookUrl ?? "").trim();

  const updated = await db.whiteboardSession.update({ where: { id: board.id }, data });

  return NextResponse.json({ title: updated.title, webhookUrl: updated.webhookUrl ?? "" });
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (board.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.whiteboardSession.delete({ where: { id: board.id } });

  return NextResponse.json({ ok: true });
}
