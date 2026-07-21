import { escapeHtml } from "./html-sanitize.js";
import { twoSheetRanges } from "./export-sheets.js";

export function createExportManager({
  canvas,
  flushRender,
  hydrateAssetSources,
  getElements,
  getAssetLoadToken,
  exportScale,
  exportFormat,
  exportQuality,
  exportPagination,
  currentExportAppearance,
  exportPalette,
  docName,
  renderCanvasFromState,
}) {
  function collectStylesText() {
    return Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules || []).map((rule) => rule.cssText).join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");
  }

  function cloneCanvasForExport() {
    const clone = canvas.cloneNode(true);
    clone.style.transform = "none";
    clone.style.margin = "0";
    const palette = exportPalette();
    clone.style.background = palette.background;
    clone.querySelectorAll(".move-handle,.resize-handle").forEach((node) => node.remove());
    clone.querySelectorAll(".selected").forEach((node) => node.classList.remove("selected"));
    clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    return clone;
  }

  function buildExportSvgMarkup(width, height, scale, clone) {
    const palette = exportPalette();
    const css = collectStylesText();
    const themedCss = currentExportAppearance() === "dark" ? `${css}\n${css.replaceAll("body.theme-dark", ".theme-dark")}` : css;
    const wrapperClass = currentExportAppearance() === "dark" ? "theme-dark" : "";
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" class="${wrapperClass}" style="width:${width}px;height:${height}px;background:${palette.background};">
          <style>${themedCss}</style>
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>
  `;
  }

  async function loadSvgIntoImage(markup) {
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve({ image, url: blobUrl });
        image.onerror = () => reject(new Error("blob-svg-load-failed"));
        image.src = blobUrl;
      });
    } catch {
      URL.revokeObjectURL(blobUrl);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve({ image, url: null });
        image.onerror = () => reject(new Error("data-svg-load-failed"));
        image.src = dataUrl;
      });
    }
  }

  function triggerDownload(url, filename) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function canvasToBlob(outputCanvas, mime, quality) {
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("image-encode-failed"));
      }, mime, quality);
    });
  }

  function isMobileShareContext() {
    const mobileUserAgent = /Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
    const touchFirstDevice = window.matchMedia?.("(pointer: coarse)")?.matches === true
      && Number(navigator.maxTouchPoints) > 0;
    return mobileUserAgent || touchFirstDevice;
  }

  async function deliverRasters(outputs, mime) {
    const mobile = isMobileShareContext();
    const files = outputs.map(({ blob, filename }) => new File([blob], filename, { type: mime }));
    const shareData = { files, title: docName() };
    const totalSize = outputs.reduce((sum, output) => sum + output.blob.size, 0);
    let canShareFiles = false;
    if (typeof navigator.share === "function") {
      try {
        canShareFiles = typeof navigator.canShare !== "function" || navigator.canShare(shareData);
      } catch {
        canShareFiles = false;
      }
    }

    if (mobile && canShareFiles) {
      try {
        await navigator.share(shareData);
        return { method: "share", mobile, filenames: outputs.map((output) => output.filename), count: outputs.length, size: totalSize };
      } catch (error) {
        if (error?.name === "AbortError") return { method: "cancelled", mobile, filenames: outputs.map((output) => output.filename), count: outputs.length, size: totalSize };
      }
    }

    outputs.forEach(({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
    return { method: "download", mobile, filenames: outputs.map((output) => output.filename), count: outputs.length, size: totalSize };
  }

  function filenameForExport(ext, scale, part = null, count = 1) {
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = part == null ? "" : `-part-${part}-of-${count}`;
    return `${docName().replace(/\s+/g, "-").toLowerCase() || "plog"}-${stamp}-${scale}x${suffix}.${ext}`;
  }

  function cropCanvas(source, start, end) {
    const output = document.createElement("canvas");
    output.width = source.width;
    output.height = Math.max(1, end - start);
    const context = output.getContext("2d");
    context.drawImage(source, 0, start, source.width, output.height, 0, 0, source.width, output.height);
    return output;
  }

  async function exportRaster() {
    flushRender();
    await hydrateAssetSources(getElements(), getAssetLoadToken());
    const scale = Math.max(1, Math.min(3, Number(exportScale.value) || 2));
    const format = exportFormat.value || "png";
    const quality = Math.max(0.5, Math.min(1, Number(exportQuality.value) || 0.9));
    const out = await renderCanvasFromState(scale, format);

    const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const ext = format === "jpg" ? "jpg" : format;
    const shouldSplit = exportPagination?.value === "split";
    const authoredHeight = out.height / scale;
    const ranges = shouldSplit ? twoSheetRanges(getElements(), authoredHeight) : [{ start: 0, end: authoredHeight }];
    const outputCanvases = ranges.map(({ start, end }) => {
      const pixelStart = Math.max(0, Math.min(out.height - 1, Math.round(start * scale)));
      const pixelEnd = Math.max(pixelStart + 1, Math.min(out.height, Math.round(end * scale)));
      return ranges.length === 1 ? out : cropCanvas(out, pixelStart, pixelEnd);
    });
    const blobs = await Promise.all(outputCanvases.map((output) => canvasToBlob(output, mime, quality)));
    const outputs = blobs.map((blob, index) => ({
      blob,
      filename: filenameForExport(ext, scale, ranges.length > 1 ? index + 1 : null, ranges.length),
    }));
    return deliverRasters(outputs, mime);
  }

  async function exportHtml() {
    flushRender();
    await hydrateAssetSources(getElements(), getAssetLoadToken());
    const clone = cloneCanvasForExport();
    const css = collectStylesText();
    const appearance = currentExportAppearance();
    const width = canvas.clientWidth;
    const height = canvas.offsetHeight;
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(docName())}</title>
  <style>${css}</style>
</head>
<body class="${appearance === "dark" ? "theme-dark" : ""}" style="margin:0;background:${exportPalette().background};display:flex;justify-content:center;padding:24px;">
  <div style="position:relative;width:${width}px;min-height:${height}px;">${clone.outerHTML}</div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${docName().replace(/\s+/g, "-").toLowerCase() || "plog"}.html`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    exportHtml,
    exportRaster,
  };
}
