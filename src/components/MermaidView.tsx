"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

// Fix common LLM-generated mermaid issues before rendering
function sanitize(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      // Quote unquoted titles that contain special chars (colon, slash, parens, etc.)
      const titleMatch = line.match(/^(\s*title\s+)([^"'\n].*)$/);
      if (titleMatch) {
        const prefix = titleMatch[1];
        const content = titleMatch[2].trim();
        if (/[:/\\()\[\]]/.test(content)) {
          return `${prefix}"${content.replace(/"/g, "'")}"`;
        }
      }
      // xychart-beta: y-axis with array format is invalid — convert to range
      // e.g. "y-axis [-2, -1, 0, 1, 2, 3]" → "y-axis -2 --> 3"
      const yAxisArrMatch = line.match(/^(\s*y-axis\s*)\[([^\]]+)\](.*)$/);
      if (yAxisArrMatch) {
        const nums = yAxisArrMatch[2]
          .split(",")
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !isNaN(n));
        if (nums.length >= 2) {
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          return `${yAxisArrMatch[1]}${min} --> ${max}`;
        }
      }
      return line;
    })
    .join("\n");
}

export default function MermaidView({ code, onInsert }: { code: string; onInsert?: (svg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mod = await import("mermaid");
        const mermaid = mod.default;
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
          mermaidInitialized = true;
        }
        const id = "m" + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.render(id, sanitize(code));
        if (!alive) return;
        setSvg(svg);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "render error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <div>
      {error ? (
        <pre className="text-xs text-red-400 whitespace-pre-wrap">{error}\n\n{code}</pre>
      ) : (
        <div ref={ref} className="bg-white rounded p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      {!error && svg && onInsert && (
        <button
          onClick={() => onInsert(svg)}
          className="mt-2 text-[11px] text-neutral-500 hover:text-indigo-400"
        >
          Insert onto canvas
        </button>
      )}
    </div>
  );
}
