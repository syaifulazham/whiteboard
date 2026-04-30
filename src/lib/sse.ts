// In-process SSE room registry — works for single-instance deployments.
// Uses globalThis so the Map is shared across Next.js module instances
// (same pattern as the Prisma singleton in db.ts).

type Sender = (data: string) => void;

declare global {
  // eslint-disable-next-line no-var
  var __sseRooms: Map<string, Set<Sender>> | undefined;
}

const rooms: Map<string, Set<Sender>> =
  globalThis.__sseRooms ?? (globalThis.__sseRooms = new Map());

export function sseSubscribe(code: string, send: Sender): () => void {
  if (!rooms.has(code)) rooms.set(code, new Set());
  rooms.get(code)!.add(send);
  return () => {
    rooms.get(code)?.delete(send);
    if (rooms.get(code)?.size === 0) rooms.delete(code);
  };
}

export function sseBroadcast(code: string, data: string) {
  rooms.get(code)?.forEach((send) => {
    try { send(data); } catch {}
  });
}
