import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const MIME = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
};

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitForValue(read, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await read();
      if (value) return value;
    } catch {}
    await delay(80);
  }
  throw new Error("timed out waiting for browser state");
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://127.0.0.1").pathname;
      const relative = pathname === "/" ? "editor.html" : decodeURIComponent(pathname.slice(1));
      if (relative.includes("..")) throw new Error("invalid path");
      const body = await readFile(join(ROOT, relative));
      response.writeHead(200, { "content-type": MIME[extname(relative)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      sequence += 1;
      return new Promise((resolveSend, rejectSend) => {
        pending.set(sequence, { resolve: resolveSend, reject: rejectSend });
        socket.send(JSON.stringify({ id: sequence, method, params }));
      });
    },
  };
}

test("browser flow loads a demo, inserts and undoes a block, imports Markdown, and exports", { timeout: 30000 }, async (t) => {
  try {
    await readFile(CHROME);
  } catch {
    t.skip("Google Chrome is not installed");
    return;
  }

  const server = createStaticServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const profile = await mkdtemp(join(tmpdir(), "plog-browser-test-"));
  const url = `http://127.0.0.1:${address.port}/editor.html`;
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-gpu",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    url,
  ], { stdio: "ignore" });

  let cdp;
  t.after(async () => {
    cdp?.close();
    chrome.kill("SIGTERM");
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(profile, { recursive: true, force: true });
  });

  const debugPort = await waitForValue(async () => {
    const value = await readFile(join(profile, "DevToolsActivePort"), "utf8");
    return Number(value.split("\n")[0]) || null;
  });
  const target = await waitForValue(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await response.json();
    return targets.find((entry) => entry.type === "page" && entry.url.includes("editor.html"));
  });
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed");
    return result.result.value;
  };
  const waitInPage = (condition) => evaluate(`(async () => {
    const started = Date.now();
    while (Date.now() - started < 10000) {
      if (${condition}) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("page condition timed out: ${condition.replaceAll('"', '\\"')}");
  })()`);

  await waitInPage("document.body.dataset.appReady === 'true'");
  await evaluate("document.querySelector('#btn-load-example').click()");
  await waitInPage("document.querySelectorAll('#canvas .el').length === 6");

  await evaluate("document.querySelector('#btn-add-text').click()");
  await waitInPage("document.querySelectorAll('#canvas .el').length === 7");
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))");
  await waitInPage("document.querySelectorAll('#canvas .el').length === 6");

  await evaluate(`(() => {
    const input = document.querySelector('#input-document');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['## Arrival\\n\\nA short note.'], 'arrival.md', { type: 'text/markdown' }));
    Object.defineProperty(input, 'files', { value: transfer.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitInPage("document.querySelectorAll('#canvas .el').length === 8");

  await evaluate(`(() => {
    document.querySelector('#canvas .el-image').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    const frame = document.querySelector('#prop-frame');
    frame.value = 'card';
    frame.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#btn-export').click();
  })()`);
  await waitInPage("document.querySelector('#app-toast').textContent.includes('exported successfully')");

  const result = await evaluate(`({
    count: document.querySelectorAll('#canvas .el').length,
    summary: document.querySelector('#canvas-summary').textContent,
    importedText: [...document.querySelectorAll('#canvas .content')].some((node) => node.textContent.includes('Arrival')),
    exportSucceeded: document.querySelector('#app-toast').textContent.includes('exported successfully')
  })`);
  assert.equal(result.count, 8);
  assert.match(result.summary, /8 blocks/);
  assert.equal(result.importedText, true);
  assert.equal(result.exportSucceeded, true);
});
