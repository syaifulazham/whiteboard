"use client";

import { ReactNode } from "react";
import MermaidView from "./MermaidView";
import { RichText } from "./MathView";

type Block =
  | { t: "mermaid"; code: string }
  | { t: "code"; lang: string; code: string }
  | { t: "prose"; lines: string[] };

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.split("\n");
  let i = 0;
  let proseAcc: string[] = [];

  const flushProse = () => {
    if (proseAcc.length) {
      blocks.push({ t: "prose", lines: [...proseAcc] });
      proseAcc = [];
    }
  };

  while (i < lines.length) {
    const fenceMatch = lines[i].match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      flushProse();
      const lang = fenceMatch[1].toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = codeLines.join("\n");
      if (lang === "mermaid") blocks.push({ t: "mermaid", code });
      else blocks.push({ t: "code", lang, code });
    } else {
      proseAcc.push(lines[i]);
      i++;
    }
  }
  flushProse();
  return blocks;
}

// Inline: handle **bold**, *italic*, then pass to RichText for LaTeX
function Inline({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<RichText key={last} text={text.slice(last, m.index)} />);
    if (m[1] !== undefined) parts.push(<strong key={m.index}><RichText text={m[1]} /></strong>);
    else if (m[2] !== undefined) parts.push(<em key={m.index}><RichText text={m[2]} /></em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<RichText key={last} text={text.slice(last)} />);
  return <>{parts}</>;
}

function renderProse(lines: string[]): ReactNode {
  const out: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hm = line.match(/^(#{1,3})\s+(.*)/);
    if (hm) {
      const lvl = hm[1].length;
      const cls =
        lvl === 1 ? "text-sm font-bold mt-3 mb-1" :
        lvl === 2 ? "text-xs font-semibold mt-2 mb-0.5 uppercase tracking-wide text-neutral-500" :
                    "text-xs font-semibold mt-1";
      out.push(<div key={i} className={cls}><Inline text={hm[2]} /></div>);
      i++; continue;
    }

    // Table: consecutive lines starting with |
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter(l => !/^\|[\s:|-]+\|$/.test(l))
        .map(l =>
          l.split("|")
            .slice(1, -1)
            .map(c => c.trim()),
        );
      if (rows.length > 0) {
        out.push(
          <div key={`t${i}`} className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>{rows[0].map((h, j) => (
                  <th key={j} className="border border-yellow-300 bg-yellow-100 px-2 py-1 text-left font-medium">
                    <Inline text={h} />
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="even:bg-yellow-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-yellow-200 px-2 py-1">
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    // Bullet list: consecutive lines starting with - or *
    if (/^(\s*)[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)[-*]\s/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*]\s+(.*)/);
        if (m) items.push(m[2]);
        i++;
      }
      out.push(
        <ul key={`ul${i}`} className="my-1 ml-4 list-disc space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-[13px] leading-5"><Inline text={item} /></li>
          ))}
        </ul>,
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={i} className="my-2 border-yellow-200" />);
      i++; continue;
    }

    // Blank line
    if (line.trim() === "") {
      out.push(<div key={i} className="h-1.5" />);
      i++; continue;
    }

    // Regular paragraph line
    out.push(
      <div key={i} className="text-[13px] leading-6">
        <Inline text={line} />
      </div>,
    );
    i++;
  }
  return <>{out}</>;
}

export default function MarkdownResultView({
  text,
  onInsertMermaid,
}: {
  text: string;
  onInsertMermaid?: (svg: string) => void;
}) {
  const blocks = parseBlocks(text);
  return (
    <div>
      {blocks.map((block, i) => {
        if (block.t === "mermaid")
          return (
            <div key={i} className="my-2">
              <MermaidView code={block.code} onInsert={onInsertMermaid} />
            </div>
          );
        if (block.t === "code")
          return (
            <pre key={i} className="my-2 rounded bg-neutral-100 p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {block.code}
            </pre>
          );
        return <div key={i}>{renderProse(block.lines)}</div>;
      })}
    </div>
  );
}
