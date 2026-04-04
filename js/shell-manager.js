import { fitZoomRatioForStage, isMobileViewport } from "./canvas-layout.js";

export function createShellManager({
  state,
  controls,
  nodes,
  authoredCanvasWidth,
}) {
  function isMobileShell() {
    return isMobileViewport(window.innerWidth);
  }

  function updateViewportMetrics() {
    const width = nodes.canvas.offsetWidth * state.zoom;
    const height = nodes.canvas.offsetHeight * state.zoom;
    nodes.canvasViewport.style.width = `${width}px`;
    nodes.canvasViewport.style.height = `${height}px`;
  }

  function syncZoomControl() {
    controls.canvasZoom.value = state.zoomMode === "fit" ? "fit" : String(state.zoom);
  }

  function fitZoomRatio() {
    const stageStyles = getComputedStyle(nodes.canvasStage);
    return fitZoomRatioForStage({
      stageClientWidth: nodes.canvasStage.clientWidth,
      paddingLeft: parseFloat(stageStyles.paddingLeft),
      paddingRight: parseFloat(stageStyles.paddingRight),
      authoredWidth: authoredCanvasWidth(),
    });
  }

  function applyZoom(nextZoom, { mode = "manual", persist = true } = {}) {
    if (nextZoom === "fit" || mode === "fit") {
      state.zoomMode = "fit";
      state.zoom = fitZoomRatio();
    } else {
      state.zoomMode = "manual";
      state.zoom = Math.max(0.3, Math.min(2, Number(nextZoom) || 1));
    }
    nodes.canvas.style.transform = "none";
    nodes.canvasScale.style.zoom = "";
    nodes.canvasScale.style.transform = `scale(${state.zoom})`;
    syncZoomControl();
    updateViewportMetrics();
  }

  function fitToFrame() {
    applyZoom("fit", { mode: "fit" });
  }

  function closeMobilePanels() {
    document.body.classList.remove("mobile-panel-left-open", "mobile-panel-right-open");
    controls.mobilePanelBackdrop.classList.add("hidden");
  }

  function openMobilePanel(side) {
    if (!isMobileShell()) return;
    document.body.classList.toggle("mobile-panel-left-open", side === "left");
    document.body.classList.toggle("mobile-panel-right-open", side === "right");
    controls.mobilePanelBackdrop.classList.remove("hidden");
  }

  function syncResponsiveShell() {
    if (!isMobileShell()) {
      closeMobilePanels();
    }
    if (state.zoomMode === "fit") {
      applyZoom("fit", { mode: "fit", persist: false });
    } else {
      updateViewportMetrics();
      syncZoomControl();
    }
  }

  function bindEvents({ onEscape, onOpenMobileElements, onOpenMobileSettings, onZoomChange }) {
    controls.canvasZoom.addEventListener("change", () => {
      if (controls.canvasZoom.value === "fit") {
        applyZoom("fit", { mode: "fit", persist: false });
        onZoomChange?.();
        return;
      }
      applyZoom(Number(controls.canvasZoom.value), { mode: "manual", persist: false });
      onZoomChange?.();
    });

    controls.btnFitFrame.addEventListener("click", () => {
      fitToFrame();
      onZoomChange?.();
    });

    controls.btnMobileElements.addEventListener("click", onOpenMobileElements);
    controls.btnMobileSettings.addEventListener("click", onOpenMobileSettings);
    controls.mobilePanelBackdrop.addEventListener("click", closeMobilePanels);

    window.addEventListener("resize", syncResponsiveShell);
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") onEscape();
    });
  }

  return {
    applyZoom,
    bindEvents,
    closeMobilePanels,
    fitToFrame,
    syncResponsiveShell,
    syncZoomControl,
    updateViewportMetrics,
    openMobilePanel,
  };
}
