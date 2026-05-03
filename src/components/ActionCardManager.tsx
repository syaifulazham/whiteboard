"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, TLShapeId } from "tldraw";
import { Sparkles } from "lucide-react";
import SelectionActionCard from "./SelectionActionCard";

type CardEntry = {
  id: string;
  initialPagePos: { x: number; y: number };
  initialShapeIds: TLShapeId[];
};

type TriggerState = {
  shapeIds: TLShapeId[];
  sig: string;
  pagePos: { x: number; y: number }; // top-right corner of selection in page coords
};

export type ActionCardManagerProps = {
  editor: Editor | null;
  insertTextNote: (text: string) => void;
  insertImage: (dataUrl: string, w?: number, h?: number) => Promise<void>;
  getSelectionImage: (ids?: TLShapeId[]) => Promise<{ base64: string; mime: string } | null>;
  getSelectionText: (ids?: TLShapeId[]) => string;
};

export default function ActionCardManager(props: ActionCardManagerProps) {
  const { editor } = props;
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const [cards, setCards] = useState<CardEntry[]>([]);
  const confirmIdRef = useRef<string | null>(null);
  const lastSigRef = useRef<string>("");
  const dismissedSigRef = useRef<string>("");

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (confirmIdRef.current === id) confirmIdRef.current = null;
  }, []);

  const onCardClose = useCallback(
    (id: string, sig: string) => {
      if (confirmIdRef.current === id) dismissedSigRef.current = sig;
      removeCard(id);
    },
    [removeCard],
  );

  const onCardDetached = useCallback((id: string) => {
    if (confirmIdRef.current === id) confirmIdRef.current = null;
  }, []);

  // Spawn the full card from the trigger
  const onTriggerClick = useCallback(() => {
    if (!editor || !trigger) return;
    const { shapeIds, sig } = trigger;
    setTrigger(null);

    const bounds = editor.getSelectionPageBounds();
    if (!bounds) return;
    const z = editor.getZoomLevel() || 1;
    const initialPagePos = { x: bounds.minX, y: bounds.maxY + 12 / z };
    const id = crypto.randomUUID();
    confirmIdRef.current = id;
    dismissedSigRef.current = sig; // prevent trigger from reappearing after close
    setCards((prev) => [...prev, { id, initialPagePos, initialShapeIds: [...shapeIds] }]);
  }, [editor, trigger]);

  useEffect(() => {
    if (!editor) return;

    const refresh = () => {
      const ids = editor.getSelectedShapeIds();
      const sig = ids.length ? [...ids].sort().join("|") : "";
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;

      // Selection changed — drop active card
      if (confirmIdRef.current) {
        const idToRemove = confirmIdRef.current;
        confirmIdRef.current = null;
        setCards((prev) => prev.filter((c) => c.id !== idToRemove));
      }

      setTrigger(null);

      if (ids.length === 0) return;
      if (sig === dismissedSigRef.current) return;

      const bounds = editor.getSelectionPageBounds();
      if (!bounds) return;
      // Position trigger at top-right corner of selection
      const z = editor.getZoomLevel() || 1;
      const pagePos = { x: bounds.maxX + 4 / z, y: bounds.minY - 4 / z };
      setTrigger({ shapeIds: [...ids], sig, pagePos });
    };

    refresh();
    const unsub = editor.store.listen(refresh, { scope: "all", source: "all" });
    return () => unsub();
  }, [editor]);

  return (
    <>
      {trigger && editor && (
        <TriggerButton
          editor={editor}
          pagePos={trigger.pagePos}
          onClick={onTriggerClick}
        />
      )}
      {cards.map((c) => {
        const sig = [...c.initialShapeIds].sort().join("|");
        return (
          <SelectionActionCard
            key={c.id}
            editor={editor}
            initialPagePos={c.initialPagePos}
            initialShapeIds={c.initialShapeIds}
            onClose={() => onCardClose(c.id, sig)}
            onDetached={() => onCardDetached(c.id)}
            getSelectionImage={props.getSelectionImage}
            getSelectionText={props.getSelectionText}
            insertTextNote={props.insertTextNote}
            insertImage={props.insertImage}
          />
        );
      })}
    </>
  );
}

function TriggerButton({
  editor,
  pagePos,
  onClick,
}: {
  editor: Editor;
  pagePos: { x: number; y: number };
  onClick: () => void;
}) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);

  const project = useCallback(() => {
    const s = editor.pageToScreen(pagePos);
    const rect = (editor.getContainer() as HTMLElement | null)?.getBoundingClientRect();
    setScreenPos({ x: s.x - (rect?.left ?? 0), y: s.y - (rect?.top ?? 0) });
  }, [editor, pagePos]);

  useEffect(() => {
    project();
    const unsub = editor.store.listen(project, { scope: "all", source: "all" });
    return () => unsub();
  }, [editor, project]);

  if (!screenPos) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: screenPos.x,
        top: screenPos.y,
        zIndex: 500,
        pointerEvents: "auto",
      }}
    >
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 11px",
          background: "#f59e0b",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          color: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          whiteSpace: "nowrap",
          letterSpacing: "0.01em",
        }}
      >
        <Sparkles size={13} />
        AI
      </button>
    </div>
  );
}
