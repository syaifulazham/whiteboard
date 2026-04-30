import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // Defer error until first actual call so the app can still build.
  console.warn("[gemini] GEMINI_API_KEY is not set. AI endpoints will fail until it is configured.");
}

export const genai = new GoogleGenAI({ apiKey: apiKey ?? "" });

export const TEXT_MODEL = "gemini-2.5-flash";
export const VISION_MODEL = "gemini-2.5-flash";
export const AUDIO_MODEL = "gemini-2.5-flash";

export const MATH_FORMATTING_RULES = `Math / equation formatting (STRICT):
- ALWAYS format mathematical expressions with LaTeX delimited by \`$\` for inline (e.g. $x^2 + 3x - 4 = 0$) or \`$$\` on its own line for display math.
- NEVER wrap math in backticks (\`like this\`). Backticks are only for code identifiers.
- Use proper LaTeX commands: \\frac{a}{b}, \\sqrt{x}, \\pm, \\cdot, \\leq, \\geq, \\neq, \\to, \\infty, \\sum, \\int, _{subscripts}, ^{superscripts}.
- Chemistry: wrap formulas in \`$\\ce{...}$\` style using mhchem when possible (e.g. $\\ce{CH4 + 2O2 -> CO2 + 2H2O}$).
- Do NOT use plain-ASCII operators like sqrt(), ^, or * for math that could be rendered; convert them to LaTeX instead.`;

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

export async function askGemini(opts: {
  system?: string;
  messages: AssistantMessage[];
  imageBase64?: string;
  imageMime?: string;
}) {
  const contents: any[] = opts.messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
  if (opts.imageBase64 && contents.length > 0) {
    const last = contents[contents.length - 1];
    last.parts.push({
      inlineData: { data: opts.imageBase64, mimeType: opts.imageMime ?? "image/png" },
    });
  }
  const res = await genai.models.generateContent({
    model: TEXT_MODEL,
    contents,
    config: {
      systemInstruction: opts.system ?? BOARD_SYSTEM_PROMPT,
    },
  });
  return res.text ?? "";
}
