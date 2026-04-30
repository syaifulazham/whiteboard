import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { content, imageBase64 } = await req.json();
    const prompt = `Summarize the following whiteboard content into concise bullet points (max 8 bullets):\n\n${content ?? "(see attached image)"}`;
    const text = await askGemini({
      messages: [{ role: "user", text: prompt }],
      imageBase64,
      imageMime: "image/png",
    });
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
