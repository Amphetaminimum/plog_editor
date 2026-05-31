export const STORAGE_KEY = "plog_editor_v1";
export const DOCS_STORAGE_KEY = "plog_editor_docs_v1";

const DB_NAME = "plog_editor_db";
const DB_VERSION = 2;
const DB_STORE = "kv";
const ASSET_STORE = "assets";
const HEIC_CONVERTER_URL = "https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js";
let dbPromise = null;
let heicConverterPromise = null;

function nativeStorage() {
  return globalThis.window?.plogNativeStorage;
}

function hasNativeStorage() {
  return typeof nativeStorage()?.request === "function";
}

function isHeifAsset(value) {
  const type = value?.type?.toLowerCase() || "";
  const name = value?.name?.toLowerCase() || "";
  return type === "image/heif"
    || type === "image/heic"
    || name.endsWith(".hif")
    || name.endsWith(".heif")
    || name.endsWith(".heic");
}

async function loadHeicConverter() {
  if (typeof globalThis.HeicTo === "function") return globalThis.HeicTo;
  if (typeof globalThis.HeicTo?.heicTo === "function") return globalThis.HeicTo.heicTo;
  if (heicConverterPromise) return heicConverterPromise;

  heicConverterPromise = new Promise((resolve, reject) => {
    if (!globalThis.document?.createElement) {
      reject(new Error("heic-converter-unavailable"));
      return;
    }

    const script = document.createElement("script");
    script.src = HEIC_CONVERTER_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (typeof globalThis.HeicTo === "function") {
        resolve(globalThis.HeicTo);
      } else if (typeof globalThis.HeicTo?.heicTo === "function") {
        resolve(globalThis.HeicTo.heicTo);
      } else {
        reject(new Error("heic-converter-missing"));
      }
    };
    script.onerror = () => reject(new Error("heic-converter-load-failed"));
    document.head.appendChild(script);
  });

  return heicConverterPromise;
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(bytes).toString("base64");
}

function base64ToBlob(data, type = "application/octet-stream") {
  let binary;
  if (typeof atob === "function") {
    binary = atob(data);
  } else {
    binary = Buffer.from(data, "base64").toString("binary");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

async function nativeRequest(payload) {
  const response = await nativeStorage().request(payload);
  if (!response?.ok) {
    throw new Error(response?.error || "native-storage-failed");
  }
  return response;
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
  if (hasNativeStorage()) {
    await nativeRequest({ op: "set", key, value });
    return;
  }
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("indexeddb-write-failed"));
  });
}

export async function idbGet(key) {
  if (hasNativeStorage()) {
    const response = await nativeRequest({ op: "get", key });
    if (Object.hasOwn(response, "value")) return response.value;
  }
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb-read-failed"));
  });
}

export async function idbSetAsset(key, value) {
  if (hasNativeStorage()) {
    await nativeRequest({
      op: "setAsset",
      key,
      type: value.type || "application/octet-stream",
      data: await blobToBase64(value),
    });
    return;
  }
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("indexeddb-asset-write-failed"));
  });
}

export async function normalizeImageAsset(value) {
  if (hasNativeStorage()) {
    const response = await nativeRequest({
      op: "normalizeImageAsset",
      name: value.name || "",
      type: value.type || "application/octet-stream",
      data: await blobToBase64(value),
    });
    if (!response.data) return value;
    return base64ToBlob(response.data, response.type || value.type);
  }

  if (!isHeifAsset(value)) return value;
  const heicTo = await loadHeicConverter();
  const converted = await heicTo({ blob: value, type: "image/png" });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (blob instanceof Blob) return blob;
  return new Blob([blob], { type: "image/png" });
}

export async function idbGetAsset(key) {
  if (hasNativeStorage()) {
    const response = await nativeRequest({ op: "getAsset", key });
    if (response.data) return base64ToBlob(response.data, response.type);
  }
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readonly");
    const req = tx.objectStore(ASSET_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb-asset-read-failed"));
  });
}

export async function idbDeleteAsset(key) {
  if (hasNativeStorage()) {
    await nativeRequest({ op: "deleteAsset", key });
    return;
  }
  const db = await openDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("indexeddb-asset-delete-failed"));
  });
}
