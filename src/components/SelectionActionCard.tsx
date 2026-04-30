"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, TLShapeId } from "tldraw";
import {
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  GripVertical,
  Send,
} from "lucide-react";
import { toPng } from "html-to-image";
import MathView, { RichText } from "./MathView";
import MermaidView from "./MermaidView";

type SuggestionMode =
  | "explain"
  | "math"
  | "translate"
  | "summarize"
  | "diagram"
  | "hwr"
  | "refine"
  | "describe"
  | "chat";

type Suggestion = {
  label: string;
  mode: SuggestionMode;
  instruction?: string;
  target?: string;
};

type Classification = {
  type: string;
  description: string;
  suggestions: Suggestion[];
};

type Stage = "confirm" | "classifying" | "actions" | "running" | "result" | "error";

type ResultPayload =
  | { kind: "math"; data: { kind: "math" | "text"; recognized: string; result?: string; explanation?: string; instruction?: string } }
  | { kind: "text"; data: string; title?: string }
  | { kind: "mermaid"; data: string };

type Snapshot = { dataUrl: string; base64: string; mime: string; text: string };

const TYPE_COLORS: Record<string, string> = {
  text: "bg-sky-100 border-sky-300 text-sky-700",
  math: "bg-violet-100 border-violet-300 text-violet-700",
  chemistry: "bg-emerald-100 border-emerald-300 text-emerald-700",
  science_symbol: "bg-teal-100 border-teal-300 text-teal-700",
  shape: "bg-amber-100 border-amber-300 text-amber-700",
  graph: "bg-rose-100 border-rose-300 text-rose-700",
  image: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700",
  mixed: "bg-indigo-100 border-indigo-300 text-indigo-700",
  unknown: "bg-neutral-100 border-neutral-300 text-neutral-600",
};

export type SelectionActionCardProps = {
  editor: Editor | null;
  initialPagePos: { x: number; y: number };
  initialShapeIds: TLShapeId[];
  onClose: () => void;
  onDetached: () => void;
  insertTextNote: (text: string) => void;
  insertImage: (dataUrl: string, w?: number, h?: number) => Promise<void>;
  getSelectionImage: (ids?: TLShapeId[]) => Promise<{ base64: string; mime: string } | null>;
  getSelectionText: (ids?: TLShapeId[]) => string;
};

export default function SelectionActionCard(props: SelectionActionCardProps) {
  const { editor, initialPagePos, initialShapeIds } = props;
  const [stage, setStage] = useState<Stage>("confirm");
  const [classification, setClassification] = useState<Classification | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [askText, setAskText] = useState("");

  // Position in PAGE coords + on-screen projection (kept in sync with camera).
  const [pagePos, setPagePos] = useState<{ x: number; y: number }>(initialPagePos);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<number>(() => editor?.getZoomLevel() || 1);

  const [size, setSize] = useState({ w: 420, h: 480 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const dragStateRef = useRef<{ startX: number; startY: number; startPagePos: { x: number; y: number } } | null>(null);
  const richResultRef = useRef<HTMLDivElement>(null);
  const richExplanationRef = useRef<HTMLDivElement>(null);
  const [captureHeight, setCaptureHeight] = useState(112);
  const captureHeightRef = useRef(captureHeight);
  captureHeightRef.current = captureHeight;

  const pageToLocalScreen = useCallback(
    (p: { x: number; y: number }): { x: number; y: number } | null => {
      if (!editor) return null;
      const s = editor.pageToScreen(p);
      const rect = (editor.getContainer() as HTMLElement | null)?.getBoundingClientRect();
      return { x: s.x - (rect?.left ?? 0), y: s.y - (rect?.top ?? 0) };
    },
    [editor],
  );

  // Track camera changes -> re-project pagePos to screenPos and update zoom.
  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      const z = editor.getZoomLevel() || 1;
      setZoom(z);
      const sp = pageToLocalScreen(pagePos);
      if (sp) setScreenPos(sp);
    };
    refresh();
    const unsub = editor.store.listen(refresh, { scope: "all", source: "all" });
    return () => unsub();
  }, [editor, pagePos, pageToLocalScreen]);

  function onCaptureResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = captureHeightRef.current;
    const onMove = (ev: MouseEvent) => setCaptureHeight(Math.max(48, startH + ev.clientY - startY));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function insertTextResult(data: string, nodeRef: React.RefObject<HTMLDivElement> = richResultRef) {
    const hasLatex = /\$/.test(data) || /\\\[/.test(data) || /\\\(/.test(data);
    if (hasLatex && nodeRef.current) {
      try {
        await new Promise((r) => setTimeout(r, 50));
        const node = nodeRef.current;
        const rect = node.getBoundingClientRect();
        const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
        await props.insertImage(dataUrl, Math.max(200, rect.width), Math.max(40, rect.height));
        return;
      } catch {}
    }
    props.insertTextNote(data);
  }

  function onResizeStart(e: React.MouseEvent, dir: "e" | "s" | "se") {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.w;
    const startH = sizeRef.current.h;
    const onMove = (ev: MouseEvent) => {
      const dw = dir !== "s" ? ev.clientX - startX : 0;
      const dh = dir !== "e" ? ev.clientY - startY : 0;
      setSize({ w: Math.max(280, startW + dw), h: Math.max(200, startH + dh) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onDragStart(e: React.MouseEvent) {
    if (!editor) return;
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, startPagePos: pagePos };
    const onMove = (ev: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const z = editor.getZoomLevel() || 1;
      const dx = (ev.clientX - ds.startX) / z;
      const dy = (ev.clientY - ds.startY) / z;
      const next = { x: ds.startPagePos.x + dx, y: ds.startPagePos.y + dy };
      setPagePos(next);
      const sp = pageToLocalScreen(next);
      if (sp) setScreenPos(sp);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function proceed() {
    if (!editor) return;
    setStage("classifying");
    setError(null);
    try {
      let snap = snapshot;
      if (!snap) {
        const img = await props.getSelectionImage(initialShapeIds);
        if (!img) throw new Error("Could not capture selection");
        const text = props.getSelectionText(initialShapeIds);
        snap = {
          base64: img.base64,
          mime: img.mime,
          text,
          dataUrl: `data:${img.mime};base64,${img.base64}`,
        };
        setSnapshot(snap);
        // Tell manager we're detached so it stops removing us on selection change.
        props.onDetached();
      }
      const res = await fetch("/api/assistant/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: snap.base64, mime: snap.mime, hintText: snap.text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClassification({
        type: data.type ?? "unknown",
        description: data.description ?? "",
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      });
      setStage("actions");
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStage("error");
    }
  }

  async function runAsk() {
    const prompt = askText.trim();
    if (!prompt || !snapshot) return;
    setAskText("");
    setStage("running");
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", text: prompt }],
          canvasContext: snapshot.text || undefined,
          imageBase64: snapshot.base64,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setResult({ kind: "text", title: prompt, data: d.text ?? "" });
      setStage("result");
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStage("error");
    }
  }

  async function executeSuggestion(s: Suggestion) {
    setStage("running");
    setError(null);
    setResult(null);
    try {
      const img = snapshot
        ? { base64: snapshot.base64, mime: snapshot.mime }
        : await props.getSelectionImage(initialShapeIds);
      if (!img) throw new Error("No captured selection");
      const text = snapshot ? snapshot.text : props.getSelectionText(initialShapeIds);

      switch (s.mode) {
        case "math": {
          const r = await fetch("/api/assistant/math", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ imageBase64: img.base64, mime: img.mime, instruction: s.instruction ?? "" }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({
            kind: "math",
            data: {
              kind: d.kind,
              recognized: d.recognized ?? "",
              result: d.result || undefined,
              explanation: d.explanation || undefined,
              instruction: s.instruction || undefined,
            },
          });
          break;
        }
        case "explain": {
          const r = await fetch("/api/assistant/explain", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: text, level: s.instruction || "general adult", imageBase64: img.base64 }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({ kind: "text", title: `Explanation${s.instruction ? ` (${s.instruction})` : ""}`, data: d.text ?? "" });
          break;
        }
        case "summarize": {
          const r = await fetch("/api/assistant/summarize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: text, imageBase64: img.base64 }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({ kind: "text", title: "Summary", data: d.text ?? "" });
          break;
        }
        case "translate": {
          const r = await fetch("/api/assistant/translate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: text, target: s.target ?? "English", imageBase64: img.base64 }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({ kind: "text", title: `Translation → ${s.target ?? "English"}`, data: d.text ?? "" });
          break;
        }
        case "diagram": {
          const desc = s.instruction || text || classification?.description || "";
          const r = await fetch("/api/assistant/diagram", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ description: desc }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({ kind: "mermaid", data: d.mermaid ?? "" });
          break;
        }
        case "hwr": {
          const r = await fetch("/api/assistant/hwr", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ imageBase64: img.base64, mime: img.mime }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({ kind: "text", title: "Recognized text", data: d.text ?? "" });
          break;
        }
        case "describe":
        case "refine":
        case "chat":
        default: {
          const userPrompt =
            s.mode === "refine"
              ? s.instruction || "Refine the selected content: fix spelling/grammar, tighten wording, preserve meaning. Return ONLY the refined version."
              : s.mode === "describe"
              ? s.instruction || "Describe the selected content concisely."
              : s.instruction || s.label;
          const r = await fetch("/api/assistant/ask", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", text: userPrompt }],
              canvasContext: text || undefined,
              imageBase64: img.base64,
            }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          setResult({ kind: "text", title: s.label, data: d.text ?? "" });
          break;
        }
      }
      setStage("result");
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStage("error");
    }
  }

  if (!screenPos) return null;

  const typeColor = classification ? TYPE_COLORS[classification.type] ?? TYPE_COLORS.unknown : TYPE_COLORS.unknown;

  return (
    <div
      className="absolute z-40 flex flex-col rounded-lg border border-yellow-300 bg-yellow-50 text-neutral-800 shadow-2xl"
      style={{
        left: screenPos.x,
        top: screenPos.y,
        width: size.w,
        height: size.h,
        maxWidth: "90vw",
        minWidth: 280,
        minHeight: 200,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header / drag handle */}
      <div
        className="flex shrink-0 cursor-move select-none items-center gap-2 rounded-t-lg border-b border-yellow-200 bg-yellow-100 px-2 py-1.5"
        onMouseDown={onDragStart}
      >
        <GripVertical size={14} className="text-yellow-400" />
        <Sparkles size={13} className="text-amber-500" />
        <span className="text-[12px] font-medium text-neutral-700">
          {stage === "confirm" && `Selection · ${initialShapeIds.length} item${initialShapeIds.length > 1 ? "s" : ""}`}
          {stage === "classifying" && "Identifying…"}
          {stage === "actions" && "What would you like to do?"}
          {stage === "running" && "Working…"}
          {stage === "result" && "Result"}
          {stage === "error" && "Error"}
        </span>
        <button
          onClick={props.onClose}
          className="ml-auto rounded p-1 text-neutral-400 hover:bg-yellow-200 hover:text-neutral-700"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {snapshot && (
        <div className="shrink-0 border-b border-yellow-200 px-3 pt-2">
          <div className="rounded-md border border-yellow-200 bg-yellow-100/60 p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Captured selection</div>
            <img
              src={snapshot.dataUrl}
              alt="selection"
              style={{ height: captureHeight }}
              className="w-full rounded bg-white object-contain"
              draggable={false}
            />
            {snapshot.text && (
              <div className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{snapshot.text}</div>
            )}
          </div>
          <div
            className="flex items-center justify-center h-2 cursor-ns-resize"
            onMouseDown={onCaptureResizeStart}
          >
            <div className="w-8 h-0.5 rounded-full bg-yellow-300" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {stage === "confirm" && (
          <>
            <div className="text-[12px] text-neutral-500">
              Identify what you selected and suggest things to do with it.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={props.onClose}
                className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-yellow-100"
              >
                Cancel
              </button>
              <button
                onClick={proceed}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Proceed
              </button>
            </div>
          </>
        )}

        {stage === "classifying" && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={14} className="animate-spin" /> Identifying…
          </div>
        )}

        {stage === "actions" && classification && (
          <>
            <div className="flex items-center gap-2">
              <span className={"rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider " + typeColor}>
                {classification.type}
              </span>
              <button
                onClick={proceed}
                className="ml-auto rounded p-1 text-neutral-400 hover:bg-yellow-200 hover:text-neutral-700"
                title="Re-classify"
              >
                <RefreshCw size={12} />
              </button>
            </div>
            {classification.description && (
              <div className="text-[13px] leading-5 text-neutral-600">{classification.description}</div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {classification.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => executeSuggestion(s)}
                  className="rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-200"
                  title={s.instruction ?? s.label}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        {stage === "running" && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 size={14} className="animate-spin" /> Working…
          </div>
        )}

        {stage === "result" && result && (
          <>
            <div className="flex items-center">
              <button
                onClick={() => setStage("actions")}
                className="flex items-center gap-1 text-[12px] text-neutral-400 hover:text-neutral-700"
              >
                <ArrowLeft size={12} /> Back to actions
              </button>
            </div>

            {result.kind === "math" && (
              <div className="space-y-2">
                <MathView
                  label={result.data.kind === "math" ? "Recognized (LaTeX)" : "Recognized (text)"}
                  latex={result.data.kind === "math" ? result.data.recognized : undefined}
                  plain={result.data.kind !== "math" ? result.data.recognized : undefined}
                  onInsertImage={result.data.kind === "math" ? (u, w, h) => props.insertImage(u, w, h) : undefined}
                  onInsertText={props.insertTextNote}
                />
                {result.data.result && (
                  <MathView
                    label={result.data.instruction ? `Result: ${result.data.instruction}` : "Result"}
                    latex={result.data.kind === "math" ? result.data.result : undefined}
                    plain={result.data.kind !== "math" ? result.data.result : undefined}
                    onInsertImage={result.data.kind === "math" ? (u, w, h) => props.insertImage(u, w, h) : undefined}
                    onInsertText={props.insertTextNote}
                  />
                )}
                {result.data.explanation && (
                  <div className="space-y-1">
                    <div ref={richExplanationRef} className="rounded-md border border-yellow-200 bg-white p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Explanation</div>
                      <RichText text={result.data.explanation} className="text-[13px] leading-6 text-neutral-700" />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => insertTextResult(result.data.explanation!, richExplanationRef)}
                        className="rounded-md border border-yellow-300 bg-white px-2.5 py-1 text-[11px] text-neutral-600 hover:bg-yellow-100"
                      >
                        Insert onto canvas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.kind === "text" && (
              <div className="space-y-2">
                {result.title && (
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">{result.title}</div>
                )}
                <div ref={richResultRef} className="rounded-md border border-yellow-200 bg-white p-3">
                  <RichText text={result.data} className="text-[13px] leading-6 text-neutral-700" />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => insertTextResult(result.data)}
                    className="rounded-md border border-yellow-300 bg-white px-2.5 py-1 text-[11px] text-neutral-600 hover:bg-yellow-100"
                  >
                    Insert onto canvas
                  </button>
                </div>
              </div>
            )}

            {result.kind === "mermaid" && (
              <MermaidView
                code={result.data}
                onInsert={(svg: string) =>
                  props.insertImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg))
                }
              />
            )}
          </>
        )}

        {stage === "error" && (
          <>
            <div className="text-sm text-red-600">{error}</div>
            <div className="flex justify-end gap-2">
              <button
                onClick={props.onClose}
                className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-yellow-100"
              >
                Close
              </button>
              <button
                onClick={proceed}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Retry
              </button>
            </div>
          </>
        )}
      </div>

      {snapshot && stage !== "classifying" && stage !== "confirm" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAsk();
          }}
          className="shrink-0 flex items-center gap-2 border-t border-yellow-200 bg-yellow-100/60 px-2 py-2"
        >
          <input
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder="Ask anything about this selection…"
            className="flex-1 rounded border border-yellow-300 bg-white px-2 py-1.5 text-xs text-neutral-700 outline-none focus:border-amber-400"
            disabled={stage === "running"}
          />
          <button
            type="submit"
            disabled={!askText.trim() || stage === "running"}
            className="rounded-md bg-indigo-600 p-1.5 text-white hover:bg-indigo-500 disabled:opacity-50"
            title="Send"
          >
            {stage === "running" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      )}

      {/* Resize handles */}
      <div className="absolute right-0 top-8 bottom-0 w-1.5 cursor-ew-resize" onMouseDown={(e) => onResizeStart(e, "e")} />
      <div className="absolute bottom-0 left-0 right-3 h-1.5 cursor-ns-resize" onMouseDown={(e) => onResizeStart(e, "s")} />
      <div className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize" onMouseDown={(e) => onResizeStart(e, "se")} />
    </div>
  );
}
