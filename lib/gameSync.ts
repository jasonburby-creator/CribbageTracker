import { supabase } from "@/lib/supabase";
import type { ScoreEvent } from "@/lib/types";

// Local-first scoring. Every point tap updates the game on-device immediately
// and stashes the latest snapshot here (IndexedDB). We then try to push it to
// Supabase; if that fails (offline), the snapshot stays pending and is flushed
// when the connection returns. The snapshot is the full set of scoring columns,
// so a flush is a last-write-wins update for that game from this device — which
// is exactly right when one phone is keeping score on a plane.

const DB_NAME = "skunklife-games";
const STORE = "snapshots";
const DB_VERSION = 1;

// Columns we own and sync. Photo/location live on their own paths.
export type GameSnapshot = {
  player1_score: number;
  player2_score: number;
  events: ScoreEvent[];
  status: "in_progress" | "completed";
  winner_player: 1 | 2 | null;
  is_skunk: boolean;
  is_double_skunk: boolean;
  payout_cents: number | null;
  win_weight: number | null;
  completed_at: string | null;
  hands_played: number | null;
};

type StoredSnapshot = GameSnapshot & { __id: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "__id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, mode).objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGameSnapshot(
  gameId: string,
  snapshot: GameSnapshot
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await tx(db, "readwrite", (s) => s.put({ ...snapshot, __id: gameId }));
  } catch {
    // Best-effort — the in-memory game state still reflects the tap.
  }
}

export async function getGameSnapshot(
  gameId: string
): Promise<GameSnapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const rec = await tx<StoredSnapshot | undefined>(db, "readonly", (s) =>
      s.get(gameId) as IDBRequest<StoredSnapshot | undefined>
    );
    if (!rec) return null;
    const { __id, ...snap } = rec;
    void __id;
    return snap;
  } catch {
    return null;
  }
}

export async function clearGameSnapshot(gameId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await tx(db, "readwrite", (s) => s.delete(gameId));
  } catch {
    // ignore
  }
}

// Push the given snapshot to Supabase. Returns true on success. Does NOT clear
// the stored snapshot — the caller decides that, so a newer tap that arrived
// mid-push isn't discarded.
export async function pushGameSnapshot(
  gameId: string,
  snapshot: GameSnapshot
): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const { error } = await supabase
      .from("games")
      .update(snapshot)
      .eq("id", gameId);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

let flushing = false;

// Flush every pending game snapshot. Safe to call repeatedly; no-op offline.
export async function flushGameSnapshots(): Promise<number> {
  if (flushing) return 0;
  if (typeof indexedDB === "undefined") return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  flushing = true;
  let pushed = 0;
  try {
    const db = await openDb();
    const records = await tx<StoredSnapshot[]>(db, "readonly", (s) =>
      s.getAll() as IDBRequest<StoredSnapshot[]>
    );
    for (const rec of records) {
      const { __id, ...snap } = rec;
      const ok = await pushGameSnapshot(__id, snap);
      if (ok) {
        await clearGameSnapshot(__id);
        pushed += 1;
      }
    }
  } catch {
    // ignore
  } finally {
    flushing = false;
  }
  return pushed;
}
