export function createExportManager({
  canvas,
  flushRender,
  hydrateAssetSources,
  getElements,
  getAssetLoadToken,
  exportScale,
  exportFormat,
  exportQuality,
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

  function filenameForExport(ext, scale) {
    const stamp = new Date().toISOString().slice(0, 10);
    return `${docName().replace(/\s+/g, "-").toLowerCase() || "plog"}-${stamp}-${scale}x.${ext}`;
  }

  async function exportRaster() {
    flushRender();
    await hydrateAssetSources(getElements(), getAssetLoadToken());
    const scale = Math.max(1, Math.min(3, Number(exportScale.value) || 2));
    const format = exportFormat.value || "png";
    const quality = Math.max(0.5, Math.min(1, Number(exportQuality.value) || 0.9));
    const width = canvas.clientWidth;
    const height = canvas.offsetHeight;
    let out;
    try {
      const clone = cloneCanvasForExport();
      const markup = buildExportSvgMarkup(width, height, scale, clone);
      const { image, url } = await loadSvgIntoImage(markup);
      out = document.createElement("canvas");
      out.width = width * scale;
      out.height = height * scale;
      const ctx = out.getContext("2d");
      ctx.fillStyle = exportPalette().background;
      if (format === "jpg" && currentExportAppearance() === "light") ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(image, 0, 0);
      if (url) URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("DOM export failed, falling back to state renderer", err);
      out = await renderCanvasFromState(scale, format);
    }

    const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const ext = format === "jpg" ? "jpg" : format;
    triggerDownload(out.toDataURL(mime, quality), filenameForExport(ext, scale));
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
  <title>${docName()}</title>
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
