import { createTwoStorySheets } from "./export-sheets.js";

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

  function filenameForExport(ext, scale, story = null, count = 1) {
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = story == null ? "" : `-story-${story}-of-${count}`;
    return `${docName().replace(/\s+/g, "-").toLowerCase() || "plog"}-${stamp}-${scale}x${suffix}.${ext}`;
  }

  async function exportRaster() {
    flushRender();
    await hydrateAssetSources(getElements(), getAssetLoadToken());
    const scale = Math.max(1, Math.min(3, Number(exportScale.value) || 2));
    const format = exportFormat.value || "png";
    const quality = Math.max(0.5, Math.min(1, Number(exportQuality.value) || 0.9));
    const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const ext = format === "jpg" ? "jpg" : format;
    const shouldSplit = exportPagination?.value === "split";
    const storySheets = shouldSplit
      ? createTwoStorySheets(getElements(), canvas.clientWidth, { title: docName() })
      : null;
    const outputCanvases = storySheets
      ? await Promise.all(storySheets.map((sheet) => renderCanvasFromState(scale, format, sheet)))
      : [await renderCanvasFromState(scale, format)];
    const blobs = await Promise.all(outputCanvases.map((output) => canvasToBlob(output, mime, quality)));
    const outputs = blobs.map((blob, index) => ({
      blob,
      filename: filenameForExport(ext, scale, outputCanvases.length > 1 ? index + 1 : null, outputCanvases.length),
    }));
    return deliverRasters(outputs, mime);
  }

  return {
    exportRaster,
  };
}
