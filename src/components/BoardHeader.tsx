"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  ArrowLeft, ChevronRight, ChevronLeft, Copy, Check,
  Crown, LogOut, Trash2, Loader2, Users, RefreshCw, Pencil,
  MessageSquare, Send, Webhook, Eye, EyeOff,
} from "lucide-react";
import type { ChatMsg } from "./Workspace";

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
  webhookUrl: string;
  createdAt: string;
  owner: { id: string; name: string | null; image: string | null };
  participants: Participant[];
};

type BoardHeaderProps = {
  title: string;
  inviteCode: string;
  isOwner: boolean;
  ownerName: string;
  sessionId: string;
  userId: string;
  chatMessages: ChatMsg[];
  onSendMessage: (content: string) => Promise<void>;
};

type Tab = "session" | "chat";

export default function BoardHeader({
  title, inviteCode, isOwner, userId, chatMessages, onSendMessage,
}: BoardHeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("session");
  const [unreadChat, setUnreadChat] = useState(0);

  // Session tab state
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Webhook config (owner only)
  const [webhookInput, setWebhookInput] = useState("");
  const [showWebhook, setShowWebhook] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);

  // Chat tab state
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(chatMessages.length);

  // Track unread when panel is closed or chat tab is not active
  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current) {
      const newCount = chatMessages.length - prevMsgCount.current;
      if (!open || tab !== "chat") setUnreadChat((n) => n + newCount);
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages.length, open, tab]);

  // Clear unread when chat tab is opened
  useEffect(() => {
    if (open && tab === "chat") setUnreadChat(0);
  }, [open, tab]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (open && tab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, open, tab]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${inviteCode}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setTitleInput(d.title);
        setWebhookInput(d.webhookUrl ?? "");
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
        setData((prev) => (prev ? { ...prev, title: d.title } : prev));
        setEditingTitle(false);
      }
    } finally {
      setSavingTitle(false);
    }
  }

  async function saveWebhook() {
    if (savingWebhook) return;
    setSavingWebhook(true);
    try {
      const res = await fetch(`/api/sessions/${inviteCode}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: webhookInput }),
      });
      if (res.ok) {
        setWebhookSaved(true);
        setTimeout(() => setWebhookSaved(false), 2000);
      }
    } finally {
      setSavingWebhook(false);
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || sending) return;
    setChatInput("");
    setSending(true);
    try {
      await onSendMessage(text);
    } finally {
      setSending(false);
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">

      {/* Collapsed tab — slides with the panel */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-auto"
        style={{ right: open ? 272 : 0, transition: "right 0.28s cubic-bezier(0.32,0,0.18,1)" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative flex flex-col items-center justify-center gap-2 rounded-l-xl border border-r-0 border-yellow-300 bg-yellow-50 shadow-md px-1.5 py-4 text-neutral-500 hover:bg-yellow-100 hover:text-amber-600 transition-colors"
          title={open ? "Collapse" : "Session & Chat"}
        >
          {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          <Users size={14} />
          <MessageSquare size={14} />
          {!open && unreadChat > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unreadChat > 9 ? "9+" : unreadChat}
            </span>
          )}
          {!open && (
            <span
              className="text-[9px] font-semibold tracking-wider uppercase"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Panel
            </span>
          )}
        </button>
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-0 right-0 bottom-0 flex flex-col border-l border-yellow-200 bg-yellow-50 shadow-2xl pointer-events-auto"
            style={{ width: 272 }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
          >
            {/* Back + tabs header */}
            <div className="shrink-0 border-b border-yellow-200 bg-yellow-100">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <a href="/dashboard" className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-amber-600 transition-colors">
                  <ArrowLeft size={11} /> Dashboard
                </a>
                <button onClick={fetchData} className="ml-auto rounded p-1 text-neutral-400 hover:bg-yellow-200 hover:text-neutral-600 transition-colors" title="Refresh">
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
              {/* Tab bar */}
              <div className="flex px-2 pb-0 gap-1">
                {(["session", "chat"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                      tab === t
                        ? "bg-yellow-50 text-amber-700 border border-b-0 border-yellow-200"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {t === "session" ? <Users size={12} /> : <MessageSquare size={12} />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {t === "chat" && unreadChat > 0 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                        {unreadChat > 9 ? "9+" : unreadChat}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── SESSION TAB ── */}
            {tab === "session" && (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
                {loading && !data ? (
                  <div className="flex items-center justify-center py-8 text-neutral-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : data ? (
                  <>
                    {/* Board title */}
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
                          <button onClick={saveTitle} disabled={savingTitle} className="rounded-lg bg-amber-400 hover:bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                            {savingTitle ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <p className="text-sm font-medium text-neutral-700 flex-1 truncate">{data.title}</p>
                          {isOwner && (
                            <button onClick={() => setEditingTitle(true)} className="opacity-0 group-hover:opacity-100 rounded p-1 text-neutral-400 hover:text-amber-600 transition-all">
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </section>

                    {/* Invite code */}
                    <section className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Invite code</p>
                      <button onClick={copyCode} className="w-full flex items-center justify-between rounded-xl border border-yellow-200 bg-white px-3 py-2.5 hover:bg-yellow-50 transition-colors group">
                        <span className="font-mono text-xl tracking-[0.3em] text-neutral-700">{inviteCode}</span>
                        <span className="text-neutral-400 group-hover:text-amber-500 transition-colors">
                          {codeCopied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                        </span>
                      </button>
                      <p className="text-[11px] text-neutral-400">Share this code — board persists until you delete it.</p>
                    </section>

                    {/* Participants */}
                    <section className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Participants · {allPeople.length}</p>
                      <ul className="space-y-1">
                        {allPeople.map((p) => (
                          <li key={p.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-yellow-100 transition-colors">
                            <Avatar name={p.name} image={p.image} />
                            <span className="flex-1 text-sm text-neutral-700 truncate">
                              {p.name ?? "Unknown"}
                              {p.userId === userId && <span className="ml-1 text-[10px] text-neutral-400">(you)</span>}
                            </span>
                            {p.isOwner && <Crown size={12} className="text-amber-400 shrink-0" aria-label="Owner" />}
                          </li>
                        ))}
                      </ul>
                    </section>

                    {isOwner && (
                      <>
                        {/* Webhook */}
                        <section className="space-y-1.5">
                          <button
                            onClick={() => setShowWebhook((v) => !v)}
                            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-neutral-400 hover:text-amber-600 transition-colors"
                          >
                            <Webhook size={11} /> Webhook notifications {showWebhook ? "▲" : "▼"}
                          </button>
                          {showWebhook && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-neutral-400">
                                Paste a Slack / Discord / Teams incoming webhook URL. A message is sent every time someone posts in the board chat.
                              </p>
                              <div className="flex gap-1.5">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={webhookInput}
                                    onChange={(e) => setWebhookInput(e.target.value)}
                                    placeholder="https://hooks.slack.com/…"
                                    className="w-full rounded-lg border border-yellow-300 bg-white px-2 py-1.5 text-xs text-neutral-700 outline-none focus:border-amber-400 pr-7"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowWebhook((v) => !v)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                  >
                                    {showWebhook ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                </div>
                                <button
                                  onClick={saveWebhook}
                                  disabled={savingWebhook}
                                  className="rounded-lg bg-amber-400 hover:bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 shrink-0"
                                >
                                  {savingWebhook ? <Loader2 size={12} className="animate-spin" /> : webhookSaved ? <Check size={12} className="text-white" /> : "Save"}
                                </button>
                              </div>
                            </div>
                          )}
                        </section>

                        {/* Danger zone */}
                        <section className="pt-1 border-t border-red-100">
                          {endConfirm ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-neutral-500 text-center">Permanently delete this board?</p>
                              <div className="flex gap-2">
                                <button onClick={() => setEndConfirm(false)} className="flex-1 rounded-lg border border-yellow-200 bg-white py-1.5 text-xs text-neutral-600 hover:bg-yellow-50">Cancel</button>
                                <button onClick={endSession} disabled={ending} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-red-500 hover:bg-red-600 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                                  {ending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEndConfirm(true)}
                              className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={11} /> Delete board permanently
                            </button>
                          )}
                        </section>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* ── CHAT TAB ── */}
            {tab === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-[12px] text-neutral-400 pt-8">No messages yet. Say something!</p>
                  ) : (
                    chatMessages.map((m) => {
                      const isMe = m.userId === userId;
                      return (
                        <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                          <Avatar name={m.userName} image={m.userImage} />
                          <div className={`flex flex-col gap-0.5 max-w-[180px] ${isMe ? "items-end" : ""}`}>
                            <span className="text-[10px] text-neutral-400 px-1">
                              {isMe ? "You" : (m.userName ?? "Unknown")}
                            </span>
                            <div className={`rounded-2xl px-3 py-2 text-xs leading-5 break-words ${
                              isMe
                                ? "bg-amber-400 text-white rounded-tr-sm"
                                : "bg-white border border-yellow-200 text-neutral-700 rounded-tl-sm"
                            }`}>
                              {m.content}
                            </div>
                            <span className="text-[9px] text-neutral-300 px-1">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <form
                  onSubmit={handleSend}
                  className="shrink-0 flex items-center gap-2 border-t border-yellow-200 bg-yellow-100/60 px-2 py-2"
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl border border-yellow-300 bg-white px-3 py-2 text-xs text-neutral-700 outline-none focus:border-amber-400"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || sending}
                    className="rounded-xl bg-amber-400 hover:bg-amber-500 p-2 text-white disabled:opacity-40 transition-colors"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </form>
              </>
            )}

            {/* Footer actions */}
            <div className="shrink-0 border-t border-yellow-200 p-3">
              {isOwner ? (
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-yellow-200 bg-white py-2 text-xs font-medium text-neutral-500 hover:bg-yellow-50 transition-colors"
                >
                  <ArrowLeft size={13} /> Close board
                </button>
              ) : (
                <button onClick={leaveSession} disabled={leaving} className="w-full flex items-center justify-center gap-2 rounded-lg border border-yellow-200 bg-white py-2 text-xs font-medium text-neutral-500 hover:bg-yellow-50 transition-colors">
                  {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  Leave board
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return <Image src={image} alt={name ?? "User"} width={26} height={26} className="rounded-full border border-yellow-200 shrink-0" />;
  }
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-[26px] h-[26px] rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
      {initials}
    </div>
  );
}
