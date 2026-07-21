# Build Week Goal Audit

This audit separates implemented and verified requirements from the one deliverable that still requires the presenter.

## P0 — GPT‑5.6 story plan becomes editable blocks

**Status: verified.**

- The bundled example loads twelve selected Kyoto image blocks.
- The browser creates one compressed labeled contact sheet and the server requests a strict GPT‑5.6 Terra JSON plan.
- `compileStoryPlanBatch()` converts the plan into normal document blocks as one atomic command.
- The browser integration test covers Preview, Apply, raster export, and one-step Undo back to the twelve selected blocks.
- The current implementation accepts 2–12 photos; the twelve-photo path is the recording demo.

## P0 — API key remains server-side

**Status: verified for the implemented local/server deployment boundary.**

- `worker/story-plan.js` reads `env.OPENAI_API_KEY` and adds the authorization header only in the server request.
- The browser calls `/api/story-plan` without receiving the key.
- `.dev.vars` and `.env*` are ignored by Git.
- Missing server credentials return an explicit 503 response and are covered by a test.

The public Sites deployment intentionally has no production key. The README now states that the public build demonstrates the editor and export, while the real GPT‑5.6 step is recorded locally with a server-side key. Adding a personal paid key to an unauthenticated public demo remains out of scope without durable quotas or authentication.

## P0 — README explains the Build Week project

**Status: verified.**

The README identifies the Build Week category, describes the end-to-end demo, distinguishes GPT‑5.6 runtime use from Codex development work, documents the architecture and server-side key boundary, links the live app, and states the current product limits.

## P0 — Open-source license

**Status: verified.**

The repository contains an MIT `LICENSE`, and the README links to it.

## P0 — Under-three-minute narrated video

**Status: pending presenter recording.**

- `BUILD_WEEK_VIDEO_SCRIPT.md` provides the timed click guide and exact English transcript to read aloud.
- Required final evidence is a presenter-recorded MP4 shorter than three minutes with audible narration, followed by a public YouTube URL.

The transcript alone does not satisfy this requirement.

## P1 — Loading, errors, Preview, Apply, and Cancel are safe

**Status: verified.**

- The dialog exposes loading text, Stop/Cancel, Preview, and Apply states.
- No command is dispatched until the user chooses Apply.
- The browser integration test simulates a 502 AI failure and asserts that all twelve original blocks remain and Apply stays unavailable.
- Successful Apply is one undoable command.

## P2 — 1,000-photo architecture is an honest roadmap

**Status: verified.**

`PHOTO_PIPELINE_ROADMAP.md` is headed “Not Implemented,” includes a Mermaid architecture diagram, separates local metadata/classical processing from model work, describes browser storage and compute constraints, and defines evaluation gates before implementation.

## Validation snapshot

- `npm test`: 45 passing tests, including the twelve-photo browser flow and two-file export.
- `npm run lint`: passes.
- `npm run build`: passes.
- `swift test`: 5 passing tests.

## Remaining completion gate

Record the video using the presenter script, then verify:

1. duration is below 3:00;
2. the presenter can be heard clearly;
3. GPT‑5.6 Terra and Codex are both named;
4. Generate Preview, returned plan, Apply, Undo/Redo, and Export are visible;
5. no secret or API dashboard is visible;
6. the final public YouTube URL is added to the Devpost submission.
