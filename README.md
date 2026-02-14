# mkly editor

A visual editing environment for mkly documents with live preview and style inspector.

<p>
  <a href="https://hubdev.ai/playground/mkly-editor">Try the Live Editor</a> &nbsp;·&nbsp;
  <a href="https://hubdev.ai/projects/mkly/docs">Documentation</a> &nbsp;·&nbsp;
  <a href="https://github.com/HubDev-AI/mkly-editor">GitHub</a>
</p>

---

<!-- Screenshot: Full editor with 3 panes -->
<!-- Add: docs/images/editor-full.png -->
![mkly editor — source, preview, and style inspector](../docs/images/editor-full.png)

The editor is a three-pane environment where everything stays in sync. Write mkly source on the left, see the compiled HTML on the right, and tweak styles in an inspector panel — all in real time.

> **[Open the live editor →](https://hubdev.ai/playground/mkly-editor)**

## Source Pane

<!-- Screenshot: Source pane closeup showing syntax highlighting and gutters -->
<!-- Add: docs/images/editor-source.png -->
![Source pane with syntax highlighting and colored block gutters](../docs/images/editor-source.png)

A CodeMirror 6 editor with:

- **mkly syntax highlighting** — blocks, properties, content, and style blocks each have distinct colors
- **Colored block gutters** — each block type gets a color bar in the gutter so you can scan the document structure at a glance
- **Autocomplete** — block names, property names, and property values complete as you type. Kit-aware: if you've loaded the newsletter kit, newsletter blocks appear in completions
- **Validation** — unknown properties or invalid values are flagged inline

## Preview Pane

<!-- Screenshot: Preview pane showing a rendered newsletter -->
<!-- Add: docs/images/editor-preview.png -->
![Live preview of a newsletter with the sunset-boulevard theme](../docs/images/editor-preview.png)

The preview renders your document in a sandboxed iframe. It updates as you type — no save step, no refresh.

The preview can also run in **WYSIWYG mode**: edit text directly in the preview and the changes are reverse-converted back to mkly source. The source pane updates to match.

## Style Inspector

<!-- Screenshot: Style inspector with tabs, color pickers, spacing inputs -->
<!-- Add: docs/images/editor-inspector.png -->
![Style inspector showing Self tab with color picker, spacing inputs, and border radius](../docs/images/editor-inspector.png)

The inspector is context-aware — it changes based on what's under your cursor:

| Cursor on... | Inspector shows... |
|---|---|
| `--- core/card` | Block properties (image, link, etc.) |
| `--- style` block | CSS controls for the targeted block |
| `--- meta` | Document metadata fields |
| `--- theme: ...` | Theme info and variables |
| `--- preset: ...` | Preset info and applied styles |

When editing styles, the inspector shows **tabs for each target**: Self, Hover, Image, Link, Body — depending on the block type. A card gets image and link tabs. A divider gets just height and color. The available controls are determined by `styleHints` on each block definition.

Controls are generated from a data-driven schema:

- **Color pickers** for `color`, `background`, `border-color`
- **Spacing inputs** for `padding`, `margin`, `gap`
- **Alignment buttons** for `text-align`, `justify-content`
- **Dropdowns** for `display`, `cursor`, `overflow`
- **Sliders** for `opacity`, `border-radius`
- **Text inputs** for `font-family`, `box-shadow`, custom values

Every change in the inspector patches the `--- style` block in your source. The cursor position is adjusted by the line delta so the editor doesn't jump.

## Architecture

```
Source (CodeMirror) ←→ Store (Zustand) ←→ Preview (iframe)
                            ↕
                     Style Inspector
                            ↕
                     StyleGraph (immutable)
```

The store holds the document source. Source changes trigger recompilation through the mkly compiler. Style inspector changes mutate the StyleGraph immutably and serialize it back into the `--- style` block. The preview iframe receives the compiled HTML + CSS and renders it.

## Embed in Your App

```typescript
import { MklyEditor } from '@milkly/mkly-editor';

function App() {
  return (
    <MklyEditor
      initialSource={source}
      kits={{ core: CORE_KIT, newsletter: NEWSLETTER_KIT }}
      onChange={(source) => console.log(source)}
    />
  );
}
```

## Development

```bash
bun install
bun run dev    # Vite dev server
bun run build  # production build
```

Built with CodeMirror 6, React 18, Zustand, and Vite.

## Related

- **[@milkly/mkly](https://github.com/HubDev-AI/mkly)** — Core language (parser, compiler, style system)
- **[mkly-kits](https://github.com/HubDev-AI/mkly-kits)** — Newsletter and docs block kits
- **[mkly-plugins](https://github.com/HubDev-AI/mkly-plugins)** — Email and docs output plugins

> **[Full documentation →](https://hubdev.ai/projects/mkly/docs)**
