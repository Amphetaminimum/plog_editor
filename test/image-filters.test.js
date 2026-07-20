import test from "node:test";
import assert from "node:assert/strict";

import { imageFilterCss, imagePresetById, matchingImagePreset, normalizedImageLook } from "../js/image-filters.js";

test("image filters use stable defaults for documents created before filter presets", () => {
  assert.deepEqual(normalizedImageLook({}), {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    warmth: 0,
    grayscale: 0,
  });
  assert.equal(
    imageFilterCss({}),
    "brightness(100%) contrast(100%) saturate(100%) sepia(0%) hue-rotate(0deg) grayscale(0%)",
  );
});

test("preset matching clears after a manual adjustment", () => {
  const portra = imagePresetById("portra");
  assert.equal(matchingImagePreset(portra), "portra");
  assert.equal(matchingImagePreset({ ...portra, warmth: portra.warmth + 1 }), null);
});

test("image filter values are clamped before rendering", () => {
  assert.deepEqual(normalizedImageLook({ brightness: 500, saturation: -20, warmth: -120 }), {
    brightness: 150,
    contrast: 100,
    saturation: 0,
    warmth: -100,
    grayscale: 0,
  });
});
