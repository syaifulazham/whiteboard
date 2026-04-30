import { NextRequest, NextResponse } from "next/server";
import { genai, AUDIO_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio") as File | null;
    if (!file) return NextResponse.json({ error: "audio file required" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const mime = file.type || "audio/webm";

    const res = await genai.models.generateContent({
      model: AUDIO_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe the speech in this audio clip. Return only the transcribed text." },
            { inlineData: { data: base64, mimeType: mime } },
          ],
        },
      ],
    });
    return NextResponse.json({ text: (res.text ?? "").trim() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
