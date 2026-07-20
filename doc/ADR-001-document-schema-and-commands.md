# ADR-001: Versioned document schema and block commands

Status: Accepted

## Context

The editor already stores ordered `elements[]`, but UI events, persistence, history, and layout can mutate those objects directly. That makes a second input path such as Markdown repeat editor logic and makes undo behavior depend on the UI implementation.

## Decision

Plog uses a versioned document envelope and a small command vocabulary. The existing UI remains in place and is migrated incrementally; this ADR does not authorize a UI rewrite.

```json
{
  "version": 1,
  "id": "doc-1",
  "title": "Kyoto notes",
  "canvas": { "width": 1200, "background": "#ffffff", "flow": "vertical" },
  "blocks": [
    {
      "id": "text-1",
      "type": "text",
      "content": "Morning walk",
      "html": "Morning walk",
      "style": { "fontSize": 48, "color": "#1f1f22" },
      "spacingBefore": "normal"
    }
  ]
}
```

Version 1 supports the existing block types: `header`, `text`, `image`, `divider`, `quote`, and `card`. Image bytes remain outside the document and are referenced by `assetId`. `x`, `y`, and measured `height` are internal layout state, not authoring instructions for importers or agents.

The stable command names are:

- `block.insert` — `{ index, block }`
- `block.delete` — `{ id }`
- `block.move` — `{ id, toIndex }`
- `block.updateContent` — `{ id, patch }`
- `block.updateStyle` — `{ id, patch }`

Commands are applied by a pure reducer. Each successful command produces an inverse command for the existing history manager. UI controls, Markdown import, and JSON import must create the same commands rather than implement their own block mutations.

## Invariants

- block IDs are unique within a document
- block order is semantic reading order
- commands never mutate their input array or block objects
- layout remains deterministic for a given ordered block list, canvas width, and measured content
- importers may set supported content and style fields but may not inject executable HTML
- unknown schema versions and unsupported block types fail with a user-visible error

## Consequences

The command layer adds a small translation step to UI handlers, but gives history, importers, tests, and future renderer adapters one shared contract. A future gallery block or external design adapter requires a new documented mapping; it is not implied by version 1.
