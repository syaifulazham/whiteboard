"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, Editor, TLShapeId, TLComponents, DefaultStylePanelContent, DefaultToolbarContent, useRelevantStyles } from "tldraw";
import { Palette } from "lucide-react";
import ActionCardManager from "./ActionCardManager";
import BoardHeader from "./BoardHeader";

export type ChatMsg = {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  content: string;
  createdAt: string;
};

type WorkspaceProps = {
  sessionId?: string;
  inviteCode?: string;
  initialSnapshot?: object | null;
  isOwner?: boolean;
  boardTitle?: string;
  userId?: string;
};

export default function Workspace({ sessionId, inviteCode, initialSnapshot, isOwner, boardTitle, userId }: WorkspaceProps) {
  const editorRef = useRef<Editor | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diffThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDiffRef = useRef<{ put: Record<string, any>; remove: Record<string, true> } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const onMount = useCallback((ed: Editor) => {
    editorRef.current = ed;
    setEditor(ed);
    if (initialSnapshot) {
      try { ed.loadSnapshot(initialSnapshot as any); } catch {}
    }
  }, [initialSnapshot]);

  // Debounced DB persist: owner only, 5s after last change
  const save = useCallback(async () => {
    if (!inviteCode || !isOwner || !editorRef.current) return;
    setSaveStatus("saving");
    try {
      const snapshot = editorRef.current.getSnapshot();
      const res = await fetch(`/api/sessions/${inviteCode}/canvas`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [inviteCode, isOwner]);

  // Owner: broadcast diffs at 50ms, persist full snapshot every 5s
  useEffect(() => {
    if (!editor || !isOwner || !inviteCode) return;

    const flushDiff = () => {
      const diff = pendingDiffRef.current;
      if (!diff) return;
      pendingDiffRef.current = null;
      const put = Object.values(diff.put);
      const remove = Object.keys(diff.remove);
      if (put.length === 0 && remove.length === 0) return;
      fetch(`/api/sessions/${inviteCode}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ put, remove }),
      }).catch(() => {});
    };

    const unsub = editor.store.listen((change) => {
      const pending = pendingDiffRef.current ?? { put: {}, remove: {} };
      for (const [id, rec] of Object.entries(change.changes.added)) {
        pending.put[id] = rec;
        delete pending.remove[id];
      }
      for (const [id, [, after]] of Object.entries(change.changes.updated)) {
        pending.put[id] = after;
        delete pending.remove[id];
      }
      for (const [id, rec] of Object.entries(change.changes.removed)) {
        if (pending.put[id]) { delete pending.put[id]; }
        else { pending.remove[id] = true; void rec; }
      }
      pendingDiffRef.current = pending;

      if (!diffThrottleRef.current) {
        diffThrottleRef.current = setTimeout(() => {
          diffThrottleRef.current = null;
          flushDiff();
        }, 50);
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(save, 5000);
    }, { scope: "document", source: "user" });

    const onHide = () => {
      if (document.visibilityState === "hidden") { flushDiff(); save(); }
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (diffThrottleRef.current) clearTimeout(diffThrottleRef.current);
    };
  }, [editor, isOwner, inviteCode, save]);

  // All users: single SSE for canvas sync (participants) + chat (everyone)
  useEffect(() => {
    if (!inviteCode || !editor) return;

    const es = new EventSource(`/api/sessions/${inviteCode}/stream`);

    es.onmessage = (e) => {
      if (!e.data || e.data === "ping") return;
      try {
        const msg = JSON.parse(e.data);
        // Canvas sync — participants only (owner is the source of truth)
        if (!isOwner) {
          if (msg.type === "diff") {
            editor.store.mergeRemoteChanges(() => {
              if (msg.put?.length) editor.store.put(msg.put);
              if (msg.remove?.length) editor.store.remove(msg.remove);
            });
          } else if (msg.type === "canvas" && msg.snapshot) {
            editor.store.mergeRemoteChanges(() => {
              editor.loadSnapshot({ document: msg.snapshot.document });
            });
          }
        }
        // Chat — everyone
        if (msg.type === "chat" && msg.message) {
          setChatMessages((prev) => {
            // Deduplicate: the sender already appended the message optimistically
            if (prev.some((m) => m.id === msg.message.id)) return prev;
            return [...prev, msg.message];
          });
        }
      } catch {}
    };

    return () => es.close();
  }, [inviteCode, editor, isOwner]);

  const sendMessage = useCallback(async (content: string) => {
    if (!inviteCode || !content.trim()) return;
    const res = await fetch(`/api/sessions/${inviteCode}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const msg: ChatMsg = await res.json();
      // Optimistically add; SSE will deduplicate
      setChatMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    }
  }, [inviteCode]);

  const getSelectionImage = useCallback(async (ids?: TLShapeId[]): Promise<{ base64: string; mime: string } | null> => {
    const ed = editorRef.current;
    if (!ed) return null;
    const useIds: TLShapeId[] = ids && ids.length ? ids : ed.getSelectedShapeIds();
    if (!useIds || useIds.length === 0) return null;
    const { blob } = await ed.toImage(useIds, { format: "png", background: true, padding: 32, scale: 1 });
    const base64 = await blobToBase64(blob);
    return { base64, mime: blob.type || "image/png" };
  }, []);

  const getSelectionText = useCallback((ids?: TLShapeId[]): string => {
    const ed = editorRef.current;
    if (!ed) return "";
    const useIds = ids && ids.length ? ids : ed.getSelectedShapeIds();
    const shapes = useIds.map((id) => ed.getShape(id)).filter(Boolean);
    const parts: string[] = [];
    for (const s of shapes) {
      if (!s) continue;
      const props: any = (s as any).props ?? {};
      if (typeof props.text === "string" && props.text.trim()) parts.push(props.text.trim());
      if (props.richText) {
        try {
          const t = extractRichText(props.richText);
          if (t) parts.push(t);
        } catch {}
      }
    }
    return parts.join("\n");
  }, []);

  const insertTextNote = useCallback((text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const { x, y } = ed.getViewportPageBounds().center;
    ed.createShape({
      type: "text",
      x: x - 200,
      y: y - 40,
      props: { richText: toRichText(text), w: 400, autoSize: false } as any,
    });
  }, []);

  const tlComponents: TLComponents = {
    StylePanel: null,
    Toolbar: TopToolbar,
    InFrontOfTheCanvas: StylePanelWithToggle,
  };

  const insertImage = useCallback(async (dataUrl: string, w = 480, h = 360) => {
    const ed = editorRef.current;
    if (!ed) return;
    const mime = dataUrl.startsWith("data:image/svg")
      ? "image/svg+xml"
      : dataUrl.startsWith("data:image/jpeg")
      ? "image/jpeg"
      : "image/png";
    const assetId = `asset:${crypto.randomUUID()}` as any;
    ed.createAssets([{
      id: assetId, type: "image", typeName: "asset", meta: {},
      props: { name: "ai.png", src: dataUrl, w, h, mimeType: mime, isAnimated: false },
    } as any]);
    const { x, y } = ed.getViewportPageBounds().center;
    ed.createShape({
      type: "image",
      x: x - w / 2,
      y: y - h / 2,
      props: { assetId, w, h } as any,
    });
  }, []);

  return (
    <div className="relative h-screen w-screen">
      <div style={{ position: "absolute", inset: 0 }}>
        <Tldraw onMount={onMount} components={tlComponents} />
      </div>

      {saveStatus !== "idle" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full border border-yellow-200 bg-white px-3 py-1 text-xs text-neutral-500 shadow-sm pointer-events-none">
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
        </div>
      )}

      {inviteCode && userId && (
        <BoardHeader
          title={boardTitle ?? "Untitled Board"}
          inviteCode={inviteCode}
          isOwner={isOwner ?? false}
          ownerName=""
          sessionId={sessionId ?? ""}
          userId={userId}
          chatMessages={chatMessages}
          onSendMessage={sendMessage}
        />
      )}

      <ActionCardManager
        editor={editor}
        getSelectionImage={getSelectionImage}
        getSelectionText={getSelectionText}
        insertTextNote={insertTextNote}
        insertImage={insertImage}
      />
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function toRichText(text: string): any {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

function extractRichText(node: any): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) return node.content.map(extractRichText).join(node.type === "paragraph" ? "\n" : "");
  return "";
}

// Toolbar rendered at top-center via the Toolbar slot.
// Module-level for stable reference.
function TopToolbar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        background: "white",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
        padding: "0 4px",
        height: 44,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <DefaultToolbarContent />
    </div>
  );
}

// Rendered via InFrontOfTheCanvas so tldraw hooks (useRelevantStyles) work.
// Defined at module level so tldraw holds a stable reference and never remounts.
function StylePanelWithToggle() {
  const [show, setShow] = useState(true);
  const styles = useRelevantStyles();

  return (
    <div
      style={{ position: "absolute", bottom: 60, left: 60, pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {show && styles && (
        <div style={{
          marginBottom: 6,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}>
          <DefaultStylePanelContent styles={styles} />
        </div>
      )}
      <button
        onClick={() => setShow((v) => !v)}
        title={show ? "Hide colour palette" : "Show colour palette"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "white",
          border: "1px solid #fde68a",
          borderRadius: 8,
          padding: "3px 8px",
          fontSize: 11,
          color: "#78716c",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,.08)",
        }}
      >
        <Palette size={12} />
        {show ? "Hide" : "Colours"}
      </button>
    </div>
  );
}
