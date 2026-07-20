import test from "node:test";
import assert from "node:assert/strict";

import {
  authoredCanvasWidthFromControls,
  canvasLayoutForWidth,
  fitZoomRatioForStage,
  flowVerticalElements,
  isMobileViewport,
  requiredCanvasHeight,
} from "../js/canvas-layout.js";

test("authoredCanvasWidthFromControls clamps preset and custom widths", () => {
  assert.equal(authoredCanvasWidthFromControls("1080", "1200"), 1080);
  assert.equal(authoredCanvasWidthFromControls("custom", "320"), 480);
  assert.equal(authoredCanvasWidthFromControls("custom", "9999"), 2400);
});

test("canvasLayoutForWidth derives padded content bounds", () => {
  assert.deepEqual(canvasLayoutForWidth(1200), {
    width: 1200,
    contentWidth: 1008,
    contentX: 96,
    topPad: 36,
  });
});

test("fitZoomRatioForStage respects minimum and maximum ratios", () => {
  assert.equal(fitZoomRatioForStage({
    stageClientWidth: 1400,
    paddingLeft: 20,
    paddingRight: 20,
    authoredWidth: 1200,
  }), 1);

  assert.equal(fitZoomRatioForStage({
    stageClientWidth: 200,
    paddingLeft: 24,
    paddingRight: 24,
    authoredWidth: 4000,
  }), 0.08);
});

test("isMobileViewport switches at 900px and below", () => {
  assert.equal(isMobileViewport(900), true);
  assert.equal(isMobileViewport(901), false);
});

test("flowVerticalElements produces stable non-overlapping geometry", () => {
  const elements = [
    { id: "title", type: "header", width: 1008, height: 104, spacingBefore: "normal" },
    { id: "body", type: "text", width: 1008, height: 240, spacingBefore: "section" },
    { id: "photo", type: "image", width: 1008, height: 10, aspectRatio: 1.5, spacingBefore: "normal" },
  ];
  const layout = canvasLayoutForWidth(1200);
  const result = flowVerticalElements(elements, layout, { tight: 14, normal: 26, section: 52 });

  assert.deepEqual(result, [
    { id: "title", x: 96, y: 36, width: 1008, height: 104 },
    { id: "body", x: 96, y: 192, width: 1008, height: 240 },
    { id: "photo", x: 96, y: 458, width: 1008, height: 672 },
  ]);
  assert.ok(result.every((item, index) => index === 0 || item.y >= result[index - 1].y + result[index - 1].height));
});

test("requiredCanvasHeight uses the actual final element bottom", () => {
  assert.equal(requiredCanvasHeight([], { minimum: 900, bottomPad: 80 }), 900);
  assert.equal(requiredCanvasHeight([
    { y: 40, height: 100 },
    { y: 420, height: 300 },
  ], { minimum: 600, bottomPad: 80 }), 800);
});
