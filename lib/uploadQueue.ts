import { supabase } from "@/lib/supabase";
import { uploadGamePhoto } from "@/lib/photo";

// Offline-safe photo upload queue. When a winner's photo is picked without a
// connection (or the upload fails), we stash the original file in IndexedDB and
// retry later — on app load and whenever the browser comes back online. Each
// entry is keyed by game id; the newest pick for a game wins.

const DB_NAME = "skunklife";
const STORE = "photoQueue";
const DB_VERSION = 1;

type QueueRecord = {
  gameId: string;
  blob: Blob;
  name: string;
  type: string;
  at: number;
  latitude?: number | null;
  longitude?: number | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // keyPath = gameId so re-queuing the same game overwrites the old pick.
        db.createObjectStore(STORE, { keyPath: "gameId" });
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

// Save a photo to retry later. Returns false if IndexedDB is unavailable.
export async function enqueuePhoto(
  gameId: string,
  file: File,
  coords?: { latitude: number; longitude: number } | null
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openDb();
    const record: QueueRecord = {
      gameId,
      blob: file,
      name: file.name || `${gameId}.jpg`,
      type: file.type || "image/jpeg",
      at: Date.now(),
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    };
    await tx(db, "readwrite", (s) => s.put(record));
    return true;
  } catch {
    return false;
  }
}

export async function queueCount(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  try {
    const db = await openDb();
    return await tx<number>(db, "readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

let flushing = false;

// Upload every queued photo and clear it once its DB row is updated. Safe to
// call repeatedly; a guard prevents overlapping flushes. No-ops when offline.
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  if (typeof indexedDB === "undefined") return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  flushing = true;
  let uploaded = 0;
  try {
    const db = await openDb();
    const records = await tx<QueueRecord[]>(db, "readonly", (s) =>
      s.getAll() as IDBRequest<QueueRecord[]>
    );
    for (const rec of records) {
      try {
        const file = new File([rec.blob], rec.name, { type: rec.type });
        const photoUrl = await uploadGamePhoto(rec.gameId, file);
        const patch: Record<string, unknown> = { photo_url: photoUrl };
        if (rec.latitude != null && rec.longitude != null) {
          patch.latitude = rec.latitude;
          patch.longitude = rec.longitude;
        }
        const { error } = await supabase
          .from("games")
          .update(patch)
          .eq("id", rec.gameId);
        if (error) throw error;
        await tx(db, "readwrite", (s) => s.delete(rec.gameId));
        uploaded += 1;
      } catch {
        // Leave this one queued and try again on the next flush.
      }
    }
  } catch {
    // IndexedDB unavailable — nothing to flush.
  } finally {
    flushing = false;
  }
  return uploaded;
}
