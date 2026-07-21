function blockBottom(block) {
  return Number(block.y || 0) + Math.max(0, Number(block.height || 0));
}

function boundaryBefore(blocks, index) {
  const current = blocks[index];
  const previous = blocks[index - 1];
  if (!current || !previous) return null;
  const previousBottom = blockBottom(previous);
  return Math.max(previousBottom, (previousBottom + Number(current.y || 0)) / 2);
}

export function chooseTwoSheetSplit(elements, totalHeight) {
  const height = Math.max(0, Number(totalHeight) || 0);
  const blocks = (elements || [])
    .filter((block) => Number.isFinite(Number(block?.y)) && Number.isFinite(Number(block?.height)))
    .slice()
    .sort((a, b) => Number(a.y) - Number(b.y));
  if (blocks.length < 2 || height <= 0) return null;

  const sectionIndexes = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => index > 0 && block.type === "text" && block.spacingBefore === "section")
    .map(({ index }) => index);
  const chapterIndexes = sectionIndexes.length > 1 ? sectionIndexes.slice(1) : sectionIndexes;
  const fallbackIndexes = blocks.map((_, index) => index).filter((index) => index > 0);
  const minimumSheetHeight = Math.min(480, height * 0.2);
  const validBoundaries = (indexes) => indexes
    .map((index) => boundaryBefore(blocks, index))
    .filter((value) => value != null && value >= minimumSheetHeight && value <= height - minimumSheetHeight);
  const middle = height / 2;
  const nearest = (candidates) => candidates.reduce((best, value) => Math.abs(value - middle) < Math.abs(best - middle) ? value : best);
  const chapterCandidates = validBoundaries(chapterIndexes);
  if (chapterCandidates.length) {
    const bestChapter = nearest(chapterCandidates);
    if (Math.abs(bestChapter - middle) <= height * 0.16) return bestChapter;
  }

  const balancedIndexes = fallbackIndexes.filter((index) => {
    const previous = blocks[index - 1];
    const current = blocks[index];
    return !(previous?.type === "text" && previous.spacingBefore === "section" && current?.type === "image");
  });
  const balancedCandidates = validBoundaries(balancedIndexes);
  if (balancedCandidates.length) return nearest(balancedCandidates);
  if (chapterCandidates.length) return nearest(chapterCandidates);
  return null;
}

export function twoSheetRanges(elements, totalHeight) {
  const height = Math.max(0, Number(totalHeight) || 0);
  const split = chooseTwoSheetSplit(elements, height);
  if (split == null) return [{ start: 0, end: height }];
  return [
    { start: 0, end: split },
    { start: split, end: height },
  ];
}
