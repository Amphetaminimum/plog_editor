# Build Week Demo Video — 2:35 Target

The submission requires a public YouTube video under three minutes with audio explaining both Codex and GPT‑5.6. Record at 1080p, keep the browser at a readable zoom, and use the English voiceover below. Captions can reuse the same text.

The narration-only source is also available in [`BUILD_WEEK_VOICEOVER.txt`](BUILD_WEEK_VOICEOVER.txt) for recording, captions, or local text-to-speech.

## Shot List and Voiceover

### 0:00–0:18 — The problem

**Screen:** Start on the empty Plog editor, then choose **Load example** so six images appear.

**Voiceover:** “After a trip, I have photos, fragments of memory, and no patience for turning them into a coherent story. Plog is a local-first picture-story composer that keeps the result editable instead of returning a flattened AI artifact.”

### 0:18–0:40 — The existing engine

**Screen:** Select a block, change spacing or an image preset, and show the long canvas reflow.

**Voiceover:** “Under the interface is a versioned block model and a deterministic layout engine. Text height, image aspect ratio, block flow, and canvas growth are recalculated so the same document can drive the editor and export renderer.”

### 0:40–1:15 — GPT‑5.6 input and preview

**Screen:** Choose **Draft with GPT‑5.6**. Type a short factual note and tone direction. Choose **Generate preview**. Pause on the preview.

**Voiceover:** “For this Build Week flow, the browser reduces six local images to one labeled, compressed contact sheet. Only that low-detail sheet, my notes, and optional voice guidance reach a server-side GPT‑5.6 Terra call. Structured Outputs returns a bounded story plan: title, chapters, copy, and photo order. My API key never reaches the browser, and nothing has changed yet.”

### 1:15–1:47 — Apply as commands, then Undo

**Screen:** Choose **Apply draft**. Show the completed story. Edit one sentence. Press `Cmd/Ctrl+Z` once to undo the whole AI application, then Redo if desired.

**Voiceover:** “I review before applying. The plan is compiled into the same document commands the manual UI uses. The result is ordinary editable blocks, not special AI output. The entire application is one atomic history operation, so one Undo restores the six original image blocks.”

### 1:47–2:08 — Export

**Screen:** Apply again or Redo, then export the Balanced JPG. Briefly show the result.

**Voiceover:** “Plog then renders the state to a shareable JPG, PNG, WebP, or standalone editable HTML file. The layout and export path existed first; GPT‑5.6 adds a reversible planning layer on top.”

### 2:08–2:28 — How Codex was used

**Screen:** Show the repository README, tests, `document-commands.js`, `story-plan.js`, and the passing test summary.

**Voiceover:** “Codex helped turn an existing prototype into this tested workflow: it audited the architecture, introduced the command boundary and atomic batches, built the secure Responses API and contact-sheet pipeline, improved mobile export UX, wrote integration tests, and documented the product boundary.”

### 2:28–2:35 — Honest ending

**Screen:** Return to the final story.

**Voiceover:** “Plog does not yet organize a thousand-photo library. Today it proves the smaller, useful loop: six moments in, one editable story out.”

## Recording Checklist

- Use a deployment with `OPENAI_API_KEY` configured and test the GPT call immediately before recording.
- Keep the network panel and any secrets off screen.
- Record one uninterrupted core flow; use cuts only to remove model wait time.
- Verify narration explicitly says “Codex” and “GPT‑5.6”.
- Export/upload as a public YouTube video shorter than 3:00.
- Add the public video URL and `/feedback` Codex Session ID to Devpost.
