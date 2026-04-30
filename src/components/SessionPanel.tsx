"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Copy, Check, Crown, LogOut, Trash2, Loader2, Users, RefreshCw, Pencil,
} from "lucide-react";
import Image from "next/image";

type Participant = {
  userId: string;
  name: string | null;
  image: string | null;
  joinedAt: string;
  lastSeenAt: string;
};

type SessionData = {
  id: string;
  title: string;
  inviteCode: string;
  createdAt: string;
  owner: { id: string; name: string | null; image: string | null };
  participants: Participant[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  inviteCode: string;
  isOwner: boolean;
  currentUserId: string;
};

export default function SessionPanel({ open, onClose, inviteCode, isOwner, currentUserId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${inviteCode}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setTitleInput(d.title);
      }
    } finally {
      setLoading(false);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function saveTitle() {
    if (!titleInput.trim() || savingTitle) return;
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/sessions/${inviteCode}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: titleInput }),
      });
      if (res.ok) {
        const d = await res.json();
        setData((prev) => prev ? { ...prev, title: d.title } : prev);
        setEditingTitle(false);
      }
    } finally {
      setSavingTitle(false);
    }
  }

  async function endSession() {
    setEnding(true);
    try {
      await fetch(`/api/sessions/${inviteCode}`, { method: "DELETE" });
      router.push("/dashboard");
    } finally {
      setEnding(false);
    }
  }

  async function leaveSession() {
    setLeaving(true);
    try {
      await fetch(`/api/sessions/${inviteCode}/leave`, { method: "DELETE" });
      router.push("/dashboard");
    } finally {
      setLeaving(false);
    }
  }

  const allPeople = data
    ? [
        { userId: data.owner.id, name: data.owner.name, image: data.owner.image, isOwner: true },
        ...data.participants
          .filter((p) => p.userId !== data.owner.id)
          .map((p) => ({ ...p, isOwner: false })),
      ]
    : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="absolute top-0 right-0 bottom-0 z-50 w-72 flex flex-col border-l border-yellow-200 bg-yellow-50 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-100 px-4 py-3 shrink-0">
              <Users size={14} className="text-amber-500" />
              <span className="text-sm font-semibold text-neutral-700">Session</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={fetchData}
                  className="rounded p-1 text-neutral-400 hover:bg-yellow-200 hover:text-neutral-700 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={onClose}
                  className="rounded p-1 text-neutral-400 hover:bg-yellow-200 hover:text-neutral-700 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {loading && !data ? (
                <div className="flex items-center justify-center py-8 text-neutral-400">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : data ? (
                <>
                  {/* Title */}
                  <section className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Board title</p>
                    {editingTitle ? (
                      <div className="flex gap-1.5">
                        <input
                          value={titleInput}
                          onChange={(e) => setTitleInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                          autoFocus
                          className="flex-1 rounded-lg border border-yellow-300 bg-white px-2 py-1.5 text-sm text-neutral-700 outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={saveTitle}
                          disabled={savingTitle}
                          className="rounded-lg bg-amber-400 hover:bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {savingTitle ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <p className="text-sm font-medium text-neutral-700 flex-1 truncate">{data.title}</p>
                        {isOwner && (
                          <button
                            onClick={() => setEditingTitle(true)}
                            className="opacity-0 group-hover:opacity-100 rounded p-1 text-neutral-400 hover:text-amber-600 transition-all"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Invite code */}
                  <section className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Invite code</p>
                    <button
                      onClick={copyCode}
                      className="w-full flex items-center justify-between rounded-xl border border-yellow-200 bg-white px-3 py-2.5 hover:bg-yellow-50 transition-colors group"
                    >
                      <span className="font-mono text-xl tracking-[0.3em] text-neutral-700">{inviteCode}</span>
                      <span className="text-neutral-400 group-hover:text-amber-500 transition-colors">
                        {codeCopied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                      </span>
                    </button>
                    <p className="text-[11px] text-neutral-400">Share this code to invite others to the board.</p>
                  </section>

                  {/* Participants */}
                  <section className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
                      Participants · {allPeople.length}
                    </p>
                    <ul className="space-y-1">
                      {allPeople.map((p) => (
                        <li
                          key={p.userId}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-yellow-100 transition-colors"
                        >
                          <Avatar name={p.name} image={p.image} />
                          <span className="flex-1 text-sm text-neutral-700 truncate">
                            {p.name ?? "Unknown"}
                            {p.userId === currentUserId && (
                              <span className="ml-1 text-[10px] text-neutral-400">(you)</span>
                            )}
                          </span>
                          {p.isOwner && (
                            <Crown size={12} className="text-amber-400 shrink-0" title="Owner" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-yellow-200 p-3 space-y-2">
              {isOwner ? (
                endConfirm ? (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500 text-center">End session for everyone?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEndConfirm(false)}
                        className="flex-1 rounded-lg border border-yellow-200 bg-white py-2 text-xs text-neutral-600 hover:bg-yellow-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={endSession}
                        disabled={ending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {ending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        End session
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEndConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} /> End session
                  </button>
                )
              ) : (
                <button
                  onClick={leaveSession}
                  disabled={leaving}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-yellow-200 bg-white py-2 text-xs font-medium text-neutral-500 hover:bg-yellow-50 transition-colors"
                >
                  {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  Leave session
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? "User"}
        width={26}
        height={26}
        className="rounded-full border border-yellow-200 shrink-0"
      />
    );
  }
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-[26px] h-[26px] rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
      {initials}
    </div>
  );
}
