import { createTextDialog } from "./js/dialog.js";
import { authoredCanvasWidthFromControls, canvasLayoutForWidth } from "./js/canvas-layout.js";
import { createDocStoreManager } from "./js/doc-store.js";
import { createExportManager } from "./js/export-manager.js";
import { createShellManager } from "./js/shell-manager.js";
import { idbDeleteAsset, idbGetAsset, idbSetAsset } from "./js/storage.js";

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
  savedSelection: null,
  savedSelectionElementId: null,
  savedSelectionTarget: null,
  themeMode: "night",
  docs: [],
  currentDocId: null,
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
const btnClearFormat = document.getElementById("btn-clear-format");
const btnThemeMode = document.getElementById("btn-theme-mode");
const docSelect = document.getElementById("doc-select");
const btnDocNew = document.getElementById("btn-doc-new");
const btnDocRename = document.getElementById("btn-doc-rename");
const btnDocDelete = document.getElementById("btn-doc-delete");
const exportFormat = document.getElementById("export-format");
const exportQuality = document.getElementById("export-quality");
const exportAppearance = document.getElementById("export-appearance");
const propRotation = document.getElementById("prop-rotation");
const propBrightness = document.getElementById("prop-brightness");
const propContrast = document.getElementById("prop-contrast");
const propGrayscale = document.getElementById("prop-grayscale");
const propFrame = document.getElementById("prop-frame");
const imageControls = document.getElementById("image-controls");
const btnMobileElements = document.getElementById("btn-mobile-elements");
const btnMobileSettings = document.getElementById("btn-mobile-settings");
const mobilePanelBackdrop = document.getElementById("mobile-panel-backdrop");
const dialogBackdrop = document.getElementById("dialog-backdrop");
const dialogTitle = document.getElementById("dialog-title");
const dialogMessage = document.getElementById("dialog-message");
const dialogInput = document.getElementById("dialog-input");
const dialogCancel = document.getElementById("dialog-cancel");
const dialogConfirm = document.getElementById("dialog-confirm");

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
      canvasBg: "#ffffff",
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
      color: "#1f1f22",
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
  const node = canvas.querySelector(`[data-id="${id}"]`);
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

function plainTextFromHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html || "";
  return temp.innerText || "";
}

function currentExportAppearance() {
  if (exportAppearance.value === "match") {
    return state.themeMode === "night" ? "dark" : "light";
  }
  return exportAppearance.value === "dark" ? "dark" : "light";
}

function exportPalette() {
  const appearance = currentExportAppearance();
  return {
    appearance,
    background: appearance === "dark" ? "#14110d" : "#ffffff",
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

const openTextDialog = createTextDialog({
  backdrop: dialogBackdrop,
  titleEl: dialogTitle,
  messageEl: dialogMessage,
  inputEl: dialogInput,
  cancelBtn: dialogCancel,
  confirmBtn: dialogConfirm,
});

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
  getCanvasBackground: () => document.getElementById("canvas-bg").value,
  setCanvasBackground: (value) => {
    document.getElementById("canvas-bg").value = value;
  },
  serializeElementsForStorage,
  clearAssetUrls,
  hydrateAssetSources,
  setLayoutLocked,
  applyCanvasWidth,
  applyZoom,
  applyThemeMode,
  flushRender,
  pushHistory,
  createDefaultDocData,
  createDocRecord,
  addElement,
  createElement,
  deleteImageAssetsForItems,
  openTextDialog,
});

const {
  applyDocData,
  buildStarterDoc,
  createNewDocument,
  deleteCurrentDocument,
  flushSaveSession,
  renameCurrentDocument,
  restoreSession,
  saveSession,
  switchDocument,
} = docStore;

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

const { exportHtml, exportRaster } = exportManager;

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
  saveSession,
  authoredCanvasWidth,
});

const {
  applyZoom,
  bindEvents: bindShellEvents,
  closeMobilePanels,
  openMobilePanel,
  syncResponsiveShell,
  syncZoomControl,
  updateViewportMetrics,
} = shellManager;

function applyThemeMode(mode = state.themeMode) {
  state.themeMode = mode === "day" ? "day" : "night";
  const dark = state.themeMode === "night";
  document.body.classList.toggle("theme-dark", dark);
  canvas.dataset.theme = dark ? "dark" : "light";
  const pickerBg = document.getElementById("canvas-bg").value || "#ffffff";
  canvas.style.background = dark ? "#14110d" : pickerBg;
  if (btnThemeMode) {
    const label = state.themeMode.charAt(0).toUpperCase() + state.themeMode.slice(1);
    btnThemeMode.textContent = `Theme: ${label}`;
  }
  saveSession();
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
  if (!restoreSavedSelection(active, range)) return false;
  const { startMarker, endMarker, commandRange } = placeSelectionMarkers(range);
  if (!restoreSavedSelection(active, commandRange)) return false;
  try {
    document.execCommand("styleWithCSS", false, "false");
  } catch {}
  const applied = document.execCommand(command, false, value);
  if (!applied) {
    startMarker.remove();
    endMarker.remove();
    return false;
  }
  restoreSelectionFromMarkers(startMarker, endMarker);
  updateEditableStateFromDom(active);
  syncSelectionSnapshot();
  const host = active.closest(".el");
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
  commitMutation();
  return true;
}

function cloneStateForHistory() {
  return JSON.parse(
    JSON.stringify({
      elements: state.elements,
      selectedId: state.selectedId,
      seq: state.seq,
      layoutLocked: state.layoutLocked,
      zoom: state.zoom,
      ui: {
        widthSelect: widthSelect.value,
        customWidth: customWidth.value,
        canvasBg: document.getElementById("canvas-bg").value,
        exportScale: exportScale.value,
        exportFormat: exportFormat.value,
        exportQuality: exportQuality.value,
        exportAppearance: exportAppearance.value,
        zoomMode: state.zoomMode,
        themeMode: state.themeMode,
      },
    }),
  );
}

function pushHistory() {
  if (state.suppressHistory) return;
  const snapshot = cloneStateForHistory();
  const current = state.history[state.historyIndex];
  if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
}

function commitMutation() {
  pushHistory();
  saveSession();
}

function restoreHistorySnapshot(snapshot) {
  state.suppressHistory = true;
  state.elements = snapshot.elements || [];
  state.selectedId = snapshot.selectedId || null;
  state.seq = snapshot.seq || 1;
  state.savedSelection = null;
  state.savedSelectionElementId = null;
  state.savedSelectionTarget = null;
  setLayoutLocked(snapshot.layoutLocked !== false);
  state.zoom = snapshot.zoom || 1;
  widthSelect.value = snapshot.ui?.widthSelect || widthSelect.value;
  customWidth.value = snapshot.ui?.customWidth || customWidth.value;
  document.getElementById("canvas-bg").value = snapshot.ui?.canvasBg || "#ffffff";
  exportScale.value = snapshot.ui?.exportScale || exportScale.value;
  exportFormat.value = snapshot.ui?.exportFormat || exportFormat.value;
  exportQuality.value = snapshot.ui?.exportQuality || exportQuality.value;
  exportAppearance.value = snapshot.ui?.exportAppearance || exportAppearance.value;
  state.zoomMode = snapshot.ui?.zoomMode === "manual" ? "manual" : "fit";
  state.themeMode = snapshot.ui?.themeMode === "day" ? "day" : "night";
  applyCanvasWidth();
  canvas.style.background = document.getElementById("canvas-bg").value;
  applyZoom(state.zoomMode === "fit" ? "fit" : state.zoom, { mode: state.zoomMode, persist: false });
  applyThemeMode(state.themeMode);
  flushRender();
  document.getElementById("btn-export").textContent = `Export ${exportFormat.value.toUpperCase()}`;
  state.suppressHistory = false;
}

function undoHistory() {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  restoreHistorySnapshot(state.history[state.historyIndex]);
}

function redoHistory() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  restoreHistorySnapshot(state.history[state.historyIndex]);
}

function updateCanvasHeight() {
  let maxBottom = 1000;
  for (const item of state.elements) {
    maxBottom = Math.max(maxBottom, item.y + item.height + 160);
  }
  canvas.style.minHeight = `${maxBottom}px`;
}

function familyCss(item) {
  return FONT_MAP[item.style.fontFamily] || FONT_MAP.fangzheng;
}

function syncInspector() {
  const selected = getElement(state.selectedId);
  if (!selected) {
    elNoSelection.classList.remove("hidden");
    inspector.classList.add("hidden");
    return;
  }

  elNoSelection.classList.add("hidden");
  inspector.classList.remove("hidden");
  propType.value = selected.type;
  propFontSize.value = selected.style.fontSize ?? 60;
  propFontSizePreset.value = String(selected.style.fontSize ?? "");
  propFontFamily.value = selected.style.fontFamily ?? "fangzheng";
  propFontWeight.value = String(selected.style.fontWeight ?? 300);
  propSpacingBefore.value = selected.spacingBefore ?? "normal";
  propColor.value = selected.style.color ?? "#1f1f22";
  propRotation.value = String(selected.style.rotation ?? 0);
  propBrightness.value = String(selected.style.brightness ?? 100);
  propContrast.value = String(selected.style.contrast ?? 100);
  propGrayscale.value = String(selected.style.grayscale ?? 0);
  propFrame.value = selected.style.frame ?? "none";
  imageControls.classList.toggle("hidden", selected.type !== "image");

  const textLike = selected.type === "text" || selected.type === "header" || selected.type === "quote" || selected.type === "card";
  propFontSize.disabled = !textLike;
  propFontSizePreset.disabled = !textLike;
  propFontFamily.disabled = !textLike;
  propFontWeight.disabled = !textLike;
  propColor.disabled = selected.type === "divider";
}

function setLayoutLocked(next) {
  state.layoutLocked = next;
  document.body.classList.toggle("layout-locked", state.layoutLocked);
  btnToggleLock.textContent = state.layoutLocked ? "Layout Locked" : "Layout Unlocked";
}

function setupNodeOnce(node) {
  const syncEditableItem = (editable) => {
    const host = editable.closest(".el");
    const current = host ? getElement(host.dataset.id) : null;
    if (!current) return;

    if (editable.classList.contains("content")) {
      current.html = editable.innerHTML || "";
      current.content = editable.innerText || "";
    } else if (editable.classList.contains("quote-content")) {
      current.html = editable.innerHTML || "";
      current.content = editable.innerText || "";
    } else if (editable.classList.contains("header-title")) {
      current.content.title = editable.innerText || "";
      current.content.titleHtml = editable.innerHTML || "";
    } else if (editable.classList.contains("header-meta")) {
      current.content.meta = editable.innerText || "";
      current.content.metaHtml = editable.innerHTML || "";
    } else if (editable.classList.contains("card-title")) {
      current.content.title = editable.innerText || "";
      current.content.titleHtml = editable.innerHTML || "";
    } else if (editable.classList.contains("card-body")) {
      current.content.body = editable.innerText || "";
      current.content.bodyHtml = editable.innerHTML || "";
    }

    reflowAfterElement(current.id);
    render();
    saveSession();
  };

  const content = node.querySelector(".content");
  if (content) {
    content.addEventListener("input", () => syncEditableItem(content));
  }

  if (node.dataset.type === "header") {
    const title = node.querySelector(".header-title");
    const meta = node.querySelector(".header-meta");
    title.addEventListener("input", () => syncEditableItem(title));
    meta.addEventListener("input", () => syncEditableItem(meta));
  }

  if (node.dataset.type === "quote") {
    const quote = node.querySelector(".quote-content");
    quote.addEventListener("input", () => syncEditableItem(quote));
  }

  if (node.dataset.type === "card") {
    const cardTitle = node.querySelector(".card-title");
    const cardBody = node.querySelector(".card-body");
    cardTitle.addEventListener("input", () => syncEditableItem(cardTitle));
    cardBody.addEventListener("input", () => syncEditableItem(cardBody));
  }
}

function bindNodeEvents(node) {
  node.addEventListener("mousedown", (ev) => {
    const target = ev.target;
    const isResize = target.classList.contains("resize-handle");
    const isMoveHandle = target.classList.contains("move-handle");
    const isContent = target.getAttribute("contenteditable") === "true";
    const item = getElement(node.dataset.id);
    if (!item) return;
    state.selectedId = item.id;
    render();
    if (isContent) return;

    if (isResize) {
      state.resize = {
        id: item.id,
        originX: ev.clientX,
        originY: ev.clientY,
        baseWidth: item.width,
        baseHeight: item.height,
      };
      ev.preventDefault();
      return;
    }

    if (!isMoveHandle || state.layoutLocked) return;

    const rect = node.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    state.drag = {
      id: item.id,
      offsetX: ev.clientX - rect.left,
      offsetY: ev.clientY - rect.top,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
    };
    ev.preventDefault();
  });
}

function renderNow() {
  const existingIds = new Set();
  const layout = canvasLayout();

  for (const item of state.elements) {
    existingIds.add(item.id);
    if (item.width > layout.contentWidth) item.width = layout.contentWidth;
    let node = getElementNode(item.id);
    if (!node) {
      node = templateFor(item.type).content.firstElementChild.cloneNode(true);
      node.dataset.id = item.id;
      elementNodeCache.set(item.id, node);
      bindNodeEvents(node);
      setupNodeOnce(node);
      canvas.appendChild(node);
    }

    node.classList.toggle("selected", state.selectedId === item.id);
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    node.style.width = `${item.width}px`;
    node.style.height = `${item.height}px`;

    if (item.type === "text") {
      const content = node.querySelector(".content");
      const desiredHtml = item.html || "";
      if (content.innerHTML !== desiredHtml) {
        content.innerHTML = desiredHtml;
      }
      content.dataset.placeholder = item.placeholder || "Write your story...";
      content.style.fontSize = `${item.style.fontSize ?? 60}px`;
      content.style.color = item.style.color ?? "#1f1f22";
      content.style.fontFamily = familyCss(item);
      content.style.fontWeight = String(item.style.fontWeight ?? 300);
      content.style.lineHeight = "1.5";
      const measured = Math.max(52, Math.ceil(content.scrollHeight + 4));
      item.height = measured;
    }

    if (item.type === "image") {
      const img = node.querySelector("img");
      if (img.src !== item.src) img.src = item.src;
      img.style.borderRadius = `${item.style.radius ?? 0}px`;
      img.style.transform = `rotate(${item.style.rotation ?? 0}deg)`;
      img.style.filter = `brightness(${item.style.brightness ?? 100}%) contrast(${item.style.contrast ?? 100}%) grayscale(${item.style.grayscale ?? 0}%)`;
      node.classList.remove("frame-none", "frame-polaroid", "frame-card");
      node.classList.add(`frame-${item.style.frame ?? "none"}`);
    }

    if (item.type === "header") {
      const title = node.querySelector(".header-title");
      const meta = node.querySelector(".header-meta");
      if (!item.content || typeof item.content !== "object") {
        item.content = {
          title: "Prayer",
          meta: "[Aug. 2020]",
          titleHtml: "Prayer",
          metaHtml: "[Aug. 2020]",
        };
      }
      const desiredTitleHtml = item.content.titleHtml || item.content.title || "";
      const desiredMetaHtml = item.content.metaHtml || item.content.meta || "";
      if (document.activeElement !== title && title.innerHTML !== desiredTitleHtml) {
        title.innerHTML = desiredTitleHtml;
      }
      if (document.activeElement !== meta && meta.innerHTML !== desiredMetaHtml) {
        meta.innerHTML = desiredMetaHtml;
      }
      title.style.fontSize = `${item.style.fontSize ?? 62}px`;
      title.style.color = item.style.color ?? "#1f1f22";
      title.style.fontFamily = familyCss(item);
      title.style.fontWeight = String(item.style.fontWeight ?? 500);
      meta.style.fontFamily = familyCss(item);
      meta.style.fontWeight = "500";
      node.style.borderRadius = `${item.style.radius ?? 0}px`;
      const titleH = Math.max(40, Math.ceil(title.scrollHeight));
      const metaH = Math.max(58, Math.ceil(meta.scrollHeight));
      item.height = Math.max(90, Math.max(titleH, metaH) + 20);
      title.style.maxWidth = `${Math.max(180, layout.contentWidth - 300)}px`;
    }

    if (item.type === "quote") {
      const quote = node.querySelector(".quote-content");
      const desiredHtml = item.html || "";
      if (quote.innerHTML !== desiredHtml) quote.innerHTML = desiredHtml;
      quote.dataset.placeholder = item.placeholder || "Quote...";
      quote.style.fontFamily = familyCss(item);
      quote.style.fontSize = `${item.style.fontSize ?? 46}px`;
      quote.style.color = item.style.color ?? "#1f1f22";
      quote.style.fontWeight = String(item.style.fontWeight ?? 300);
      item.height = Math.max(130, Math.ceil(quote.scrollHeight + 66));
    }

    if (item.type === "card") {
      const cardTitle = node.querySelector(".card-title");
      const cardBody = node.querySelector(".card-body");
      if (!item.content || typeof item.content !== "object") {
        item.content = { title: "", body: "", titleHtml: "", bodyHtml: "" };
      }
      if (cardTitle.innerHTML !== (item.content.titleHtml || "")) cardTitle.innerHTML = item.content.titleHtml || "";
      if (cardBody.innerHTML !== (item.content.bodyHtml || "")) cardBody.innerHTML = item.content.bodyHtml || "";
      cardTitle.style.fontFamily = familyCss(item);
      cardTitle.style.fontWeight = "500";
      cardBody.style.fontFamily = familyCss(item);
      cardBody.style.color = item.style.color ?? "#1f1f22";
      cardBody.style.fontWeight = String(item.style.fontWeight ?? 300);
      item.height = Math.max(170, Math.ceil(cardTitle.scrollHeight + cardBody.scrollHeight + 56));
    }

    if (item.type === "divider") {
      node.querySelector(".divider-line").style.borderRadius = `${item.style.radius ?? 999}px`;
    }
  }

  canvas.querySelectorAll(".el").forEach((node) => {
    if (!existingIds.has(node.dataset.id)) {
      elementNodeCache.delete(node.dataset.id);
      node.remove();
    }
  });

  updateCanvasHeight();
  updateViewportMetrics();
  syncInspector();
}

function render() {
  if (state.renderScheduled) return;
  state.renderScheduled = true;
  state.renderFrame = window.requestAnimationFrame(() => {
    state.renderScheduled = false;
    state.renderFrame = 0;
    renderNow();
  });
}

function flushRender() {
  if (state.renderFrame) {
    window.cancelAnimationFrame(state.renderFrame);
    state.renderFrame = 0;
    state.renderScheduled = false;
  }
  renderNow();
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
  const anchor = getInsertionAnchor();
  if (anchor) {
    const anchorIndex = state.elements.findIndex((entry) => entry.id === anchor.id);
    state.elements.splice(anchorIndex + 1, 0, item);
  } else {
    state.elements.push(item);
  }
  state.selectedId = item.id;
  if (state.layoutLocked) reflowFrom(0);
  render();
  commitMutation();
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
  const ordered = state.elements;
  if (!ordered.length) return;
  let currentY = layout.topPad;
  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i];
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
    if (i >= startIndex) item.y = currentY;
    currentY = item.y + item.height;
  }
}

document.addEventListener("mousemove", (ev) => {
  if (!state.drag && !state.resize) return;
  const selected = getElement(state.drag?.id || state.resize?.id);
  if (!selected) return;

  if (state.drag) {
    const rawX = ev.clientX - state.drag.canvasLeft - state.drag.offsetX;
    const rawY = ev.clientY - state.drag.canvasTop - state.drag.offsetY;
    const freeX = clamp(rawX, 0, canvas.clientWidth - selected.width);
    selected.x = ev.shiftKey ? snapX(freeX) : canvasLayout().contentX;
    let y = clamp(stickyY(rawY, selected.id), 0, 100000);
    if (selected.spacingBefore === "section") {
      const above = state.elements
        .filter((item) => item.id !== selected.id && item.y <= y)
        .sort((a, b) => b.y - a.y)[0];
      if (above) {
        y = Math.max(y, above.y + above.height + SPACING_MAP.section - 6);
      }
    }
    selected.y = y;
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
  state.drag = null;
  state.resize = null;
  if (!interaction) return;
  if (activeId) reflowAfterElement(activeId);
  render();
  commitMutation();
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

  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === "z") {
    if (ev.shiftKey) redoHistory();
    else undoHistory();
    ev.preventDefault();
    return;
  }

  if ((ev.key === "Delete" || ev.key === "Backspace") && !isEditing) {
    if (!selected) return;
    state.elements = state.elements.filter((item) => item.id !== selected.id);
    state.selectedId = null;
    render();
    commitMutation();
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
    selected.style.fontWeight = current >= 500 ? 300 : 500;
    render();
    commitMutation();
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
      style: { fontSize: 62, color: "#20160f", radius: 0, fontFamily: "fangzheng" },
    }),
  );
});

document.getElementById("btn-add-quote").addEventListener("click", () => {
  addElement(createElement("quote", { content: "", spacingBefore: "normal" }));
});

document.getElementById("btn-add-card").addEventListener("click", () => {
  addElement(createElement("card", { spacingBefore: "section" }));
});

document.getElementById("input-image").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const tempUrl = URL.createObjectURL(file);

  let image;
  try {
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = tempUrl;
    });
  } finally {
    URL.revokeObjectURL(tempUrl);
  }

  const layout = canvasLayout();
  const width = layout.contentWidth;
  const aspectRatio = image.naturalWidth / image.naturalHeight;
  const height = Math.max(120, Math.floor(width / aspectRatio));
  const assetId = createAssetId();

  try {
    await idbSetAsset(assetId, file);
  } catch (err) {
    console.error("Failed to persist image asset", err);
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
      style: { radius: 0, fontSize: 60, color: "#1f1f22", fontFamily: "fangzheng" },
    }),
  );
  ev.target.value = "";
});

document.getElementById("btn-delete").addEventListener("click", () => {
  if (!state.selectedId) return;
  state.elements = state.elements.filter((item) => item.id !== state.selectedId);
  state.selectedId = null;
  render();
  commitMutation();
});

document.getElementById("btn-auto-stack").addEventListener("click", () => {
  reflowFrom(0);
  render();
  commitMutation();
});

function wireInspectorNumber(input, updater) {
  input.addEventListener("input", () => {
    const selected = getElement(state.selectedId);
    if (!selected) return;
    updater(selected, Number(input.value));
    render();
    commitMutation();
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
  selected.style.fontSize = clamp(Number(propFontSizePreset.value), 12, 128);
  propFontSize.value = String(selected.style.fontSize);
  render();
  commitMutation();
});

propFontFamily.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.fontFamily = propFontFamily.value;
  render();
  commitMutation();
});

propFontWeight.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.fontWeight = clamp(Number(propFontWeight.value) || 300, 200, 700);
  render();
  commitMutation();
});

propSpacingBefore.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.spacingBefore = propSpacingBefore.value;
  if (state.layoutLocked) reflowFrom(0);
  render();
  commitMutation();
});

propColor.addEventListener("input", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.color = propColor.value;
  render();
  commitMutation();
});

propFrame.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.frame = propFrame.value;
  render();
  commitMutation();
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
  render();
}

widthSelect.addEventListener("change", () => {
  applyCanvasWidth();
  commitMutation();
});
customWidth.addEventListener("input", () => {
  applyCanvasWidth();
  commitMutation();
});

document.getElementById("canvas-bg").addEventListener("input", (ev) => {
  const dark = state.themeMode === "night";
  canvas.style.background = dark ? "#14110d" : ev.target.value;
  saveSession();
});

function drawRoundedImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

async function renderCanvasFromState(scale, format) {
  const width = canvas.clientWidth;
  const height = canvas.offsetHeight;
  const palette = exportPalette();
  const out = document.createElement("canvas");
  out.width = width * scale;
  out.height = height * scale;
  const ctx = out.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.background;
  if (format === "jpg" && palette.appearance === "light") ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  for (const item of state.elements) {
    if (item.type === "image" && item.src) {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = item.src;
      });
      ctx.save();
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(((item.style.rotation ?? 0) * Math.PI) / 180);
      ctx.filter = `brightness(${item.style.brightness ?? 100}%) contrast(${item.style.contrast ?? 100}%) grayscale(${item.style.grayscale ?? 0}%)`;
      drawRoundedImage(ctx, img, -item.width / 2, -item.height / 2, item.width, item.height, item.style.radius ?? 0);
      ctx.restore();
      ctx.filter = "none";
      continue;
    }

    if (item.type === "divider") {
      ctx.fillStyle = "#8d684e";
      roundRect(ctx, item.x, item.y + 8, item.width, 3, 999);
      ctx.fill();
      continue;
    }

    if (item.type === "header") {
      drawRichTextBox(ctx, {
        ...item,
        width: Math.max(180, item.width - 300),
        html: item.content?.titleHtml || item.content?.title || "",
        style: { ...item.style, color: exportTextColor(item.style.color ?? "#1f1f22"), fontWeight: item.style.fontWeight ?? 500 },
      });
      const metaHtml = item.content?.metaHtml || item.content?.meta || "";
      const metaText = plainTextFromHtml(metaHtml);
      ctx.textAlign = "right";
      drawText(ctx, metaText, item.x + item.width, item.y + 62, 60, exportTextColor(item.style.color ?? "#1f1f22"), "500", familyCss(item));
      ctx.textAlign = "left";
      continue;
    }

    if (item.type === "quote") {
      ctx.fillStyle = palette.appearance === "dark" ? "rgba(255,248,239,0.08)" : "rgba(201,178,148,0.18)";
      ctx.fillRect(item.x, item.y, item.width, item.height);
      ctx.fillStyle = "#8d7354";
      ctx.fillRect(item.x, item.y, 6, item.height);
      drawRichTextBox(ctx, { ...item, html: item.html || item.content || "", style: { ...item.style, color: exportTextColor(item.style.color) } });
      continue;
    }

    if (item.type === "card") {
      ctx.fillStyle = palette.panel;
      roundRect(ctx, item.x, item.y, item.width, item.height, 14);
      ctx.fill();
      drawText(
        ctx,
        plainTextFromHtml(item.content?.titleHtml || item.content?.title || ""),
        item.x + 18,
        item.y + 52,
        52,
        exportTextColor(item.style.color ?? "#1f1f22"),
        "500",
        familyCss(item),
      );
      drawRichTextBox(ctx, {
        ...item,
        x: item.x + 18,
        y: item.y + 60,
        width: item.width - 36,
        html: item.content?.bodyHtml || item.content?.body || "",
        style: { ...item.style, color: exportTextColor(item.style.color) },
      });
      continue;
    }

    if (item.type === "markdown") {
      ctx.fillStyle = "#fffdfa";
      roundRect(ctx, item.x, item.y, item.width, item.height, 12);
      ctx.fill();
      drawTextBox(ctx, {
        ...item,
        x: item.x + 12,
        y: item.y + 12,
        width: item.width - 24,
        content: stripMarkdown(item.content || ""),
      });
      continue;
    }

    if (item.type === "text") {
      drawRichTextBox(ctx, { ...item, html: item.html || item.content || "", style: { ...item.style, color: exportTextColor(item.style.color) } });
    }
  }

  return out;
}

function drawTextBox(ctx, item) {
  const content = item.content || "";
  if (!content.trim()) return;
  const fontSize = item.style.fontSize ?? 60;
  const color = item.style.color ?? "#1f1f22";
  const family = familyCss(item);
  const weight = item.style.fontWeight ?? 300;
  const lines = wrapText(ctx, content, item.width, `${weight} ${fontSize}px ${family}`);
  ctx.fillStyle = color;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  const lineHeight = fontSize * 1.5;
  lines.forEach((line, idx) => {
    const y = item.y + lineHeight * (idx + 0.8);
    const isLast = idx === lines.length - 1;
    drawJustifiedLine(ctx, line, item.x, y, item.width, isLast);
  });
}

function drawText(ctx, text, x, y, size, color, weight = "400", family = FONT_MAP.fangzheng) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillText(text, x, y);
}

function htmlToRichTokens(html, style) {
  const root = document.createElement("div");
  root.innerHTML = html || "";
  const tokens = [];
  const base = {
    weight: Number(style.fontWeight ?? 300),
    italic: false,
  };

  function pushText(text, current) {
    if (!text) return;
    for (const ch of text.replace(/\r/g, "")) {
      tokens.push({
        text: ch,
        weight: current.weight,
        italic: current.italic,
      });
    }
  }

  function walk(node, current) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent || "", current);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    const next = {
      weight: current.weight,
      italic: current.italic,
    };

    if (tag === "strong" || tag === "b") next.weight = Math.max(current.weight, 700);
    if (tag === "em" || tag === "i") next.italic = true;
    if (tag === "br") {
      tokens.push({ text: "\n", weight: current.weight, italic: current.italic });
      return;
    }

    const blockLike = tag === "div" || tag === "p";
    if (blockLike && tokens.length) {
      const last = tokens[tokens.length - 1];
      if (last.text !== "\n") tokens.push({ text: "\n", weight: current.weight, italic: current.italic });
    }

    Array.from(node.childNodes).forEach((child) => walk(child, next));

    if (blockLike && tokens.length) {
      const last = tokens[tokens.length - 1];
      if (last.text !== "\n") tokens.push({ text: "\n", weight: current.weight, italic: current.italic });
    }
  }

  Array.from(root.childNodes).forEach((child) => walk(child, base));
  while (tokens.length && tokens[tokens.length - 1].text === "\n") tokens.pop();
  return tokens;
}

function measureRichToken(ctx, token, fontSize, family) {
  const fontStyle = token.italic ? "italic " : "";
  ctx.font = `${fontStyle}${token.weight} ${fontSize}px ${family}`;
  return ctx.measureText(token.text).width;
}

function drawRichTextBox(ctx, item) {
  const html = item.html || "";
  if (!html.trim()) return false;
  const fontSize = item.style.fontSize ?? 60;
  const color = item.style.color ?? "#1f1f22";
  const family = familyCss(item);
  const lineHeight = fontSize * 1.5;
  const tokens = htmlToRichTokens(html, item.style);
  if (!tokens.length) return false;

  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const token of tokens) {
    if (token.text === "\n") {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
      continue;
    }
    const tokenWidth = measureRichToken(ctx, token, fontSize, family);
    if (currentWidth + tokenWidth > item.width && currentLine.length) {
      lines.push(currentLine);
      currentLine = [token];
      currentWidth = tokenWidth;
    } else {
      currentLine.push(token);
      currentWidth += tokenWidth;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  lines.forEach((line, index) => {
    let cursorX = item.x;
    const y = item.y + lineHeight * (index + 0.8);
    line.forEach((token) => {
      const fontStyle = token.italic ? "italic " : "";
      ctx.fillStyle = color;
      ctx.font = `${fontStyle}${token.weight} ${fontSize}px ${family}`;
      ctx.fillText(token.text, cursorX, y);
      cursorX += ctx.measureText(token.text).width;
    });
  });

  return true;
}

function wrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = tokenizeForWrap(text || "");
  const lines = [];
  let line = "";

  for (const word of words) {
    if (word === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const needSpace = line && !isCjkChar(word) && !isCjkChar(line[line.length - 1]);
    const test = line ? `${line}${needSpace ? " " : ""}${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function tokenizeForWrap(text) {
  const hasCjk = /[\u3400-\u9FFF]/.test(text);
  if (hasCjk) return [...text.replace(/\r/g, "")];
  return text.replace(/\r/g, "").split(/\s+/);
}

function isCjkChar(ch) {
  if (!ch) return false;
  return /[\u3400-\u9FFF]/.test(ch);
}

function drawJustifiedLine(ctx, line, x, y, width, isLastLine) {
  const trimmed = line.trimEnd();
  if (isLastLine || trimmed.length <= 1) {
    ctx.fillText(trimmed, x, y);
    return;
  }
  const chars = [...trimmed];
  const textWidth = ctx.measureText(trimmed).width;
  const gapCount = chars.length - 1;
  const extra = Math.max(0, width - textWidth);
  const gap = gapCount > 0 ? extra / gapCount : 0;
  let cursorX = x;
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    ctx.fillText(ch, cursorX, y);
    cursorX += ctx.measureText(ch).width + (i < chars.length - 1 ? gap : 0);
  }
}

function escapeHtml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(md) {
  const src = escapeHtml(md || "");
  const lines = src.split("\n");
  const html = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) html.push("<ul>");
      inList = true;
      html.push(`<li>${line.slice(2)}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (line.startsWith("### ")) html.push(`<h4>${line.slice(4)}</h4>`);
    else if (line.startsWith("## ")) html.push(`<h3>${line.slice(3)}</h3>`);
    else if (line.startsWith("# ")) html.push(`<h2>${line.slice(2)}</h2>`);
    else if (line.startsWith("> ")) html.push(`<blockquote>${line.slice(2)}</blockquote>`);
    else html.push(`<p>${line || "&nbsp;"}</p>`);
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

function stripMarkdown(md) {
  return (md || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^-\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1");
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

document.getElementById("btn-export").addEventListener("click", () => {
  exportRaster().catch((err) => {
    console.error(err);
    alert("Export failed. Try PNG first, or use Export HTML.");
  });
});

document.getElementById("btn-export-html").addEventListener("click", () => {
  void exportHtml();
});

btnToggleLock.addEventListener("click", () => {
  setLayoutLocked(!state.layoutLocked);
  if (state.layoutLocked) {
    reflowFrom(0);
    render();
  } else {
    render();
  }
  commitMutation();
});

btnUndo.addEventListener("click", () => {
  undoHistory();
});

btnRedo.addEventListener("click", () => {
  redoHistory();
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

btnClearFormat.addEventListener("mousedown", (ev) => {
  ev.preventDefault();
  applyInlineFormat("removeFormat");
});

btnThemeMode.addEventListener("click", () => {
  cycleThemeMode();
});

bindShellEvents({
  onEscape: closeMobilePanels,
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
});

docSelect.addEventListener("change", async () => {
  await switchDocument(docSelect.value);
});

btnDocNew.addEventListener("click", async () => {
  await createNewDocument();
});

btnDocRename.addEventListener("click", async () => {
  await renameCurrentDocument();
});

btnDocDelete.addEventListener("click", async () => {
  await deleteCurrentDocument();
});

exportFormat.addEventListener("change", () => {
  document.getElementById("btn-export").textContent = `Export ${exportFormat.value.toUpperCase()}`;
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
  if (state.history.length === 0) {
    pushHistory();
  }
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
