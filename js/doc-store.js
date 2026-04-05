import { DOCS_STORAGE_KEY, STORAGE_KEY, idbGet, idbSet } from "./storage.js";

export function createDocStoreManager({
  state,
  controls,
  getCanvasBackground,
  setCanvasBackground,
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
}) {
  function monthYearLabel(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    return `[${months[date.getMonth()]} ${date.getFullYear()}]`;
  }

  function isoMonthValue(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function captureCurrentDocData() {
    return {
      state: {
        elements: serializeElementsForStorage(state.elements),
        seq: state.seq,
        selectedId: state.selectedId,
        layoutLocked: state.layoutLocked,
        zoom: state.zoom,
        themeMode: state.themeMode,
      },
      ui: {
        widthSelect: controls.widthSelect.value,
        customWidth: controls.customWidth.value,
        canvasBg: getCanvasBackground(),
        exportScale: controls.exportScale.value,
        exportFormat: controls.exportFormat.value,
        exportQuality: controls.exportQuality.value,
        exportAppearance: controls.exportAppearance.value,
        zoomMode: state.zoomMode,
        themeMode: state.themeMode,
      },
    };
  }

  async function persistDocStore() {
    if (!state.currentDocId) return;
    const current = state.docs.find((entry) => entry.id === state.currentDocId);
    if (current) current.data = captureCurrentDocData();
    const payload = {
      currentDocId: state.currentDocId,
      docs: state.docs,
    };
    try {
      await idbSet(DOCS_STORAGE_KEY, payload);
      localStorage.setItem("plog_editor_current_doc_id", state.currentDocId);
    } catch (err) {
      console.error("Failed to persist docs", err);
    }
  }

  function refreshDocSelect() {
    controls.docSelect.innerHTML = "";
    state.docs.forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.name;
      controls.docSelect.appendChild(option);
    });
    if (state.currentDocId) controls.docSelect.value = state.currentDocId;
  }

  function applyDocData(payload) {
    state.suppressHistory = true;
    state.assetLoadToken += 1;
    clearAssetUrls();
    state.elements = Array.isArray(payload.state?.elements) ? payload.state.elements : [];
    state.seq = Number(payload.state?.seq) || 1;
    state.selectedId = payload.state?.selectedId || null;
    state.zoom = Number(payload.state?.zoom) || 1;
    state.history = [];
    state.historyIndex = -1;
    state.savedSelection = null;
    state.savedSelectionElementId = null;
    state.savedSelectionTarget = null;
    state.themeMode = payload.state?.themeMode === "day" || payload.ui?.themeMode === "day" ? "day" : "night";
    setLayoutLocked(payload.state?.layoutLocked !== false);
    controls.widthSelect.value = payload.ui?.widthSelect || "1200";
    controls.customWidth.value = payload.ui?.customWidth || "1200";
    setCanvasBackground(payload.ui?.canvasBg || "#ffffff");
    controls.exportScale.value = payload.ui?.exportScale || "2";
    controls.exportFormat.value = payload.ui?.exportFormat || "png";
    controls.exportQuality.value = payload.ui?.exportQuality || "0.9";
    controls.exportAppearance.value = payload.ui?.exportAppearance || "match";
    state.zoomMode = payload.ui?.zoomMode === "manual" ? "manual" : "fit";
    controls.exportButton.textContent = `Export ${controls.exportFormat.value.toUpperCase()}`;
    state.suppressHistory = false;
  }

  function buildStarterDoc(doc, starter = {}) {
    const headerTitle = starter.headerTitle?.trim() || "Prayer";
    const headerMeta = starter.headerMeta?.trim() || monthYearLabel();
    if (!state.docs.find((entry) => entry.id === doc.id)) {
      state.docs.push(doc);
    }
    state.currentDocId = doc.id;
    applyDocData(doc.data);
    addElement(
      createElement("header", {
        content: {
          title: headerTitle,
          meta: headerMeta,
        },
        spacingBefore: "normal",
        style: { fontSize: 62, color: "#1f1f22", radius: 0, fontFamily: "fangzheng" },
      }),
    );
    addElement(createElement("text", { content: "", placeholder: "Paragraph", spacingBefore: "section" }));
    refreshDocSelect();
    void persistDocStore();
  }

  async function restoreSession() {
    let docsPayload = null;
    try {
      docsPayload = await idbGet(DOCS_STORAGE_KEY);
    } catch (err) {
      console.error("Failed to read docs store", err);
    }
    if (docsPayload) {
      try {
        state.docs = Array.isArray(docsPayload.docs) ? docsPayload.docs : [];
        state.currentDocId = docsPayload.currentDocId || state.docs[0]?.id || null;
        if (!state.docs.length) throw new Error("Empty docs");
        refreshDocSelect();
        const current = state.docs.find((entry) => entry.id === state.currentDocId) || state.docs[0];
        state.currentDocId = current.id;
        applyDocData(current.data || createDefaultDocData());
        return true;
      } catch (err) {
        console.error("Failed to restore docs", err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const doc = createDocRecord("Untitled Plog");
        doc.data = parsed;
        state.docs = [doc];
        state.currentDocId = doc.id;
        refreshDocSelect();
        applyDocData(doc.data);
        void persistDocStore();
        return true;
      } catch (err) {
        console.error("Failed to migrate legacy session", err);
      }
    }
    return false;
  }

  async function flushSaveSession() {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    await persistDocStore();
  }

  function saveSession() {
    if (state.saveTimer) window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      void flushSaveSession();
      state.saveTimer = null;
    }, 180);
  }

  async function switchDocument(docId) {
    await flushSaveSession();
    const doc = state.docs.find((entry) => entry.id === docId);
    if (!doc) return;
    state.currentDocId = doc.id;
    refreshDocSelect();
    applyDocData(doc.data || createDefaultDocData());
  }

  async function createNewDocument() {
    await flushSaveSession();
    const defaults = {
      name: `Plog ${state.docs.length + 1}`,
      headerTitle: "Prayer",
      headerMonth: isoMonthValue(),
    };
    const result = await openFormDialog({
      title: "New plog",
      message: "These are optional starter values. You can change them later in the canvas.",
      confirmLabel: "Create",
      fields: [
        {
          id: "name",
          label: "Plog name",
          initialValue: defaults.name,
          hint: "Suggested automatically. You can rename it later.",
        },
        {
          id: "headerTitle",
          label: "Header title",
          initialValue: defaults.headerTitle,
          hint: "Optional. This fills the left side of the starter header.",
        },
        {
          id: "headerMonth",
          label: "Header date",
          type: "month",
          initialValue: defaults.headerMonth,
          hint: "Optional. Defaults to the current month.",
        },
      ],
    });
    if (!result) return;
    const name = result.name?.trim() || defaults.name;
    const headerTitle = result.headerTitle?.trim() || defaults.headerTitle;
    const headerMeta = result.headerMonth ? monthYearLabel(`${result.headerMonth}-01`) : monthYearLabel();
    const doc = createDocRecord(name);
    state.docs.push(doc);
    refreshDocSelect();
    buildStarterDoc(doc, {
      headerTitle,
      headerMeta,
    });
  }

  async function renameCurrentDocument() {
    const current = state.docs.find((entry) => entry.id === state.currentDocId);
    if (!current) return;
    const next = await openTextDialog({
      title: "Rename document",
      message: "Update the current document name.",
      initialValue: current.name,
      confirmLabel: "Save",
    });
    if (!next) return;
    current.name = next.trim() || current.name;
    refreshDocSelect();
    await persistDocStore();
  }

  async function deleteCurrentDocument() {
    const current = state.docs.find((entry) => entry.id === state.currentDocId);
    if (!current) return;
    const confirmation = await openTextDialog({
      title: "Delete document",
      message: `Type DELETE to remove "${current.name}".`,
      initialValue: "",
      confirmLabel: "Delete",
    });
    if (confirmation !== "DELETE") return;

    if (current.id === state.currentDocId) {
      current.data = captureCurrentDocData();
    }
    const docElements = Array.isArray(current.data?.state?.elements) ? current.data.state.elements : [];
    await deleteImageAssetsForItems(docElements);

    state.docs = state.docs.filter((entry) => entry.id !== current.id);

    if (state.docs.length === 0) {
      const replacement = createDocRecord("Untitled Plog");
      buildStarterDoc(replacement);
      return;
    }

    state.currentDocId = state.docs[0].id;
    refreshDocSelect();
    await persistDocStore();
    applyDocData(state.docs[0].data || createDefaultDocData());
  }

  return {
    applyDocData,
    buildStarterDoc,
    captureCurrentDocData,
    createNewDocument,
    deleteCurrentDocument,
    flushSaveSession,
    persistDocStore,
    refreshDocSelect,
    renameCurrentDocument,
    restoreSession,
    saveSession,
    switchDocument,
  };
}
