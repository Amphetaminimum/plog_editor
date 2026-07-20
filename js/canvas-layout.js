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
  return clamp(available / Math.max(1, authoredWidth), 0.08, 1);
}

export function isMobileViewport(viewportWidth) {
  return viewportWidth <= 767;
}

export function responsiveShellMode(viewportWidth) {
  if (viewportWidth <= 767) return "phone";
  if (viewportWidth <= 1199) return "tablet";
  return "desktop";
}

export function flowVerticalElements(elements, layout, spacingMap) {
  let currentY = layout.topPad;
  return elements.map((item, index) => {
    const spacingBefore = spacingMap[item.spacingBefore] ?? spacingMap.normal;
    if (index > 0) currentY += spacingBefore;

    const width = item.width >= layout.contentWidth - 60
      ? layout.contentWidth
      : Math.min(item.width, layout.contentWidth);
    const height = item.type === "image" && item.aspectRatio
      ? Math.max(120, Math.floor(width / item.aspectRatio))
      : item.height;
    const geometry = {
      id: item.id,
      x: layout.contentX,
      y: Math.round(currentY),
      width,
      height,
    };
    currentY = geometry.y + geometry.height;
    return geometry;
  });
}

export function requiredCanvasHeight(elements, { minimum = 1000, bottomPad = 96 } = {}) {
  if (!elements.length) return minimum;
  const lastBottom = Math.max(...elements.map((item) => item.y + item.height));
  return Math.max(minimum, Math.ceil(lastBottom + bottomPad));
}
