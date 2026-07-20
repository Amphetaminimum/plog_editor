const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonthYearLabel(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = String(date.getFullYear()).slice(-2).padStart(2, "0");
  return `[${MONTHS[date.getMonth()]} ${year}]`;
}

export function normalizeMonthYearLabel(value = "") {
  const source = String(value).trim();
  const match = source.match(/^\[\s*([A-Za-z]+)\.?\s+(\d{2}|\d{4})\s*\]$/);
  if (!match) return source;

  const monthIndex = MONTHS.findIndex((month) => month.toLowerCase().startsWith(match[1].toLowerCase().slice(0, 3)));
  if (monthIndex < 0) return source;
  const year = match[2].slice(-2).padStart(2, "0");
  return `[${MONTHS[monthIndex]} ${year}]`;
}

export function headerMetaBaselineY(itemY, titleFontSize, metaFontSize) {
  return itemY + titleFontSize * 0.4 + metaFontSize * 0.8;
}
