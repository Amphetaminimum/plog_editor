# Optimization Notes

## Overview

This repo is already functional as a local-first static editor, but it is still structured like a prototype. The main risk is not missing features. The main risk is that state, rendering, persistence, export, and editing logic are too tightly coupled, which will make future changes slower and more fragile.

## Current Status

### Completed in the first two optimization rounds

#### Done: Reduce render cost and render frequency

Completed work:

- node caching for rendered elements
- `requestAnimationFrame` batching for render scheduling
- removed save scheduling from the hot render loop
- reduced some full-document reflow paths to more local follow-up reflow

Current benefit:

- less UI thrash during editing
- lower DOM query overhead
- better drag / resize / input responsiveness

#### Done: Fix persistence timing

Completed work:

- debounced save path kept for normal editing
- explicit flush path added
- flush now runs on `visibilitychange`
- flush now runs on `pagehide`
- flush now runs on `beforeunload`
- document switching and creation now flush pending saves first

Current benefit:

- lower chance of losing recent edits
- better reliability on browser tab close / app backgrounding

#### Done: Upgrade storage part-way

Completed work:

- IndexedDB connection reuse
- dedicated asset store for uploaded images

Current benefit:

- avoids repeated DB open overhead
- prepares the project for a cleaner split between docs and assets

#### Done: Stop storing uploaded images directly inside document state

Completed work:

- uploaded images now persist as Blob assets in IndexedDB
- documents keep `assetId` instead of storing full image payload inline
- restore and export paths hydrate images from asset storage
- deleting a whole document also removes its asset blobs

Current benefit:

- smaller document payloads
- lower persistence pressure
- better long-document scalability

### Still to do

#### Not done yet: Split `app.js` into modules

Status:

- still a single large runtime file
- some internals are cleaner now, but the architecture is still monolithic

#### Not done yet: Replace snapshot-based undo/redo with operation-based history

Status:

- history still stores large snapshots
- image pressure is lower now because images moved to assets
- but the history model is still more expensive than it should be

#### Not done yet: Finish storage layer normalization

Status:

- `assets` store exists
- but storage is not yet a fully normalized data layer with explicit schema strategy and clearer document/metadata separation

#### Not done yet: Decouple rich text editing from `execCommand`

Status:

- current text formatting still depends on legacy browser editing commands

#### Not done yet: Sanitize `contenteditable` HTML before persistence/export

Status:

- pasted markup can still carry structure we do not fully control

#### Not done yet: Replace CSS `zoom`

Status:

- display scaling still relies on `style.zoom`
- this remains a portability and layout math issue

#### Not done yet: Add tests

Status:

- no automated regression coverage yet

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

Original order:

1. Split `app.js` into modules.
2. Reduce `render()` frequency and cost.
3. Rework undo/redo history.
4. Move images to Blob-based asset storage.
5. Fix save flushing behavior.
6. Sanitize rich text input/output.
7. Add tests.

Updated order after two completed rounds:

1. Fix mobile support and weird canvas size support.
2. Separate document-space rules from display-space rules.
3. Replace CSS `zoom` with a more controlled scaling model.
4. Split `app.js` into modules.
5. Rework undo/redo history.
6. Sanitize rich text input/output.
7. Add tests.

## Mobile And Weird Canvas Size Support

### Current problems

Observed issues:

- mobile layout collapses into a crowded stacked editor shell
- desktop assumptions still dominate the editor UI
- weird canvas sizes do not adapt cleanly
- document width and display width are too tightly coupled

Main root causes:

- mobile currently switches to one-column layout, but still tries to show the full desktop editor shell
- the canvas display is still treated like a desktop-first object
- content width logic is constrained by desktop-biased clamp values
- the app mixes authored canvas width with viewport display width

### Best-practice direction

For an editor like this, the safer model is:

- document space: the authored canvas size and element coordinates
- display space: how that document is scaled and presented on the current device

That means:

- document width should stay stable
- mobile should not rewrite the authored layout just because the screen is smaller
- the viewport should scale the document to fit available space

### Recommended next implementation goals

#### 1. Add a true mobile editor mode

Instead of simply stacking all three desktop columns, mobile should prefer:

- canvas-first view
- collapsible or drawer-based controls
- reduced always-visible chrome

#### 2. Make auto-fit the default display behavior

The canvas should compute a display scale from available viewport width, rather than relying on a manual fit button as the main rescue path.

#### 3. Decouple document width from visible viewport width

The app should store and reason about:

- authored canvas width
- authored content width / padding rules
- display scale

These should not all come from `canvas.clientWidth`.

#### 4. Replace desktop-biased width clamping

Current content width rules should stop forcing narrow or unusual canvas sizes back into a desktop-friendly range.

#### 5. Keep export and edit geometry consistent

The same authored document should:

- edit correctly
- scale correctly on device
- export correctly

without re-authoring element geometry just because the viewport changes.

### Practical next-step order for this repo

1. Introduce an explicit authored canvas width in state.
2. Compute a display scale from available stage width.
3. Make mobile default to a canvas-first mode.
4. Revisit content width rules so they respect authored canvas width.
5. Only after that, continue larger architecture refactors.

## Shipping Note

For GitHub Pages MVP, the app is suitable because it is:

- static
- local-first
- browser-only
- build-step-free

The main product tradeoff is that persistence is browser-local. Users can browse and use the app on GitHub Pages, but their data will stay in that browser only unless export/import or cloud sync is added later.

## Framework Decision Notes

### Is this repo already using a frontend framework

No.

Current stack is still:

- static HTML
- CSS
- vanilla JavaScript modules
- browser APIs

That means this repo is already a dynamic frontend app, but it is not using React or Vue.

### Does using React or Vue mean the site is no longer static

No.

React or Vue changes how the frontend is authored, not whether the final deployment is static.

It is still possible to:

- use React or Vue
- build the app into static files
- deploy the result to GitHub Pages

So the more accurate distinction is:

- current repo: static deployment + dynamic frontend behavior + no framework
- future React/Vue repo: static deployment + dynamic frontend behavior + component framework

### Would React or Vue make the code shorter

Sometimes, but that is not the main benefit.

The bigger benefit is structure.

In vanilla JS, complex UI tends to accumulate:

- repeated DOM queries
- manual event wiring
- manual state-to-DOM synchronization
- large files with mixed responsibilities

React or Vue usually improves maintainability because UI is split into components with clearer responsibilities.

Typical benefits:

- easier file-level separation
- clearer state flow
- easier reuse for buttons, dialogs, panels, controls
- less manual DOM synchronization

So the core value is not just fewer lines of code.
The core value is a cleaner mental model for growing UI complexity.

### When staying on vanilla JS still makes sense

- MVP speed matters more than architecture
- the team wants minimal tooling
- framework migration would slow current product iteration
- the main problems are still layout and UX correctness

### When moving to React or Vue starts to make sense

- the editor shell becomes more complex
- mobile and desktop UIs diverge more
- side panels, dialogs, and controls keep growing
- state synchronization becomes hard to reason about
- the repo needs more modular long-term maintenance

### Recommended order for this repo

For this project, the practical order is:

1. Fix layout architecture first.
2. Separate document-space rules from display-space rules.
3. Continue modularizing core logic.
4. Only then reconsider React or Vue migration.

That is a better order than migrating to a framework first and hoping it will solve layout problems by itself.
