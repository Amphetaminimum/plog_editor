import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
  const downloadDir = join(profile, "downloads");
  await mkdir(downloadDir, { recursive: true });
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
    if (chrome.exitCode == null && chrome.signalCode == null) {
      await new Promise((resolveExit) => {
        chrome.once("exit", resolveExit);
        chrome.kill("SIGTERM");
      });
    }
    server.closeAllConnections?.();
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
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
  await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

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
  const desktopControls = await evaluate(`({
    exportPreset: document.querySelector('#export-preset').value,
    mobileAppearanceDisplay: getComputedStyle(document.querySelector('#btn-theme-mode-mobile')).display,
    canvasResetHidden: document.querySelector('#btn-canvas-bg-reset').classList.contains('hidden')
  })`);
  assert.equal(desktopControls.exportPreset, "balanced");
  assert.equal(desktopControls.mobileAppearanceDisplay, "none");
  assert.equal(desktopControls.canvasResetHidden, true);
  await evaluate("document.querySelector('#btn-load-example').click()");
  await waitInPage("document.querySelectorAll('#canvas .el').length === 6");

  await evaluate(`(() => {
    window.fetch = async (input) => {
      if (String(input) !== '/api/story-plan') throw new Error('unexpected fetch: ' + input);
      return new Response(JSON.stringify({ error: 'The AI draft could not be generated. Try again.' }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    };
    document.querySelector('#btn-ai-draft').click();
    document.querySelector('#ai-dialog-generate').click();
  })()`);
  await waitInPage("document.querySelector('#ai-dialog-status').dataset.tone === 'error'");
  const failedDraftState = await evaluate(`({
    blockCount: document.querySelectorAll('#canvas .el').length,
    applyHidden: document.querySelector('#ai-dialog-apply').classList.contains('hidden'),
    message: document.querySelector('#ai-dialog-status').textContent
  })`);
  assert.equal(failedDraftState.blockCount, 6);
  assert.equal(failedDraftState.applyHidden, true);
  assert.match(failedDraftState.message, /could not be generated/i);
  await evaluate("document.querySelector('#ai-dialog-cancel').click()");

  await evaluate(`(() => {
    window.fetch = async (input, options) => {
      if (String(input) !== '/api/story-plan') throw new Error('unexpected fetch: ' + input);
      const request = JSON.parse(options.body);
      window.__aiRequest = {
        photoCount: request.photoIds.length,
        contactSheetPrefix: request.contactSheet.slice(0, 23),
      };
      return new Response(JSON.stringify({
        model: 'gpt-5.6-terra',
        plan: {
          title: 'Six Frames Before Sunrise',
          dek: 'A short walk through changing light.',
          sections: [
            { heading: 'First light', body: 'The path was almost empty.', photoIds: ['photo-1', 'photo-2', 'photo-3'] },
            { heading: 'The city returns', body: 'Warm light gathered near the road.', photoIds: ['photo-4', 'photo-5', 'photo-6'] }
          ]
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    document.querySelector('#btn-ai-draft').click();
    document.querySelector('#ai-dialog-generate').click();
  })()`);
  await waitInPage("!document.querySelector('#ai-dialog-apply').classList.contains('hidden')");
  const aiRequest = await evaluate("window.__aiRequest");
  assert.equal(aiRequest.photoCount, 6);
  assert.equal(aiRequest.contactSheetPrefix, "data:image/jpeg;base64,");
  await evaluate("document.querySelector('#ai-dialog-apply').click()");
  await waitInPage("document.querySelectorAll('#canvas .el').length === 10");
  await evaluate(`(() => {
    const prototype = CanvasRenderingContext2D.prototype;
    window.__originalFillText = prototype.fillText;
    window.__aiExportText = [];
    prototype.fillText = function(text, ...args) {
      window.__aiExportText.push(String(text));
      return window.__originalFillText.call(this, text, ...args);
    };
    document.querySelector('#app-toast').textContent = '';
    document.querySelector('#btn-export').click();
  })()`);
  await waitInPage("document.querySelector('#app-toast').textContent.includes('exported successfully')");
  const aiExportText = await evaluate(`(() => {
    CanvasRenderingContext2D.prototype.fillText = window.__originalFillText;
    return window.__aiExportText.join(' ');
  })()`);
  assert.match(aiExportText.replace(/\s+/g, " "), /Six Frames Before Sunrise/);
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))");
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
    document.querySelector('#app-toast').textContent = '';
    document.querySelector('#btn-export').click();
  })()`);
  await waitInPage("document.querySelector('#app-toast').textContent.length > 0");

  const result = await evaluate(`({
    count: document.querySelectorAll('#canvas .el').length,
    summary: document.querySelector('#canvas-summary').textContent,
    importedText: [...document.querySelectorAll('#canvas .content')].some((node) => node.textContent.includes('Arrival')),
    exportMessage: document.querySelector('#app-toast').textContent,
    exportSucceeded: document.querySelector('#app-toast').textContent.includes('exported successfully')
  })`);
  assert.equal(result.count, 8);
  assert.match(result.summary, /8 blocks/);
  assert.equal(result.importedText, true);
  assert.equal(result.exportSucceeded, true, result.exportMessage);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await cdp.send("Emulation.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await waitInPage("getComputedStyle(document.querySelector('#btn-theme-mode-mobile')).display !== 'none'");
  await evaluate(`(() => {
    window.__sharedExport = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__sharedExport = {
          fileCount: payload.files.length,
          name: payload.files[0].name,
          type: payload.files[0].type,
        };
      },
    });
    document.querySelector('#btn-mobile-export').click();
  })()`);
  await waitInPage("window.__sharedExport?.fileCount === 1");
  const mobileExport = await evaluate("window.__sharedExport");
  assert.equal(mobileExport.type, "image/jpeg");
  assert.match(mobileExport.name, /\.jpg$/);
});
