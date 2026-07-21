import { createTextDialog } from "./js/dialog.js";
import { authoredCanvasWidthFromControls, canvasLayoutForWidth, flowVerticalElements, requiredCanvasHeight } from "./js/canvas-layout.js";
import { createDocStoreManager } from "./js/doc-store.js";
import { DOCUMENT_COMMANDS, executeDocumentCommand } from "./js/document-commands.js";
import { parseDocumentImport } from "./js/document-import.js";
import { createEditorRenderManager } from "./js/editor-render.js";
import { createExportManager } from "./js/export-manager.js";
import { createHistoryManager } from "./js/history-manager.js";
import { createContactSheet } from "./js/contact-sheet.js";
import { sanitizeEditableHtml } from "./js/html-sanitize.js";
import { formatMonthYearLabel } from "./js/header-format.js";
import { DEFAULT_IMAGE_LOOK, imagePresetById } from "./js/image-filters.js";
import { createStateRenderer } from "./js/render-state.js";
import { createShellManager } from "./js/shell-manager.js";
import { idbDeleteAsset, idbGetAsset, idbSetAsset, normalizeImageAsset } from "./js/storage.js";
import { compileStoryPlanBatch, normalizeStoryPlan } from "./js/story-plan.js";
import { STORY_PLAN_MAX_PHOTO_COUNT, STORY_PLAN_MIN_PHOTO_COUNT, storyPlanPhotoCountIsValid } from "./js/story-plan-limits.js";

const FONT_MAP = {
  fangzheng: '"方正清刻本悦宋", "FZQKBYSJW--GB1-0", "Songti SC", "STSong", "Noto Serif SC", serif',
  song: '"Songti SC", "STSong", "Noto Serif SC", serif',
  sans: '"Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
};

const SPACING_MAP = {
  tight: 14,
  normal: 26,
  section: 52,
};

const CANVAS_BG_DEFAULTS = {
  day: "#ffffff",
  night: "#14110d",
};

const THEME_SEQUENCE = ["night", "day"];

const state = {
  elements: [],
  selectedId: null,
  drag: null,
  resize: null,
  seq: 1,
  layoutLocked: true,
  zoom: 1,
  history: [],
  historyIndex: -1,
  suppressHistory: false,
  editSession: null,
  savedSelection: null,
  savedSelectionElementId: null,
  savedSelectionTarget: null,
  themeMode: "night",
  docs: [],
  currentDocId: null,
  lastCanvasWidthUi: {
    widthSelect: "1200",
    customWidth: "1200",
  },
  saveTimer: null,
  renderFrame: 0,
  renderScheduled: false,
  assetUrls: new Map(),
  assetLoadToken: 0,
  zoomMode: "fit",
};

const elementNodeCache = new Map();

const canvas = document.getElementById("canvas");
const canvasViewport = document.getElementById("canvas-viewport");
const canvasScale = document.getElementById("canvas-scale");
const canvasStage = document.getElementById("canvas-stage");

const elNoSelection = document.getElementById("no-selection");
const inspector = document.getElementById("inspector");
const propType = document.getElementById("prop-type");
const propFontSize = document.getElementById("prop-font-size");
const propFontSizePreset = document.getElementById("prop-font-size-preset");
const propFontFamily = document.getElementById("prop-font-family");
const propFontWeight = document.getElementById("prop-font-weight");
const propSpacingBefore = document.getElementById("prop-spacing-before");
const propColor = document.getElementById("prop-color");

const widthSelect = document.getElementById("canvas-width");
const customWrap = document.getElementById("custom-width-wrap");
const customWidth = document.getElementById("custom-width");
const exportScale = document.getElementById("export-scale");
const btnToggleLock = document.getElementById("btn-toggle-lock");
const canvasZoom = document.getElementById("canvas-zoom");
const btnFitFrame = document.getElementById("btn-fit-frame");
const btnExport = document.getElementById("btn-export");
const btnUndo = document.getElementById("btn-undo");
const btnRedo = document.getElementById("btn-redo");
const btnBold = document.getElementById("btn-bold");
const btnItalic = document.getElementById("btn-italic");
const btnBulletList = document.getElementById("btn-bullet-list");
const btnNumberList = document.getElementById("btn-number-list");
const btnClearFormat = document.getElementById("btn-clear-format");
const btnThemeMode = document.getElementById("btn-theme-mode");
const btnThemeModeMobile = document.getElementById("btn-theme-mode-mobile");
const btnDocDrawer = document.getElementById("btn-doc-drawer");
const docSelect = document.getElementById("doc-select");
const btnDocNew = document.getElementById("btn-doc-new");
const btnDocRename = document.getElementById("btn-doc-rename");
const btnDocDelete = document.getElementById("btn-doc-delete");
const btnDocDrawerClose = document.getElementById("btn-doc-drawer-close");
const docDrawerBackdrop = document.getElementById("doc-drawer-backdrop");
const docDrawerList = document.getElementById("doc-drawer-list");
const exportFormat = document.getElementById("export-format");
const exportQuality = document.getElementById("export-quality");
const exportAppearance = document.getElementById("export-appearance");
const exportPreset = document.getElementById("export-preset");
const exportPagination = document.getElementById("export-pagination");
const exportOptionsSummary = document.getElementById("export-options-summary");
const exportQualityField = document.getElementById("export-quality-field");
const canvasBgInput = document.getElementById("canvas-bg");
const btnCanvasBgReset = document.getElementById("btn-canvas-bg-reset");
const canvasPaletteStatus = document.getElementById("canvas-palette-status");
const inputDocument = document.getElementById("input-document");
const canvasBgPresetButtons = [...document.querySelectorAll("[data-canvas-bg]")];
const propRotation = document.getElementById("prop-rotation");
const propBrightness = document.getElementById("prop-brightness");
const propBrightnessValue = document.getElementById("prop-brightness-value");
const propContrast = document.getElementById("prop-contrast");
const propContrastValue = document.getElementById("prop-contrast-value");
const propSaturation = document.getElementById("prop-saturation");
const propSaturationValue = document.getElementById("prop-saturation-value");
const propWarmth = document.getElementById("prop-warmth");
const propWarmthValue = document.getElementById("prop-warmth-value");
const propGrayscale = document.getElementById("prop-grayscale");
const propGrayscaleValue = document.getElementById("prop-grayscale-value");
const propRotationValue = document.getElementById("prop-rotation-value");
const propFrame = document.getElementById("prop-frame");
const imageControls = document.getElementById("image-controls");
const imagePresetButtons = [...document.querySelectorAll("[data-image-preset]")];
const btnImageReset = document.getElementById("btn-image-reset");
const textFormattingControls = document.getElementById("text-formatting-controls");
const textStyleControls = document.getElementById("text-style-controls");
const btnMobileElements = document.getElementById("btn-mobile-elements");
const btnMobileSettings = document.getElementById("btn-mobile-settings");
const btnMobileExport = document.getElementById("btn-mobile-export");
const mobileSheetCloseButtons = [...document.querySelectorAll("[data-close-mobile-panel]")];
const mobilePanelBackdrop = document.getElementById("mobile-panel-backdrop");
const dialogBackdrop = document.getElementById("dialog-backdrop");
const dialogTitle = document.getElementById("dialog-title");
const dialogMessage = document.getElementById("dialog-message");
const dialogInput = document.getElementById("dialog-input");
const dialogFields = document.getElementById("dialog-fields");
const dialogCancel = document.getElementById("dialog-cancel");
const dialogConfirm = document.getElementById("dialog-confirm");
const toolbarMenus = [...document.querySelectorAll(".toolbar-menu")];
const btnLoadExample = document.getElementById("btn-load-example");
const btnLoadExampleTop = document.getElementById("btn-load-example-top");
const btnAiDraft = document.getElementById("btn-ai-draft");
const aiDialogBackdrop = document.getElementById("ai-dialog-backdrop");
const aiDialogForm = document.getElementById("ai-dialog-form");
const aiTripNotes = document.getElementById("ai-trip-notes");
const aiVoiceSample = document.getElementById("ai-voice-sample");
const aiPlanPreview = document.getElementById("ai-plan-preview");
const aiDialogStatus = document.getElementById("ai-dialog-status");
const aiDialogCancel = document.getElementById("ai-dialog-cancel");
const aiDialogGenerate = document.getElementById("ai-dialog-generate");
const aiDialogApply = document.getElementById("ai-dialog-apply");
const appToast = document.getElementById("app-toast");
const canvasSummary = document.getElementById("canvas-summary");
let toastTimer = null;
let aiAbortController = null;
let pendingAiDraft = null;
let pendingAiPhotoBlocks = null;
const STYLE_PROPERTY_BY_KIND = {
  "style.color": "color",
  "style.fontFamily": "fontFamily",
  "style.fontSize": "fontSize",
  "style.fontSizePreset": "fontSize",
  "style.fontWeight": "fontWeight",
  "style.fontWeightToggle": "fontWeight",
  "style.imageBrightness": "brightness",
  "style.imageContrast": "contrast",
  "style.imageFrame": "frame",
  "style.imageGrayscale": "grayscale",
  "style.imageRotation": "rotation",
  "style.imageSaturation": "saturation",
  "style.imageWarmth": "warmth",
};

propFontSize.dataset.historyKind = "style.fontSize";
propRotation.dataset.historyKind = "style.imageRotation";
propBrightness.dataset.historyKind = "style.imageBrightness";
propContrast.dataset.historyKind = "style.imageContrast";
propSaturation.dataset.historyKind = "style.imageSaturation";
propWarmth.dataset.historyKind = "style.imageWarmth";
propGrayscale.dataset.historyKind = "style.imageGrayscale";

function docName() {
  const doc = state.docs.find((entry) => entry.id === state.currentDocId);
  return doc?.name || "Untitled Plog";
}

function createDefaultDocData() {
  return {
    state: {
      elements: [],
      seq: 1,
      selectedId: null,
      layoutLocked: true,
      zoom: 1,
      history: [],
      historyIndex: -1,
      themeMode: "night",
    },
    ui: {
      widthSelect: "1200",
      customWidth: "1200",
      canvasBg: CANVAS_BG_DEFAULTS.night,
      exportScale: "2",
      exportFormat: "jpg",
      exportQuality: "0.88",
      exportPagination: "single",
      zoomMode: "fit",
      themeMode: "night",
    },
  };
}

function createDocRecord(name = "Untitled Plog") {
  return {
    id: uid("doc"),
    name,
    meta: {
      headerTitle: name,
      headerMeta: "Starter header",
      preview: "No preview yet",
      elementCount: 0,
      updatedAt: Date.now(),
    },
    data: createDefaultDocData(),
  };
}

function uid(prefix) {
  const id = `${prefix}-${state.seq}`;
  state.seq += 1;
  return id;
}

function createAssetId() {
  return uid("asset");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function showToast(message, tone = "success") {
  if (!appToast) return;
  if (toastTimer) window.clearTimeout(toastTimer);
  appToast.textContent = message;
  appToast.classList.remove("hidden", "is-success", "is-error");
  appToast.classList.add(tone === "error" ? "is-error" : "is-success");
  toastTimer = window.setTimeout(() => appToast.classList.add("hidden"), 4200);
}

function setGenerateButtonState(loading) {
  const label = btnExport?.querySelector(".btn-generate-label");
  if (!btnExport || !label) return;
  btnExport.disabled = loading;
  btnExport.classList.toggle("is-loading", loading);
  label.textContent = loading ? "Exporting…" : "Export";
  if (btnMobileExport) {
    const mobileLabel = btnMobileExport.querySelector(".mobile-shell-label");
    btnMobileExport.disabled = loading;
    btnMobileExport.classList.toggle("is-loading", loading);
    btnMobileExport.setAttribute("aria-busy", String(loading));
    if (mobileLabel) mobileLabel.textContent = loading ? "Working…" : "Export";
  }
}

function closeToolbarMenus({ except = null } = {}) {
  toolbarMenus.forEach((menu) => {
    if (menu !== except) menu.removeAttribute("open");
  });
}

function openDocDrawer() {
  if (!docDrawerBackdrop) return;
  document.body.classList.add("doc-drawer-open");
  docDrawerBackdrop.classList.remove("hidden");
}

function closeDocDrawer() {
  if (!docDrawerBackdrop) return;
  document.body.classList.remove("doc-drawer-open");
  docDrawerBackdrop.classList.add("hidden");
}

function headerSummaryFromDoc(doc) {
  return {
    title: doc.meta?.headerTitle?.trim() || doc.name,
    meta: doc.meta?.headerMeta?.trim() || "Starter header",
  };
}

function renderDocDrawer() {
  if (!docDrawerList) return;
  docDrawerList.innerHTML = "";
  state.docs.forEach((doc) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "doc-card";
    if (doc.id === state.currentDocId) item.classList.add("is-active");
    item.dataset.docId = doc.id;

    const headerSummary = headerSummaryFromDoc(doc);
    const preview = (doc.meta?.preview || "No preview yet").slice(0, 120);
    const elementCount = Number(doc.meta?.elementCount) || 0;

    const visual = document.createElement("div");
    visual.className = "doc-card-visual";

    const visualTitle = document.createElement("div");
    visualTitle.className = "doc-card-visual-title";
    visualTitle.textContent = headerSummary.title;

    const visualMeta = document.createElement("div");
    visualMeta.className = "doc-card-visual-meta";
    visualMeta.textContent = headerSummary.meta;

    const visualExcerpt = document.createElement("div");
    visualExcerpt.className = "doc-card-visual-excerpt";
    visualExcerpt.textContent = preview;

    visual.append(visualTitle, visualMeta, visualExcerpt);

    const titleRow = document.createElement("div");
    titleRow.className = "doc-card-title-row";

    const title = document.createElement("span");
    title.className = "doc-card-title";
    title.textContent = doc.name;
    titleRow.appendChild(title);

    if (doc.id === state.currentDocId) {
      const badge = document.createElement("span");
      badge.className = "doc-card-badge";
      badge.textContent = "Current";
      titleRow.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "doc-card-meta";
    meta.textContent = `${elementCount} block${elementCount === 1 ? "" : "s"}`;

    const previewNode = document.createElement("div");
    previewNode.className = "doc-card-preview";
    previewNode.textContent = preview;

    item.append(visual, titleRow, meta, previewNode);
    docDrawerList.appendChild(item);
  });
}

function authoredCanvasWidth() {
  return authoredCanvasWidthFromControls(widthSelect.value, customWidth.value);
}

function canvasLayout() {
  return canvasLayoutForWidth(authoredCanvasWidth());
}

function defaultSpacingBefore(type, prevType) {
  if (!prevType) return "normal";
  if (prevType === "image" && type === "image") return "tight";
  if (prevType === "text" && type === "image") return "tight";
  if (prevType === "image" && type === "text") return "normal";
  if (prevType === "text" && type === "text") return "normal";
  if (type === "header") return "section";
  return "normal";
}

function getInsertionAnchor() {
  if (!state.selectedId) return null;
  return getElement(state.selectedId) || null;
}

function getFlowPlacement(type, spacingBefore) {
  const layout = canvasLayout();
  const anchor = getInsertionAnchor();
  if (anchor) {
    const gap = SPACING_MAP[spacingBefore] ?? SPACING_MAP.normal;
    return {
      x: layout.contentX,
      y: Math.floor(anchor.y + anchor.height + gap),
    };
  }
  if (state.elements.length === 0) {
    return { x: layout.contentX, y: layout.topPad };
  }
  const last = state.elements[state.elements.length - 1];
  const gap = SPACING_MAP[spacingBefore] ?? SPACING_MAP.normal;
  return {
    x: layout.contentX,
    y: Math.floor(last.y + last.height + gap),
  };
}

function createElement(type, patch = {}) {
  const layout = canvasLayout();
  const prev = getInsertionAnchor() || state.elements[state.elements.length - 1];
  const spacingBefore = patch.spacingBefore ?? defaultSpacingBefore(type, prev?.type);
  const flow = getFlowPlacement(type, spacingBefore);

  const base = {
    id: uid(type),
    type,
    x: flow.x,
    y: flow.y,
    width: layout.contentWidth,
    height: 120,
    content: "",
    html: "",
    placeholder: "Write your story...",
    spacingBefore,
    style: {
      fontSize: 60,
      color: defaultTextColorForTheme(),
      radius: 10,
      fontFamily: "fangzheng",
      fontWeight: 300,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      warmth: 0,
      grayscale: 0,
      frame: "none",
    },
    src: "",
    aspectRatio: null,
  };

  if (type === "image") {
    base.height = Math.floor(layout.contentWidth * 0.66);
    base.style.radius = 0;
  }

  if (type === "divider") {
    base.height = 18;
  }

  if (type === "header") {
    base.height = 104;
    base.content = {
      title: "",
      meta: "",
    };
    base.style.fontSize = 62;
    base.style.fontWeight = 500;
  }

  if (type === "quote") {
    base.height = 150;
    base.content = "";
    base.placeholder = "Quote...";
    base.style.fontSize = 46;
  }

  if (type === "card") {
    base.height = 200;
    base.content = {
      title: "",
      body: "",
    };
    base.style.fontSize = 40;
    base.style.fontWeight = 300;
  }

  return { ...base, ...patch };
}

function templateFor(type) {
  if (type === "text") return document.getElementById("tpl-text");
  if (type === "image") return document.getElementById("tpl-image");
  if (type === "divider") return document.getElementById("tpl-divider");
  if (type === "quote") return document.getElementById("tpl-quote");
  if (type === "card") return document.getElementById("tpl-card");
  return document.getElementById("tpl-header");
}

function getElement(id) {
  return state.elements.find((item) => item.id === id);
}

function getElementIndex(id) {
  return state.elements.findIndex((item) => item.id === id);
}

function getElementNode(id) {
  const cached = elementNodeCache.get(id);
  if (cached?.isConnected) return cached;
  const node = canvas.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (node) elementNodeCache.set(id, node);
  return node || null;
}

function reflowAfterElement(id) {
  const index = getElementIndex(id);
  if (state.layoutLocked && index >= 0) reflowFrom(index + 1);
}

function revokeAssetUrl(assetId) {
  const url = state.assetUrls.get(assetId);
  if (!url) return;
  URL.revokeObjectURL(url);
  state.assetUrls.delete(assetId);
}

function clearAssetUrls() {
  state.assetUrls.forEach((url) => URL.revokeObjectURL(url));
  state.assetUrls.clear();
}

async function ensureAssetUrl(assetId) {
  if (!assetId) return "";
  const cached = state.assetUrls.get(assetId);
  if (cached) return cached;
  const blob = await idbGetAsset(assetId);
  if (!(blob instanceof Blob)) return "";
  const url = URL.createObjectURL(blob);
  state.assetUrls.set(assetId, url);
  return url;
}

async function hydrateAssetSources(elements, token = state.assetLoadToken) {
  const pending = elements
    .filter((item) => item.type === "image" && item.assetId)
    .map(async (item) => {
      try {
        const src = await ensureAssetUrl(item.assetId);
        if (state.assetLoadToken !== token) return;
        if (src) item.src = src;
      } catch (err) {
        console.error("Failed to hydrate asset", item.assetId, err);
      }
    });

  if (!pending.length) return;
  await Promise.all(pending);
  if (state.assetLoadToken === token) render();
}

function serializeElementsForStorage(elements) {
  return elements.map((item) => {
    if (item.type !== "image") return item;

    const serialized = { ...item };
    if (serialized.assetId) {
      delete serialized.src;
    }
    return serialized;
  });
}

function currentExportAppearance() {
  if (exportAppearance.value === "match") {
    return state.themeMode === "night" ? "dark" : "light";
  }
  return exportAppearance.value === "dark" ? "dark" : "light";
}

function defaultCanvasBackgroundForTheme(mode = state.themeMode) {
  return mode === "day" ? CANVAS_BG_DEFAULTS.day : CANVAS_BG_DEFAULTS.night;
}

function defaultTextColorForTheme(mode = state.themeMode) {
  return mode === "day" ? "#1f1f22" : "#f4ede2";
}

function normalizeCanvasBackground(value, fallback = defaultCanvasBackgroundForTheme()) {
  const normalized = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : fallback.toLowerCase();
}

function normalizeTextColor(value, fallback = defaultTextColorForTheme()) {
  const normalized = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : fallback.toLowerCase();
}

function currentCanvasBackground() {
  return normalizeCanvasBackground(canvasBgInput?.value, defaultCanvasBackgroundForTheme());
}

function isTextualElement(item) {
  return item?.type === "text" || item?.type === "header" || item?.type === "quote" || item?.type === "card";
}

function resolvedElementTextColor(item, mode = state.themeMode) {
  return normalizeTextColor(item?.style?.color, defaultTextColorForTheme(mode));
}

function canvasUsesThemeDefaults(mode = state.themeMode) {
  const bgMatches = currentCanvasBackground() === normalizeCanvasBackground(defaultCanvasBackgroundForTheme(mode));
  const textMatches = state.elements.filter(isTextualElement).every((item) => resolvedElementTextColor(item, mode) === normalizeTextColor(defaultTextColorForTheme(mode)));
  return bgMatches && textMatches;
}

function syncCanvasBackgroundPresetState() {
  const current = currentCanvasBackground().toLowerCase();
  canvasBgPresetButtons.forEach((button) => {
    button.classList.toggle("is-active", (button.dataset.canvasBg || "").toLowerCase() === current);
  });
}

function applyCanvasBackground(value, { persist = false } = {}) {
  const next = normalizeCanvasBackground(value, defaultCanvasBackgroundForTheme());
  if (canvasBgInput) canvasBgInput.value = next;
  canvas.style.background = next;
  syncCanvasBackgroundPresetState();
  updateCanvasPaletteUi();
  if (persist) saveSession();
}

function updateCanvasPaletteUi() {
  if (!canvasPaletteStatus || !btnCanvasBgReset) return;
  const auto = canvasUsesThemeDefaults(state.themeMode);
  canvasPaletteStatus.textContent = auto
    ? "Canvas colors follow the current appearance."
    : "Custom canvas colors stay until you switch appearance or reset them.";
  btnCanvasBgReset.classList.toggle("hidden", auto);
  btnCanvasBgReset.textContent = "Reset canvas colors";
}

function applyThemePalette(mode = state.themeMode, { persist = false } = {}) {
  const bg = defaultCanvasBackgroundForTheme(mode);
  const text = defaultTextColorForTheme(mode);
  applyCanvasBackground(bg);
  state.elements.forEach((item) => {
    if (!isTextualElement(item)) return;
    item.style = item.style || {};
    item.style.color = text;
  });
  render();
  syncInspector();
  updateCanvasPaletteUi();
  if (persist) saveSession();
}

function insertLineBreakAtSelection(editable) {
  if (!editable) return;
  editable.focus();
  let inserted = false;
  try {
    inserted = document.execCommand("insertLineBreak");
  } catch {
    inserted = false;
  }
  if (!inserted) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  editable.dispatchEvent(new Event("input", { bubbles: true }));
}

function exportPalette() {
  const appearance = currentExportAppearance();
  return {
    appearance,
    background: currentCanvasBackground(),
    text: appearance === "dark" ? "#f4ede2" : "#1f1f22",
    panel: appearance === "dark" ? "rgba(255,248,239,0.08)" : "#fffaf2",
  };
}

function exportTextColor(color) {
  const palette = exportPalette();
  const normalized = (color || "").toLowerCase();
  if (!normalized || normalized === "#1f1f22" || normalized === "rgb(31, 31, 34)") {
    return palette.text;
  }
  return color;
}

const dialogApi = createTextDialog({
  backdrop: dialogBackdrop,
  fieldsEl: dialogFields,
  titleEl: dialogTitle,
  messageEl: dialogMessage,
  inputEl: dialogInput,
  cancelBtn: dialogCancel,
  confirmBtn: dialogConfirm,
});
const { openFormDialog, openTextDialog } = dialogApi;

let applyDocData;
let buildStarterDoc;
let createNewDocument;
let deleteCurrentDocument;
let flushSaveSession;
let renameCurrentDocument;
let restoreSession;
let saveSession;
let switchDocument;
let exportHtml;
let exportRaster;
let applyZoom;
let bindShellEvents;
let commitMutation;
let closeMobilePanels;
let openMobilePanel;
let pushHistory;
let redoHistory;
let renderCanvasFromState;
let render;
let syncResponsiveShell;
let syncInspector;
let syncZoomControl;
let undoHistory;
let updateViewportMetrics;
let flushRender;

const docStore = createDocStoreManager({
  state,
  controls: {
    customWidth,
    docSelect,
    exportAppearance,
    exportButton: btnExport,
    exportFormat,
    exportPagination,
    exportQuality,
    exportScale,
    widthSelect,
  },
  getCanvasBackground: currentCanvasBackground,
  getDefaultTextColor: () => defaultTextColorForTheme(),
  setCanvasBackground: (value) => applyCanvasBackground(value),
  serializeElementsForStorage,
  clearAssetUrls,
  setLayoutLocked,
  createDefaultDocData,
  createDocRecord,
  addElement,
  createElement,
  deleteImageAssetsForItems,
  openFormDialog,
  openTextDialog,
});

({
  applyDocData,
  buildStarterDoc,
  createNewDocument,
  deleteCurrentDocument,
  flushSaveSession,
  renameCurrentDocument,
  restoreSession,
  saveSession,
  switchDocument,
} = docStore);

({ renderCanvasFromState } = createStateRenderer({
  getCanvasMetrics: () => ({
    width: canvas.clientWidth,
    height: canvas.offsetHeight,
  }),
  getElements: () => state.elements,
  getPalette: exportPalette,
  resolveFontFamily: familyCss,
  resolveTextColor: exportTextColor,
}));

({ flushRender, render, syncInspector } = createEditorRenderManager({
  state,
  canvas,
  elementNodeCache,
  controls: {
    btnRedo,
    btnUndo,
    btnMobileSettings,
    elNoSelection,
    imageControls,
    inspector,
    propBrightness,
    propBrightnessValue,
    propColor,
    propContrast,
    propContrastValue,
    propFontFamily,
    propFontSize,
    propFontSizePreset,
    propFontWeight,
    propFrame,
    propGrayscale,
    propGrayscaleValue,
    propRotation,
    propRotationValue,
    propSaturation,
    propSaturationValue,
    propSpacingBefore,
    propType,
    propWarmth,
    propWarmthValue,
    imagePresetButtons,
    textFormattingControls,
    textStyleControls,
  },
  getElement,
  getElementNode,
  templateFor,
  canvasLayout,
  familyCss,
  onEditableBlur: (editable) => finishEditableSession(editable),
  onEditableFocus: (editable) => beginEditableSession(editable),
  reflowAfterElement,
  reflowAll: () => reflowFrom(0),
  saveSession: (...args) => saveSession(...args),
  updateCanvasHeight,
  updateViewportMetrics: (...args) => updateViewportMetrics(...args),
  updateBlockContent: (id, patch) => {
    applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_CONTENT, id, patch });
  },
}));

const exportManager = createExportManager({
  canvas,
  flushRender,
  hydrateAssetSources,
  getElements: () => state.elements,
  getAssetLoadToken: () => state.assetLoadToken,
  exportScale,
  exportFormat,
  exportQuality,
  exportPagination,
  currentExportAppearance,
  exportPalette,
  docName,
  renderCanvasFromState,
});

({ exportHtml, exportRaster } = exportManager);

({ commitMutation, pushHistory, redoHistory, undoHistory } = createHistoryManager({
  state,
  controls: {
    canvasBg: canvasBgInput,
    customWidth,
    exportAppearance,
    exportButton: btnExport,
    exportFormat,
    exportPagination,
    exportQuality,
    exportScale,
    widthSelect,
  },
  setCanvasBackground: (value) => {
    applyCanvasBackground(value);
  },
  setLayoutLocked,
}));

const shellManager = createShellManager({
  state,
  controls: {
    btnFitFrame,
    btnMobileElements,
    btnMobileSettings,
    canvasZoom,
    mobilePanelBackdrop,
  },
  nodes: {
    canvas,
    canvasScale,
    canvasStage,
    canvasViewport,
    mobileShellActions: document.querySelector(".mobile-shell-actions"),
    topbar: document.querySelector(".topbar"),
  },
  authoredCanvasWidth,
});

({
  applyZoom,
  bindEvents: bindShellEvents,
  closeMobilePanels,
  openMobilePanel,
  syncResponsiveShell,
  syncZoomControl,
  updateViewportMetrics,
} = shellManager);

function applyThemeMode(mode = state.themeMode, { syncPalette = true } = {}) {
  state.themeMode = mode === "day" ? "day" : "night";
  const dark = state.themeMode === "night";
  document.body.classList.toggle("theme-dark", dark);
  canvas.dataset.theme = dark ? "dark" : "light";
  if (syncPalette) {
    applyThemePalette(state.themeMode);
  } else {
    applyCanvasBackground(currentCanvasBackground());
  }
  const label = state.themeMode.charAt(0).toUpperCase() + state.themeMode.slice(1);
  if (btnThemeMode) btnThemeMode.textContent = `Appearance: ${label}`;
  if (btnThemeModeMobile) btnThemeModeMobile.textContent = `Appearance: ${label}`;
  saveSession();
}

function syncAppliedDocState({ hydrate = true, pushInitialHistory = false } = {}) {
  applyCanvasWidth();
  applyZoom(state.zoomMode === "fit" ? "fit" : state.zoom, { mode: state.zoomMode, persist: false });
  applyThemeMode(state.themeMode, { syncPalette: false });
  syncExportOptionsUi();
  flushRender();
  renderDocDrawer();
  if (hydrate) {
    void hydrateAssetSources(state.elements, state.assetLoadToken);
  }
  if (pushInitialHistory && state.history.length === 0) {
    pushHistory();
  }
}

function commitAndSave(kind = "unknown", payload = null) {
  commitMutation(kind, payload);
  saveSession();
}

function applyDocumentCommandState(command) {
  const result = executeDocumentCommand(state.elements, command);
  state.elements = result.blocks;
  return result;
}

function recordDocumentCommand(command, inverse, { beforeLayout = null, afterLayout = null } = {}) {
  if (!inverse) return;
  commitAndSave("document.command", { command, inverse, beforeLayout, afterLayout });
}

function dispatchDocumentCommand(command, { beforeLayout = captureElementLayoutState(), select = true } = {}) {
  const result = applyDocumentCommandState(command);
  if (!result.changed) return result;
  const affectedId = command.id || command.block?.id || null;
  if (select) state.selectedId = command.type === DOCUMENT_COMMANDS.DELETE ? null : affectedId;
  if (state.layoutLocked) reflowFrom(0);
  render();
  recordDocumentCommand(command, result.inverse, {
    beforeLayout,
    afterLayout: captureElementLayoutState(),
  });
  return result;
}

function contentCommandPair(id, item, beforeState, afterState) {
  if (!item || !beforeState || !afterState) return null;
  if (item.type === "text" || item.type === "quote") {
    return {
      command: { type: DOCUMENT_COMMANDS.UPDATE_CONTENT, id, patch: { html: afterState.html || "", content: afterState.content || "" } },
      inverse: { type: DOCUMENT_COMMANDS.UPDATE_CONTENT, id, patch: { html: beforeState.html || "", content: beforeState.content || "" } },
    };
  }
  if (item.type === "header" || item.type === "card") {
    return {
      command: { type: DOCUMENT_COMMANDS.UPDATE_CONTENT, id, patch: { content: structuredClone(afterState.content || {}) } },
      inverse: { type: DOCUMENT_COMMANDS.UPDATE_CONTENT, id, patch: { content: structuredClone(beforeState.content || {}) } },
    };
  }
  return null;
}

function commitStyleChange(selected, kind, beforeValue, afterValue) {
  const property = STYLE_PROPERTY_BY_KIND[kind];
  if (!selected || !property) {
    commitAndSave(kind);
    return;
  }
  recordDocumentCommand(
    { type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { [property]: afterValue } },
    { type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { [property]: beforeValue } },
  );
}

function syncRestoredHistoryState() {
  applyCanvasWidth();
  applyZoom(state.zoomMode === "fit" ? "fit" : state.zoom, { mode: state.zoomMode, persist: false });
  applyThemeMode(state.themeMode, { syncPalette: false });
  flushRender();
  renderDocDrawer();
}

async function loadBuildWeekExample() {
  await flushSaveSession();
  let doc = state.docs.find((entry) => entry.name === "Example" || entry.name === "Build Week Demo");
  if (!doc) {
    doc = createDocRecord("Example");
    state.docs.push(doc);
  }
  doc.name = "Example";

  state.currentDocId = doc.id;
  applyDocData(createDefaultDocData());
  state.elements = [];
  state.selectedId = null;
  state.seq = Math.max(state.seq, 100);

  const demoPhotos = [
    { filename: "kyoto-demo-01-temple-rooftops.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-02-red-umbrella.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-03-moss-courtyard.jpg", aspectRatio: 1462 / 2600 },
    { filename: "kyoto-demo-04-moss-path.jpg", aspectRatio: 1462 / 2600 },
    { filename: "kyoto-demo-05-lantern-teahouse.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-06-city-overlook.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-07-dry-garden.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-08-azalea-stones.jpg", aspectRatio: 1462 / 2600 },
    { filename: "kyoto-demo-09-garden-gate.jpg", aspectRatio: 1462 / 2600 },
    { filename: "kyoto-demo-10-shadow-corridor.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-11-red-maple-roof.jpg", aspectRatio: 2600 / 1462 },
    { filename: "kyoto-demo-12-forest-villa.jpg", aspectRatio: 2600 / 1462 },
  ];
  demoPhotos.forEach(({ filename, aspectRatio }, index) => {
    state.elements.push(createElement("image", {
      id: `demo-photo-${index + 1}`,
      src: new URL(`./assets/demo/${filename}`, window.location.href).href,
      aspectRatio,
      spacingBefore: index === 0 ? "normal" : "tight",
      style: { radius: 16, rotation: 0, brightness: 100, contrast: 100, saturation: 100, warmth: 0, grayscale: 0, frame: "none" },
    }));
  });

  exportPagination.value = "split";
  syncExportOptionsUi();

  setLayoutLocked(true);
  applyThemeMode("day");
  applyThemePalette("day");
  reflowFrom(0);
  state.history = [];
  state.historyIndex = -1;
  syncAppliedDocState({ hydrate: false, pushInitialHistory: true });
  await flushSaveSession();
  renderDocDrawer();
  showToast("Twelve-photo Kyoto demo loaded as one Plog. Export is set to two balanced JPGs.");
}

function setAiDialogBusy(busy) {
  aiDialogGenerate.disabled = busy;
  aiDialogCancel.textContent = busy ? "Stop" : "Cancel";
  aiDialogGenerate.textContent = busy ? "Creating contact sheet…" : "Generate preview";
  aiDialogGenerate.classList.toggle("is-loading", busy);
}

function closeAiDialog() {
  aiAbortController?.abort();
  aiAbortController = null;
  pendingAiDraft = null;
  pendingAiPhotoBlocks = null;
  setAiDialogBusy(false);
  aiDialogBackdrop.classList.add("hidden");
}

function openAiDialog() {
  const images = state.elements.filter((item) => item.type === "image");
  if (!storyPlanPhotoCountIsValid(images.length)) {
    showToast(`AI drafting supports ${STORY_PLAN_MIN_PHOTO_COUNT}–${STORY_PLAN_MAX_PHOTO_COUNT} image blocks.`, "error");
    return;
  }
  pendingAiDraft = null;
  pendingAiPhotoBlocks = null;
  aiDialogForm.classList.remove("hidden");
  aiPlanPreview.classList.add("hidden");
  aiPlanPreview.replaceChildren();
  aiDialogApply.classList.add("hidden");
  aiDialogGenerate.classList.remove("hidden");
  aiDialogStatus.textContent = `${images.length} image blocks are ready. Apply replaces this document as one undoable action.`;
  aiDialogStatus.dataset.tone = "neutral";
  aiDialogBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => aiTripNotes.focus());
}

function renderAiPlanPreview(plan, model) {
  aiPlanPreview.replaceChildren();
  const title = document.createElement("h4");
  title.textContent = plan.title;
  const dek = document.createElement("p");
  dek.textContent = plan.dek;
  aiPlanPreview.append(title, dek);
  plan.sections.forEach((section) => {
    const wrapper = document.createElement("div");
    wrapper.className = "ai-plan-section";
    const heading = document.createElement("strong");
    heading.textContent = section.heading;
    const body = document.createElement("span");
    body.textContent = section.body;
    const photos = document.createElement("div");
    photos.className = "ai-photo-order";
    photos.textContent = section.photoIds.map((id) => id.replace("photo-", "Photo ")).join(" · ");
    wrapper.append(heading, body, photos);
    aiPlanPreview.appendChild(wrapper);
  });
  aiPlanPreview.classList.remove("hidden");
  aiDialogStatus.textContent = `Preview generated by ${model || "GPT‑5.6"}. Review it before applying.`;
}

async function generateAiDraftPreview() {
  const sourceImages = state.elements.filter((item) => item.type === "image");
  if (!storyPlanPhotoCountIsValid(sourceImages.length)) return;
  aiAbortController?.abort();
  aiAbortController = new AbortController();
  setAiDialogBusy(true);
  aiDialogStatus.dataset.tone = "neutral";
  aiDialogStatus.textContent = "Preparing one compressed contact sheet locally…";

  try {
    await Promise.all(sourceImages.map(async (item) => {
      if (!item.src && item.assetId) item.src = await ensureAssetUrl(item.assetId);
    }));
    const contactSheet = await createContactSheet(sourceImages);
    pendingAiPhotoBlocks = contactSheet.photos.map(({ id, block }) => ({ ...structuredClone(block), id }));
    aiDialogGenerate.textContent = "Asking GPT‑5.6…";
    aiDialogStatus.textContent = `GPT‑5.6 is grouping ${sourceImages.length} frames and drafting chapters…`;
    const response = await fetch("/api/story-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: aiAbortController.signal,
      body: JSON.stringify({
        contactSheet: contactSheet.dataUrl,
        photoIds: contactSheet.photos.map((photo) => photo.id),
        tripNotes: aiTripNotes.value,
        voiceSample: aiVoiceSample.value,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The AI draft could not be generated.");
    pendingAiDraft = normalizeStoryPlan(payload.plan, contactSheet.photos.map((photo) => photo.id));
    renderAiPlanPreview(pendingAiDraft, payload.model);
    aiDialogForm.classList.add("hidden");
    aiDialogGenerate.classList.add("hidden");
    aiDialogApply.classList.remove("hidden");
  } catch (error) {
    if (error?.name === "AbortError") {
      aiDialogStatus.textContent = "Generation stopped. No document changes were made.";
    } else {
      aiDialogStatus.textContent = error?.message || "The AI draft could not be generated.";
      aiDialogStatus.dataset.tone = "error";
    }
  } finally {
    aiAbortController = null;
    setAiDialogBusy(false);
  }
}

function applyAiDraft() {
  if (!pendingAiDraft || !pendingAiPhotoBlocks) return;
  const result = compileStoryPlanBatch({
    existingBlocks: state.elements,
    imageBlocks: pendingAiPhotoBlocks,
    plan: pendingAiDraft,
    meta: formatMonthYearLabel(),
    createBlock: (type, patch) => {
      const block = createElement(type, patch);
      if (type === "header") block.style = { ...block.style, fontSize: 62, fontWeight: 500 };
      if (type === "text") block.style = { ...block.style, fontSize: 38, fontWeight: 400 };
      return block;
    },
  });
  dispatchDocumentCommand(result.command, { select: false });
  closeAiDialog();
  showToast("AI draft applied as one undoable document command.");
}

toolbarMenus.forEach((menu) => {
  menu.addEventListener("toggle", () => {
    if (menu.open) closeToolbarMenus({ except: menu });
  });
  menu.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("button")) {
      menu.removeAttribute("open");
    }
  });
});

[btnLoadExample, btnLoadExampleTop].forEach((button) => {
  button?.addEventListener("click", () => {
    void loadBuildWeekExample();
  });
});

btnAiDraft?.addEventListener("click", openAiDialog);
aiDialogGenerate?.addEventListener("click", () => void generateAiDraftPreview());
aiDialogApply?.addEventListener("click", applyAiDraft);
aiDialogCancel?.addEventListener("click", closeAiDialog);
aiDialogBackdrop?.addEventListener("mousedown", (event) => {
  if (event.target === aiDialogBackdrop) closeAiDialog();
});

document.addEventListener("pointerdown", (ev) => {
  const target = ev.target;
  if (!(target instanceof Node)) return;
  if (toolbarMenus.some((menu) => menu.contains(target))) return;
  closeToolbarMenus();
});

if (docDrawerBackdrop) {
  docDrawerBackdrop.addEventListener("click", closeDocDrawer);
}

if (btnDocDrawer) {
  btnDocDrawer.addEventListener("click", () => {
    const nextOpen = !document.body.classList.contains("doc-drawer-open");
    closeMobilePanels();
    if (!nextOpen) {
      closeDocDrawer();
      return;
    }
    closeToolbarMenus();
    openDocDrawer();
  });
}

if (btnDocDrawerClose) {
  btnDocDrawerClose.addEventListener("click", closeDocDrawer);
}

if (docDrawerList) {
  docDrawerList.addEventListener("click", async (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest(".doc-card");
    if (!item) return;
    const { docId } = item.dataset;
    if (!docId || docId === state.currentDocId) {
      closeDocDrawer();
      return;
    }
    await switchDocument(docId);
    syncAppliedDocState({ hydrate: true, pushInitialHistory: true });
    closeDocDrawer();
  });
}

function cycleThemeMode() {
  const index = THEME_SEQUENCE.indexOf(state.themeMode);
  const next = THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length];
  applyThemeMode(next);
}

function updateEditableStateFromDom(editable) {
  const host = editable.closest(".el");
  if (!host) return false;
  const current = getElement(host.dataset.id);
  if (!current) return false;
  if (editable.classList.contains("content") || editable.classList.contains("quote-content")) {
    applyDocumentCommandState({
      type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
      id: current.id,
      patch: { html: editable.innerHTML || "", content: editable.innerText || "" },
    });
  }
  if (editable.classList.contains("card-title")) {
    applyDocumentCommandState({
      type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
      id: current.id,
      patch: { content: { ...current.content, titleHtml: editable.innerHTML || "", title: editable.innerText || "" } },
    });
  }
  if (editable.classList.contains("card-body")) {
    applyDocumentCommandState({
      type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
      id: current.id,
      patch: { content: { ...current.content, bodyHtml: editable.innerHTML || "", body: editable.innerText || "" } },
    });
  }
  if (editable.classList.contains("header-title")) {
    applyDocumentCommandState({
      type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
      id: current.id,
      patch: { content: { ...current.content, titleHtml: editable.innerHTML || "", title: editable.innerText || "" } },
    });
  }
  if (editable.classList.contains("header-meta")) {
    applyDocumentCommandState({
      type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
      id: current.id,
      patch: { content: { ...current.content, metaHtml: editable.innerHTML || "", meta: editable.innerText || "" } },
    });
  }
  return true;
}

function restoreSavedSelection(editable, range) {
  const selection = window.getSelection();
  if (!selection || !range) return false;
  editable.focus();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function findSavedEditable() {
  if (!state.savedSelectionElementId || !state.savedSelectionTarget) return null;
  const host = getElementNode(state.savedSelectionElementId);
  if (!host) return null;
  return host.querySelector(state.savedSelectionTarget);
}

function syncSelectionSnapshot() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    state.savedSelection = null;
    return;
  }
  try {
    state.savedSelection = selection.getRangeAt(0).cloneRange();
  } catch {
    state.savedSelection = null;
  }
}

function placeSelectionMarkers(range) {
  const startMarker = document.createComment("selection-start");
  const endMarker = document.createComment("selection-end");

  const endRange = range.cloneRange();
  endRange.collapse(false);
  endRange.insertNode(endMarker);

  const startRange = range.cloneRange();
  startRange.collapse(true);
  startRange.insertNode(startMarker);

  const commandRange = document.createRange();
  commandRange.setStartAfter(startMarker);
  commandRange.setEndBefore(endMarker);
  return { startMarker, endMarker, commandRange };
}

function restoreSelectionFromMarkers(startMarker, endMarker) {
  if (!startMarker?.isConnected || !endMarker?.isConnected) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  range.setStartAfter(startMarker);
  range.setEndBefore(endMarker);
  selection.removeAllRanges();
  selection.addRange(range);
  startMarker.remove();
  endMarker.remove();
  return true;
}

function unwrapNode(node) {
  const parent = node?.parentNode;
  if (!parent) return;
  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }
  parent.removeChild(node);
}

function stripFormattingFromFragment(fragment) {
  const formattingTags = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "MARK", "FONT", "SPAN", "SUB", "SUP", "CODE", "SMALL"]);
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  const elements = [];
  let current = walker.nextNode();
  while (current) {
    elements.push(current);
    current = walker.nextNode();
  }

  elements.forEach((element) => {
    element.removeAttribute("style");
    element.removeAttribute("class");
  });

  elements.reverse().forEach((element) => {
    if (formattingTags.has(element.tagName)) {
      unwrapNode(element);
    }
  });
}

function clearFormattingInRange(range) {
  const fragment = range.extractContents();
  stripFormattingFromFragment(fragment);
  range.insertNode(fragment);
  return true;
}

function nonWhitespaceTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let current = walker.nextNode();
  while (current) {
    if (current.textContent?.trim()) nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
}

function fragmentTextIsFullyWrapped(fragment, tagNames) {
  const textNodes = nonWhitespaceTextNodes(fragment);
  if (!textNodes.length) return false;
  return textNodes.every((node) => {
    let current = node.parentNode;
    while (current && current !== fragment) {
      if (current.nodeType === Node.ELEMENT_NODE && tagNames.has(current.tagName)) return true;
      current = current.parentNode;
    }
    return false;
  });
}

function unwrapFormattingTags(fragment, tagNames) {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  const elements = [];
  let current = walker.nextNode();
  while (current) {
    elements.push(current);
    current = walker.nextNode();
  }
  elements.reverse().forEach((element) => {
    if (tagNames.has(element.tagName)) {
      unwrapNode(element);
    }
  });
}

function toggleFormattingInRange(range, wrapperTagName, tagNames) {
  const fragment = range.extractContents();
  if (!nonWhitespaceTextNodes(fragment).length) {
    range.insertNode(fragment);
    return false;
  }
  if (fragmentTextIsFullyWrapped(fragment, tagNames)) {
    unwrapFormattingTags(fragment, tagNames);
    range.insertNode(fragment);
    return true;
  }
  const wrapper = document.createElement(wrapperTagName);
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);
  return true;
}

function applyInlineFormat(command, value = null) {
  let active = document.activeElement;
  let range = null;
  if (active && active.getAttribute && active.getAttribute("contenteditable") === "true") {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) range = sel.getRangeAt(0).cloneRange();
  } else if (state.savedSelection && state.savedSelectionElementId) {
    active = findSavedEditable();
    try {
      range = state.savedSelection.cloneRange();
    } catch {
      range = null;
    }
  }
  if (!active || !range) return false;
  finishEditableSession(active);
  if (!restoreSavedSelection(active, range)) return false;
  const host = active.closest(".el");
  const currentBefore = host ? getElement(host.dataset.id) : null;
  const beforeContentState = captureElementContentState(currentBefore);
  const beforeLayout = captureElementLayoutState();
  const { startMarker, endMarker, commandRange } = placeSelectionMarkers(range);
  if (!restoreSavedSelection(active, commandRange)) return false;
  let applied = false;
  if (command === "removeFormat") {
    applied = clearFormattingInRange(commandRange);
  } else if (command === "bold") {
    applied = toggleFormattingInRange(commandRange, "strong", new Set(["B", "STRONG"]));
  } else if (command === "italic") {
    applied = toggleFormattingInRange(commandRange, "em", new Set(["I", "EM"]));
  } else {
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {}
    applied = document.execCommand(command, false, value);
  }
  if (!applied) {
    startMarker.remove();
    endMarker.remove();
    return false;
  }
  restoreSelectionFromMarkers(startMarker, endMarker);
  updateEditableStateFromDom(active);
  syncSelectionSnapshot();
  const current = host ? getElement(host.dataset.id) : null;
  if (current && host) {
    if (current.type === "text") {
      current.height = Math.max(52, Math.ceil(active.scrollHeight + 4));
    }
    if (current.type === "quote") {
      current.height = Math.max(130, Math.ceil(active.scrollHeight + 66));
    }
    if (current.type === "header") {
      const title = host.querySelector(".header-title");
      const meta = host.querySelector(".header-meta");
      const titleH = Math.max(40, Math.ceil(title.scrollHeight));
      const metaH = Math.max(58, Math.ceil(meta.scrollHeight));
      current.height = Math.max(90, Math.max(titleH, metaH) + 20);
    }
    if (current.type === "card") {
      const title = host.querySelector(".card-title");
      const body = host.querySelector(".card-body");
      current.height = Math.max(170, Math.ceil(title.scrollHeight + body.scrollHeight + 56));
    }
    reflowAfterElement(current.id);
  }
  updateCanvasHeight();
  updateViewportMetrics();
  syncInspector();
  const currentAfterFormat = current ? getElement(current.id) : null;
  const afterContentState = captureElementContentState(currentAfterFormat);
  const commandPair = contentCommandPair(currentAfterFormat?.id, currentAfterFormat, beforeContentState, afterContentState);
  if (commandPair) {
    recordDocumentCommand(commandPair.command, commandPair.inverse, {
      beforeLayout,
      afterLayout: captureElementLayoutState(),
    });
  }
  beginEditableSession(active);
  return true;
}

function updateCanvasHeight() {
  canvas.style.minHeight = `${requiredCanvasHeight(state.elements)}px`;
  if (canvasSummary) {
    const height = requiredCanvasHeight(state.elements);
    canvasSummary.textContent = `${state.elements.length} block${state.elements.length === 1 ? "" : "s"} · ${height}px tall`;
  }
}

function familyCss(item) {
  return FONT_MAP[item.style.fontFamily] || FONT_MAP.fangzheng;
}

function setLayoutLocked(next) {
  state.layoutLocked = next;
  document.body.classList.toggle("layout-locked", state.layoutLocked);
  btnToggleLock.textContent = state.layoutLocked ? "Layout Locked" : "Layout Unlocked";
}

function sortElementsByPosition() {
  state.elements.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return 0;
  });
}

function captureElementLayoutState() {
  return state.elements.map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    spacingBefore: item.spacingBefore || "normal",
  }));
}

function captureCanvasWidthUiState() {
  return {
    widthSelect: widthSelect.value,
    customWidth: customWidth.value,
  };
}

function syncLastCanvasWidthUiState() {
  state.lastCanvasWidthUi = { ...captureCanvasWidthUiState() };
}

function captureElementContentState(item) {
  if (!item) return null;
  if (item.type === "text" || item.type === "quote") {
    return {
      html: item.html || "",
      content: item.content || "",
      height: item.height,
    };
  }
  if (item.type === "header" || item.type === "card") {
    return {
      content: structuredClone(item.content || {}),
      height: item.height,
    };
  }
  return null;
}

function contentStateEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function editableTargetSelector(editable) {
  if (!editable?.classList) return null;
  if (editable.classList.contains("content")) return ".content";
  if (editable.classList.contains("quote-content")) return ".quote-content";
  if (editable.classList.contains("card-title")) return ".card-title";
  if (editable.classList.contains("card-body")) return ".card-body";
  if (editable.classList.contains("header-title")) return ".header-title";
  if (editable.classList.contains("header-meta")) return ".header-meta";
  return null;
}

function beginEditableSession(editable) {
  const host = editable?.closest?.(".el");
  const current = host ? getElement(host.dataset.id) : null;
  const selector = editableTargetSelector(editable);
  if (!current || !selector) return;
  if (state.editSession?.id === current.id && state.editSession?.selector === selector) return;
  state.editSession = {
    id: current.id,
    selector,
    beforeContentState: captureElementContentState(current),
    beforeLayout: captureElementLayoutState(),
  };
}

function finishEditableSession(editable, { restart = false } = {}) {
  const host = editable?.closest?.(".el");
  const current = host ? getElement(host.dataset.id) : null;
  const selector = editableTargetSelector(editable);
  const session = state.editSession;
  if (!current || !selector || !session) return false;
  if (session.id !== current.id || session.selector !== selector) return false;

  const afterContentState = captureElementContentState(current);
  const changed = !contentStateEqual(session.beforeContentState, afterContentState);
  if (changed) {
    const commandPair = contentCommandPair(current.id, current, session.beforeContentState, afterContentState);
    if (commandPair) {
      recordDocumentCommand(commandPair.command, commandPair.inverse, {
        beforeLayout: session.beforeLayout,
        afterLayout: captureElementLayoutState(),
      });
    }
  }

  state.editSession = restart ? {
    id: current.id,
    selector,
    beforeContentState: captureElementContentState(current),
    beforeLayout: captureElementLayoutState(),
  } : null;
  return changed;
}

async function deleteImageAssetForItem(item) {
  if (!item?.assetId) return;
  revokeAssetUrl(item.assetId);
  try {
    await idbDeleteAsset(item.assetId);
  } catch (err) {
    console.error("Failed to delete asset", item.assetId, err);
  }
}

async function deleteImageAssetsForItems(items) {
  await Promise.all(items.filter((item) => item?.type === "image" && item.assetId).map((item) => deleteImageAssetForItem(item)));
}

function addElement(item) {
  let insertedIndex = state.elements.length;
  const anchor = getInsertionAnchor();
  if (anchor) {
    const anchorIndex = state.elements.findIndex((entry) => entry.id === anchor.id);
    insertedIndex = anchorIndex + 1;
    // The command reducer owns the insertion below.
  } else {
    insertedIndex = state.elements.length;
  }
  dispatchDocumentCommand({ type: DOCUMENT_COMMANDS.INSERT, index: insertedIndex, block: item });
  requestAnimationFrame(() => {
    const node = getElementNode(item.id);
    node?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  });
}

function snapX(value) {
  const layout = canvasLayout();
  return Math.abs(value - layout.contentX) <= 20 ? layout.contentX : value;
}

function stickyY(rawY, movingId) {
  const layout = canvasLayout();
  const gridY = Math.round(rawY / 8) * 8;
  const anchors = [layout.topPad];
  for (const item of state.elements) {
    if (item.id === movingId) continue;
    const bottom = item.y + item.height;
    anchors.push(bottom + SPACING_MAP.tight);
    anchors.push(bottom + SPACING_MAP.normal);
    anchors.push(bottom + SPACING_MAP.section);
  }
  let best = gridY;
  let dist = 999999;
  for (const y of anchors) {
    const d = Math.abs(y - gridY);
    if (d < dist) {
      dist = d;
      best = y;
    }
  }
  return dist <= 20 ? best : gridY;
}

function reflowFrom(startIndex) {
  const layout = canvasLayout();
  const geometry = flowVerticalElements(state.elements, layout, SPACING_MAP);
  geometry.forEach((next, index) => {
    if (index < startIndex && state.elements[index].y === next.y) return;
    Object.assign(state.elements[index], next);
  });
}

function reorderDraggedByThreshold(id, draggedY) {
  let currentIndex = state.elements.findIndex((item) => item.id === id);
  if (currentIndex < 0) return;

  while (currentIndex > 0) {
    const previous = state.elements[currentIndex - 1];
    const moveUpThreshold = previous.y + previous.height / 2;
    if (draggedY >= moveUpThreshold) break;
    [state.elements[currentIndex - 1], state.elements[currentIndex]] = [state.elements[currentIndex], state.elements[currentIndex - 1]];
    currentIndex -= 1;
  }

  while (currentIndex < state.elements.length - 1) {
    const next = state.elements[currentIndex + 1];
    const moveDownThreshold = next.y;
    if (draggedY <= moveDownThreshold) break;
    [state.elements[currentIndex], state.elements[currentIndex + 1]] = [state.elements[currentIndex + 1], state.elements[currentIndex]];
    currentIndex += 1;
  }
}

function reflowAroundDragged(draggedId, draggedY) {
  const layout = canvasLayout();
  let currentY = layout.topPad;
  for (let i = 0; i < state.elements.length; i += 1) {
    const item = state.elements[i];
    item.x = layout.contentX;
    if (item.width >= layout.contentWidth - 60) {
      item.width = layout.contentWidth;
      if (item.type === "image" && item.aspectRatio) {
        item.height = Math.max(120, Math.floor(item.width / item.aspectRatio));
      }
    }
    if (i > 0) {
      currentY += SPACING_MAP[item.spacingBefore || "normal"] || SPACING_MAP.normal;
    }
    if (item.id === draggedId) {
      item.y = draggedY;
    } else {
      item.y = currentY;
    }
    currentY = item.y + item.height;
  }
}

document.addEventListener("pointermove", (ev) => {
  if (!state.drag && !state.resize) return;
  const activePointerId = state.drag?.pointerId ?? state.resize?.pointerId;
  if (activePointerId != null && ev.pointerId !== activePointerId) return;
  const selected = getElement(state.drag?.id || state.resize?.id);
  if (!selected) return;

  if (state.drag) {
    const rawY = ev.clientY - state.drag.canvasTop - state.drag.offsetY;
    selected.x = canvasLayout().contentX;
    if (state.layoutLocked) {
      selected.y = clamp(stickyY(rawY, selected.id), 0, 100000);
    } else {
      selected.y = clamp(rawY, 0, 100000);
      reorderDraggedByThreshold(selected.id, selected.y);
      reflowAroundDragged(selected.id, selected.y);
    }
    render();
    return;
  }

  if (state.resize) {
    const deltaX = ev.clientX - state.resize.originX;
    const deltaY = ev.clientY - state.resize.originY;
    selected.width = clamp(state.resize.baseWidth + deltaX, 220, 2600);
    if (selected.type === "image" && selected.aspectRatio) {
      selected.height = Math.floor(selected.width / selected.aspectRatio);
    } else {
      selected.height = clamp(state.resize.baseHeight + deltaY, 30, 2600);
    }
    render();
  }
});

function finishPointerInteraction(ev) {
  const interaction = state.drag || state.resize;
  const activePointerId = state.drag?.pointerId ?? state.resize?.pointerId;
  if (interaction && activePointerId != null && ev?.pointerId != null && ev.pointerId !== activePointerId) return;
  const activeId = state.drag?.id || state.resize?.id || null;
  const interactionKind = state.drag ? "layout.move" : state.resize ? "layout.resize" : "unknown";
  const interactionBefore = state.drag
    ? {
        x: state.drag.baseX,
        y: state.drag.baseY,
        width: state.drag.baseWidth,
        height: state.drag.baseHeight,
      }
    : state.resize
      ? {
          x: state.resize.baseX,
          y: state.resize.baseY,
          width: state.resize.baseWidth,
          height: state.resize.baseHeight,
        }
      : null;
  const selectedBeforeRelease = activeId ? getElement(activeId) : null;
  state.drag = null;
  state.resize = null;
  document.body.classList.remove("drag-reordering");
  if (!interaction) return;
  if (!state.layoutLocked && interactionKind === "layout.move") {
    sortElementsByPosition();
  }
  if (activeId) reflowAfterElement(activeId);
  render();
  const selectedAfter = activeId ? getElement(activeId) : null;
  if (!selectedBeforeRelease || !selectedAfter || !interactionBefore) {
    commitAndSave(interactionKind);
    return;
  }
  if (interactionKind === "layout.move") {
    const finalIndex = state.elements.findIndex((item) => item.id === activeId);
    recordDocumentCommand(
      { type: DOCUMENT_COMMANDS.MOVE, id: activeId, toIndex: finalIndex },
      { type: DOCUMENT_COMMANDS.MOVE, id: activeId, toIndex: interaction.baseIndex },
      {
        beforeLayout: interaction.beforeLayout,
        afterLayout: captureElementLayoutState(),
      },
    );
    return;
  }
  commitAndSave(interactionKind, {
    id: activeId,
    before: interactionBefore,
    after: {
      x: selectedAfter.x,
      y: selectedAfter.y,
      width: selectedAfter.width,
      height: selectedAfter.height,
    },
  });
}

document.addEventListener("pointerup", finishPointerInteraction);
document.addEventListener("pointercancel", finishPointerInteraction);

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  const active = document.activeElement;
  const isEditing = active && active.getAttribute && active.getAttribute("contenteditable") === "true";
  if (!isEditing || !selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const host = active.closest(".el");
  if (!host) return;
  if (!active.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== active) return;
  try {
    state.savedSelection = range.cloneRange();
  } catch {
    state.savedSelection = null;
  }
  state.savedSelectionElementId = host.dataset.id;
  if (active.classList.contains("content")) state.savedSelectionTarget = ".content";
  else if (active.classList.contains("quote-content")) state.savedSelectionTarget = ".quote-content";
  else if (active.classList.contains("card-title")) state.savedSelectionTarget = ".card-title";
  else if (active.classList.contains("card-body")) state.savedSelectionTarget = ".card-body";
  else if (active.classList.contains("header-title")) state.savedSelectionTarget = ".header-title";
  else if (active.classList.contains("header-meta")) state.savedSelectionTarget = ".header-meta";
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !aiDialogBackdrop?.classList.contains("hidden")) {
    closeAiDialog();
    ev.preventDefault();
    return;
  }
  const active = document.activeElement;
  const isEditing = active && active.getAttribute && active.getAttribute("contenteditable") === "true";
  const selected = getElement(state.selectedId);

  if (isEditing && ev.key === "Enter" && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
    insertLineBreakAtSelection(active);
    ev.preventDefault();
    return;
  }

  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === "z") {
    const restored = ev.shiftKey ? redoHistory() : undoHistory();
    if (restored) syncRestoredHistoryState();
    ev.preventDefault();
    return;
  }

  if ((ev.key === "Delete" || ev.key === "Backspace") && !isEditing) {
    if (!selected) return;
    dispatchDocumentCommand({ type: DOCUMENT_COMMANDS.DELETE, id: selected.id });
    ev.preventDefault();
    return;
  }

  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "b") {
    if (isEditing) {
      applyInlineFormat("bold");
      ev.preventDefault();
      return;
    }
    if (!selected) return;
    const current = Number(selected.style.fontWeight || 300);
    const beforeValue = selected.style.fontWeight;
    const afterValue = current >= 500 ? 300 : 500;
    applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { fontWeight: afterValue } });
    render();
    commitStyleChange(selected, "style.fontWeightToggle", beforeValue, afterValue);
    ev.preventDefault();
  }

  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "i") {
    if (isEditing) {
      applyInlineFormat("italic");
      ev.preventDefault();
      return;
    }
  }
});

canvas.addEventListener("pointerdown", (ev) => {
  if (ev.target === canvas) {
    state.selectedId = null;
    render();
  }
});

document.getElementById("btn-add-text").addEventListener("click", () => {
  addElement(createElement("text", { content: "", placeholder: "Write your story...", spacingBefore: "normal" }));
});

document.getElementById("btn-add-text-section").addEventListener("click", () => {
  addElement(createElement("text", { content: "", placeholder: "New paragraph...", spacingBefore: "section" }));
});

document.getElementById("btn-add-divider").addEventListener("click", () => {
  addElement(createElement("divider", { spacingBefore: "section" }));
});

document.getElementById("btn-add-header").addEventListener("click", () => {
  addElement(
    createElement("header", {
      content: {
        title: "Prayer",
        meta: formatMonthYearLabel(),
      },
      spacingBefore: "section",
      style: { fontSize: 62, color: defaultTextColorForTheme(), radius: 0, fontFamily: "fangzheng" },
    }),
  );
});

document.getElementById("btn-add-quote").addEventListener("click", () => {
  addElement(createElement("quote", { content: "", spacingBefore: "normal" }));
});

document.getElementById("btn-add-card")?.addEventListener("click", () => {
  addElement(createElement("card", { spacingBefore: "section" }));
});

function safeImportedImageSource(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  try {
    const url = new URL(source, window.location.href);
    if (["http:", "https:", "blob:"].includes(url.protocol)) return url.href;
    if (url.protocol === "data:" && /^data:image\//i.test(source)) return source;
  } catch {}
  return "";
}

const IMPORTED_STYLE_PROPERTIES = new Set([
  "fontSize", "fontFamily", "fontWeight", "color", "radius", "rotation",
  "brightness", "contrast", "saturation", "warmth", "grayscale", "frame",
]);

function supportedImportedStyle(style) {
  if (!style || typeof style !== "object") return {};
  return Object.fromEntries(Object.entries(style).filter(([property]) => IMPORTED_STYLE_PROPERTIES.has(property)));
}

function materializeImportedBlock(block) {
  const type = block.type;
  const patch = {};
  if (["tight", "normal", "section"].includes(block.spacingBefore)) patch.spacingBefore = block.spacingBefore;
  const item = createElement(type, patch);
  item.style = { ...item.style, ...supportedImportedStyle(block.style) };

  if (type === "text" || type === "quote") {
    item.content = String(block.content || "");
    item.html = sanitizeEditableHtml(block.html || block.content || "");
  } else if (type === "header") {
    const content = block.content && typeof block.content === "object" ? block.content : {};
    item.content = {
      title: String(content.title || ""),
      titleHtml: sanitizeEditableHtml(content.titleHtml || content.title || ""),
      meta: String(content.meta || ""),
      metaHtml: sanitizeEditableHtml(content.metaHtml || content.meta || ""),
    };
  } else if (type === "card") {
    const content = block.content && typeof block.content === "object" ? block.content : {};
    item.content = {
      title: String(content.title || ""),
      titleHtml: sanitizeEditableHtml(content.titleHtml || content.title || ""),
      body: String(content.body || ""),
      bodyHtml: sanitizeEditableHtml(content.bodyHtml || content.body || ""),
    };
  } else if (type === "image") {
    item.src = safeImportedImageSource(block.src);
    item.assetId = String(block.assetId || "") || undefined;
    item.alt = String(block.alt || "");
    item.aspectRatio = Number(block.aspectRatio) > 0 ? Number(block.aspectRatio) : 16 / 9;
    item.height = Math.max(120, Math.floor(item.width / item.aspectRatio));
  }
  return item;
}

function applyImportedCanvas(canvasSettings = {}) {
  const width = Number(canvasSettings.width);
  if (Number.isFinite(width) && width >= 480 && width <= 2400) {
    if (width === 1080 || width === 1200) {
      widthSelect.value = String(width);
    } else {
      widthSelect.value = "custom";
      customWidth.value = String(Math.round(width));
    }
    applyCanvasWidth();
  }
  if (canvasSettings.background) applyCanvasBackground(canvasSettings.background);
}

function importStructuredDocument(documentData) {
  applyImportedCanvas(documentData.canvas);
  state.selectedId = null;
  for (const block of documentData.blocks) addElement(materializeImportedBlock(block));
  void hydrateAssetSources(state.elements, state.assetLoadToken);
  showToast(`${documentData.blocks.length} block${documentData.blocks.length === 1 ? "" : "s"} imported from ${documentData.title}.`);
}

inputDocument?.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    const imported = parseDocumentImport(await file.text(), file.name);
    importStructuredDocument(imported);
  } catch (err) {
    console.error("Document import failed", err);
    showToast(err?.message || "The document could not be imported.", "error");
  } finally {
    ev.target.value = "";
  }
});

document.getElementById("input-image").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  let assetBlob;
  try {
    assetBlob = await normalizeImageAsset(file, { quality: 0.92 });
  } catch (err) {
    console.error("Failed to normalize image asset", err);
    showToast("That HEIF image could not be converted. Try JPG or PNG for the demo.", "error");
    ev.target.value = "";
    return;
  }

  const tempUrl = URL.createObjectURL(assetBlob);

  let image;
  try {
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`image-decode-failed:${file.name || file.type || "unknown-image"}`));
      img.src = tempUrl;
    });
  } catch (err) {
    console.error("Failed to load image asset", {
      name: file.name || "",
      originalType: file.type || "",
      normalizedType: assetBlob.type || "",
    }, err);
    showToast("That image could not be displayed. Try a JPG, PNG, or WebP file.", "error");
    ev.target.value = "";
    return;
  } finally {
    URL.revokeObjectURL(tempUrl);
  }

  const layout = canvasLayout();
  const width = layout.contentWidth;
  const aspectRatio = image.naturalWidth / image.naturalHeight;
  const height = Math.max(120, Math.floor(width / aspectRatio));
  const assetId = createAssetId();

  try {
    await idbSetAsset(assetId, assetBlob);
  } catch (err) {
    console.error("Failed to persist image asset", err);
    showToast("The image could not be saved locally. Check browser storage and try again.", "error");
    ev.target.value = "";
    return;
  }

  const src = await ensureAssetUrl(assetId);

  addElement(
    createElement("image", {
      src,
      assetId,
      width,
      height,
      aspectRatio,
      spacingBefore: defaultSpacingBefore("image", (getInsertionAnchor() || state.elements[state.elements.length - 1])?.type),
      style: { radius: 0, fontSize: 60, color: defaultTextColorForTheme(), fontFamily: "fangzheng" },
    }),
  );
  showToast("Image added. The canvas has been extended automatically.");
  ev.target.value = "";
});

document.getElementById("btn-delete").addEventListener("click", () => {
  if (!state.selectedId) return;
  dispatchDocumentCommand({ type: DOCUMENT_COMMANDS.DELETE, id: state.selectedId });
});

function wireInspectorNumber(input, updater) {
  input.addEventListener("input", () => {
    const selected = getElement(state.selectedId);
    if (!selected) return;
    const kind = input.dataset.historyKind || "style.numeric";
    const property = STYLE_PROPERTY_BY_KIND[kind];
    const beforeValue = property ? selected.style[property] : null;
    const draft = { ...selected, style: { ...selected.style } };
    updater(draft, Number(input.value));
    const afterValue = property ? draft.style[property] : null;
    if (property) {
      applyDocumentCommandState({
        type: DOCUMENT_COMMANDS.UPDATE_STYLE,
        id: selected.id,
        patch: { [property]: afterValue },
      });
    }
    render();
    commitStyleChange(selected, kind, beforeValue, afterValue);
  });
}

wireInspectorNumber(propFontSize, (selected, value) => {
  selected.style.fontSize = clamp(value || 12, 12, 128);
  propFontSizePreset.value = "";
});

wireInspectorNumber(propRotation, (selected, value) => {
  selected.style.rotation = clamp(value || 0, -180, 180);
});

wireInspectorNumber(propBrightness, (selected, value) => {
  selected.style.brightness = clamp(value || 100, 50, 150);
});

wireInspectorNumber(propContrast, (selected, value) => {
  selected.style.contrast = clamp(value || 100, 50, 150);
});

wireInspectorNumber(propSaturation, (selected, value) => {
  selected.style.saturation = clamp(value, 0, 180);
});

wireInspectorNumber(propWarmth, (selected, value) => {
  selected.style.warmth = clamp(value, -100, 100);
});

wireInspectorNumber(propGrayscale, (selected, value) => {
  selected.style.grayscale = clamp(value || 0, 0, 100);
});

const IMAGE_LOOK_PROPERTIES = ["brightness", "contrast", "saturation", "warmth", "grayscale"];
const IMAGE_RESET_PROPERTIES = [...IMAGE_LOOK_PROPERTIES, "rotation", "frame", "radius"];
const IMAGE_STYLE_DEFAULTS = {
  ...DEFAULT_IMAGE_LOOK,
  rotation: 0,
  frame: "none",
  radius: 0,
};

function captureImageStyle(style, properties) {
  return Object.fromEntries(properties.map((property) => [property, style[property] ?? IMAGE_STYLE_DEFAULTS[property]]));
}

imagePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selected = getElement(state.selectedId);
    const preset = imagePresetById(button.dataset.imagePreset);
    if (!selected || selected.type !== "image" || !preset) return;
    const beforeStyle = captureImageStyle(selected.style, IMAGE_LOOK_PROPERTIES);
    const afterStyle = captureImageStyle(preset, IMAGE_LOOK_PROPERTIES);
    applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: afterStyle });
    render();
    recordDocumentCommand(
      { type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: afterStyle },
      { type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: beforeStyle },
    );
    showToast(`${preset.label} applied.`);
  });
});

btnImageReset.addEventListener("click", () => {
  const selected = getElement(state.selectedId);
  if (!selected || selected.type !== "image") return;
  const beforeStyle = captureImageStyle(selected.style, IMAGE_RESET_PROPERTIES);
  const afterStyle = captureImageStyle(IMAGE_STYLE_DEFAULTS, IMAGE_RESET_PROPERTIES);
  applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: afterStyle });
  render();
  recordDocumentCommand(
    { type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: afterStyle },
    { type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: beforeStyle },
  );
  showToast("Image adjustments reset.");
});

propFontSizePreset.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  if (!propFontSizePreset.value) return;
  const beforeValue = selected.style.fontSize;
  const afterValue = clamp(Number(propFontSizePreset.value), 12, 128);
  applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { fontSize: afterValue } });
  propFontSize.value = String(afterValue);
  render();
  commitStyleChange(selected, "style.fontSizePreset", beforeValue, afterValue);
});

propFontFamily.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.fontFamily;
  const afterValue = propFontFamily.value;
  applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { fontFamily: afterValue } });
  render();
  commitStyleChange(selected, "style.fontFamily", beforeValue, afterValue);
});

propFontWeight.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.fontWeight;
  const afterValue = clamp(Number(propFontWeight.value) || 300, 200, 700);
  applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { fontWeight: afterValue } });
  render();
  commitStyleChange(selected, "style.fontWeight", beforeValue, afterValue);
});

propSpacingBefore.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeLayout = captureElementLayoutState();
  const beforeSpacing = selected.spacingBefore || "normal";
  selected.spacingBefore = propSpacingBefore.value;
  if (state.layoutLocked) reflowFrom(0);
  render();
  commitAndSave("layout.spacingBefore", {
    id: selected.id,
    beforeSpacing,
    afterSpacing: selected.spacingBefore,
    beforeLayout,
    afterLayout: captureElementLayoutState(),
  });
});

propColor.addEventListener("input", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.color;
  const afterValue = normalizeTextColor(propColor.value);
  applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { color: afterValue } });
  render();
  updateCanvasPaletteUi();
  commitStyleChange(selected, "style.color", beforeValue, afterValue);
});

propFrame.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.frame;
  const afterValue = propFrame.value;
  applyDocumentCommandState({ type: DOCUMENT_COMMANDS.UPDATE_STYLE, id: selected.id, patch: { frame: afterValue } });
  render();
  commitStyleChange(selected, "style.imageFrame", beforeValue, afterValue);
});

function applyCanvasWidth() {
  const previousLayout = canvasLayoutForWidth(canvas.offsetWidth || authoredCanvasWidth());
  const nextWidth = authoredCanvasWidth();
  if (widthSelect.value === "custom") {
    customWrap.classList.remove("hidden");
  } else {
    customWrap.classList.add("hidden");
  }
  canvas.style.width = `${nextWidth}px`;
  const layout = canvasLayout();
  for (const item of state.elements) {
    if (Math.abs(item.x - layout.contentX) <= 100) item.x = layout.contentX;
    if (item.width >= previousLayout.contentWidth - 60) {
      item.width = layout.contentWidth;
      if (item.type === "image" && item.aspectRatio) {
        item.height = Math.max(120, Math.floor(item.width / item.aspectRatio));
      }
    }
  }
  if (state.layoutLocked) reflowFrom(0);
  if (state.zoomMode === "fit") {
    applyZoom("fit", { mode: "fit", persist: false });
  }
  syncLastCanvasWidthUiState();
  render();
}

widthSelect.addEventListener("change", () => {
  const beforeLayout = captureElementLayoutState();
  const beforeUi = { ...state.lastCanvasWidthUi };
  applyCanvasWidth();
  commitAndSave("layout.canvasWidth", {
    beforeUi,
    afterUi: captureCanvasWidthUiState(),
    beforeLayout,
    afterLayout: captureElementLayoutState(),
  });
});
customWidth.addEventListener("input", () => {
  const beforeLayout = captureElementLayoutState();
  const beforeUi = { ...state.lastCanvasWidthUi };
  applyCanvasWidth();
  commitAndSave("layout.canvasWidth", {
    beforeUi,
    afterUi: captureCanvasWidthUiState(),
    beforeLayout,
    afterLayout: captureElementLayoutState(),
  });
});

canvasBgInput.addEventListener("input", (ev) => {
  applyCanvasBackground(ev.target.value, { persist: true });
});

canvasBgPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyCanvasBackground(button.dataset.canvasBg, { persist: true });
  });
});

btnCanvasBgReset?.addEventListener("click", () => {
  applyThemePalette(state.themeMode, { persist: true });
});

document.getElementById("btn-export").addEventListener("click", async () => {
  setGenerateButtonState(true);
  try {
    const delivery = await exportRaster();
    const sizeLabel = delivery.size ? `${(delivery.size / (1024 * 1024)).toFixed(1)} MB` : "";
    if (delivery.method === "share") {
      showToast(`${delivery.count === 2 ? "Two images" : "Image"} ready${sizeLabel ? ` · ${sizeLabel}` : ""}. Use the share menu to save ${delivery.count === 2 ? "both files" : "it"}.`);
    } else if (delivery.method === "cancelled") {
      showToast("Export cancelled.");
    } else if (delivery.mobile) {
      showToast(`${delivery.count === 2 ? "Two images" : "Image"} ready${sizeLabel ? ` · ${sizeLabel}` : ""}. If it opens in a tab, use Share → Save Image.`);
    } else {
      showToast(`${delivery.count === 2 ? "2 " : ""}${exportFormat.value.toUpperCase()}${delivery.count === 2 ? " files" : ""} · ${sizeLabel} exported successfully to your downloads.`);
    }
  } catch (err) {
    console.error(err);
    showToast("Export failed. Try PNG first, or use Export HTML from the menu.", "error");
  } finally {
    setGenerateButtonState(false);
  }
});

btnMobileExport?.addEventListener("click", () => {
  closeMobilePanels();
  btnExport.click();
});

mobileSheetCloseButtons.forEach((button) => {
  button.addEventListener("click", closeMobilePanels);
});

document.getElementById("btn-export-html").addEventListener("click", () => {
  void exportHtml();
});

btnToggleLock.addEventListener("click", () => {
  const beforeLayout = captureElementLayoutState();
  const beforeLocked = state.layoutLocked;
  setLayoutLocked(!state.layoutLocked);
  if (state.layoutLocked) {
    sortElementsByPosition();
    reflowFrom(0);
    render();
  } else {
    render();
  }
  commitAndSave("layout.lockToggle", {
    beforeLocked,
    afterLocked: state.layoutLocked,
    beforeLayout,
    afterLayout: captureElementLayoutState(),
  });
});

btnUndo.addEventListener("click", () => {
  if (undoHistory()) syncRestoredHistoryState();
});

btnRedo.addEventListener("click", () => {
  if (redoHistory()) syncRestoredHistoryState();
});

btnBold.addEventListener("click", (ev) => {
  ev.preventDefault();
});

btnBold.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("bold");
});

btnBold.addEventListener("pointerup", (ev) => {
  ev.preventDefault();
});

btnItalic.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("italic");
});

btnBulletList?.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("insertUnorderedList");
});

btnNumberList?.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("insertOrderedList");
});

btnClearFormat.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("removeFormat");
});

btnThemeMode.addEventListener("click", () => {
  cycleThemeMode();
});

btnThemeModeMobile?.addEventListener("click", () => {
  cycleThemeMode();
});

bindShellEvents({
  onEscape: () => {
    closeToolbarMenus();
    closeDocDrawer();
    closeMobilePanels();
  },
  onOpenMobileElements: () => {
    const nextOpen = !document.body.classList.contains("mobile-panel-left-open");
    if (!nextOpen) {
      closeMobilePanels();
      return;
    }
    openMobilePanel("left");
  },
  onOpenMobileSettings: () => {
    const nextOpen = !document.body.classList.contains("mobile-panel-right-open");
    if (!nextOpen) {
      closeMobilePanels();
      return;
    }
    openMobilePanel("right");
  },
  onZoomChange: () => {
    saveSession();
  },
});

docSelect.addEventListener("change", async () => {
  await switchDocument(docSelect.value);
  syncAppliedDocState({ hydrate: true, pushInitialHistory: true });
});

btnDocNew.addEventListener("click", async () => {
  await createNewDocument();
  syncAppliedDocState({ hydrate: true, pushInitialHistory: true });
  closeDocDrawer();
});

btnDocRename.addEventListener("click", async () => {
  await renameCurrentDocument();
  renderDocDrawer();
});

btnDocDelete.addEventListener("click", async () => {
  await deleteCurrentDocument();
  syncAppliedDocState({ hydrate: true, pushInitialHistory: true });
  closeDocDrawer();
});

function syncExportOptionsUi() {
  const format = exportFormat.value.toUpperCase();
  const scale = `${exportScale.value}×`;
  const delivery = exportPagination?.value === "split" ? " · 2 files" : "";
  if (exportOptionsSummary) exportOptionsSummary.textContent = `${format} · ${scale}${delivery}`;
  exportQualityField?.classList.toggle("hidden", exportFormat.value === "png");
  if (!exportPreset) return;
  const signature = `${exportFormat.value}:${exportScale.value}:${exportQuality.value}`;
  const presetBySignature = {
    "jpg:1:0.82": "compact",
    "jpg:2:0.88": "balanced",
  };
  exportPreset.value = exportFormat.value === "png" && exportScale.value === "2"
    ? "maximum"
    : presetBySignature[signature] || "custom";
}

function applyExportPreset(preset) {
  const settings = {
    compact: { format: "jpg", scale: "1", quality: "0.82" },
    balanced: { format: "jpg", scale: "2", quality: "0.88" },
    maximum: { format: "png", scale: "2", quality: "0.96" },
  }[preset];
  if (!settings) return;
  exportFormat.value = settings.format;
  exportScale.value = settings.scale;
  exportQuality.value = settings.quality;
  syncExportOptionsUi();
  saveSession();
}

exportPreset?.addEventListener("change", () => applyExportPreset(exportPreset.value));

exportFormat.addEventListener("change", () => {
  syncExportOptionsUi();
  saveSession();
});

exportScale.addEventListener("change", () => {
  syncExportOptionsUi();
  saveSession();
});
exportQuality.addEventListener("change", saveSession);
exportPagination?.addEventListener("change", () => {
  syncExportOptionsUi();
  saveSession();
});
exportAppearance.addEventListener("change", saveSession);

setLayoutLocked(true);
applyThemeMode("night");
async function initApp() {
  const restored = await restoreSession();
  if (!restored) {
    await buildStarterDoc(createDocRecord("Untitled Plog"));
  }
  syncAppliedDocState({ hydrate: true, pushInitialHistory: true });
  syncResponsiveShell();
  document.body.dataset.appReady = "true";
}

initApp().catch((err) => {
  document.body.dataset.appReady = "error";
  console.error("Failed to initialize app", err);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void flushSaveSession();
});

window.addEventListener("pagehide", () => {
  void flushSaveSession();
});

window.addEventListener("beforeunload", () => {
  void flushSaveSession();
});
