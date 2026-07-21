# Build Week Demo — Presenter Script and Click Guide

Target length: **2:30–2:45**. The English under **Say** is the transcript to read in your own voice. The Chinese under **Do** is not spoken; it tells you exactly what to show.

## Before recording

1. Record at 1920×1080 if possible. Keep browser zoom at 100% and use the Day theme.
2. Run the app locally with `npm run dev`; use the local URL because `.dev.vars` contains the server-side API key. Never show the terminal, `.dev.vars`, API dashboard, or Network panel in the recording.
3. Create a clean Plog, then return to the editor before recording.
4. Copy these two inputs so you can paste them quickly:
   - Trip notes: `A quiet autumn walk through Kyoto temples and gardens after rain, from tiled rooftops and moss paths to shaded wooden corridors.`
   - Your voice: `First person, observant and restrained. Keep the prose concrete.`
5. Open the GitHub README in a second tab. Keep both exported JPGs available for the final shots.
6. It is fine to cut out the model waiting time. Do not cut between **Apply draft** and **Undo**, because that interaction is important evidence.

## 0:00–0:18 — Problem and product

**Do**

- Start on the clean editor.
- At “after a trip,” click **Load example**.
- Let the twelve selected Kyoto photographs finish loading.

**Say**

> After a trip, I have hundreds of photos and fragments of memory, but little patience to shape them into a story. Plog is a local-first picture-story composer. It creates an editable design, not a flattened AI image.

## 0:18–0:40 — Existing layout engine

**Do**

- Click one photo on the canvas.
- In the right panel, click the **Portra** image preset.
- Scroll a little so the long canvas and following blocks move into view.

**Say**

> Plog uses versioned content blocks and deterministic layout. Text height, image ratio, spacing, flow, and canvas growth are recalculated together, so manual editing, AI, and export share one document state.

## 0:40–1:08 — Generate a real GPT‑5.6 preview

**Do**

- Click **Draft with GPT‑5.6**.
- Paste the prepared text into **Trip notes** and **Your voice**.
- Click **Generate preview**.
- Cut out most of the waiting time, but leave about one second of the loading state.
- Pause on the completed preview so the title, sections, and photo numbers can be read.

**Say**

> Now I ask GPT‑5.6 Terra for a first draft. Instead of uploading every original separately, the browser creates one labeled, compressed contact sheet from two to twelve images. Only that sheet, my notes, and tone direction reach the server-side model. The API key never enters the browser, and the document is still unchanged.

## 1:08–1:30 — Review and apply

**Do**

- Point briefly at the proposed title and the chapter photo numbers.
- Click **Apply draft**.
- Slowly scroll through the generated title, chapter copy, and reordered photos.

**Say**

> The response is a structured plan: title, introduction, chapters, copy, and photo order. I review it first. Apply draft turns the proposal into ordinary Plog blocks, not a special AI-only result.

## 1:30–1:51 — Prove reversibility

**Do**

- Click an empty part of the canvas so no text cursor is active.
- Press `Cmd+Z` once. Pause on the restored twelve-photo document.
- Press `Cmd+Shift+Z` once to restore the AI draft.

**Say**

> Applying the AI plan is one atomic document command. One Undo restores the twelve selected image blocks, and Redo brings the draft back. AI is a reversible planner, not an autonomous publisher.

## 1:51–2:09 — Export the result

**Do**

- Open the arrow beside **Export** and briefly show **Balanced · recommended**, **Two files · balanced split**, **2x**, and **JPG**.
- Close the options and click **Export**.
- Briefly show the two downloaded JPGs side by side. Explain that they are two delivery files from one editable Plog, not two saved drafts.
- After the success message, show the first exported JPG, then the second continuation JPG, and scroll each one slightly.

**Say**

> I can export JPEG, PNG, WebP, or standalone editable HTML. The export is rendered from the same blocks and automatic layout as the editor.

## 2:09–2:34 — Codex and technical contribution

**Do**

- Switch to the GitHub README tab.
- Scroll through **Architecture** and **How GPT‑5.6 and Codex Are Used**.
- Briefly show the architecture diagram or the passing-test command, without opening secrets.

**Say**

> Codex helped turn my frontend prototype into this tested workflow. It introduced versioned commands and atomic history, built the contact-sheet and secure Responses API path, repaired export and mobile behavior, added integration tests, and documented the boundary between working features and roadmap.

## 2:34–2:47 — Honest ending

**Do**

- Return to the finished story and hold the frame.

**Say**

> Plog does not yet organize a thousand-photo library. Today it proves a smaller useful loop: selected moments in, one grounded, editable story out.

## Recording checks

- Total duration is below 3:00.
- Your voice is audible throughout; background music is optional and much quieter than speech.
- The recording visibly shows **Generate preview**, the real returned preview, **Apply draft**, one-step **Undo**, **Redo**, and **Export**.
- The narration explicitly says **GPT‑5.6 Terra** and **Codex**.
- No API key, `.dev.vars`, dashboard balance, terminal secret, or Network request body appears on screen.
- Watch the exported MP4 once before uploading it publicly to YouTube.
