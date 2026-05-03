import { NextRequest, NextResponse } from "next/server";
import { askEptim, AssistantMessage } from "@/lib/eptim";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: AssistantMessage[] = body.messages ?? [];
    const canvasContext: string | undefined = body.canvasContext;

    const contextPrefix = canvasContext
      ? `Current board context (recognized text / shape summary):\n${canvasContext}\n\n`
      : "";
    if (contextPrefix && messages.length > 0) {
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, text: contextPrefix + last.text };
    }

    const text = await askEptim({ messages });
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 });
  }
}
