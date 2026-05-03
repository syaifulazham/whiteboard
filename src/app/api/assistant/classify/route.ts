import { NextRequest, NextResponse } from "next/server";
import { genai, VISION_MODEL } from "@/lib/gemini";
import { Type } from "@google/genai";

export const runtime = "nodejs";

const SYSTEM = `You classify a selected region of a smart whiteboard to power contextual UI suggestions.

Given an image of the selection (and optional recognized text), output JSON:
- "type": one of
    "text"            - plain prose, notes, handwriting that is prose
    "math"            - equations, formulas, mathematical expressions
    "chemistry"       - chemical equations, molecular structures, reactions
    "science_symbol" - physics / scientific symbols, units, circuit labels
    "shape"           - sketches of basic shapes, flowchart boxes, diagrams without data
    "graph"           - charts, plots, function graphs, coordinate systems
    "image"           - photo / screenshot / embedded raster image
    "mixed"           - more than one of the above clearly present
    "unknown"
- "description": <= 80 chars of what is shown.
- "suggestions": 2-5 actions. Each has { "label" (<=24 chars, imperative), "mode", "instruction" (optional), "target" (optional, for translate) }.
    "mode" is one of: "explain", "math", "translate", "summarize", "diagram", "chart", "hwr", "chat", "refine".
    Choose suggestions appropriate to the detected type, e.g.:
      math     -> [Solve for x / Factor / Simplify / Differentiate / Integrate / Explain]
      chemistry-> [Balance equation / Predict products / Name compound / Explain]
      text     -> [Summarize / Translate to English / Explain / Refine wording]
      graph    -> [Plot clean chart / Identify function / Explain / Extract data points]  <- use mode "chart" for "Plot clean chart"
      shape    -> [Convert to diagram / Describe / Explain]  <- use mode "chart" for "Convert to diagram"
      image    -> [Describe / Extract text / Identify objects]
      science_symbol -> [Explain / Convert to LaTeX]
      unknown / mixed -> [Describe / Explain]
    Always include at least one action that leads to "explain".
    Use "refine" when the user likely wants cleaned-up handwriting or tidier wording.
    For "translate", include a "target" language guess (default "English").
Never output markdown. Only the JSON.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mime, hintText } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    const userText = hintText && hintText.trim()
      ? `Recognized text hint from the selection: ${hintText.trim().slice(0, 800)}`
      : "Classify the attached selection.";

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
            type: {
              type: Type.STRING,
              enum: ["text", "math", "chemistry", "science_symbol", "shape", "graph", "image", "mixed", "unknown"],
            },
            description: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  mode: {
                    type: Type.STRING,
                    enum: ["explain", "math", "translate", "summarize", "diagram", "chart", "hwr", "chat", "refine"],
                  },
                  instruction: { type: Type.STRING },
                  target: { type: Type.STRING },
                },
                required: ["label", "mode"],
              },
            },
          },
          required: ["type", "description", "suggestions"],
        },
      },
    });

    const raw = (res.text ?? "").trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { type: "unknown", description: "", suggestions: [] };
    }
    return NextResponse.json({
      type: parsed.type ?? "unknown",
      description: parsed.description ?? "",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
