import test from "node:test";
import assert from "node:assert/strict";

import {
  formatMonthYearLabel,
  headerMetaBaselineY,
  normalizeMonthYearLabel,
} from "../js/header-format.js";

test("month and year labels use full month names and two-digit years", () => {
  assert.equal(formatMonthYearLabel(new Date(2026, 6, 1)), "[July 26]");
  assert.equal(normalizeMonthYearLabel("[Jul. 2026]"), "[July 26]");
  assert.equal(normalizeMonthYearLabel("[August 20]"), "[August 20]");
  assert.equal(normalizeMonthYearLabel("06:42 · Sunday"), "06:42 · Sunday");
});

test("header date baseline aligns the top of differently sized title and date text", () => {
  assert.equal(headerMetaBaselineY(36, 62, 60), 108.8);
  assert.equal(headerMetaBaselineY(36, 74, 60), 113.6);
});
