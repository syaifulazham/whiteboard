"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mic, Square, Loader2, FileText, Wand2, Languages, GraduationCap, ScanLine, Sparkles, Sigma, RefreshCw, MousePointerClick } from "lucide-react";
import MermaidView from "./MermaidView";
import MathView, { RichText } from "./MathView";

type Mode = "chat" | "summarize" | "diagram" | "translate" | "explain" | "hwr" | "math";

export type Suggestion = {
  label: string;
  mode: "explain" | "math" | "translate" | "summarize" | "diagram" | "hwr" | "chat" | "refine";
  instruction?: string;
  target?: string;
};

export type Classification = {
  loading?: boolean;
  type?: string;
  description?: string;
  suggestions?: Suggestion[];
  error?: string;
};

const TYPE_COLORS: Record<string, string> = {
  text: "bg-sky-900/40 border-sky-700 text-sky-200",
  math: "bg-violet-900/40 border-violet-700 text-violet-200",
  chemistry: "bg-emerald-900/40 border-emerald-700 text-emerald-200",
  science_symbol: "bg-teal-900/40 border-teal-700 text-teal-200",
  shape: "bg-amber-900/40 border-amber-700 text-amber-200",
  graph: "bg-rose-900/40 border-rose-700 text-rose-200",
  image: "bg-fuchsia-900/40 border-fuchsia-700 text-fuchsia-200",
  mixed: "bg-indigo-900/40 border-indigo-700 text-indigo-200",
  unknown: "bg-neutral-800/60 border-neutral-700 text-neutral-300",
};

type MathPayload = {
  kind: "math" | "text";
  recognized: string;
  result?: string;
  explanation?: string;
  instruction?: string;
};

type Msg = { role: "user" | "model"; text: string; mermaid?: string; math?: MathPayload };

export default function AssistantPanel(props: {
  getSelectionImage: () => Promise<{ base64: string; mime: string } | null>;
  getSelectionText: () => string;
  insertTextNote: (text: string) => void;
  insertImage: (dataUrl: string, w?: number, h?: number) => Promise<void>;
  classification?: Classification | null;
  onReclassify?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "model", text: "Hi, I'm your whiteboard assistant. Select shapes on the canvas and use the tools above, or ask me anything." },
  ]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [target, setTarget] = useState("English");
  const [level, setLevel] = useState("general adult");
  const [mathInstruction, setMathInstruction] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function runAsk() {
    if (!input.trim() || busy) return;
    const userText = input.trim();
    setInput("");
    const history = [...messages.filter((m) => !m.mermaid), { role: "user" as const, text: userText }];
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setBusy(true);
    try {
      const canvasContext = props.getSelectionText();
      const img = await props.getSelectionImage().catch(() => null);
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, text }) => ({ role, text })),
          canvasContext: canvasContext || undefined,
          imageBase64: img?.base64,
        }),
      });
      const data = await res.json();
      const text = data.text ?? data.error ?? "(no response)";
      const mermaid = extractMermaid(text);
      setMessages((m) => [...m, { role: "model", text, mermaid }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "model", text: `Error: ${e?.message ?? e}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function runSummarize() {
    if (busy) return;
    setBusy(true);
    try {
      const content = props.getSelectionText();
      const img = await props.getSelectionImage();
      const res = await fetch("/api/assistant/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, imageBase64: img?.base64 }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "user", text: "Summarize selection" }, { role: "model", text: data.text ?? data.error ?? "(no response)" }]);
    } finally {
      setBusy(false);
    }
  }

  async function runTranslate() {
    if (busy) return;
    const content = props.getSelectionText() || input.trim();
    if (!content) return;
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, target }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "user", text: `Translate to ${target}: ${content.slice(0, 120)}${content.length > 120 ? "…" : ""}` },
        { role: "model", text: data.text ?? data.error ?? "(no response)" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function runExplain() {
    if (busy) return;
    const content = props.getSelectionText() || input.trim();
    if (!content) return;
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, level }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "user", text: `Explain (${level}): ${content.slice(0, 120)}${content.length > 120 ? "…" : ""}` },
        { role: "model", text: data.text ?? data.error ?? "(no response)" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function runDiagram() {
    if (busy) return;
    const description = input.trim() || props.getSelectionText();
    if (!description) return;
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/diagram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      const mermaid = (data.mermaid ?? "").trim();
      setMessages((m) => [
        ...m,
        { role: "user", text: `Diagram: ${description}` },
        { role: "model", text: "```mermaid\n" + mermaid + "\n```", mermaid },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function runMath() {
    if (busy) return;
    setBusy(true);
    try {
      const img = await props.getSelectionImage();
      if (!img) {
        setMessages((m) => [...m, { role: "model", text: "Select the handwritten math on the canvas first." }]);
        return;
      }
      const instruction = mathInstruction.trim();
      const res = await fetch("/api/assistant/math", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: img.base64, mime: img.mime, instruction }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((m) => [...m, { role: "model", text: `Error: ${data.error}` }]);
        return;
      }
      const userLabel = instruction
        ? `Math: ${instruction}`
        : "Recognize handwriting (math/text)";
      setMessages((m) => [
        ...m,
        { role: "user", text: userLabel },
        {
          role: "model",
          text: "",
          math: {
            kind: data.kind,
            recognized: data.recognized ?? "",
            result: data.result || undefined,
            explanation: data.explanation || undefined,
            instruction: instruction || undefined,
          },
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "model", text: `Error: ${e?.message ?? e}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function runRefine(instruction?: string) {
    if (busy) return;
    const content = props.getSelectionText();
    const img = await props.getSelectionImage().catch(() => null);
    if (!content && !img) {
      setMessages((m) => [...m, { role: "model", text: "Select something on the board to refine." }]);
      return;
    }
    setBusy(true);
    try {
      const userPrompt = (instruction?.trim() ||
        "Refine the selected content: fix spelling/grammar, tighten wording, preserve meaning. Return ONLY the refined version.");
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", text: userPrompt }],
          canvasContext: content || undefined,
          imageBase64: img?.base64,
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "user", text: instruction?.trim() || "Refine selection" },
        { role: "model", text: data.text ?? data.error ?? "(no response)" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function executeSuggestion(s: Suggestion) {
    switch (s.mode) {
      case "math":
        setMode("math");
        setMathInstruction(s.instruction ?? "");
        setTimeout(() => runMath(), 0);
        break;
      case "explain":
        setMode("explain");
        if (s.instruction) setLevel(s.instruction);
        setTimeout(() => runExplain(), 0);
        break;
      case "translate":
        setMode("translate");
        if (s.target) setTarget(s.target);
        setTimeout(() => runTranslate(), 0);
        break;
      case "summarize":
        setMode("summarize");
        setTimeout(() => runSummarize(), 0);
        break;
      case "diagram":
        setMode("diagram");
        if (s.instruction) setInput(s.instruction);
        else {
          const t = props.getSelectionText();
          if (t) setInput(t);
        }
        setTimeout(() => runDiagram(), 0);
        break;
      case "hwr":
        setMode("hwr");
        setTimeout(() => runHWR(), 0);
        break;
      case "refine":
        runRefine(s.instruction);
        break;
      case "chat":
      default:
        setMode("chat");
        if (s.instruction) setInput(s.instruction);
        break;
    }
  }

  async function runHWR() {
    if (busy) return;
    setBusy(true);
    try {
      const img = await props.getSelectionImage();
      if (!img) {
        setMessages((m) => [...m, { role: "model", text: "Select shapes containing handwriting first." }]);
        return;
      }
      const res = await fetch("/api/assistant/hwr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: img.base64, mime: img.mime }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "user", text: "Convert handwriting to text" },
        { role: "model", text: data.text ?? data.error ?? "(no response)" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecord() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBusy(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "clip.webm");
          const res = await fetch("/api/assistant/transcribe", { method: "POST", body: fd });
          const data = await res.json();
          const text = (data.text ?? "").trim();
          if (text) setInput((prev) => (prev ? prev + " " + text : text));
          else setMessages((m) => [...m, { role: "model", text: data.error ?? "(no speech detected)" }]);
        } finally {
          setBusy(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "model", text: `Mic error: ${e?.message ?? e}` }]);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mode === "diagram") runDiagram();
      else if (mode === "translate") runTranslate();
      else if (mode === "explain") runExplain();
      else runAsk();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Sparkles size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-neutral-100">Whiteboard AI</h2>
        <span className="ml-auto text-xs text-neutral-500">Gemini</span>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pb-2">
        <ModeButton active={mode === "chat"} onClick={() => setMode("chat")} icon={<Sparkles size={14} />} label="Chat" />
        <ModeButton active={mode === "summarize"} onClick={() => setMode("summarize")} icon={<FileText size={14} />} label="Summarize" />
        <ModeButton active={mode === "diagram"} onClick={() => setMode("diagram")} icon={<Wand2 size={14} />} label="Diagram" />
        <ModeButton active={mode === "translate"} onClick={() => setMode("translate")} icon={<Languages size={14} />} label="Translate" />
        <ModeButton active={mode === "explain"} onClick={() => setMode("explain")} icon={<GraduationCap size={14} />} label="Explain" />
        <ModeButton active={mode === "hwr"} onClick={() => setMode("hwr")} icon={<ScanLine size={14} />} label="HWR" />
        <ModeButton active={mode === "math"} onClick={() => setMode("math")} icon={<Sigma size={14} />} label="Math" />
      </div>

      {mode === "summarize" && (
        <ActionRow label="Summarize the current selection (or whole board if nothing selected)." action={runSummarize} busy={busy} />
      )}
      {mode === "hwr" && (
        <ActionRow label="Convert selected handwriting to text using Gemini vision." action={runHWR} busy={busy} />
      )}
      {mode === "math" && (
        <div className="px-3 pb-2 space-y-2">
          <label className="text-xs text-neutral-400">
            Select handwritten math on the board, then optionally tell the assistant what to do.
          </label>
          <textarea
            value={mathInstruction}
            onChange={(e) => setMathInstruction(e.target.value)}
            rows={2}
            placeholder="e.g. solve for x, factor, differentiate w.r.t. x, simplify, integrate, balance the equation"
            className="w-full resize-none rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              onClick={runMath}
              disabled={busy}
              className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {mathInstruction.trim() ? "Recognize & solve" : "Recognize as LaTeX"}
            </button>
            {["solve for x", "factor", "simplify", "differentiate w.r.t. x", "integrate"].map((s) => (
              <button
                key={s}
                onClick={() => setMathInstruction(s)}
                className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-700"
                title={`Use: ${s}`}
              >
                {s.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === "translate" && (
        <div className="px-3 pb-2">
          <label className="text-xs text-neutral-400">Target language</label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-sm"
          />
        </div>
      )}
      {mode === "explain" && (
        <div className="px-3 pb-2">
          <label className="text-xs text-neutral-400">Reading level</label>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-sm"
            placeholder="e.g. 5th grader, undergraduate, expert"
          />
        </div>
      )}

      {props.classification && (
        <SelectionCard
          classification={props.classification}
          onReclassify={props.onReclassify}
          onExecute={executeSuggestion}
          busy={busy}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={
                "inline-block max-w-full rounded-lg px-3 py-2 text-[13px] leading-6 whitespace-pre-wrap break-words " +
                (m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-900 text-neutral-100 border border-neutral-800")
              }
            >
              {m.mermaid ? (
                <MermaidView
                  code={m.mermaid}
                  onInsert={(svg) => props.insertImage(svgToDataUrl(svg))}
                />
              ) : m.math ? (
                <MathMessage
                  payload={m.math}
                  insertImage={props.insertImage}
                  insertText={props.insertTextNote}
                />
              ) : m.role === "model" ? (
                <RichText text={m.text} />
              ) : (
                m.text
              )}
            </div>
            {m.role === "model" && !m.mermaid && !m.math && m.text && (
              <div className="mt-1">
                <button
                  onClick={() => props.insertTextNote(m.text)}
                  className="text-[11px] text-neutral-500 hover:text-indigo-400"
                >
                  Insert onto canvas
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Loader2 size={14} className="animate-spin" /> thinking…
          </div>
        )}
      </div>

      {(mode === "chat" || mode === "diagram" || mode === "translate" || mode === "explain") && (
        <div className="border-t border-neutral-800 p-2">
          <div className="flex items-end gap-2">
            <button
              onClick={toggleRecord}
              className={
                "rounded-md p-2 " +
                (recording ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700")
              }
              title={recording ? "Stop recording" : "Record voice"}
            >
              {recording ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={
                mode === "diagram"
                  ? "Describe the diagram (e.g., 'sequence diagram for OAuth')"
                  : mode === "translate"
                  ? "Text to translate (or select on canvas)"
                  : mode === "explain"
                  ? "Text to explain (or select on canvas)"
                  : "Ask the board anything…"
              }
              className="flex-1 resize-none rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={
                mode === "diagram" ? runDiagram : mode === "translate" ? runTranslate : mode === "explain" ? runExplain : runAsk
              }
              disabled={busy}
              className="rounded-md bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs border " +
        (active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800")
      }
    >
      {icon} {label}
    </button>
  );
}

function ActionRow({ label, action, busy }: { label: string; action: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <span className="text-xs text-neutral-400 flex-1">{label}</span>
      <button
        onClick={action}
        disabled={busy}
        className="rounded-md bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Run
      </button>
    </div>
  );
}

function SelectionCard({
  classification,
  onReclassify,
  onExecute,
  busy,
}: {
  classification: Classification;
  onReclassify?: () => void;
  onExecute: (s: Suggestion) => void;
  busy: boolean;
}) {
  const color = TYPE_COLORS[classification.type ?? "unknown"] ?? TYPE_COLORS.unknown;
  return (
    <div className="mx-3 mb-2 rounded-lg border border-neutral-800 bg-neutral-900/80 p-2">
      <div className="flex items-center gap-2">
        <MousePointerClick size={14} className="text-neutral-400" />
        <span className="text-[11px] text-neutral-400">Selection</span>
        {classification.loading ? (
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Loader2 size={12} className="animate-spin" /> classifying…
          </span>
        ) : classification.error ? (
          <span className="text-[11px] text-red-400">{classification.error}</span>
        ) : (
          <span className={"rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider " + color}>
            {classification.type ?? "unknown"}
          </span>
        )}
        <button
          onClick={onReclassify}
          disabled={!onReclassify || classification.loading}
          className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50"
          title="Re-classify selection"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      {classification.description && (
        <div className="mt-1 text-[13px] leading-5 text-neutral-300">{classification.description}</div>
      )}
      {classification.suggestions && classification.suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {classification.suggestions.map((s, i) => (
            <button
              key={i}
              disabled={busy || classification.loading}
              onClick={() => onExecute(s)}
              className="rounded-md border border-indigo-700/60 bg-indigo-600/20 px-2 py-1 text-[11px] text-indigo-100 hover:bg-indigo-600/40 disabled:opacity-50"
              title={s.instruction ?? s.label}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MathMessage({
  payload,
  insertImage,
  insertText,
}: {
  payload: MathPayload;
  insertImage: (dataUrl: string, w?: number, h?: number) => Promise<void>;
  insertText: (text: string) => void;
}) {
  const isMath = payload.kind === "math";
  return (
    <div className="space-y-2 min-w-[280px]">
      <MathView
        label={isMath ? "Recognized (LaTeX)" : "Recognized (text)"}
        latex={isMath ? payload.recognized : undefined}
        plain={!isMath ? payload.recognized : undefined}
        onInsertImage={isMath ? (u, w, h) => insertImage(u, w, h) : undefined}
        onInsertText={insertText}
      />
      {payload.result && (
        <MathView
          label={payload.instruction ? `Result: ${payload.instruction}` : "Result"}
          latex={isMath ? payload.result : undefined}
          plain={!isMath ? payload.result : undefined}
          onInsertImage={isMath ? (u, w, h) => insertImage(u, w, h) : undefined}
          onInsertText={insertText}
        />
      )}
      {payload.explanation && (
        <div className="rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Explanation</div>
          <RichText text={payload.explanation} className="text-[13px] leading-6 text-neutral-200" />
        </div>
      )}
    </div>
  );
}

function extractMermaid(text: string): string | undefined {
  const m = text.match(/```mermaid\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : undefined;
}

function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
