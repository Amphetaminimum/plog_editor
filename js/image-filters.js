const DEFAULTS = Object.freeze({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  grayscale: 0,
});

export const DEFAULT_IMAGE_LOOK = DEFAULTS;

export const IMAGE_FILTER_PRESETS = Object.freeze([
  { id: "soft", label: "Soft", brightness: 104, contrast: 88, saturation: 82, warmth: 18, grayscale: 0 },
  { id: "portra", label: "Portra", brightness: 104, contrast: 94, saturation: 92, warmth: 24, grayscale: 0 },
  { id: "gold", label: "Gold", brightness: 105, contrast: 108, saturation: 112, warmth: 38, grayscale: 0 },
  { id: "chrome", label: "Chrome", brightness: 98, contrast: 118, saturation: 128, warmth: -8, grayscale: 0 },
  { id: "cinema", label: "Cinema", brightness: 94, contrast: 112, saturation: 82, warmth: -18, grayscale: 0 },
  { id: "mono", label: "Mono", brightness: 102, contrast: 108, saturation: 0, warmth: 0, grayscale: 100 },
  { id: "noir", label: "Noir", brightness: 88, contrast: 138, saturation: 0, warmth: 0, grayscale: 100 },
]);

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizedImageLook(style = {}) {
  return {
    brightness: clampNumber(style.brightness, DEFAULTS.brightness, 50, 150),
    contrast: clampNumber(style.contrast, DEFAULTS.contrast, 50, 150),
    saturation: clampNumber(style.saturation, DEFAULTS.saturation, 0, 180),
    warmth: clampNumber(style.warmth, DEFAULTS.warmth, -100, 100),
    grayscale: clampNumber(style.grayscale, DEFAULTS.grayscale, 0, 100),
  };
}

export function imageFilterCss(style = {}) {
  const look = normalizedImageLook(style);
  const sepia = Math.round(Math.max(0, look.warmth) * 0.35);
  const hueRotate = Math.round(look.warmth < 0 ? look.warmth * 0.18 : look.warmth * -0.08);
  return `brightness(${look.brightness}%) contrast(${look.contrast}%) saturate(${look.saturation}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) grayscale(${look.grayscale}%)`;
}

export function imagePresetById(id) {
  return IMAGE_FILTER_PRESETS.find((preset) => preset.id === id) || null;
}

export function matchingImagePreset(style = {}) {
  const look = normalizedImageLook(style);
  return IMAGE_FILTER_PRESETS.find((preset) => (
    preset.brightness === look.brightness
    && preset.contrast === look.contrast
    && preset.saturation === look.saturation
    && preset.warmth === look.warmth
    && preset.grayscale === look.grayscale
  ))?.id || null;
}
