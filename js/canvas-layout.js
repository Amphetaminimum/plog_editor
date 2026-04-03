function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function authoredCanvasWidthFromControls(widthMode, customWidthValue) {
  if (widthMode === "custom") {
    return clamp(Number(customWidthValue) || 1200, 480, 2400);
  }
  return clamp(Number(widthMode) || 1200, 480, 2400);
}

export function canvasLayoutForWidth(width) {
  const horizontalPad = clamp(Math.round(width * 0.08), 24, 96);
  const contentWidth = Math.max(220, width - horizontalPad * 2);
  const contentX = Math.floor((width - contentWidth) / 2);
  const topPad = 36;
  return { width, contentWidth, contentX, topPad };
}

export function fitZoomRatioForStage({ stageClientWidth, paddingLeft, paddingRight, authoredWidth }) {
  const available = Math.max(180, stageClientWidth - paddingLeft - paddingRight - 8);
  return clamp(available / Math.max(1, authoredWidth), 0.32, 1);
}

export function isMobileViewport(viewportWidth) {
  return viewportWidth <= 900;
}
