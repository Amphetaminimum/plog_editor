const SELECTOR = {
  select: "select:not([data-native-control])",
  color: 'input[type="color"]:not([data-native-control])',
  range: 'input[type="range"]',
};

const COLOR_PRESETS = ["#f4ede2", "#ffffff", "#d9c6a5", "#9b6bf2", "#d96f58", "#14110d", "#2e5d50", "#315f86"];

function clampControlValue(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value, fallback = "#000000") {
  const compact = String(value || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(compact)) {
    return `#${compact.split("").map((character) => character + character).join("")}`.toLowerCase();
  }
  return /^[0-9a-f]{6}$/i.test(compact) ? `#${compact.toLowerCase()}` : fallback;
}

function hexToHsv(value) {
  const hex = normalizeHex(value).slice(1);
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { h: hue, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const chroma = v * s;
  const section = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const offset = v - chroma;
  const rgb = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  return `#${rgb.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function optionLabel(select) {
  return select.selectedOptions[0]?.textContent?.trim() || "Choose";
}

function enhanceSelect(select, closeAll) {
  select.dataset.nativeControl = "true";
  select.classList.add("native-control-source");
  const root = document.createElement("div");
  root.className = "modern-select";
  const trigger = document.createElement("button");
  trigger.className = "modern-select-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = '<span></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6"/></svg>';
  const menu = document.createElement("div");
  menu.className = "modern-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  root.append(trigger, menu);
  select.insertAdjacentElement("afterend", root);

  function sync() {
    trigger.querySelector("span").textContent = optionLabel(select);
    trigger.disabled = select.disabled;
    const label = select.closest("label")?.childNodes[0]?.textContent?.trim() || "Selection";
    trigger.setAttribute("aria-label", `${label}: ${optionLabel(select)}`);
    menu.querySelectorAll("[role=option]").forEach((item) => {
      const active = item.dataset.value === select.value;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-selected", String(active));
    });
  }

  function buildOptions() {
    menu.replaceChildren();
    [...select.options].forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "modern-select-option";
      item.dataset.value = option.value;
      item.disabled = option.disabled;
      item.setAttribute("role", "option");
      item.innerHTML = `<span>${option.textContent}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 2.6 2.6 6.4-6.4"/></svg>`;
      item.addEventListener("click", () => {
        if (option.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        close();
        trigger.focus();
      });
      menu.appendChild(item);
    });
    sync();
  }

  function open() {
    if (trigger.disabled) return;
    closeAll(root);
    buildOptions();
    menu.hidden = false;
    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.getBoundingClientRect().height;
    root.classList.toggle("opens-up", triggerRect.bottom + menuHeight + 12 > window.innerHeight && triggerRect.top > menuHeight + 12);
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      (menu.querySelector(".is-selected") || menu.querySelector("[role=option]:not(:disabled)"))?.focus();
    });
  }

  function close() {
    menu.hidden = true;
    root.classList.remove("is-open", "opens-up");
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", () => (menu.hidden ? open() : close()));
  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });
  menu.addEventListener("keydown", (event) => {
    const options = [...menu.querySelectorAll("[role=option]:not(:disabled)")];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      options[(index + direction + options.length) % options.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      options[event.key === "Home" ? 0 : options.length - 1]?.focus();
    }
  });
  select.addEventListener("change", sync);
  sync();
  return { root, close, sync };
}

function enhanceColor(input, closeAll) {
  input.dataset.nativeControl = "true";
  input.classList.add("native-control-source");
  const root = document.createElement("div");
  root.className = "modern-color";
  const trigger = document.createElement("button");
  trigger.className = "modern-color-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = '<span class="modern-color-chip"></span><span class="modern-color-value"></span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6"/></svg>';
  const popover = document.createElement("div");
  popover.className = "modern-color-popover";
  popover.hidden = true;
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Choose color");
  popover.innerHTML = `
    <div class="color-plane" tabindex="0" role="application" aria-label="Saturation and brightness">
      <span class="color-plane-cursor"></span>
    </div>
    <label class="color-hue-label">Hue
      <input class="color-hue" type="range" min="0" max="360" value="0" aria-label="Hue" />
    </label>
    <div class="color-presets" aria-label="Color presets"></div>
    <div class="color-value-row">
      <span>#</span>
      <input class="color-hex" type="text" maxlength="6" spellcheck="false" aria-label="Hex color" />
      <button class="color-eyedropper" type="button" aria-label="Pick a color from the screen" title="Pick from screen">⌖</button>
    </div>`;
  root.append(trigger, popover);
  input.insertAdjacentElement("afterend", root);

  const plane = popover.querySelector(".color-plane");
  const cursor = popover.querySelector(".color-plane-cursor");
  const hueInput = popover.querySelector(".color-hue");
  const hexInput = popover.querySelector(".color-hex");
  const presetRoot = popover.querySelector(".color-presets");
  const eyeDropperButton = popover.querySelector(".color-eyedropper");
  let hsv = hexToHsv(input.value);

  function paint() {
    const value = normalizeHex(input.value);
    hsv = hexToHsv(value);
    trigger.querySelector(".modern-color-chip").style.setProperty("--color", value);
    trigger.querySelector(".modern-color-value").textContent = value.toUpperCase();
    plane.style.setProperty("--hue", `hsl(${hsv.h} 100% 50%)`);
    cursor.style.left = `${hsv.s * 100}%`;
    cursor.style.top = `${(1 - hsv.v) * 100}%`;
    hueInput.value = String(Math.round(hsv.h));
    hexInput.value = value.slice(1).toUpperCase();
    presetRoot.querySelectorAll(".color-preset").forEach((swatch) => {
      swatch.classList.toggle("is-selected", normalizeHex(swatch.getAttribute("aria-label")) === value);
    });
  }

  function setValue(value, commit = false) {
    input.value = normalizeHex(value, input.value);
    paint();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    if (commit) input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  COLOR_PRESETS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-preset";
    swatch.style.setProperty("--swatch", color);
    swatch.setAttribute("aria-label", color);
    swatch.addEventListener("click", () => setValue(color, true));
    presetRoot.appendChild(swatch);
  });

  function setFromPlane(event, commit = false) {
    const rect = plane.getBoundingClientRect();
    hsv.s = clampControlValue((event.clientX - rect.left) / rect.width);
    hsv.v = 1 - clampControlValue((event.clientY - rect.top) / rect.height);
    setValue(hsvToHex(hsv), commit);
  }

  function open() {
    if (input.disabled) return;
    closeAll(root);
    paint();
    popover.hidden = false;
    const triggerRect = trigger.getBoundingClientRect();
    const popoverHeight = popover.getBoundingClientRect().height;
    root.classList.toggle("opens-up", triggerRect.bottom + popoverHeight + 12 > window.innerHeight && triggerRect.top > popoverHeight + 12);
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
  }

  function close() {
    popover.hidden = true;
    root.classList.remove("is-open", "opens-up");
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (popover.hidden) open();
    else close();
  });
  plane.addEventListener("pointerdown", (event) => {
    plane.setPointerCapture?.(event.pointerId);
    setFromPlane(event);
  });
  plane.addEventListener("pointermove", (event) => {
    if (plane.hasPointerCapture?.(event.pointerId)) setFromPlane(event);
  });
  plane.addEventListener("pointerup", (event) => {
    setFromPlane(event, true);
    plane.releasePointerCapture?.(event.pointerId);
  });
  plane.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const fine = event.shiftKey ? 0.01 : 0.03;
    if (event.key === "ArrowLeft") hsv.s = clampControlValue(hsv.s - fine);
    if (event.key === "ArrowRight") hsv.s = clampControlValue(hsv.s + fine);
    if (event.key === "ArrowUp") hsv.v = clampControlValue(hsv.v + fine);
    if (event.key === "ArrowDown") hsv.v = clampControlValue(hsv.v - fine);
    setValue(hsvToHex(hsv), true);
  });
  hueInput.addEventListener("input", () => {
    hsv.h = Number(hueInput.value);
    setValue(hsvToHex(hsv));
  });
  hueInput.addEventListener("change", () => input.dispatchEvent(new Event("change", { bubbles: true })));
  hexInput.addEventListener("change", () => setValue(`#${hexInput.value}`, true));
  hexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setValue(`#${hexInput.value}`, true);
    }
  });
  if (!("EyeDropper" in window)) eyeDropperButton.hidden = true;
  eyeDropperButton.addEventListener("click", async () => {
    try {
      const result = await new window.EyeDropper().open();
      setValue(result.sRGBHex, true);
    } catch {}
  });
  input.addEventListener("input", paint);
  paint();
  return {
    root,
    close,
    sync() {
      trigger.disabled = input.disabled;
      paint();
    },
  };
}

function syncRange(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const progress = max === min ? 0 : clampControlValue((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

export function initModernControls(root = document) {
  const controls = [];
  const closeAll = (except = null) => {
    controls.forEach((control) => {
      if (control.root !== except) control.close();
    });
  };
  root.querySelectorAll(SELECTOR.select).forEach((select) => controls.push(enhanceSelect(select, closeAll)));
  root.querySelectorAll(SELECTOR.color).forEach((input) => controls.push(enhanceColor(input, closeAll)));
  root.querySelectorAll(SELECTOR.range).forEach((input) => {
    input.addEventListener("input", () => syncRange(input));
    syncRange(input);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!controls.some((control) => control.root.contains(event.target))) closeAll();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });
  return {
    close: closeAll,
    sync() {
      controls.forEach((control) => control.sync());
      root.querySelectorAll(SELECTOR.range).forEach(syncRange);
    },
  };
}
