import { STORY_PLAN_MAX_PHOTO_COUNT, STORY_PLAN_MIN_PHOTO_COUNT, storyPlanPhotoCountIsValid } from "./story-plan-limits.js";

const DEFAULT_WIDTH = 1200;
const TARGET_CELL_ASPECT_RATIO = 3 / 2;
const CELL_GAP = 8;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("One of the selected photos could not be read."));
    image.src = source;
  });
}

function drawContain(context, image, x, y, width, height) {
  context.fillStyle = "#221e1a";
  context.fillRect(x, y, width, height);
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function contactSheetGrid(photoCount) {
  if (!storyPlanPhotoCountIsValid(photoCount)) {
    throw new Error(`AI drafting supports ${STORY_PLAN_MIN_PHOTO_COUNT}–${STORY_PLAN_MAX_PHOTO_COUNT} photos.`);
  }
  const columns = photoCount <= 2 ? photoCount : photoCount <= 4 ? 2 : photoCount <= 9 ? 3 : 4;
  return { columns, rows: Math.ceil(photoCount / columns) };
}

export async function createContactSheet(photoBlocks, { width = DEFAULT_WIDTH, height } = {}) {
  if (!Array.isArray(photoBlocks) || !storyPlanPhotoCountIsValid(photoBlocks.length)) {
    throw new Error(`AI drafting supports ${STORY_PLAN_MIN_PHOTO_COUNT}–${STORY_PLAN_MAX_PHOTO_COUNT} photos.`);
  }
  const { columns, rows } = contactSheetGrid(photoBlocks.length);
  const photos = photoBlocks.map((block, index) => ({
    id: `photo-${index + 1}`,
    block,
    source: String(block.src || ""),
  }));
  if (photos.some((photo) => !photo.source)) throw new Error("Wait for all selected photos to finish loading.");

  const images = await Promise.all(photos.map((photo) => loadImage(photo.source)));
  const cellWidth = (width - CELL_GAP * (columns - 1)) / columns;
  const sheetHeight = height || Math.round(rows * (cellWidth / TARGET_CELL_ASPECT_RATIO) + CELL_GAP * (rows - 1));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = sheetHeight;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot create the contact sheet.");

  context.fillStyle = "#171411";
  context.fillRect(0, 0, width, sheetHeight);
  const cellHeight = (sheetHeight - CELL_GAP * (rows - 1)) / rows;

  images.forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * (cellWidth + CELL_GAP);
    const y = row * (cellHeight + CELL_GAP);
    drawContain(context, image, x, y, cellWidth, cellHeight);
    context.fillStyle = "rgba(18, 14, 12, 0.76)";
    context.fillRect(x + 14, y + 14, 112, 34);
    context.fillStyle = "#fffaf2";
    context.font = "700 18px system-ui, sans-serif";
    context.fillText(`PHOTO ${index + 1}`, x + 26, y + 37);
  });

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.76),
    photos,
    grid: { columns, rows, width, height: sheetHeight },
  };
}
