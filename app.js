import { createTextDialog } from "./js/dialog.js";
import { authoredCanvasWidthFromControls, canvasLayoutForWidth, flowVerticalElements, requiredCanvasHeight } from "./js/canvas-layout.js";
import { createDocStoreManager } from "./js/doc-store.js";
import { createEditorRenderManager } from "./js/editor-render.js";
import { createExportManager } from "./js/export-manager.js";
import { createHistoryManager } from "./js/history-manager.js";
import { createStateRenderer } from "./js/render-state.js";
import { createShellManager } from "./js/shell-manager.js";
import { idbDeleteAsset, idbGetAsset, idbSetAsset, normalizeImageAsset } from "./js/storage.js";

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
const canvasBgInput = document.getElementById("canvas-bg");
const btnCanvasBgReset = document.getElementById("btn-canvas-bg-reset");
const canvasPaletteStatus = document.getElementById("canvas-palette-status");
const importQuality = document.getElementById("import-quality");
const importQualityValue = document.getElementById("import-quality-value");
const canvasBgPresetButtons = [...document.querySelectorAll("[data-canvas-bg]")];
const propRotation = document.getElementById("prop-rotation");
const propBrightness = document.getElementById("prop-brightness");
const propContrast = document.getElementById("prop-contrast");
const propGrayscale = document.getElementById("prop-grayscale");
const propFrame = document.getElementById("prop-frame");
const imageControls = document.getElementById("image-controls");
const textFormattingControls = document.getElementById("text-formatting-controls");
const btnMobileElements = document.getElementById("btn-mobile-elements");
const btnMobileSettings = document.getElementById("btn-mobile-settings");
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
const appToast = document.getElementById("app-toast");
const canvasSummary = document.getElementById("canvas-summary");
let toastTimer = null;
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
};

propFontSize.dataset.historyKind = "style.fontSize";
propRotation.dataset.historyKind = "style.imageRotation";
propBrightness.dataset.historyKind = "style.imageBrightness";
propContrast.dataset.historyKind = "style.imageContrast";
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
      exportFormat: "png",
      exportQuality: "0.9",
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
  label.textContent = loading ? "Generating…" : "Generate design";
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
  const themeLabel = state.themeMode === "day" ? "Day" : "Night";
  canvasPaletteStatus.textContent = auto
    ? "Theme default colors follow day and night automatically."
    : "Using custom canvas colors. Theme switches will keep them until you reset.";
  btnCanvasBgReset.textContent = auto ? `Reapply ${themeLabel} Default` : `Use ${themeLabel} Default`;
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
    elNoSelection,
    imageControls,
    inspector,
    propBrightness,
    propColor,
    propContrast,
    propFontFamily,
    propFontSize,
    propFontSizePreset,
    propFontWeight,
    propFrame,
    propGrayscale,
    propRotation,
    propSpacingBefore,
    propType,
    textFormattingControls,
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

function applyThemeMode(mode = state.themeMode) {
  const previousMode = state.themeMode;
  const shouldSyncPalette = canvasUsesThemeDefaults(previousMode);
  state.themeMode = mode === "day" ? "day" : "night";
  const dark = state.themeMode === "night";
  document.body.classList.toggle("theme-dark", dark);
  canvas.dataset.theme = dark ? "dark" : "light";
  if (shouldSyncPalette) {
    applyThemePalette(state.themeMode);
  } else {
    applyCanvasBackground(currentCanvasBackground());
  }
  if (btnThemeMode) {
    const label = state.themeMode.charAt(0).toUpperCase() + state.themeMode.slice(1);
    btnThemeMode.textContent = `Theme: ${label}`;
  }
  saveSession();
}

function syncAppliedDocState({ hydrate = true, pushInitialHistory = false } = {}) {
  applyCanvasWidth();
  applyZoom(state.zoomMode === "fit" ? "fit" : state.zoom, { mode: state.zoomMode, persist: false });
  applyThemeMode(state.themeMode);
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

function commitStyleChange(selected, kind, beforeValue, afterValue) {
  const property = STYLE_PROPERTY_BY_KIND[kind];
  if (!selected || !property) {
    commitAndSave(kind);
    return;
  }
  commitAndSave(kind, {
    id: selected.id,
    property,
    beforeValue,
    afterValue,
  });
}

function syncRestoredHistoryState() {
  applyCanvasWidth();
  applyZoom(state.zoomMode === "fit" ? "fit" : state.zoom, { mode: state.zoomMode, persist: false });
  applyThemeMode(state.themeMode);
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

  const addDemoElement = (item) => state.elements.push(item);
  addDemoElement(createElement("header", {
    content: {
      title: "The Walk Before the City Wakes",
      titleHtml: "The Walk Before the City Wakes",
      meta: "06:42 · Sunday",
      metaHtml: "06:42 · Sunday",
    },
    spacingBefore: "normal",
    style: { fontSize: 74, color: "#232038", radius: 0, fontFamily: "fangzheng", fontWeight: 600 },
  }));
  addDemoElement(createElement("text", {
    content: "At 6:42, the streets were still holding their breath. I left my phone on silent and followed the light toward the old reservoir.",
    html: "At <strong>6:42</strong>, the streets were still holding their breath. I left my phone on silent and followed the light toward the <em>old reservoir</em>.",
    spacingBefore: "section",
    style: { fontSize: 38, color: "#232038", radius: 0, fontFamily: "fangzheng", fontWeight: 400 },
  }));
  addDemoElement(createElement("image", {
    src: new URL("./assets/build-week-demo.svg", window.location.href).href,
    aspectRatio: 16 / 9,
    spacingBefore: "normal",
    style: { radius: 18, rotation: 0, brightness: 100, contrast: 100, grayscale: 0, frame: "none" },
  }));
  addDemoElement(createElement("text", {
    content: "What I noticed:\nThe first bus sounded farther away than usual.\nA baker unlocked the corner shop.\nSunlight arrived before the crowd did.",
    html: "<strong>What I noticed</strong><ul><li>The first bus sounded farther away than usual.</li><li>A baker unlocked the corner shop.</li><li>Sunlight arrived before the crowd did.</li></ul>",
    spacingBefore: "section",
    style: { fontSize: 36, color: "#232038", radius: 0, fontFamily: "fangzheng", fontWeight: 400 },
  }));
  addDemoElement(createElement("quote", {
    content: "A long story should feel composed, not assembled.",
    html: "A long story should feel <em>composed</em>, not assembled.",
    spacingBefore: "section",
    style: { fontSize: 42, color: "#4a416b", radius: 0, fontFamily: "fangzheng", fontWeight: 500 },
  }));
  addDemoElement(createElement("text", {
    content: "By the time the city became loud again, the page was already complete: every block in order, every gap intentional, and the canvas exactly as long as the story needed.",
    html: "By the time the city became loud again, the page was already complete: every block in order, every gap intentional, and the canvas exactly as long as the story needed.",
    spacingBefore: "section",
    style: { fontSize: 38, color: "#232038", radius: 0, fontFamily: "fangzheng", fontWeight: 400 },
  }));

  setLayoutLocked(true);
  applyThemeMode("day");
  applyThemePalette("day");
  reflowFrom(0);
  state.history = [];
  state.historyIndex = -1;
  syncAppliedDocState({ hydrate: false, pushInitialHistory: true });
  await flushSaveSession();
  renderDocDrawer();
  showToast("Example loaded. Edit any block, then generate the finished design.");
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
  if (editable.classList.contains("content")) {
    current.html = editable.innerHTML || "";
    current.content = editable.innerText || "";
  }
  if (editable.classList.contains("quote-content")) {
    current.html = editable.innerHTML || "";
    current.content = editable.innerText || "";
  }
  if (editable.classList.contains("card-title")) {
    current.content.titleHtml = editable.innerHTML || "";
    current.content.title = editable.innerText || "";
  }
  if (editable.classList.contains("card-body")) {
    current.content.bodyHtml = editable.innerHTML || "";
    current.content.body = editable.innerText || "";
  }
  if (editable.classList.contains("header-title")) {
    current.content.titleHtml = editable.innerHTML || "";
    current.content.title = editable.innerText || "";
  }
  if (editable.classList.contains("header-meta")) {
    current.content.metaHtml = editable.innerHTML || "";
    current.content.meta = editable.innerText || "";
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
  commitAndSave("content.richTextFormat", current ? {
    id: current.id,
    beforeContentState,
    afterContentState: captureElementContentState(current),
    beforeLayout,
    afterLayout: captureElementLayoutState(),
  } : null);
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
    commitAndSave("content.edit", {
      id: current.id,
      beforeContentState: session.beforeContentState,
      afterContentState,
      beforeLayout: session.beforeLayout,
      afterLayout: captureElementLayoutState(),
    });
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
    state.elements.splice(insertedIndex, 0, item);
  } else {
    insertedIndex = state.elements.length;
    state.elements.push(item);
  }
  state.selectedId = item.id;
  if (state.layoutLocked) reflowFrom(0);
  render();
  requestAnimationFrame(() => {
    const node = getElementNode(item.id);
    node?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  });
  commitAndSave("structure.insert", {
    index: insertedIndex,
    item,
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

document.addEventListener("mousemove", (ev) => {
  if (!state.drag && !state.resize) return;
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

document.addEventListener("mouseup", () => {
  const interaction = state.drag || state.resize;
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
});

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
    const deletedIndex = state.elements.findIndex((item) => item.id === selected.id);
    const deletedItem = deletedIndex >= 0 ? state.elements[deletedIndex] : null;
    state.elements = state.elements.filter((item) => item.id !== selected.id);
    state.selectedId = null;
    render();
    commitAndSave("structure.delete", deletedItem ? {
      index: deletedIndex,
      item: deletedItem,
    } : null);
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
    selected.style.fontWeight = current >= 500 ? 300 : 500;
    render();
    commitStyleChange(selected, "style.fontWeightToggle", beforeValue, selected.style.fontWeight);
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

canvas.addEventListener("mousedown", (ev) => {
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
        meta: "[Aug. 2020]",
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

document.getElementById("input-image").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  let assetBlob;
  try {
    const quality = Math.max(0.8, Math.min(1, (Number(importQuality?.value) || 96) / 100));
    assetBlob = await normalizeImageAsset(file, { quality });
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

importQuality?.addEventListener("input", () => {
  if (importQualityValue) importQualityValue.textContent = importQuality.value;
});

document.getElementById("btn-delete").addEventListener("click", () => {
  if (!state.selectedId) return;
  const deletedIndex = state.elements.findIndex((item) => item.id === state.selectedId);
  const deletedItem = deletedIndex >= 0 ? state.elements[deletedIndex] : null;
  state.elements = state.elements.filter((item) => item.id !== state.selectedId);
  state.selectedId = null;
  render();
  commitAndSave("structure.delete", deletedItem ? {
    index: deletedIndex,
    item: deletedItem,
  } : null);
});

function wireInspectorNumber(input, updater) {
  input.addEventListener("input", () => {
    const selected = getElement(state.selectedId);
    if (!selected) return;
    const kind = input.dataset.historyKind || "style.numeric";
    const property = STYLE_PROPERTY_BY_KIND[kind];
    const beforeValue = property ? selected.style[property] : null;
    updater(selected, Number(input.value));
    render();
    const afterValue = property ? selected.style[property] : null;
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

wireInspectorNumber(propGrayscale, (selected, value) => {
  selected.style.grayscale = clamp(value || 0, 0, 100);
});

propFontSizePreset.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  if (!propFontSizePreset.value) return;
  const beforeValue = selected.style.fontSize;
  selected.style.fontSize = clamp(Number(propFontSizePreset.value), 12, 128);
  propFontSize.value = String(selected.style.fontSize);
  render();
  commitStyleChange(selected, "style.fontSizePreset", beforeValue, selected.style.fontSize);
});

propFontFamily.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.fontFamily;
  selected.style.fontFamily = propFontFamily.value;
  render();
  commitStyleChange(selected, "style.fontFamily", beforeValue, selected.style.fontFamily);
});

propFontWeight.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.fontWeight;
  selected.style.fontWeight = clamp(Number(propFontWeight.value) || 300, 200, 700);
  render();
  commitStyleChange(selected, "style.fontWeight", beforeValue, selected.style.fontWeight);
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
  selected.style.color = normalizeTextColor(propColor.value);
  render();
  updateCanvasPaletteUi();
  commitStyleChange(selected, "style.color", beforeValue, selected.style.color);
});

propFrame.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  const beforeValue = selected.style.frame;
  selected.style.frame = propFrame.value;
  render();
  commitStyleChange(selected, "style.imageFrame", beforeValue, selected.style.frame);
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
    await exportRaster();
    showToast(`${exportFormat.value.toUpperCase()} exported successfully to your downloads.`);
  } catch (err) {
    console.error(err);
    showToast("Generation failed. Try PNG first, or use Export HTML from the menu.", "error");
  } finally {
    setGenerateButtonState(false);
  }
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

btnBold.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("bold");
});

btnBold.addEventListener("mouseup", (ev) => {
  ev.preventDefault();
});

btnItalic.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("italic");
});

btnBulletList?.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("insertUnorderedList");
});

btnNumberList?.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("insertOrderedList");
});

btnClearFormat.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("removeFormat");
});

btnThemeMode.addEventListener("click", () => {
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

exportFormat.addEventListener("change", () => {
  const formatLabel = btnExport.querySelector("small");
  if (formatLabel) formatLabel.textContent = exportFormat.value.toUpperCase();
  saveSession();
});

exportQuality.addEventListener("change", saveSession);
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
}

initApp().catch((err) => {
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
