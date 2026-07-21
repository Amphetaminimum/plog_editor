# Build Week Demo — Presenter Script and Click Guide

Target length: **2:30–2:50**. Read only the English under **Say**. The instructions under **Do** are not spoken.

The original clean narration rehearsal was **1:55** (about **134 words per minute**). The revised narration is 276 words, or roughly **2:04** at the same comfortable pace. The remaining 25–45 seconds should come from visible actions, short review pauses, and one edited cut across model waiting—not from adding filler to the script.

## Before recording

1. Record at 1920×1080 if possible. Keep browser zoom at 100% and use the Day theme.
2. Run the app locally with `npm run dev`; `.dev.vars` supplies the API key to the server. Never show the terminal, `.dev.vars`, the API dashboard, or the Network panel.
3. Start on a clean Plog editor screen.
4. Copy this Trip note so it can be pasted quickly:
   `A quiet autumn walk through Kyoto temples and gardens after rain, from tiled rooftops and moss paths to shaded wooden corridors.`
5. Leave **Writing style · optional** empty. The demo does not claim that the API remembers the user or has learned a personal voice.
6. Keep the exported long JPG ready for the final shot. It is fine to cut most of the model waiting time, but leave about one second of the loading state.

## 0:00–0:20 — The problem

**Do**

- Start on the empty editor.
- Click **Load example**.
- Let all twelve Kyoto photographs appear.

**Say**

> After a trip, I usually have hundreds of photos and fragments of memory, but very little patience to turn them into something I can share. Plog helps me turn selected moments into one editable visual story.

## 0:20–0:38 — Start with selected photos

**Do**

- Scroll through several of the loaded photos.
- Select one photo and apply the **Portra** image preset.

**Say**

> For this demo, I am starting with twelve Kyoto photos I have already selected. I can arrange and style them manually, while Plog keeps the long page flowing as the content changes.

## 0:38–1:08 — Ask GPT‑5.6 for a first draft

**Do**

- Click **Draft with GPT‑5.6**.
- Paste the prepared text into **Trip notes**.
- Leave **Writing style · optional** empty.
- Click **Generate preview**.
- Keep about one second of the loading state, then cut to the completed Preview.
- Pause so the proposed title, chapters, and photo numbers can be read.

**Say**

> I add a short note with context the photos cannot explain by themselves. The browser combines the twelve photos into one compressed contact sheet—a labeled grid of small previews—and GPT‑5.6 uses it with my notes to propose chapters, photo order, and a concise first draft. Nothing has changed yet.

## 1:08–1:35 — Review, apply, and keep editing

**Do**

- Point briefly at the proposed title and chapter photo numbers.
- Click **Apply draft**.
- Scroll through the generated story.
- Click inside one generated chapter heading or paragraph, make one small text edit, then click outside it.

**Say**

> I review the proposal before applying it. Once applied, the result is not a flattened AI image or a locked template. It becomes ordinary Plog content, so I can rewrite the text, change the image treatment, or rearrange the story myself.

## 1:35–1:47 — A quick reversibility check

**Do**

- Undo the small text edit once, then redo it.
- Do not pause on keyboard shortcuts or explain the underlying command system.

**Say**

> AI gives me a useful starting point, but I remain in control of the document and can undo any change.

## 1:47–2:10 — Export the continuous story

**Do**

- Open the arrow beside **Export**.
- Briefly show **Balanced · recommended**, **2x**, and **JPG**.
- Close the options and click **Export**.
- After the success message, show the exported long JPG.
- Show the title and first chapter, jump briefly to the middle, then finish on the final section. Do not slowly scroll through every photograph.

**Say**

> I can export the same editable document as one continuous JPEG. The long image preserves the full reading flow, while PNG and WebP remain available for different sharing needs.

## 2:10–2:26 — Codex contribution

**Do**

- Stay on the finished Plog. There is no need to switch to source code or explain individual modules.

**Say**

> I built and refined Plog with Codex, from the block-based editing workflow to the secure GPT‑5.6 integration, reversible editing, browser testing, and reliable long-image export.

## 2:26–2:50 — Honest next step

**Do**

- Hold on the finished story or the exported long JPG.

**Say**

> Today, Plog starts with photos I have already selected. The next step is to use timestamps, GPS, duplicate and blur detection, and burst clustering locally. Only small contact sheets of representative candidates would reach AI for final selection, chapter planning, and an editable draft.

## Recording checks

- Total duration is below 3:00.
- Your spoken narration is audible throughout; background music is optional and much quieter than speech.
- The recording visibly shows **Load example**, the twelve selected photos, **Generate preview**, the returned plan, **Apply draft**, a manual text edit, Undo/Redo, and the continuous long-image export.
- The narration explicitly says **GPT‑5.6** and **Codex**.
- It never claims that photo selection, long-term writing-style memory, or the thousand-photo pipeline already works.
- No API key, `.dev.vars`, API dashboard, terminal secret, or Network request body appears on screen.
- Watch the exported MP4 once before uploading it publicly to YouTube.
