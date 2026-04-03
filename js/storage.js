export const STORAGE_KEY = "plog_editor_v1";
export const DOCS_STORAGE_KEY = "plog_editor_docs_v1";

const DB_NAME = "plog_editor_db";
const DB_STORE = "kv";
const ASSET_STORE = "assets";
let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("indexeddb-open-failed"));
    };
  });

  return dbPromise;
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

export async function idbSetAsset(key, value) {
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("indexeddb-asset-write-failed"));
  });
}

export async function idbGetAsset(key) {
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readonly");
    const req = tx.objectStore(ASSET_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb-asset-read-failed"));
  });
}

export async function idbDeleteAsset(key) {
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("indexeddb-asset-delete-failed"));
  });
}
