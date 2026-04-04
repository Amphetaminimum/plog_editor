export function createEditorRenderManager({
  state,
  canvas,
  elementNodeCache,
  controls,
  getElement,
  getElementNode,
  templateFor,
  canvasLayout,
  familyCss,
  reflowAfterElement,
  saveSession,
  updateCanvasHeight,
  updateViewportMetrics,
}) {
  function syncInspector() {
    const selected = getElement(state.selectedId);
    if (!selected) {
      controls.elNoSelection.classList.remove("hidden");
      controls.inspector.classList.add("hidden");
      return;
    }

    controls.elNoSelection.classList.add("hidden");
    controls.inspector.classList.remove("hidden");
    controls.propType.value = selected.type;
    controls.propFontSize.value = selected.style.fontSize ?? 60;
    controls.propFontSizePreset.value = String(selected.style.fontSize ?? "");
    controls.propFontFamily.value = selected.style.fontFamily ?? "fangzheng";
    controls.propFontWeight.value = String(selected.style.fontWeight ?? 300);
    controls.propSpacingBefore.value = selected.spacingBefore ?? "normal";
    controls.propColor.value = selected.style.color ?? "#1f1f22";
    controls.propRotation.value = String(selected.style.rotation ?? 0);
    controls.propBrightness.value = String(selected.style.brightness ?? 100);
    controls.propContrast.value = String(selected.style.contrast ?? 100);
    controls.propGrayscale.value = String(selected.style.grayscale ?? 0);
    controls.propFrame.value = selected.style.frame ?? "none";
    controls.imageControls.classList.toggle("hidden", selected.type !== "image");

    const textLike = selected.type === "text" || selected.type === "header" || selected.type === "quote" || selected.type === "card";
    controls.propFontSize.disabled = !textLike;
    controls.propFontSizePreset.disabled = !textLike;
    controls.propFontFamily.disabled = !textLike;
    controls.propFontWeight.disabled = !textLike;
    controls.propColor.disabled = selected.type === "divider";
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
        item.height = Math.max(52, Math.ceil(content.scrollHeight + 4));
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

  return {
    flushRender,
    render,
    syncInspector,
  };
}
