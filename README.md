# Smart Whiteboard (Gemini)

A web-based prototype of the AI-integrated smart whiteboard described in
`ai_smart_whiteboard_build_guide.md`, focused on the software stack (hardware
assembly sections of the guide are not applicable here).

Stack:

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- **tldraw** as the canvas / ink engine
- **Google Gemini** (`@google/genai`, model `gemini-2.5-flash`) for all AI
  features: chat, summarize, diagram generation (Mermaid), translate, explain,
  handwriting recognition (vision), and voice transcription (audio)
- **Mermaid** for diagram rendering, inserted onto the canvas as SVG images
- **MediaRecorder** in-browser for push-to-talk voice capture

## Setup

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

The Gemini API key is read from `.env` (`GEMINI_API_KEY`). It is used only
server-side inside Next.js API routes — it never ships to the browser.

## Features

| Feature | UI | Backend route |
|---|---|---|
| Free-form chat with canvas context | Chat tab | `POST /api/assistant/ask` |
| Summarize selection / board | Summarize tab | `POST /api/assistant/summarize` |
| Generate Mermaid diagram | Diagram tab | `POST /api/assistant/diagram` |
| Translate selection or typed text | Translate tab | `POST /api/assistant/translate` |
| Explain at a reading level | Explain tab | `POST /api/assistant/explain` |
| Handwriting → text (vision) | HWR tab | `POST /api/assistant/hwr` |
| Voice → text (push-to-talk) | Mic button | `POST /api/assistant/transcribe` |

Chat and summarize send a PNG render of the current selection as vision input
so the model can see shapes and handwriting, not only text. Diagrams render as
SVG with a one-click "Insert onto canvas" button. All AI calls are proxied
through Next.js server routes — consistent with §11.1 of the build guide.

## Project layout

```
src/
  app/
    api/assistant/{ask,summarize,diagram,translate,explain,hwr,transcribe}/route.ts
    layout.tsx
    page.tsx
    globals.css
  components/
    Workspace.tsx      # tldraw + layout
    AssistantPanel.tsx # AI sidebar
    MermaidView.tsx    # client-side mermaid renderer
  lib/
    gemini.ts          # Gemini client + shared prompts
```

## Mapped to the build guide

- §7 Whiteboard application — implemented via tldraw + Tauri-less web shell
  (run in Electron/Tauri later for kiosk mode).
- §8 Speech recognition — browser MediaRecorder → Gemini audio transcription.
- §9 Handwriting recognition — Gemini vision against a PNG of the selection.
- §10 Vision — same pipeline; a camera input can be piped into the HWR route.
- §11 LLM integration — all endpoints described in §11.2 are implemented.
- §11.5 Diagram generation — Mermaid emitted by Gemini and rendered to SVG.
- §12 Storage and sync — tldraw persists in-memory; extend with IndexedDB or a
  server event log to match the spec.

## Notes / next steps

- Persistence: wire tldraw's `persistenceKey` or a custom `TLStore` to
  IndexedDB, then a WebSocket sync layer for multi-board rooms.
- Streaming: the `ask` endpoint currently returns a full response. Upgrade to
  SSE for token streaming as in §11.4.
- Auth / kiosk / NFC / hardening — see §13 and §16 of the guide.
