import { NextRequest, NextResponse } from "next/server";
import { askEptim } from "@/lib/eptim";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { content, level } = await req.json();
    const prompt = `Explain the following at a ${level ?? "general adult"} reading level. Be clear and concise.\n\n${content}`;
    const text = await askEptim({ messages: [{ role: "user", text: prompt }] });
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
