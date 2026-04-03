# Optimization Notes

## Overview

This repo is already functional as a local-first static editor, but it is still structured like a prototype. The main risk is not missing features. The main risk is that state, rendering, persistence, export, and editing logic are too tightly coupled, which will make future changes slower and more fragile.

## Highest Priority

### 1. Split `app.js` into modules

`app.js` currently mixes:

- app state
- DOM lookups
- render logic
- input handling
- document management
- export logic
- persistence logic

Suggested split:

- `editor-state.js`
- `editor-render.js`
- `editor-interactions.js`
- `editor-export.js`
- `editor-docs.js`

Why:

- reduces change risk
- makes features easier to add
- makes testing possible

Relevant areas:

- `app.js:18`
- `app.js:693`
- `app.js:1732`

### 2. Reduce render cost and render frequency

Many interactions call a full `render()` immediately:

- text input
- drag
- resize
- style changes
- width changes

Current `render()` also does several expensive things repeatedly:

- `querySelector` per element
- layout measurement with `scrollHeight`
- inspector sync
- save scheduling

Suggested improvements:

- cache DOM nodes by element id
- throttle drag/input rendering with `requestAnimationFrame`
- separate persistence from render
- avoid full inspector sync on every visual update

Relevant areas:

- `app.js:599`
- `app.js:693`
- `app.js:880`

### 3. Replace snapshot-based undo/redo with operation-based history

Undo/redo currently deep-clones the entire state and compares snapshots with `JSON.stringify`.

Problems:

- expensive for large documents
- expensive for large images
- memory usage grows quickly

Suggested direction:

- keep operation-based history
- store only changed fields
- exclude heavy image payloads from history snapshots

Relevant areas:

- `app.js:474`
- `app.js:496`

### 4. Stop storing uploaded images directly as Data URLs in document state

Uploaded images are stored inline in the element `src`, which means:

- document payloads get large
- undo/redo gets heavy
- IndexedDB payload gets large
- export and restore become slower

Suggested direction:

- store image blobs in a dedicated IndexedDB store
- keep only `imageId` and metadata in the document
- resolve assets on render/export

Relevant areas:

- `app.js:1053`
- `app.js:1755`

### 5. Fix persistence timing

`beforeunload` currently triggers delayed save logic, which is not reliable.

Suggested direction:

- keep debounce during normal editing
- flush immediately on `visibilitychange` or `pagehide`
- expose a direct save path without timer wrapping

Relevant areas:

- `app.js:1874`
- `app.js:2032`

## Second Priority

### 6. Upgrade storage from a simple key-value wrapper to a real data layer

`js/storage.js` is a minimal IndexedDB wrapper. It does not yet support:

- connection reuse
- schema versioning strategy
- separate stores for docs/assets/meta

Suggested direction:

- cache database connection
- add stores such as `docs`, `assets`, `meta`
- add explicit migration handling

Relevant areas:

- `js/storage.js:4`
- `js/storage.js:7`

### 7. Decouple rich text editing from `document.execCommand`

Inline text formatting currently depends on `execCommand`.

Problems:

- limited long-term reliability
- awkward behavior across browsers
- hard to evolve into a robust rich text model

Suggested direction:

- isolate formatting commands behind an adapter
- sanitize and normalize editable HTML
- consider a more structured editor model later

Relevant area:

- `app.js:412`

### 8. Sanitize `contenteditable` HTML before persistence/export

The app largely stores `innerHTML` directly and later exports it.

Risks:

- pasted content can carry unexpected markup
- exported HTML can become inconsistent
- style leakage is hard to control

Suggested direction:

- whitelist tags such as `strong`, `em`, `br`, `p`, `div`
- strip inline styles and unsupported tags

Relevant areas:

- `app.js:602`
- `app.js:718`
- `app.js:1313`

### 9. Replace CSS `zoom` with a more controlled scaling strategy

Zoom currently uses `style.zoom`.

Suggested direction:

- use `transform: scale()`
- keep one explicit coordinate conversion path for interaction math

Relevant area:

- `app.js:1189`

### 10. Add tests before larger refactors

This type of editor is easy to break while changing layout or persistence.

Minimum useful coverage:

- layout/reflow unit tests
- restore/migration tests
- export smoke tests
- browser-level flows with Playwright

## Suggested Execution Order

1. Split `app.js` into modules.
2. Reduce `render()` frequency and cost.
3. Rework undo/redo history.
4. Move images to Blob-based asset storage.
5. Fix save flushing behavior.
6. Sanitize rich text input/output.
7. Add tests.

## Shipping Note

For GitHub Pages MVP, the app is suitable because it is:

- static
- local-first
- browser-only
- build-step-free

The main product tradeoff is that persistence is browser-local. Users can browse and use the app on GitHub Pages, but their data will stay in that browser only unless export/import or cloud sync is added later.
