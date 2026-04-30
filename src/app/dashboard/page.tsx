import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import db from "@/lib/db";
import { Sparkles, LogOut, Plus, Clock, Users } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = session.user.id!;

  const [ownedBoards, joinedBoards] = await Promise.all([
    db.whiteboardSession.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { participants: true } } },
    }),
    db.participant.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            owner: { select: { name: true, image: true } },
            _count: { select: { participants: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      {/* Navbar */}
      <header className="border-b border-yellow-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Sparkles size={18} className="text-amber-500" />
          <span className="font-semibold text-neutral-800 text-sm">Smart Whiteboard</span>
          <div className="ml-auto flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={30}
                height={30}
                className="rounded-full border border-yellow-200"
              />
            )}
            <span className="text-sm text-neutral-600 hidden sm:block">{session.user.name}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-neutral-500 hover:bg-yellow-100 hover:text-neutral-700 transition-colors"
              >
                <LogOut size={13} /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">My Boards</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Create or join a whiteboard session</p>
          </div>
          <a
            href="/board/new"
            className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            <Plus size={16} /> New Board
          </a>
        </div>

        {/* Owned boards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Created by me</h2>
          {ownedBoards.length === 0 ? (
            <EmptyState message="No boards yet. Create your first one!" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ownedBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  title={board.title}
                  inviteCode={board.inviteCode}
                  updatedAt={board.updatedAt}
                  participantCount={board._count.participants}
                  href={`/board/${board.inviteCode}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Joined boards */}
        {joinedBoards.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Joined</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {joinedBoards.map(({ session: board }) => (
                <BoardCard
                  key={board.id}
                  title={board.title}
                  inviteCode={board.inviteCode}
                  updatedAt={board.updatedAt}
                  participantCount={board._count.participants}
                  ownerName={board.owner.name ?? undefined}
                  ownerImage={board.owner.image ?? undefined}
                  href={`/board/${board.inviteCode}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Join by code */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Join a board</h2>
          <JoinForm />
        </section>
      </main>
    </div>
  );
}

function BoardCard({
  title, inviteCode, updatedAt, participantCount, ownerName, ownerImage, href,
}: {
  title: string; inviteCode: string; updatedAt: Date; participantCount: number;
  ownerName?: string; ownerImage?: string; href: string;
}) {
  return (
    <a
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-yellow-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
          <Sparkles size={18} className="text-amber-400" />
        </div>
        <span className="font-mono text-[11px] text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-md px-1.5 py-0.5">
          {inviteCode}
        </span>
      </div>
      <div>
        <p className="font-semibold text-sm text-neutral-800 group-hover:text-amber-700 transition-colors line-clamp-1">{title}</p>
        {ownerName && (
          <p className="text-[11px] text-neutral-400 mt-0.5">by {ownerName}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-neutral-400">
        <span className="flex items-center gap-1"><Clock size={11} />{formatRelative(updatedAt)}</span>
        <span className="flex items-center gap-1"><Users size={11} />{participantCount}</span>
      </div>
    </a>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-yellow-300 bg-yellow-50/50 px-6 py-10 text-center text-sm text-neutral-400">
      {message}
    </div>
  );
}

function JoinForm() {
  async function join(formData: FormData) {
    "use server";
    const code = (formData.get("code") as string ?? "").trim().toUpperCase();
    if (code.length >= 1) redirect(`/board/${code}`);
  }
  return (
    <form action={join} className="flex gap-2 max-w-sm">
      <input
        name="code"
        placeholder="Enter invite code…"
        maxLength={6}
        className="flex-1 rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none focus:border-amber-400 uppercase tracking-widest"
      />
      <button
        type="submit"
        className="rounded-xl bg-amber-400 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        Join
      </button>
    </form>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
