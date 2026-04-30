import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sseBroadcast } from "@/lib/sse";

export const runtime = "nodejs";

// Owner POSTs incremental store diffs here; we fan them out via SSE instantly.
// No DB write per diff — the canvas PUT route handles persistence.
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.whiteboardSession.findUnique({ where: { inviteCode: params.code } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (board.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { put, remove } = await req.json();
  sseBroadcast(params.code, JSON.stringify({ type: "diff", put, remove }));

  return NextResponse.json({ ok: true });
}
