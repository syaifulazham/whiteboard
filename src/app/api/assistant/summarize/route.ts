import { NextRequest, NextResponse } from "next/server";
import { askEptim } from "@/lib/eptim";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    const prompt = `Summarize the following whiteboard content into concise bullet points (max 8 bullets):\n\n${content ?? "(see attached image)"}`;
    const text = await askEptim({
      messages: [{ role: "user", text: prompt }],
    });
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
