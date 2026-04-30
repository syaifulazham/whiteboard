"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Note definitions — landLeft/landTop are the final CSS positions     */
/* ix/iy = initial transform offset (px), ex/ey = exit offset (px)    */
/* ------------------------------------------------------------------ */
const NOTES = [
  { id: 0, bg: "#fef08a", w: 88,  h: 88,  ll: "5%",  lt: "14%", ix: -2200, iy: -900,  ex: 2200,  ey: -1100, rot: -12, delay: 0    },
  { id: 1, bg: "#fde68a", w: 80,  h: 80,  ll: "62%", lt: "7%",  ix: 2200,  iy: 100,   ex: -2200, ey: 900,   rot: 7,   delay: 0.05 },
  { id: 2, bg: "#fcd34d", w: 100, h: 96,  ll: "26%", lt: "44%", ix: 500,   iy: -2200, ex: 2200,  ey: 2200,  rot: -5,  delay: 0.1  },
  { id: 3, bg: "#fef9c3", w: 76,  h: 72,  ll: "78%", lt: "56%", ix: -2200, iy: 900,   ex: 500,   ey: 2200,  rot: 14,  delay: 0.08 },
  { id: 4, bg: "#fbbf24", w: 84,  h: 84,  ll: "11%", lt: "68%", ix: 2200,  iy: 1000,  ex: -2200, ey: -700,  rot: -9,  delay: 0.12 },
  { id: 5, bg: "#fffbeb", w: 92,  h: 92,  ll: "88%", lt: "23%", ix: 700,   iy: 2200,  ex: 2200,  ey: 300,   rot: 19,  delay: 0.06 },
  { id: 6, bg: "#fef3c7", w: 72,  h: 70,  ll: "45%", lt: "72%", ix: -2200, iy: 1500,  ex: -700,  ey: -2200, rot: -3,  delay: 0.15 },
];

type Phase = "in" | "out" | "done";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    if (reduced) { setPhase("done"); return; }
    // fly-in finishes ~1.1s (0.75 base + 0.15 max stagger + 0.2 spring tail)
    // brief pause, then exit
    // fly-in finishes ~1.4s (1.0 base + 0.15 max stagger + spring tail)
    const t1 = setTimeout(() => setPhase("out"), 1900);
    // exit takes ~0.9s
    const t2 = setTimeout(() => setPhase("done"), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reduced]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="h-full"
      >
        {children}
      </motion.div>

      {phase !== "done" && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {/* Backdrop — fades in with notes, fades out when they leave */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "in" ? 1 : 0 }}
            transition={
              phase === "in"
                ? { duration: 0.75, ease: "easeOut" }
                : { duration: 0.85, ease: "easeIn" }
            }
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(254,243,199,0.72) 0%, rgba(255,251,235,0.55) 60%, rgba(255,255,255,0.30) 100%)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />

          {NOTES.map((note) => (
            <motion.div
              key={note.id}
              initial={{ x: note.ix, y: note.iy, rotate: 0, opacity: 0 }}
              animate={
                phase === "in"
                  ? { x: 0, y: 0, rotate: note.rot, opacity: 1 }
                  : { x: note.ex, y: note.ey, rotate: note.rot * 2, opacity: 0 }
              }
              transition={
                phase === "in"
                  ? {
                      x: { duration: 1.0, ease: [0.34, 1.56, 0.64, 1], delay: note.delay },
                      y: { duration: 1.0, ease: [0.34, 1.56, 0.64, 1], delay: note.delay },
                      rotate: { duration: 1.0, ease: [0.34, 1.56, 0.64, 1], delay: note.delay },
                      opacity: { duration: 0.35, delay: note.delay },
                    }
                  : {
                      x: { duration: 0.75, ease: "easeIn", delay: note.delay * 0.2 },
                      y: { duration: 0.75, ease: "easeIn", delay: note.delay * 0.2 },
                      rotate: { duration: 0.75, ease: "easeIn", delay: note.delay * 0.2 },
                      opacity: { duration: 0.4, ease: "easeIn", delay: note.delay * 0.2 },
                    }
              }
              style={{
                position: "absolute",
                left: note.ll,
                top: note.lt,
                width: note.w,
                height: note.h,
              }}
            >
              <StickyNote color={note.bg} width={note.w} height={note.h} />
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

function StickyNote({ color, width, height }: { color: string; width: number; height: number }) {
  const stripH = Math.round(height * 0.13);
  const lineWidths = [68, 50, 40];

  return (
    <div
      style={{
        width,
        height,
        background: color,
        borderRadius: 2,
        boxShadow: "0 6px 18px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Sticky strip at top */}
      <div style={{ height: stripH, background: darken(color, 18), flexShrink: 0 }} />
      {/* Faint ruled lines suggesting handwriting */}
      <div
        style={{
          flex: 1,
          padding: "7px 9px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 5,
        }}
      >
        {lineWidths.map((w, i) => (
          <div
            key={i}
            style={{
              height: 2,
              width: `${w}%`,
              background: "rgba(0,0,0,0.13)",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
