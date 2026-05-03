const BASE = "https://eptim-core.bytesforge.net";

export const MATH_FORMATTING_RULES = `Math / equation formatting (STRICT):
- ALWAYS format mathematical expressions with LaTeX delimited by \`$\` for inline (e.g. $x^2 + 3x - 4 = 0$) or \`$$\` on its own line for display math.
- NEVER wrap math in backticks (\`like this\`). Backticks are only for code identifiers.
- Use proper LaTeX commands: \\frac{a}{b}, \\sqrt{x}, \\pm, \\cdot, \\leq, \\geq, \\neq, \\to, \\infty, \\sum, \\int, _{subscripts}, ^{superscripts}.
- Chemistry: wrap formulas in \`$\\ce{...}$\` style using mhchem when possible.
- Do NOT use plain-ASCII operators like sqrt(), ^, or * for math that could be rendered.`;

export const BOARD_SYSTEM_PROMPT = `You are an assistant embedded inside a smart whiteboard.
Be concise. Prefer short paragraphs and bullet points.
When the user says "draw", "diagram", "flowchart", or "show", respond with a Mermaid code block.
If asked about real-time data (stocks, weather, live news), say you do not have it.
Never invent prior-session context that was not given to you.

${MATH_FORMATTING_RULES}`;

export type AssistantMessage = {
  role: "user" | "model";
  text: string;
};

type EptimMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function askEptim(opts: {
  system?: string;
  messages: AssistantMessage[];
  models?: string[];
}): Promise<string> {
  const apiKey = process.env.EPTIM_API_KEY;
  if (!apiKey) throw new Error("EPTIM_API_KEY is not set");

  // Convert Gemini-style messages to eptim format (role: "model" → "assistant")
  const messages: EptimMessage[] = opts.messages.map((m) => ({
    role: m.role === "model" ? "assistant" : "user",
    content: m.text,
  }));

  // Prepend system instruction to the first user message
  const system = opts.system ?? BOARD_SYSTEM_PROMPT;
  if (messages.length > 0) {
    const first = messages[0];
    if (typeof first.content === "string") {
      first.content = `${system}\n\n${first.content}`;
    }
  }

  const body: Record<string, unknown> = { messages };
  if (opts.models?.length) body.options = { models: opts.models };

  const res = await fetch(`${BASE}/v1/consensus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error(`[eptim] ${res.status} ${res.statusText}:`, raw.slice(0, 500));
    let msg = `eptim error ${res.status}`;
    try { msg = (JSON.parse(raw) as any).error ?? msg; } catch {}
    throw new Error(msg);
  }

  const data = await res.json() as any;
  console.log("[eptim] epistemic_state:", data.epistemic_state, "consensus:", data.consensus_score);
  return data.content ?? "";
}
