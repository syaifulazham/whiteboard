import { NextRequest, NextResponse } from "next/server";
import { genai, VISION_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM = `You are a handwriting recognition engine. Given an image of a handwritten note or sketch,
return ONLY the text content transcribed from the image. Preserve line breaks. Do not add commentary.
If the image contains a diagram or equation, transcribe visible text literally.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mime } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

    const res = await genai.models.generateContent({
      model: VISION_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe the handwriting in this image." },
          { inlineData: { data: imageBase64, mimeType: mime ?? "image/png" } },
        ],
      }],
      config: { systemInstruction: SYSTEM },
    });

    return NextResponse.json({ text: (res.text ?? "").trim() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
