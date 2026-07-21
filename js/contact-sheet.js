const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("One of the six photos could not be read."));
    image.src = source;
  });
}

function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

export async function createContactSheet(photoBlocks, { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = {}) {
  if (!Array.isArray(photoBlocks) || photoBlocks.length !== 6) {
    throw new Error("AI drafting needs exactly six photos.");
  }
  const photos = photoBlocks.map((block, index) => ({
    id: `photo-${index + 1}`,
    block,
    source: String(block.src || ""),
  }));
  if (photos.some((photo) => !photo.source)) throw new Error("Wait for all six photos to finish loading.");

  const images = await Promise.all(photos.map((photo) => loadImage(photo.source)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot create the contact sheet.");

  context.fillStyle = "#171411";
  context.fillRect(0, 0, width, height);
  const columns = 3;
  const rows = 2;
  const gap = 8;
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - gap * (rows - 1)) / rows;

  images.forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * (cellWidth + gap);
    const y = row * (cellHeight + gap);
    drawCover(context, image, x, y, cellWidth, cellHeight);
    context.fillStyle = "rgba(18, 14, 12, 0.76)";
    context.fillRect(x + 14, y + 14, 112, 34);
    context.fillStyle = "#fffaf2";
    context.font = "700 18px system-ui, sans-serif";
    context.fillText(`PHOTO ${index + 1}`, x + 26, y + 37);
  });

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.76),
    photos,
  };
}
