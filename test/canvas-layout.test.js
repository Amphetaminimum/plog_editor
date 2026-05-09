import test from "node:test";
import assert from "node:assert/strict";

import {
  authoredCanvasWidthFromControls,
  canvasLayoutForWidth,
  fitZoomRatioForStage,
  isMobileViewport,
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
