"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import { toPng } from "html-to-image";

export function renderKatex(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: "ignore",
    });
  } catch (e: any) {
    return `<span style="color:#f87171">KaTeX error: ${e?.message ?? e}</span>`;
  }
}

type Segment = { kind: "text" | "math"; body: string; display?: boolean };

const LATEX_HINT = /\\(frac|sqrt|sum|int|prod|lim|pm|mp|cdot|times|leq|geq|neq|to|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|ce)\b|[_^]\{|\\\\/;

function splitMath(input: string): Segment[] {
  const out: Segment[] = [];
  // Order matters: $$...$$, \[...\], \(...\), $...$, then `...` (code) as a
  // fallback only when it looks like LaTeX (contains \commands or ^/_ with braces).
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$((?:[^$\\\n]|\\.)+?)\$|`([^`\n]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const display = m[0].startsWith("$$") || m[0].startsWith("\\[");
    const bodyMath = m[1] ?? m[2] ?? m[3] ?? m[4];
    const bodyBacktick = m[5];

    if (bodyMath !== undefined) {
      if (m.index > last) out.push({ kind: "text", body: input.slice(last, m.index) });
      out.push({ kind: "math", body: bodyMath, display });
      last = m.index + m[0].length;
    } else if (bodyBacktick !== undefined && LATEX_HINT.test(bodyBacktick)) {
      // Backtick-wrapped content that looks like LaTeX: render as inline math.
      if (m.index > last) out.push({ kind: "text", body: input.slice(last, m.index) });
      out.push({ kind: "math", body: bodyBacktick, display: false });
      last = m.index + m[0].length;
    }
    // otherwise leave the match inside the plain-text run
  }
  if (last < input.length) out.push({ kind: "text", body: input.slice(last) });
  return out;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const segs = splitMath(text);
  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {segs.map((s, i) =>
        s.kind === "math" ? (
          <span
            key={i}
            style={s.display ? { display: "block", margin: "0.4em 0" } : { display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: renderKatex(s.body, !!s.display) }}
          />
        ) : (
          <span key={i}>{s.body}</span>
        ),
      )}
    </span>
  );
}

export default function MathView({
  latex,
  plain,
  label,
  onInsertImage,
  onInsertText,
}: {
  latex?: string;
  plain?: string;
  label: string;
  onInsertImage?: (dataUrl: string, w: number, h: number) => void | Promise<void>;
  onInsertText?: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const html = useMemo(() => (latex ? renderKatex(latex) : ""), [latex]);

  async function insertImage() {
    if (!ref.current || !onInsertImage) return;
    setBusy(true);
    try {
      // Give KaTeX fonts a tick to settle.
      await new Promise((r) => setTimeout(r, 50));
      const node = ref.current;
      const rect = node.getBoundingClientRect();
      const scale = 2;
      const dataUrl = await toPng(node, {
        pixelRatio: scale,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      await onInsertImage(dataUrl, Math.max(120, rect.width), Math.max(40, rect.height));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-yellow-200 bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
        <div className="flex gap-2">
          {latex && onInsertText && (
            <button
              onClick={() => onInsertText(latex)}
              className="text-[11px] text-neutral-400 hover:text-amber-600"
              title="Insert the LaTeX source as a text note"
            >
              Insert LaTeX
            </button>
          )}
          {latex && onInsertImage && (
            <button
              disabled={busy}
              onClick={insertImage}
              className="text-[11px] text-neutral-400 hover:text-amber-600 disabled:opacity-50"
              title="Render with KaTeX and drop as an image onto the board"
            >
              {busy ? "Rendering…" : "Insert rendered"}
            </button>
          )}
          {plain && onInsertText && (
            <button
              onClick={() => onInsertText(plain)}
              className="text-[11px] text-neutral-400 hover:text-amber-600"
            >
              Insert text
            </button>
          )}
        </div>
      </div>
      {latex ? (
        <div
          ref={ref}
          className="bg-yellow-50 text-black rounded p-3 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="whitespace-pre-wrap text-sm text-neutral-700">{plain}</pre>
      )}
      {latex && (
        <pre className="mt-2 text-xs leading-5 text-neutral-400 whitespace-pre-wrap break-words font-mono">{latex}</pre>
      )}
    </div>
  );
}
