# @milkly/mkly-editor

> Visual editor for mkly — CodeMirror 6 source editor, live HTML preview, and a schema-driven style inspector.

## Overview

The mkly editor is a split-pane editing environment with three synchronized views:

**Source Editor** — CodeMirror 6 with mkly syntax highlighting, block-aware autocompletion, property validation, and cursor-context tracking.

**Live Preview** — Real-time HTML output rendered in an iframe. Supports both view-only and WYSIWYG editable modes with bidirectional sync between source and preview.

**Style Inspector** — A data-driven property panel that adapts to the block under the cursor. Shows relevant CSS properties grouped by sector (Layout, Sizing, Spacing, Typography, Background, Border, Effects, Animation) with controls generated from the style schema.

## Architecture

```
Source (CodeMirror) ←→ Store (Zustand) ←→ Preview (iframe)
                           ↕
                    Style Inspector
                           ↕
                    StyleGraph (immutable)
```

The editor uses a Zustand store as the single source of truth. Source changes trigger recompilation. Preview edits are reverse-converted to mkly and patched back into the source. Style inspector changes mutate the StyleGraph immutably and serialize it back to the `--- style` block.

## Key Components

### Editor
- `MklyEditor` — CodeMirror 6 wrapper with mkly language mode, block-color gutter decorations, and diff-based document updates that preserve cursor position.

### Inspector
- `PropertyInspector` — Routes to the correct inspector based on cursor context (block properties, style editor, meta, theme info, preset info).
- `StyleEditor` — Schema-driven CSS editor with per-target tabs (Self, Hover, Image, Link, etc.). Filters available properties using the block's `styleHints`. Renders controls dynamically: color pickers, spacing inputs, alignment buttons, select dropdowns, sliders, text fields.
- `PropertyForm` — Block property editor with schema-validated fields.

### Preview
- `PreviewPane` — Iframe-based live preview with view/edit mode toggle.
- `EditablePreview` — WYSIWYG editing within the preview. Handles contentEditable, block selection, and reverse conversion.
- `SyncEngine` — Bidirectional sync between source and preview using diff-match-patch for minimal updates.

### Store
- `editor-store.ts` — Central Zustand store: source text, compiled output, cursor position, theme/preset selection, panel visibility.
- `block-properties.ts` — Style mutations (`applyStyleChange`) that return `lineDelta` for cursor adjustment after source patching.
- `use-cursor-context.ts` — Derives the block type, label, and target under the cursor from the source text.

## Development

```bash
bun install
bun run dev    # Vite dev server
bun run build  # Production build
```

## Tech Stack

- **Editor**: CodeMirror 6
- **State**: Zustand 4
- **Compile**: `@milkly/mkly` (real-time)
- **Preview**: iframe with postMessage
- **Sync**: diff-match-patch
- **Build**: Vite
