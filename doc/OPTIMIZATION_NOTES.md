# Optimization Notes

## Overview

This repo is already functional as a local-first static editor, but it is still structured like a prototype. The main risk is not missing features. The main risk is that state, rendering, persistence, export, and editing logic are too tightly coupled, which will make future changes slower and more fragile.

## Current Status

### To-Do Checklist

- [x] Reduce render cost and render frequency
- [x] Fix persistence timing and flush behavior
- [x] Move uploaded images to Blob-based asset storage
- [x] Add IndexedDB connection reuse
- [x] Start mobile / weird canvas size support
- [~] Clean up topbar options and menu-dismiss behavior
- [~] Move text-only formatting actions into contextual settings UI
- [~] Redesign document management into a drawer-style flow
- [~] Replace snapshot-based undo/redo with operation-based history
- [~] Finish storage layer normalization
- [ ] Decouple rich text editing from `execCommand`
- [~] Sanitize `contenteditable` HTML before persistence/export
- [~] Replace CSS `zoom` with a more controlled scaling model
- [ ] Add tests
- [~] Split `app.js` into modules

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

#### Current product priority: simplify top-level UI before deeper architecture work

The next round should prioritize product cleanup and interaction clarity over further internal refactors.

The current top-level shell still exposes controls that feel prototype-ish:

- the `Options` menu mixes export settings with editor actions
- the `Options` dropdown currently depends on re-clicking the trigger instead of dismissing naturally on outside click
- text formatting actions (`Undo`, `Redo`, `Bold`, `Italic`, `Clear`) live in the global top bar even though they only matter while editing text content
- document management is visually prominent but still reads like a raw control cluster instead of a designed workflow

This changes the short-term priority order:

1. simplify the topbar and remove or relocate controls that do not need permanent global presence
2. make menus and contextual editing affordances behave more naturally
3. improve document browsing / switching UX
4. continue architecture cleanup after the interaction model is clearer

#### In progress: Split `app.js` into modules

Status:

- still a single large runtime file
- some internals are cleaner now, but the architecture is still monolithic
- extracted so far:
  `js/canvas-layout.js`
  `js/doc-store.js`
  `js/editor-render.js`
  `js/export-manager.js`
  `js/history-manager.js`
  `js/render-state.js`
  `js/shell-manager.js`

Remaining heavy areas in `app.js`:

- editor DOM rendering / node sync
- editor interaction handlers
- history model
- inline rich-text command flow

Recent dependency cleanup:

- `shell-manager` no longer persists zoom changes directly
- `doc-store` no longer pushes history or drives UI sync directly
- `app.js` now acts more clearly as the orchestration layer after doc restore / doc switch / history restore
- display scaling now uses `transform: scale(...)` instead of CSS `zoom`

Priority note:

- this is now a background refactor, not the immediate next milestone
- further extraction should follow the upcoming UI decisions so we do not move code twice

#### Not done yet: Clean up topbar options and menu-dismiss behavior

Status:

- `Layout Locked` still has real behavior: it controls whether flow re-layout runs automatically and whether block dragging is allowed
- `Fit To Frame` still has real behavior: it reapplies fit zoom for the current stage width
- `Auto Layout` has now been removed from the topbar because it overlapped with the existing locked-flow model
- the `details`-based menus now dismiss on outside click and on `Escape`
- the old generic `Options` entry has been split so canvas actions and export settings are no longer mixed together
- theme, zoom, and canvas actions have now been consolidated into a single `View` entry
- the top bar is much cleaner, but it still needs a later pass to decide whether any remaining controls should move deeper into the app

Desired next step:

- audit every topbar control for whether it belongs in the topbar, settings panel, or nowhere
- keep export concerns and canvas/view concerns separate
- remove any remaining redundant actions once the intended editing model is confirmed

#### Not done yet: Move text-only formatting actions into contextual settings UI

Status:

- `Undo`, `Redo`, `Bold`, `Italic`, and `Clear` have been moved out of the global top bar into the right-side inspector
- in practice these actions are most relevant only when a text-like block is selected or actively being edited
- the controls now only appear for text-like selections, which better matches the "select block -> edit in settings" model
- `Undo` / `Redo` now have clearer product behavior: keyboard shortcuts remain global, while the contextual buttons expose local availability via enabled / disabled states
- we may still want a later pass on whether history should get an additional always-visible affordance

Desired direction:

- keep the top bar focused on document-level and canvas-level actions
- decide whether the current shortcut-plus-contextual-button model is sufficient, or whether history needs a stronger always-visible affordance

#### Not done yet: Redesign document management into a drawer-style flow

Status:

- document switching has been moved out of the top bar and into a dedicated left-side drawer entry point
- the drawer now supports browsing current documents with title, lightweight preview text, and a stronger card-style visual hierarchy
- create / rename / delete actions now live inside the drawer instead of the global toolbar
- the current model still uses derived previews rather than persisted thumbnails, which keeps storage simple but leaves room for richer cards later

Desired direction:

- continue refining the drawer interaction and visual hierarchy
- explore richer document list items with title, preview text, and possibly lightweight thumbnails
- keep IndexedDB pressure in mind and prefer derived or lightweight preview metadata over large duplicated payloads
- separate "switch document" from "manage document lifecycle" so the workflow feels less like a raw form control

#### Not done yet: Replace snapshot-based undo/redo with operation-based history

Status:

- history still stores large snapshots
- image pressure is lower now because images moved to assets
- but the history model is still more expensive than it should be
- snapshot history is now capped to a fixed number of entries so it cannot grow without bound during long editing sessions
- mutation write points are now explicitly classified by kind (`structure`, `layout`, `style`) at commit time, which gives the next refactor a clearer boundary map

Desired next step:

- use the new mutation kinds to identify which actions can move to operation-based history first
- `structure.insert` and `structure.delete` have now started using operation entries in a mixed-mode history model
- `layout.move` and `layout.resize` now also use operation entries in the mixed-mode model
- unlocked block dragging now stays on the vertical flow axis and reorders blocks in-place instead of allowing free horizontal drift
- `layout.spacingBefore`, `layout.canvasWidth`, and `layout.lockToggle` now also use operation entries with before/after layout state
- direct single-property style edits now use operation entries as well (`fontSize`, `fontFamily`, `fontWeight`, `color`, image adjustments, and frame style)
- explicit rich-text formatting actions (`bold`, `italic`, `clear format`) now use per-block operation entries instead of full-document snapshots
- text input now records one `content.edit` operation per editing session instead of taking full snapshots on every change
- keep the remaining layout and style mutations on snapshots until the mixed-mode path is proven stable
- start with `structure` and `layout` operations before touching rich-text content mutations

#### Not done yet: Finish storage layer normalization

Status:

- `assets` store exists
- but storage is not yet a fully normalized data layer with explicit schema strategy and clearer document/metadata separation
- document records now carry lightweight `meta` alongside full `data`, so drawer previews no longer have to derive title/meta/preview text from every stored document on demand

#### Not done yet: Decouple rich text editing from `execCommand`

Status:

- inline `bold`, `italic`, and `clear format` no longer depend on `execCommand`
- richer browser-editing behavior still relies on the legacy selection/contenteditable model, so this refactor is not complete yet

#### In progress: Sanitize `contenteditable` HTML before persistence/export

Status:

- editable HTML now passes through a shared sanitizer before render/write-back
- paste handling now sanitizes clipboard HTML before insertion
- exported HTML now escapes the document title
- this substantially reduces uncontrolled markup persistence, but the rich-text command model still depends on legacy browser behavior

Desired next step:

- verify sanitized paste behavior across text, header, quote, and card blocks
- confirm state-render fallback preserves expected line-break semantics
- keep this work aligned with the later removal of `execCommand`

#### Not done yet: Replace CSS `zoom`

Status:

- display scaling still relies on `style.zoom`
- this remains a portability and layout math issue

#### In progress: Replace CSS `zoom` with a more controlled scaling model

Status:

- the main shell now scales the authored canvas through `transform: scale(...)` on the dedicated viewport wrapper
- the remaining `style.zoom` fallback path has been removed from `shell-manager`
- zoom persistence and fit/manual mode switching still exist, but this area still needs browser regression testing before being called done

#### Not done yet: Add tests

Status:

- no automated regression coverage yet

## Commit Map

### `4799063` `Init`

Initial project import.

Main scope:

- static frontend app shell
- vanilla JS editor runtime
- long-canvas editing MVP
- local-first persistence baseline

### `74cc069` `Optimize rendering and move image storage to assets`

Main work:

- reduced hot-path render cost
- added render batching and node reuse
- improved save flush timing
- added IndexedDB connection reuse
- moved uploaded images from inline document payloads to asset-backed Blob storage

Main code areas:

- `app.js`
- `js/storage.js`

### `6fc8485` `Improve mobile canvas layout and document sizing`

Main work:

- introduced authored canvas width thinking
- added auto-fit zoom mode
- started mobile canvas-first shell behavior
- updated optimization and reference notes

Main code areas:

- `app.js`
- `index.html`
- `styles.css`
- `doc/OPTIMIZATION_NOTES.md`

### Current interpretation of commit scope

Round 1:

- performance
- persistence reliability
- asset storage

Round 2:

- responsive shell direction
- canvas sizing model improvements
- mobile-first groundwork

## Priority Order

### 1. Simplify the topbar and `Options` menu

The current top bar still looks and behaves like a prototype shell.

Main issues:

- global controls include actions that are only meaningful in narrow editing contexts
- `Options` mixes export settings and editor actions
- dropdown menus do not dismiss on outside click
- some controls may be redundant now that mobile fit zoom and locked flow behavior exist

Immediate targets:

- review whether `Layout Locked`, `Fit To Frame`, and `Auto Layout` all need persistent UI
- keep export controls grouped together as export concerns
- make menus dismiss when clicking elsewhere
- reduce visual weight in the top-level shell

### 2. Move text-editing actions into contextual settings UI

The formatting button group should follow the selected element model instead of living permanently at the app level.

Why:

- these actions only apply to text-capable content
- contextual controls will make the settings panel feel more purposeful
- this reduces clutter in the top bar and clarifies which actions affect the current selection

Relevant areas:

- `index.html`
- `app.js`
- `js/editor-render.js`

### 3. Redesign document management UX

The current document controls are functional but visually blunt.

Goals:

- move doc browsing out of the top-level toolbar into a drawer-like interaction
- make document switching feel like navigation rather than form filling
- consider title, preview text, and optional thumbnail support without inflating IndexedDB usage

Relevant areas:

- `index.html`
- `styles.css`
- `app.js`
- `js/doc-store.js`

### 4. Replace snapshot-based undo/redo with operation-based history

History is still too expensive for larger documents and will become more limiting as the product UI improves.

### 5. Split `app.js` into modules after the UI model stabilizes

`app.js` still mixes app state, DOM wiring, interactions, persistence, and formatting flow, but the extraction plan should follow the next UI pass rather than lead it.

Suggested split after the UI decisions are settled:

- `editor-state.js`
- `editor-render.js`
- `editor-interactions.js`
- `editor-formatting.js`
- `editor-docs.js`

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
