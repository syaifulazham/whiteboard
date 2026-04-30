import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { content, target } = await req.json();
    const prompt = `Translate the following text into ${target ?? "English"}. Return only the translation, no commentary.\n\n${content}`;
    const text = await askGemini({ messages: [{ role: "user", text: prompt }] });
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
