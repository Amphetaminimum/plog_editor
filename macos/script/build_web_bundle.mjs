#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const root = args.get("--root");
const out = args.get("--out");

if (!root || !out) {
  console.error("usage: build_web_bundle.mjs --root <repo-root> --out <web-output-dir>");
  process.exit(2);
}

const moduleOrder = [
  "js/html-sanitize.js",
  "js/canvas-layout.js",
  "js/storage.js",
  "js/dialog.js",
  "js/history-manager.js",
  "js/render-state.js",
  "js/editor-render.js",
  "js/export-manager.js",
  "js/doc-store.js",
  "js/shell-manager.js",
  "app.js",
];

function stripModuleSyntax(source) {
  return source
    .replace(/^import\s.+?;\n/gm, "")
    .replace(/^export\s+(?=(const|let|var|async\s+function|function|class)\s)/gm, "");
}

await mkdir(out, { recursive: true });

const indexSource = await readFile(path.join(root, "index.html"), "utf8");
const indexBundled = indexSource.replace(
  /<script\s+src="\.\/app\.js\?v=[^"]+"\s+type="module"><\/script>/,
  '<script src="./app.bundle.js"></script>',
);
await writeFile(path.join(out, "index.html"), indexBundled);

const bundleParts = [];
for (const modulePath of moduleOrder) {
  const source = await readFile(path.join(root, modulePath), "utf8");
  bundleParts.push(`\n// ${modulePath}\n${stripModuleSyntax(source)}`);
}
await writeFile(path.join(out, "app.bundle.js"), bundleParts.join("\n"));

await cp(path.join(root, "styles.css"), path.join(out, "styles.css"));
await cp(path.join(root, "favicon.svg"), path.join(out, "favicon.svg"));
