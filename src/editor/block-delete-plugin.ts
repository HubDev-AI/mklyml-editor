import { EditorView, ViewPlugin, GutterMarker, gutter } from '@codemirror/view';
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
 * Check if a block has a matching closing tag (--- /blockName) below it,
 * making it a container block (e.g. section, core/html).
 */
function isContainerBlock(doc: EditorView['state']['doc'], startLineNum: number, blockName: string): boolean {
  let depth = 1;
  for (let i = startLineNum + 1; i <= doc.lines; i++) {
    const text = doc.line(i).text;
    const open = text.match(BLOCK_RE);
    if (open && open[1] === blockName && !CLOSE_RE.test(text)) depth++;
    const close = text.match(CLOSE_RE);
    if (close && close[1] === blockName) {
      depth--;
      if (depth === 0) return true;
    }
  }
  return false;
}

/**
 * Find the full range of a block starting at `startLineNum`.
 * For container blocks (e.g. section), includes everything through the closing tag.
 * For normal blocks, includes everything up to the next block header.
 * Returns { from, to } character positions for deletion.
 */
function findBlockRange(view: EditorView, startLineNum: number): { from: number; to: number } {
  const doc = view.state.doc;
  const startLine = doc.line(startLineNum);
  const match = startLine.text.match(BLOCK_RE);
  if (!match) return { from: startLine.from, to: startLine.to };

  const blockName = match[1];
  let endLineNum = doc.lines; // default: end of document

  if (isContainerBlock(doc, startLineNum, blockName)) {
    // Container block: track depth to find matching close
    let depth = 1;
    for (let i = startLineNum + 1; i <= doc.lines; i++) {
      const lineText = doc.line(i).text;
      const open = lineText.match(BLOCK_RE);
      if (open && open[1] === blockName && !CLOSE_RE.test(lineText)) depth++;
      const close = lineText.match(CLOSE_RE);
      if (close && close[1] === blockName) {
        depth--;
        if (depth === 0) { endLineNum = i; break; }
      }
    }
  } else {
    // Normal block: ends at the line before the next block header
    for (let i = startLineNum + 1; i <= doc.lines; i++) {
      const lineText = doc.line(i).text;
      if (BLOCK_RE.test(lineText) || CLOSE_RE.test(lineText)) {
        endLineNum = i - 1;
        break;
      }
    }
  }

  // Calculate character range: include the newline before the block if possible
  const from = startLineNum > 1 ? doc.line(startLineNum - 1).to : startLine.from;
  const to = doc.line(endLineNum).to;

  return { from, to: Math.min(to, doc.length) };
}

/**
 * ViewPlugin that syncs mouseover on .cm-line to .mkly-line-hover on the
 * corresponding gutter element, bridging the CM6 DOM container boundary.
 */
const lineHoverPlugin = ViewPlugin.fromClass(class {
  private lastGutterEl: Element | null = null;

  constructor(readonly view: EditorView) {
    this.onMove = this.onMove.bind(this);
    this.onLeave = this.onLeave.bind(this);
    view.contentDOM.addEventListener('mousemove', this.onMove);
    view.contentDOM.addEventListener('mouseleave', this.onLeave);
  }

  onMove(e: MouseEvent) {
    const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) { this.clear(); return; }

    const gutterContainer = this.view.dom.querySelector('.mkly-delete-gutter');
    if (!gutterContainer) { this.clear(); return; }

    const gutterElements = gutterContainer.querySelectorAll('.cm-gutterElement');
    let matched: Element | null = null;
    for (const gel of gutterElements) {
      if (!gel.querySelector('.mkly-block-delete-btn')) continue;
      const gelRect = gel.getBoundingClientRect();
      if (e.clientY >= gelRect.top && e.clientY <= gelRect.bottom) {
        matched = gel;
        break;
      }
    }

    if (matched !== this.lastGutterEl) {
      this.clear();
      if (matched) {
        matched.classList.add('mkly-line-hover');
        this.lastGutterEl = matched;
      }
    }
  }

  onLeave() { this.clear(); }

  clear() {
    if (this.lastGutterEl) {
      this.lastGutterEl.classList.remove('mkly-line-hover');
      this.lastGutterEl = null;
    }
  }

  destroy() {
    this.clear();
    this.view.contentDOM.removeEventListener('mousemove', this.onMove);
    this.view.contentDOM.removeEventListener('mouseleave', this.onLeave);
  }
});

export function blockDeletePlugin(): Extension {
  return [
    gutter({
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
    }),
    lineHoverPlugin,
  ];
}
