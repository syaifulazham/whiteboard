import { NextRequest, NextResponse } from "next/server";
import { genai, VISION_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

export const runtime = "nodejs";

const SYSTEM = `You are a handwriting OCR and math assistant.
You are given a PNG of something handwritten on a whiteboard and an optional instruction.

Steps:
1. Read the image. Decide kind:
   - "math" if it contains math/science notation (equations, formulas, chemistry, physics symbols).
   - "text" otherwise.
2. Transcribe what is written into "recognized":
   - For "math": use valid LaTeX WITHOUT surrounding $ delimiters. Use standard commands (\\frac, \\sqrt, \\sum, \\int, ^, _, \\times, \\cdot, \\pm, \\alpha, etc).
   - For "text": plain UTF-8 text preserving line breaks.
3. If an instruction is provided (e.g. "solve for x", "factor", "differentiate w.r.t. x", "simplify", "integrate", "balance equation", "translate"), perform it:
   - Set "result" to the final answer. For math answers, this must be valid LaTeX without $ delimiters.
   - Fill "explanation" with a concise step-by-step reasoning in plain prose. EVERY mathematical expression, variable, coefficient, equation, or formula inside the explanation MUST be wrapped in LaTeX delimiters ($...$ for inline, $$...$$ for display). NEVER wrap math in backticks. Use proper LaTeX (\\frac, \\sqrt, \\pm, \\cdot, etc.).
4. If no instruction, leave "result" and "explanation" empty.

Rules:
- Never wrap LaTeX in dollar signs inside "recognized" or "result".
- Never include markdown fences.
- Be precise. If the image is illegible or empty, set recognized to "" and explain briefly.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mime, instruction } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    const userText = instruction?.trim()
      ? `Instruction: ${instruction.trim()}`
      : "No instruction. Just transcribe what is on the board.";

    const res = await genai.models.generateContent({
      model: VISION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: userText },
            { inlineData: { data: imageBase64, mimeType: mime ?? "image/png" } },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            kind: { type: Type.STRING, enum: ["math", "text"] },
            recognized: { type: Type.STRING },
            result: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["kind", "recognized"],
        },
      },
    });

    const raw = (res.text ?? "").trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { kind: "text", recognized: raw };
    }
    return NextResponse.json({
      kind: parsed.kind ?? "text",
      recognized: parsed.recognized ?? "",
      result: parsed.result ?? "",
      explanation: parsed.explanation ?? "",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
