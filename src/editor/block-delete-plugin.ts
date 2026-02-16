import { EditorView, GutterMarker, gutter } from '@codemirror/view';
import { RangeSet, type Extension } from '@codemirror/state';

const BLOCK_RE = /^---\s+([\w]+(?:\/[\w]+)?)/;
const CLOSE_RE = /^---\s+\/([\w]+(?:\/[\w]+)?)/;

class DeleteMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'mkly-block-delete-btn';
    el.textContent = '\u00d7'; // ×
    el.title = 'Delete block';
    return el;
  }
}

const deleteMarker = new DeleteMarker();

/**
 * Find the full range of a block starting at `startLineNum`.
 * For container blocks (e.g. section), includes everything through the closing tag.
 * Returns { from, to } character positions for deletion.
 */
function findBlockRange(view: EditorView, startLineNum: number): { from: number; to: number } {
  const doc = view.state.doc;
  const startLine = doc.line(startLineNum);
  const match = startLine.text.match(BLOCK_RE);
  if (!match) return { from: startLine.from, to: startLine.to };

  const blockName = match[1];
  let endLineNum = doc.lines; // default: end of document

  // Check for container: look for matching --- /blockName
  let depth = 1;
  for (let i = startLineNum + 1; i <= doc.lines; i++) {
    const lineText = doc.line(i).text;
    // Opening of same block type increases depth
    const openMatch = lineText.match(BLOCK_RE);
    if (openMatch && openMatch[1] === blockName && !CLOSE_RE.test(lineText)) {
      depth++;
    }
    // Closing tag decreases depth
    const closeMatch = lineText.match(CLOSE_RE);
    if (closeMatch && closeMatch[1] === blockName) {
      depth--;
      if (depth === 0) {
        endLineNum = i;
        break;
      }
    }
    // Next block at same level (not a closing tag) → this block ends before it
    if (depth === 1 && openMatch && openMatch[1] !== blockName) {
      endLineNum = i - 1;
      break;
    }
  }

  // Calculate character range: include the newline before the block if possible
  const from = startLineNum > 1 ? doc.line(startLineNum - 1).to : startLine.from;
  const to = doc.line(endLineNum).to;

  return { from, to: Math.min(to, doc.length) };
}

export function blockDeletePlugin(): Extension {
  return gutter({
    class: 'mkly-delete-gutter',
    markers(view) {
      const ranges: Array<ReturnType<typeof deleteMarker.range>> = [];
      for (let i = 1; i <= view.state.doc.lines; i++) {
        const line = view.state.doc.line(i);
        if (BLOCK_RE.test(line.text) && !CLOSE_RE.test(line.text)) {
          ranges.push(deleteMarker.range(line.from));
        }
      }
      return RangeSet.of(ranges);
    },
    domEventHandlers: {
      click(view, line) {
        const lineNum = view.state.doc.lineAt(line.from).number;
        const lineText = view.state.doc.line(lineNum).text;
        if (!BLOCK_RE.test(lineText) || CLOSE_RE.test(lineText)) return false;

        const { from, to } = findBlockRange(view, lineNum);
        view.dispatch({ changes: { from, to } });
        return true;
      },
    },
  });
}
