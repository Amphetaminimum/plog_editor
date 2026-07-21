import test from "node:test";
import assert from "node:assert/strict";

import { chooseTwoSheetSplit, twoSheetRanges } from "../js/export-sheets.js";

test("two-sheet export chooses the chapter boundary nearest the middle", () => {
  const blocks = [
    { id: "header", type: "header", y: 40, height: 120, spacingBefore: "normal" },
    { id: "dek", type: "text", y: 220, height: 80, spacingBefore: "section" },
    { id: "chapter-1", type: "text", y: 420, height: 100, spacingBefore: "section" },
    { id: "photo-1", type: "image", y: 560, height: 900, spacingBefore: "normal" },
    { id: "chapter-2", type: "text", y: 1580, height: 100, spacingBefore: "section" },
    { id: "photo-2", type: "image", y: 1720, height: 900, spacingBefore: "normal" },
    { id: "chapter-3", type: "text", y: 2740, height: 100, spacingBefore: "section" },
    { id: "photo-3", type: "image", y: 2880, height: 900, spacingBefore: "normal" },
  ];

  assert.equal(chooseTwoSheetSplit(blocks, 3900), 1520);
});

test("two-sheet export falls back to the nearest block boundary", () => {
  const blocks = [
    { id: "a", type: "image", y: 40, height: 800 },
    { id: "b", type: "image", y: 880, height: 800 },
    { id: "c", type: "image", y: 1720, height: 800 },
    { id: "d", type: "image", y: 2560, height: 800 },
  ];

  assert.equal(chooseTwoSheetSplit(blocks, 3400), 1700);
});

test("two-sheet export prefers balance when chapter boundaries are too uneven", () => {
  const blocks = [
    { id: "header", type: "header", y: 40, height: 120 },
    { id: "chapter-1", type: "text", y: 220, height: 100, spacingBefore: "section" },
    { id: "photo-1", type: "image", y: 360, height: 900 },
    { id: "chapter-2", type: "text", y: 1380, height: 100, spacingBefore: "section" },
    { id: "photo-2", type: "image", y: 1520, height: 1800 },
    { id: "photo-3", type: "image", y: 3360, height: 1800 },
    { id: "chapter-3", type: "text", y: 5280, height: 100, spacingBefore: "section" },
    { id: "photo-4", type: "image", y: 5420, height: 900 },
  ];

  assert.equal(chooseTwoSheetSplit(blocks, 6400), 3340);
});

test("two-sheet ranges cover the full canvas without overlap", () => {
  const ranges = twoSheetRanges([
    { id: "a", type: "image", y: 40, height: 800 },
    { id: "b", type: "image", y: 880, height: 800 },
  ], 1720);

  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges[0].end, ranges[1].start);
  assert.equal(ranges[1].end, 1720);
});
