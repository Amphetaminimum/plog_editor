import { canvasLayoutForWidth, flowVerticalElements, requiredCanvasHeight } from "./canvas-layout.js";

const SPACING_MAP = {
  tight: 14,
  normal: 26,
  section: 52,
};

function orderedBlocks(elements) {
  return (elements || [])
    .filter((block) => block && Number.isFinite(Number(block.y)) && Number.isFinite(Number(block.height)))
    .slice()
    .sort((a, b) => Number(a.y) - Number(b.y));
}

function isChapterHeading(block) {
  return block?.type === "text"
    && block.spacingBefore === "section"
    && /<strong(?:\s|>)/i.test(String(block.html || ""));
}

function sectionStartIndexes(blocks) {
  const explicit = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isChapterHeading(block))
    .map(({ index }) => index);
  if (explicit.length >= 2) return explicit;

  const sections = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === "text" && block.spacingBefore === "section")
    .map(({ index }) => index);
  return sections.length >= 3 ? sections.slice(1) : sections;
}

function blockWeight(block) {
  return Math.max(1, Number(block.height) || 0) + (SPACING_MAP[block.spacingBefore] ?? SPACING_MAP.normal);
}

function chooseGroupBoundary(groups) {
  const total = groups.flat().reduce((sum, block) => sum + blockWeight(block), 0);
  let running = 0;
  let bestIndex = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < groups.length; index += 1) {
    running += groups[index - 1].reduce((sum, block) => sum + blockWeight(block), 0);
    const distance = Math.abs(total / 2 - running);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function cloneWithFreshIds(blocks, sheetNumber) {
  return blocks.map((block, index) => ({
    ...structuredClone(block),
    id: `${block.id || block.type || "block"}-sheet-${sheetNumber}-${index + 1}`,
  }));
}

function layoutSheet(blocks, width, sheetNumber) {
  const cloned = cloneWithFreshIds(blocks, sheetNumber);
  const layout = canvasLayoutForWidth(width);
  const geometry = flowVerticalElements(cloned, layout, SPACING_MAP);
  geometry.forEach((position, index) => Object.assign(cloned[index], position));
  return {
    elements: cloned,
    width,
    height: requiredCanvasHeight(cloned),
  };
}

function semanticSheetBlocks(blocks) {
  const header = blocks.find((block) => block.type === "header");
  const starts = sectionStartIndexes(blocks);
  if (!header || starts.length < 2) return null;

  const firstStart = starts[0];
  const intro = blocks.slice(0, firstStart).filter((block) => block !== header);
  const groups = starts.map((start, index) => blocks.slice(start, starts[index + 1] ?? blocks.length));
  const boundary = chooseGroupBoundary(groups);
  return [
    [header, ...intro, ...groups.slice(0, boundary).flat()],
    [header, ...groups.slice(boundary).flat()],
  ];
}

function fallbackSheetBlocks(blocks) {
  const header = blocks.find((block) => block.type === "header");
  const body = blocks.filter((block) => block !== header);
  if (!header || body.length < 2) return null;

  const total = body.reduce((sum, block) => sum + blockWeight(block), 0);
  let running = 0;
  let boundary = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < body.length; index += 1) {
    running += blockWeight(body[index - 1]);
    const distance = Math.abs(total / 2 - running);
    if (distance < bestDistance) {
      bestDistance = distance;
      boundary = index;
    }
  }
  return [
    [header, ...body.slice(0, boundary)],
    [header, ...body.slice(boundary)],
  ];
}

function fallbackHeader(width, title) {
  const layout = canvasLayoutForWidth(width);
  return {
    id: "export-header",
    type: "header",
    x: layout.contentX,
    y: layout.topPad,
    width: layout.contentWidth,
    height: 104,
    spacingBefore: "normal",
    content: { title: title || "Untitled Plog", meta: "" },
    style: {
      fontSize: 62,
      color: "#1f1f22",
      fontFamily: "fangzheng",
      fontWeight: 500,
    },
  };
}

export function createTwoStorySheets(elements, width, { title = "Untitled Plog" } = {}) {
  const ordered = orderedBlocks(elements);
  const blocks = ordered.some((block) => block.type === "header")
    ? ordered
    : [fallbackHeader(width, title), ...ordered];
  const sheetBlocks = semanticSheetBlocks(blocks) || fallbackSheetBlocks(blocks);
  if (!sheetBlocks) return null;
  return sheetBlocks.map((items, index) => layoutSheet(items, width, index + 1));
}
