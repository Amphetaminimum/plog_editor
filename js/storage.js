export const STORAGE_KEY = "plog_editor_v1";
export const DOCS_STORAGE_KEY = "plog_editor_docs_v1";

const DB_NAME = "plog_editor_db";
const DB_STORE = "kv";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexeddb-open-failed"));
  });
}

export async function idbSet(key, value) {
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("indexeddb-write-failed"));
  });
}

export async function idbGet(key) {
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb-read-failed"));
  });
}
