# Plog

**Plog turns a set of visual moments into an editable long-form story—not a flattened AI artifact.**

Plog is a local-first, block-based picture-story composer. A user can arrange and edit content manually, import Markdown or structured JSON, or ask GPT‑5.6 to propose a grounded story plan from 2–12 images. Every path ends in the same versioned blocks, deterministic vertical layout, and editable export workflow.

Live demo: [plog-editor.renovacyoun.chatgpt.site](https://plog-editor.renovacyoun.chatgpt.site)

OpenAI Build Week track: **Apps for your life** — travel, personal creativity, and memory keeping.

## Build Week Demo

1. Choose **Load example** to place six visual frames on the canvas.
2. Choose **Draft with GPT‑5.6**, add optional trip notes and a writing sample, then generate.
3. Review the proposed title, chapters, copy, and image order. The document has not changed yet.
4. Choose **Apply draft**. The plan becomes ordinary editable Plog blocks.
5. Press `Cmd/Ctrl+Z` once to undo the entire AI operation, or continue editing and export JPG, PNG, WebP, or HTML.

The AI request does **not** upload the original files individually. For 2–12 selected images, the browser first creates one labeled, compressed, adaptive contact sheet and sends that low-detail image to a server-side OpenAI Responses API endpoint. The API key never enters client JavaScript. The bundled six-photo demo uses original AI-generated sample assets, so the repository does not depend on third-party photo licenses.

## What Works Today

- editable header, text, image, divider, quote, and card blocks
- deterministic vertical auto-flow and canvas height growth
- versioned document schema and pure commands, including atomic command batches
- image aspect-ratio preservation, filters, rotation, and frames
- local documents and Blob-backed image assets in IndexedDB
- Markdown and structured JSON import
- mixed operation/snapshot undo and redo
- GPT‑5.6 Terra six-image story planning with Structured Outputs
- explicit Preview / Apply / Cancel flow and one-step undo for an AI draft
- PNG, JPG, WebP, and standalone HTML export
- browser and macOS storage paths

## Run Locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .dev.vars
# Add your OPENAI_API_KEY to .dev.vars for the AI draft only.
npm run dev
```

Open the local URL printed by Vinext. The editor, local storage, import, layout, and export work without an API key; the AI draft endpoint returns a clear configuration error until the server has one.

For the static editor without the AI endpoint:

```bash
python3 -m http.server 5173
```

Then open [http://localhost:5173/editor.html](http://localhost:5173/editor.html).

## Test

```bash
npm test
npm run lint
npm run build
cd macos && swift test
```

The browser integration test covers the six-image contact sheet request, AI preview, Apply, single-step Undo, Markdown import, and raster export without spending API credits.

## Architecture

```text
manual UI ─┐
Markdown ──┼──> document commands ──> versioned blocks
JSON ──────┤                              │
GPT plan ──┘                              ├──> deterministic layout ──> editable DOM
                                           └──> raster / HTML export

six local images ──> compressed contact sheet ──> server endpoint ──> GPT‑5.6 plan
       originals remain local                     API key stays here
```

Important modules:

- `app.js` — editor orchestration and AI Preview / Apply / Cancel UI
- `js/document-commands.js` — pure block command reducer and atomic batches
- `js/story-plan.js` — validates an AI plan and compiles it into one undoable command
- `js/contact-sheet.js` — locally reduces 2–12 images to one adaptive labeled JPEG
- `worker/story-plan.js` — protected GPT‑5.6 Responses API integration
- `js/canvas-layout.js` — authored width, auto-flow, and canvas sizing
- `js/editor-render.js` — editable DOM preview
- `js/render-state.js` — state-based raster renderer
- `js/history-manager.js` — undo and redo
- `js/doc-store.js` and `js/storage.js` — local documents and image assets

The schema and command boundary is documented in [`doc/ADR-001-document-schema-and-commands.md`](doc/ADR-001-document-schema-and-commands.md).

## How GPT‑5.6 and Codex Are Used

- **GPT‑5.6 Terra at runtime:** reads one low-detail contact sheet plus optional notes and voice guidance, then returns a strict JSON story plan. It proposes grouping, order, headings, and a concise draft; it does not mutate the document directly.
- **Codex during Build Week:** audited and refactored the existing editor into a tested command boundary, implemented the contact-sheet and server pipeline, added atomic AI transactions, repaired export and responsive UX, wrote tests and documentation, and validated the complete browser flow.
- **Key product decision:** AI is a reversible planner, not an autonomous publisher. Preview and user approval are mandatory.

This repository existed before Build Week as a local-first long-canvas editor. The Build Week work added the programmable command layer, Markdown/JSON path, image export improvements, six-image GPT‑5.6 workflow, server-side key boundary, automated tests, and deployable Sites configuration. Add the `/feedback` Codex Session ID to the Devpost submission form as required by the event.

## Honest Scope

Plog does not currently ingest or cluster a 1,000-photo library, run local CV models, retouch images with an image-to-image model, publish a blog, or collaborate in the cloud. Those are not hidden demo features. The proposed large-library pipeline is documented as future work in [`doc/PHOTO_PIPELINE_ROADMAP.md`](doc/PHOTO_PIPELINE_ROADMAP.md).

The public AI endpoint has intentionally small request/output limits and a lightweight per-client demo limit. That is adequate for a judged demo, not production abuse prevention. A production release would need durable rate limits, authentication or quotas, consent and retention controls, and usage monitoring.

## License

MIT — see [`LICENSE`](LICENSE).
