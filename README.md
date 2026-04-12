# Long Canvas Plog Editor

A local-first long-canvas editor for image-led visual blogs.

## Stack

- Static frontend
- HTML + CSS + JavaScript modules
- IndexedDB for document persistence
- No build step

## Run

```bash
python3 -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173).

## Repo Structure

```text
.
├── doc/
│   ├── OPTIMIZATION_NOTES.md
│   ├── PRD.long-canvas-plog-editor.md
│   └── archi.mermaid
├── index.html
├── styles.css
├── app.js
├── js/
│   ├── dialog.js
│   └── storage.js
└── favicon.svg
```

## Current Architecture

- `index.html`
  Main shell, templates, inspector, dialog mount point
- `styles.css`
  Tokens, layout, editor surface, components, dark theme
- `app.js`
  Editor state, rendering, layout flow, formatting, export, event wiring
- `js/storage.js`
  IndexedDB persistence helpers
- `js/dialog.js`
  Reusable in-app text dialog

## Product Boundaries

Current scope:

- long canvas editing
- local documents
- text, image, divider, header, quote, card
- PNG/JPG/WebP export
- HTML export

Not yet production-complete:

- robust rich text model
- image crop/rotate handles on-canvas
- batch export
- cloud sync
- collaboration

## Migration Note

If this project later moves to iOS, the data model and layout rules can be reused.
The UI layer and editing interactions should be treated as replaceable.
