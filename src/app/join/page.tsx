"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) { setError("Invite code must be 6 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${trimmed}/join`, { method: "POST" });
      if (res.status === 404) { setError("Board not found. Check the code and try again."); return; }
      if (!res.ok) { setError("Something went wrong. Try again."); return; }
      router.push(`/board/${trimmed}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-50 to-white px-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">

        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-100 border border-yellow-200 shadow-sm">
          <Sparkles size={26} className="text-amber-500" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Join a board</h1>
          <p className="mt-1 text-sm text-neutral-500">Enter the 6-character invite code</p>
        </div>

        <form onSubmit={handleJoin} className="w-full rounded-2xl border border-yellow-200 bg-white shadow-sm p-6 space-y-4">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="X7K2MP"
            autoFocus
            className="w-full text-center text-2xl font-mono tracking-[0.4em] rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-neutral-800 placeholder:text-neutral-300 outline-none focus:border-amber-400 uppercase"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.trim().length !== 6}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {loading ? "Joining…" : "Join Board"}
          </button>
        </form>

        <a href="/dashboard" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
