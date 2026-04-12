const MAX_HISTORY_ENTRIES = 120;

function cloneForHistory(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createHistoryManager({
  state,
  controls,
  setCanvasBackground,
  setLayoutLocked,
}) {
  function cloneStateForHistory(kind = "unknown") {
    return cloneForHistory({
      type: "snapshot",
      snapshot: {
        elements: state.elements,
        selectedId: state.selectedId,
        seq: state.seq,
        layoutLocked: state.layoutLocked,
        zoom: state.zoom,
        meta: {
          kind,
        },
        ui: {
          widthSelect: controls.widthSelect.value,
          customWidth: controls.customWidth.value,
          canvasBg: controls.canvasBg.value,
          exportScale: controls.exportScale.value,
          exportFormat: controls.exportFormat.value,
          exportQuality: controls.exportQuality.value,
          exportAppearance: controls.exportAppearance.value,
          zoomMode: state.zoomMode,
          themeMode: state.themeMode,
        },
      },
    });
  }

  function createOperationHistory(kind, payload) {
    return cloneForHistory({
      type: "operation",
      operation: {
        kind,
        ...payload,
      },
    });
  }

  function trimHistory() {
    if (state.history.length <= MAX_HISTORY_ENTRIES) return;
    const overflow = state.history.length - MAX_HISTORY_ENTRIES;
    state.history.splice(0, overflow);
  }

  function pushHistory(kind = "unknown", payload = null) {
    if (state.suppressHistory) return;
    const entry = payload ? createOperationHistory(kind, payload) : cloneStateForHistory(kind);
    const current = state.history[state.historyIndex];
    if (!payload && current && JSON.stringify(current) === JSON.stringify(entry)) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(entry);
    trimHistory();
    state.historyIndex = state.history.length - 1;
  }

  function commitMutation(kind = "unknown", payload = null) {
    pushHistory(kind, payload);
  }

  function restoreHistorySnapshot(snapshotEntry) {
    const snapshot = snapshotEntry.snapshot || snapshotEntry;
    state.suppressHistory = true;
    state.elements = snapshot.elements || [];
    state.selectedId = snapshot.selectedId || null;
    state.seq = snapshot.seq || 1;
    state.savedSelection = null;
    state.savedSelectionElementId = null;
    state.savedSelectionTarget = null;
    setLayoutLocked(snapshot.layoutLocked !== false);
    state.zoom = snapshot.zoom || 1;
    controls.widthSelect.value = snapshot.ui?.widthSelect || controls.widthSelect.value;
    controls.customWidth.value = snapshot.ui?.customWidth || controls.customWidth.value;
    setCanvasBackground(snapshot.ui?.canvasBg || "#ffffff");
    controls.exportScale.value = snapshot.ui?.exportScale || controls.exportScale.value;
    controls.exportFormat.value = snapshot.ui?.exportFormat || controls.exportFormat.value;
    controls.exportQuality.value = snapshot.ui?.exportQuality || controls.exportQuality.value;
    controls.exportAppearance.value = snapshot.ui?.exportAppearance || controls.exportAppearance.value;
    state.zoomMode = snapshot.ui?.zoomMode === "manual" ? "manual" : "fit";
    state.themeMode = snapshot.ui?.themeMode === "day" ? "day" : "night";
    controls.exportButton.textContent = `Export ${controls.exportFormat.value.toUpperCase()}`;
    state.suppressHistory = false;
    return true;
  }

  function applyOperation(operation, direction) {
    state.suppressHistory = true;
    if (operation.kind === "structure.insert") {
      if (direction === "undo") {
        state.elements = state.elements.filter((item) => item.id !== operation.item.id);
        state.selectedId = null;
      } else {
        state.elements.splice(operation.index, 0, cloneForHistory(operation.item));
        state.selectedId = operation.item.id;
      }
      state.suppressHistory = false;
      return true;
    }

    if (operation.kind === "structure.delete") {
      if (direction === "undo") {
        state.elements.splice(operation.index, 0, cloneForHistory(operation.item));
        state.selectedId = operation.item.id;
      } else {
        state.elements = state.elements.filter((item) => item.id !== operation.item.id);
        state.selectedId = null;
      }
      state.suppressHistory = false;
      return true;
    }

    if (operation.kind === "layout.move" || operation.kind === "layout.resize") {
      const target = state.elements.find((item) => item.id === operation.id);
      if (!target) {
        state.suppressHistory = false;
        return false;
      }
      const geometry = direction === "undo" ? operation.before : operation.after;
      target.x = geometry.x;
      target.y = geometry.y;
      target.width = geometry.width;
      target.height = geometry.height;
      state.selectedId = target.id;
      state.suppressHistory = false;
      return true;
    }

    state.suppressHistory = false;
    return false;
  }

  function undoHistory() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    const entry = state.history[state.historyIndex + 1];
    if (entry?.type === "operation") {
      return applyOperation(entry.operation, "undo");
    }
    return restoreHistorySnapshot(state.history[state.historyIndex]);
  }

  function redoHistory() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    const entry = state.history[state.historyIndex];
    if (entry?.type === "operation") {
      return applyOperation(entry.operation, "redo");
    }
    return restoreHistorySnapshot(entry);
  }

  return {
    commitMutation,
    maxHistoryEntries: MAX_HISTORY_ENTRIES,
    pushHistory,
    redoHistory,
    undoHistory,
  };
}
