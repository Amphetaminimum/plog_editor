import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("build_web_bundle creates a classic script entrypoint for WKWebView file loading", async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), "plog-web-bundle-"));
  try {
    await execFileAsync("node", [
      path.join(repoRoot, "script/build_web_bundle.mjs"),
      "--root",
      repoRoot,
      "--out",
      outDir,
    ]);

    const html = await readFile(path.join(outDir, "index.html"), "utf8");
    const bundle = await readFile(path.join(outDir, "app.bundle.js"), "utf8");

    assert.match(html, /<script src="\.\/app\.bundle\.js"><\/script>/);
    assert.doesNotMatch(html, /type="module"/);
    assert.doesNotMatch(bundle, /^import\s/m);
    assert.doesNotMatch(bundle, /^export\s/m);
    assert.match(bundle, /function createTextDialog/);
    assert.match(bundle, /function createDocStoreManager/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
