import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/db";
import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("@/components/Workspace"), { ssr: false });

export default async function BoardPage({ params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const { code } = params;

  const board = await db.whiteboardSession.findUnique({
    where: { inviteCode: code },
    include: { owner: { select: { id: true, name: true, image: true } } },
  });

  if (!board) notFound();

  const isOwner = board.ownerId === userId;

  // Auto-join as participant if not owner
  if (!isOwner) {
    await db.participant.upsert({
      where: { sessionId_userId: { sessionId: board.id, userId } },
      create: { sessionId: board.id, userId },
      update: { lastSeenAt: new Date() },
    });
  }

  return (
    <div className="h-screen w-screen">
      <Workspace
        sessionId={board.id}
        inviteCode={board.inviteCode}
        initialSnapshot={board.canvasState as object | null}
        isOwner={isOwner}
        boardTitle={board.title}
        userId={userId}
      />
    </div>
  );
}
