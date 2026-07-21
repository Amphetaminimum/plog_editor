# Build Week Demo — Presenter Script and Click Guide

Target length: **2:30–2:50**. Read only the English under **Say**. The instructions under **Do** are not spoken.

The original clean narration rehearsal was **1:55** (about **134 words per minute**). The revised narration is 314 words, or roughly **2:21** at the same comfortable pace. The remaining 10–30 seconds should come from visible actions, short review pauses, and one edited cut across model waiting—not from adding filler to the script.

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

**Say**

> After a trip, I usually come home with hundreds of photos and little fragments of memory—but not much patience to turn them into something I can share. That's why I built Plog: to turn selected moments into one editable visual story.

## 0:20–0:40 — Start with selected photos

**Do**

- Click **Load example**.
- Let all twelve Kyoto photographs appear.
- Scroll through several of the loaded photos.
- Select one photo and apply the **Portra** image preset.

**Say**

> Okay, so let's load a small example from one of my Kyoto trips. I've already picked these twelve photos. I can add text and images in the order I want, then use a few presets or filters to adjust the look.

## 0:40–1:09 — Ask GPT‑5.6 for a first draft

**Do**

- Click **Draft with GPT‑5.6**.
- Paste the prepared text into **Trip notes**.
- Leave **Writing style · optional** empty.
- Click **Generate preview**.
- Keep about one second of the loading state, then cut to the completed Preview.
- Pause so the proposed title, chapters, and photo numbers can be read.

**Say**

> Now, this is where GPT‑5.6 helps me get started. I'll add a little context—this was a quiet walk through Kyoto just after the rain. Plog combines the photos into one compressed contact sheet, and GPT‑5.6 uses it with my note to propose a title, photo order, and chapters. This is still just a preview.

## 1:09–1:35 — Review, apply, and keep editing

**Do**

- Point briefly at the proposed title and chapter photo numbers.
- Click **Apply draft**.
- Scroll through the generated story.
- Click inside one generated chapter heading or paragraph, make one small text edit, then click outside it.

**Say**

> Okay, this looks pretty close, so I'll apply it. It doesn't become a flattened AI image or a locked template. It's ordinary Plog content, so I can rewrite the text, adjust the filters, or keep building the story block by block.

## 1:35–1:46 — A quick reversibility check

**Do**

- Undo the small text edit once, then redo it.
- Do not pause on keyboard shortcuts or explain the underlying command system.

**Say**

> AI gives me a useful starting point, but I still control the document. I can undo that edit—and bring it back.

## 1:46–2:09 — Export the continuous story

**Do**

- Open the arrow beside **Export**.
- Briefly show **Balanced · recommended**, **2x**, and **JPG**.
- Close the options and click **Export**.
- After the success message, show the exported long JPG.
- Show the title and first chapter, jump briefly to the middle, then finish on the final section. Do not slowly scroll through every photograph.

**Say**

> Once I'm happy with the story, I can export it with the balanced preset at two-times resolution. And that's it: one continuous JPEG with the complete reading flow preserved. PNG and WebP are also available.

## 2:09–2:25 — Codex contribution

**Do**

- Stay on the finished Plog. There is no need to switch to source code or explain individual modules.

**Say**

> I built and refined Plog with Codex, from the block-based editing workflow to the secure GPT‑5.6 integration, reversible editing, browser testing, and reliable long-image export.

## 2:25–2:50 — Honest next step

**Do**

- Hold on the finished story or the exported long JPG.

**Say**

> Right now, I still choose the photos before bringing them into Plog. The next step is to do more of that filtering locally, using timestamps, GPS, duplicate and blur detection, and burst clustering. Then only a small contact sheet of representative photos would go to AI for final selection, chapter planning, and an editable first draft.

## Recording checks

- Total duration is below 3:00.
- Your spoken narration is audible throughout; background music is optional and much quieter than speech.
- The recording visibly shows **Load example**, the twelve selected photos, **Generate preview**, the returned plan, **Apply draft**, a manual text edit, Undo/Redo, and the continuous long-image export.
- The narration explicitly says **GPT‑5.6** and **Codex**.
- It never claims that photo selection, long-term writing-style memory, or the thousand-photo pipeline already works.
- No API key, `.dev.vars`, API dashboard, terminal secret, or Network request body appears on screen.
- Watch the exported MP4 once before uploading it publicly to YouTube.
