import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM = `You generate Mermaid diagrams.
Respond with ONLY a fenced mermaid code block, nothing else. No prose.
Pick the best Mermaid diagram type for the request (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, mindmap, gantt).`;

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();
    const text = await askGemini({
      system: SYSTEM,
      messages: [{ role: "user", text: `Create a Mermaid diagram for: ${description}` }],
    });
    const match = text.match(/```mermaid\s*([\s\S]*?)```/i);
    const mermaid = (match ? match[1] : text).trim();
    return NextResponse.json({ mermaid });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
