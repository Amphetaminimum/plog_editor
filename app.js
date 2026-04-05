import { createTextDialog } from "./js/dialog.js";
import { authoredCanvasWidthFromControls, canvasLayoutForWidth } from "./js/canvas-layout.js";
import { createDocStoreManager } from "./js/doc-store.js";
import { createEditorRenderManager } from "./js/editor-render.js";
import { createExportManager } from "./js/export-manager.js";
import { createHistoryManager } from "./js/history-manager.js";
import { createStateRenderer } from "./js/render-state.js";
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
const dialogCancel = document.getElementById("dialog-cancel");
const dialogConfirm = document.getElementById("dialog-confirm");
const toolbarMenus = [...document.querySelectorAll(".toolbar-menu")];

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

function closeToolbarMenus({ except = null } = {}) {
  toolbarMenus.forEach((menu) => {
    if (menu !== except) menu.removeAttribute("open");
  });
}

function openDocDrawer() {
  document.body.classList.add("doc-drawer-open");
  docDrawerBackdrop.classList.remove("hidden");
}

function closeDocDrawer() {
  document.body.classList.remove("doc-drawer-open");
  docDrawerBackdrop.classList.add("hidden");
}

function previewTextFromDoc(doc) {
  const elements = doc.id === state.currentDocId
    ? state.elements
    : Array.isArray(doc.data?.state?.elements) ? doc.data.state.elements : [];
  for (const item of elements) {
    if (item?.type === "text" || item?.type === "quote") {
      const text = String(item.content || "").replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    if (item?.type === "header") {
      const text = [item.content?.title, item.content?.meta].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    if (item?.type === "card") {
      const text = [item.content?.title, item.content?.body].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return "No preview yet";
}

function renderDocDrawer() {
  docDrawerList.innerHTML = "";
  state.docs.forEach((doc) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "doc-card";
    if (doc.id === state.currentDocId) item.classList.add("is-active");
    item.dataset.docId = doc.id;

    const elementCount = doc.id === state.currentDocId
      ? state.elements.length
      : Array.isArray(doc.data?.state?.elements) ? doc.data.state.elements.length : 0;
    const preview = previewTextFromDoc(doc).slice(0, 120);

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

    item.append(titleRow, meta, previewNode);
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
  getCanvasBackground: () => document.getElementById("canvas-bg").value,
  setCanvasBackground: (value) => {
    document.getElementById("canvas-bg").value = value;
  },
  serializeElementsForStorage,
  clearAssetUrls,
  setLayoutLocked,
  createDefaultDocData,
  createDocRecord,
  addElement,
  createElement,
  deleteImageAssetsForItems,
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
  reflowAfterElement,
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
    canvasBg: document.getElementById("canvas-bg"),
    customWidth,
    exportAppearance,
    exportButton: btnExport,
    exportFormat,
    exportQuality,
    exportScale,
    widthSelect,
  },
  setCanvasBackground: (value) => {
    document.getElementById("canvas-bg").value = value;
    const dark = state.themeMode === "night";
    canvas.style.background = dark ? "#14110d" : value;
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

function commitAndSave() {
  commitMutation();
  saveSession();
}

function syncRestoredHistoryState() {
  applyCanvasWidth();
  applyZoom(state.zoomMode === "fit" ? "fit" : state.zoom, { mode: state.zoomMode, persist: false });
  applyThemeMode(state.themeMode);
  flushRender();
  renderDocDrawer();
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

document.addEventListener("pointerdown", (ev) => {
  const target = ev.target;
  if (!(target instanceof Node)) return;
  if (toolbarMenus.some((menu) => menu.contains(target))) return;
  closeToolbarMenus();
});

docDrawerBackdrop.addEventListener("click", closeDocDrawer);
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
btnDocDrawerClose.addEventListener("click", closeDocDrawer);
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
  commitAndSave();
  return true;
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

function setLayoutLocked(next) {
  state.layoutLocked = next;
  document.body.classList.toggle("layout-locked", state.layoutLocked);
  btnToggleLock.textContent = state.layoutLocked ? "Layout Locked" : "Layout Unlocked";
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
  commitAndSave();
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
  commitAndSave();
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
    const restored = ev.shiftKey ? redoHistory() : undoHistory();
    if (restored) syncRestoredHistoryState();
    ev.preventDefault();
    return;
  }

  if ((ev.key === "Delete" || ev.key === "Backspace") && !isEditing) {
    if (!selected) return;
    state.elements = state.elements.filter((item) => item.id !== selected.id);
    state.selectedId = null;
    render();
    commitAndSave();
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
    commitAndSave();
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
  commitAndSave();
});

function wireInspectorNumber(input, updater) {
  input.addEventListener("input", () => {
    const selected = getElement(state.selectedId);
    if (!selected) return;
    updater(selected, Number(input.value));
    render();
    commitAndSave();
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
  commitAndSave();
});

propFontFamily.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.fontFamily = propFontFamily.value;
  render();
  commitAndSave();
});

propFontWeight.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.fontWeight = clamp(Number(propFontWeight.value) || 300, 200, 700);
  render();
  commitAndSave();
});

propSpacingBefore.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.spacingBefore = propSpacingBefore.value;
  if (state.layoutLocked) reflowFrom(0);
  render();
  commitAndSave();
});

propColor.addEventListener("input", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.color = propColor.value;
  render();
  commitAndSave();
});

propFrame.addEventListener("change", () => {
  const selected = getElement(state.selectedId);
  if (!selected) return;
  selected.style.frame = propFrame.value;
  render();
  commitAndSave();
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
  commitAndSave();
});
customWidth.addEventListener("input", () => {
  applyCanvasWidth();
  commitAndSave();
});

document.getElementById("canvas-bg").addEventListener("input", (ev) => {
  const dark = state.themeMode === "night";
  canvas.style.background = dark ? "#14110d" : ev.target.value;
  saveSession();
});

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
  commitAndSave();
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
