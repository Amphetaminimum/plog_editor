import { fitZoomRatioForStage, responsiveShellMode } from "./canvas-layout.js";

export function createShellManager({
  state,
  controls,
  nodes,
  authoredCanvasWidth,
}) {
  let responsiveFrame = 0;
  let chromeObserver = null;

  function shellMode() {
    return responsiveShellMode(window.innerWidth);
  }

  function syncChromeMetrics() {
    const topbarHeight = Math.ceil(nodes.topbar?.getBoundingClientRect().height || 0);
    const dockHeight = shellMode() === "phone"
      ? Math.ceil(nodes.mobileShellActions?.getBoundingClientRect().height || 0)
      : 0;
    document.documentElement.style.setProperty("--topbar-height", `${topbarHeight}px`);
    document.documentElement.style.setProperty("--mobile-dock-height", `${dockHeight}px`);
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
    controls.btnMobileElements.setAttribute("aria-expanded", "false");
    controls.btnMobileSettings.setAttribute("aria-expanded", "false");
  }

  function openMobilePanel(side) {
    if (shellMode() === "desktop") return;
    document.body.classList.toggle("mobile-panel-left-open", side === "left");
    document.body.classList.toggle("mobile-panel-right-open", side === "right");
    controls.mobilePanelBackdrop.classList.remove("hidden");
    controls.btnMobileElements.setAttribute("aria-expanded", String(side === "left"));
    controls.btnMobileSettings.setAttribute("aria-expanded", String(side === "right"));
  }

  function syncResponsiveShell() {
    const mode = shellMode();
    document.body.dataset.shellMode = mode;
    syncChromeMetrics();
    if (mode === "desktop") {
      closeMobilePanels();
    }
    if (state.zoomMode === "fit") {
      applyZoom("fit", { mode: "fit", persist: false });
    } else {
      updateViewportMetrics();
      syncZoomControl();
    }
  }

  function scheduleResponsiveSync() {
    if (responsiveFrame) window.cancelAnimationFrame(responsiveFrame);
    responsiveFrame = window.requestAnimationFrame(() => {
      responsiveFrame = 0;
      syncResponsiveShell();
    });
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

    window.addEventListener("resize", scheduleResponsiveSync, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      chromeObserver = new ResizeObserver(scheduleResponsiveSync);
      if (nodes.topbar) chromeObserver.observe(nodes.topbar);
      if (nodes.mobileShellActions) chromeObserver.observe(nodes.mobileShellActions);
    }
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
