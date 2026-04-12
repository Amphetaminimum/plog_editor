export function createHistoryManager({
  state,
  controls,
  setCanvasBackground,
  setLayoutLocked,
}) {
  function cloneStateForHistory(kind = "unknown") {
    return JSON.parse(
      JSON.stringify({
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
      }),
    );
  }

  function pushHistory(kind = "unknown") {
    if (state.suppressHistory) return;
    const snapshot = cloneStateForHistory(kind);
    const current = state.history[state.historyIndex];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex = state.history.length - 1;
  }

  function commitMutation(kind = "unknown") {
    pushHistory(kind);
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

  function undoHistory() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    return restoreHistorySnapshot(state.history[state.historyIndex]);
  }

  function redoHistory() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    return restoreHistorySnapshot(state.history[state.historyIndex]);
  }

  return {
    commitMutation,
    pushHistory,
    redoHistory,
    undoHistory,
  };
}
