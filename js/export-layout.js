function rect(x, y, width, height) {
  return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

export function imageExportLayout(item) {
  const frame = item.style?.frame || "none";
  const bounds = rect(item.x, item.y, item.width, item.height);
  if (frame === "polaroid") {
    return {
      frame,
      bounds,
      frameStyle: { fill: "#fffaf4", radius: 0, shadow: "soft" },
      image: rect(item.x + 14, item.y + 14, item.width - 28, item.height - 62),
    };
  }
  if (frame === "card") {
    return {
      frame,
      bounds,
      frameStyle: { fill: "#fff6ea", radius: 18, shadow: "soft" },
      image: rect(item.x + 12, item.y + 12, item.width - 24, item.height - 24),
    };
  }
  return {
    frame: "none",
    bounds,
    frameStyle: null,
    image: bounds,
  };
}
