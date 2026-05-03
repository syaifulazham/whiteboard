import { NextRequest, NextResponse } from "next/server";
import { genai, VISION_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM = `You convert a hand-drawn chart, graph, or diagram image into clean Mermaid syntax.

CRITICAL: Reproduce EXACTLY what is drawn in the image.
- Read every text label visible and use those exact words (preserve the original language).
- Reproduce the exact nodes, edges, and hierarchy shown — do NOT invent new nodes or replace content with generic placeholders like "Start", "Process", "Input", "Analyze".
- If you cannot read a label clearly, use your best guess at the handwritten text rather than substituting a generic word.

Diagram type selection:
- Tree / hierarchy (parent with children, mind-map style) → flowchart TD
- Flowchart / process with decision diamonds → flowchart TD (use {diamond} for decisions)
- Left-to-right flow → flowchart LR
- Line/scatter/bar plots with numeric axes → xychart-beta
- Sequence / timeline content → sequenceDiagram

Output ONLY the raw Mermaid code. No markdown fences, no explanation.

xychart-beta reference:
  xychart-beta
      title "optional title"
      x-axis "label" [v1, v2, v3]
      y-axis "label" min --> max
      line [y1, y2, y3]
      bar  [y1, y2, y3]

flowchart reference:
  flowchart TD
      A[label] --> B[label]
      A --> C[label]
      B --> D{decision?}
      D -->|Yes| E[label]
      D -->|No| F[label]`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mime, instruction } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

    const prompt = instruction?.trim()
      ? `Recreate this as a clean diagram using the exact text and structure visible. ${instruction}`
      : "Recreate this hand-drawn diagram as clean Mermaid code. Use the exact labels and structure shown — do not substitute generic words.";

    const res = await genai.models.generateContent({
      model: VISION_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64, mimeType: mime ?? "image/png" } },
        ],
      }],
      config: { systemInstruction: SYSTEM },
    });

    let mermaid = (res.text ?? "").trim();
    mermaid = mermaid.replace(/^```[a-z]*\n?/im, "").replace(/\n?```$/im, "").trim();

    return NextResponse.json({ mermaid });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
