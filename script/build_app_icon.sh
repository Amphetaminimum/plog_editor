#!/usr/bin/env bash
set -euo pipefail

SOURCE_SVG="${1:?source svg required}"
OUTPUT_ICNS="${2:?output icns required}"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert is required to build the app icon" >&2
  exit 1
fi

ICONSET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/plog-iconset.XXXXXX")"
trap 'rm -rf "$ICONSET_DIR"' EXIT

mkdir -p "$ICONSET_DIR/AppIcon.iconset"

for size in 16 32 128 256 512; do
  scale2=$((size * 2))
  rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" -o "$ICONSET_DIR/AppIcon.iconset/icon_${size}x${size}.png"
  rsvg-convert -w "$scale2" -h "$scale2" "$SOURCE_SVG" -o "$ICONSET_DIR/AppIcon.iconset/icon_${size}x${size}@2x.png"
done

mkdir -p "$(dirname "$OUTPUT_ICNS")"
/usr/bin/iconutil -c icns "$ICONSET_DIR/AppIcon.iconset" -o "$OUTPUT_ICNS"
