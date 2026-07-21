export function createExportManager({
  flushRender,
  hydrateAssetSources,
  getElements,
  getAssetLoadToken,
  exportScale,
  exportFormat,
  exportQuality,
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
    const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const ext = format === "jpg" ? "jpg" : format;
    const outputCanvas = await renderCanvasFromState(scale, format);
    const blob = await canvasToBlob(outputCanvas, mime, quality);
    const outputs = [{ blob, filename: filenameForExport(ext, scale) }];
    return deliverRasters(outputs, mime);
  }

  return {
    exportRaster,
  };
}
