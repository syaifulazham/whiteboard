"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, TLShapeId } from "tldraw";
import SelectionActionCard from "./SelectionActionCard";

type CardEntry = {
  id: string;
  initialPagePos: { x: number; y: number };
  initialShapeIds: TLShapeId[];
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
  const [cards, setCards] = useState<CardEntry[]>([]);
  // The id of the card currently in "confirm" stage (tied to canvas selection).
  const confirmIdRef = useRef<string | null>(null);
  // Selection signature we last reacted to, to avoid duplicate spawns.
  const lastSigRef = useRef<string>("");
  // Signatures the user explicitly cancelled — don't re-spawn unless the
  // selection actually changes to something else and back.
  const dismissedSigRef = useRef<string>("");

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (confirmIdRef.current === id) confirmIdRef.current = null;
  }, []);

  const onCardClose = useCallback(
    (id: string, sig: string) => {
      // If this was the active confirm card, mark its sig as dismissed so
      // selecting the same shapes again won't immediately re-pop.
      if (confirmIdRef.current === id) dismissedSigRef.current = sig;
      removeCard(id);
    },
    [removeCard],
  );

  const onCardDetached = useCallback((id: string) => {
    if (confirmIdRef.current === id) confirmIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!editor) return;

    const refresh = () => {
      const ids = editor.getSelectedShapeIds();
      const sig = ids.length ? [...ids].sort().join("|") : "";
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;

      // Selection changed -> drop any active confirm card.
      if (confirmIdRef.current) {
        const idToRemove = confirmIdRef.current;
        confirmIdRef.current = null;
        setCards((prev) => prev.filter((c) => c.id !== idToRemove));
      }

      if (ids.length === 0) return;
      if (sig === dismissedSigRef.current) return;

      const bounds = editor.getSelectionPageBounds();
      if (!bounds) return;
      const z = editor.getZoomLevel() || 1;
      const initialPagePos = { x: bounds.minX, y: bounds.maxY + 12 / z };
      const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
      confirmIdRef.current = id;
      setCards((prev) => [
        ...prev,
        { id, initialPagePos, initialShapeIds: [...ids] },
      ]);
    };

    refresh();
    const unsub = editor.store.listen(refresh, { scope: "all", source: "all" });
    return () => unsub();
  }, [editor]);

  return (
    <>
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
