import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { CompletionData } from '@milkly/mkly';

/**
 * CodeMirror ViewPlugin that colors block type names on `--- blockType` lines
 * using the color defined in BlockDocs (from kits). Unknown blocks get no color.
 */
export function blockColorPlugin(data: CompletionData) {
  const BLOCK_RE = /^---\s+\/?(\w+(?:\/\w+)?)/;

  function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = view.state.doc.lineAt(pos);
        const match = line.text.match(BLOCK_RE);
        if (match) {
          const blockType = match[1];
          const docs = data.docs.get(blockType);
          const color = docs?.color;
          if (color) {
            // Color the block type name portion (after "--- " or "--- /")
            const nameStart = line.text.indexOf(match[1]);
            if (nameStart >= 0) {
              builder.add(
                line.from + nameStart,
                line.from + nameStart + match[1].length,
                Decoration.mark({
                  attributes: { style: `color: ${color}; font-weight: 700` },
                }),
              );
            }
          }
        }
        pos = line.to + 1;
      }
    }

    return builder.finish();
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
