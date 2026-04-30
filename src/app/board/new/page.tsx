import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { nanoid } from "nanoid";

export default async function NewBoardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const board = await db.whiteboardSession.create({
    data: {
      inviteCode: nanoid(6).toUpperCase(),
      ownerId: session.user.id,
    },
  });

  redirect(`/board/${board.inviteCode}`);
}
