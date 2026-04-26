import assert from "node:assert/strict";
import { test } from "node:test";

const storageModuleUrl = new URL("../js/storage.js", import.meta.url);

async function importFreshStorage() {
  return await import(`${storageModuleUrl.href}?case=${Date.now()}-${Math.random()}`);
}

test("storage uses native bridge for key-value data when available", async () => {
  const calls = [];
  globalThis.window = {
    plogNativeStorage: {
      request: async (payload) => {
        calls.push(payload);
        if (payload.op === "get") return { ok: true, value: { docs: [] } };
        return { ok: true };
      },
    },
  };

  const { idbSet, idbGet } = await importFreshStorage();

  await idbSet("plog_editor_docs_v1", { docs: [] });
  const value = await idbGet("plog_editor_docs_v1");

  assert.deepEqual(value, { docs: [] });
  assert.deepEqual(calls, [
    { op: "set", key: "plog_editor_docs_v1", value: { docs: [] } },
    { op: "get", key: "plog_editor_docs_v1" },
  ]);
});

test("storage serializes native assets as base64 and restores them as blobs", async () => {
  const calls = [];
  const assets = new Map();
  globalThis.window = {
    plogNativeStorage: {
      request: async (payload) => {
        calls.push(payload);
        if (payload.op === "setAsset") {
          assets.set(payload.key, { data: payload.data, type: payload.type });
          return { ok: true };
        }
        if (payload.op === "getAsset") {
          return { ok: true, ...assets.get(payload.key) };
        }
        return { ok: true };
      },
    },
  };

  const { idbSetAsset, idbGetAsset } = await importFreshStorage();
  const asset = new Blob(["hello"], { type: "text/plain" });

  await idbSetAsset("asset-1", asset);
  const restored = await idbGetAsset("asset-1");

  assert.equal(calls[0].op, "setAsset");
  assert.equal(calls[0].key, "asset-1");
  assert.equal(calls[0].type, "text/plain");
  assert.equal(calls[0].data, "aGVsbG8=");
  assert.equal(restored instanceof Blob, true);
  assert.equal(restored.type, "text/plain");
  assert.equal(await restored.text(), "hello");
});
