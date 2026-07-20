# Plog

Plog is a local-first long-canvas editor for image-led stories. It turns editable content blocks into a deterministic vertical layout that stays editable as text changes, images resize, and the canvas grows.

The current product is an editor and export workflow. Its document model is being made programmable so the same layout core can accept editor actions, Markdown, and structured JSON without giving up local ownership of the source content.

## What Works Today

- editable header, text, image, divider, quote, and card blocks
- deterministic vertical auto-flow and canvas height growth
- image aspect-ratio preservation, filters, rotation, and frames
- local documents and Blob-backed image assets
- mixed operation/snapshot undo and redo
- PNG, JPG, WebP, and standalone HTML export
- browser and macOS app storage paths

## Run

```bash
python3 -m http.server 5173
```

Open [http://localhost:5173/editor.html](http://localhost:5173/editor.html).

## Test

```bash
npm test
cd macos && swift test
```

## Architecture

```text
editor UI / importers
        ↓ document commands
versioned document blocks
        ↓
layout → DOM preview / canvas export / HTML export
        ↓
IndexedDB or macOS native storage
```

Important modules:

- `app.js` — editor orchestration and UI event wiring
- `js/document-commands.js` — pure block command reducer
- `js/canvas-layout.js` — authored width, auto-flow, and canvas sizing
- `js/editor-render.js` — editable DOM preview
- `js/render-state.js` — state-based raster renderer
- `js/history-manager.js` — undo and redo
- `js/doc-store.js` and `js/storage.js` — documents and image assets

The schema and command boundary is documented in [`doc/ADR-001-document-schema-and-commands.md`](doc/ADR-001-document-schema-and-commands.md).

## Product Boundary

Plog deliberately does not attempt to select a whole photo library, invent a travel narrative, publish a blog, or replace a general-purpose design suite. The near-term goal is narrower: make image-led long-form documents local, editable, importable, and reliably exportable.

Not yet production-complete:

- robust rich-text editing independent of browser `contenteditable`
- gallery layout and on-canvas crop handles
- cloud sync and collaboration
- batch photo organization
- external design-platform adapters
