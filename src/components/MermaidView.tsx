"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

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
        const { svg } = await mermaid.render(id, code);
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
