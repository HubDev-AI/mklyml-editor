import { useEffect, useRef } from 'react';
import { EditorState, Compartment, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { mklyThemeDark } from '../editor/mkly-theme-dark';
import { mklyThemeLight } from '../editor/mkly-theme-light';
import { useEditorStore } from '../store/editor-store';
import { useExternalSync } from '../hooks/use-external-sync';
import { clearPendingScroll } from '../editor/safe-dispatch';
import { findHtmlPositionForBlock, resolveBlockLine, shouldScrollToBlock } from '../store/selection-orchestrator';
import { parseCursorBlock } from '../store/use-cursor-context';

const setHtmlHighlightEffect = StateEffect.define<{ from: number; to: number } | null>();

const htmlHighlightDeco = Decoration.line({ class: 'mkly-highlight-line' });

const htmlHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setHtmlHighlightEffect)) {
        if (e.value === null) return Decoration.none;
        const doc = tr.state.doc;
        const startLine = doc.lineAt(e.value.from);
        const endLine = doc.lineAt(Math.min(e.value.to, doc.length));
        const ranges = [];
        for (let i = startLine.number; i <= endLine.number; i++) {
          ranges.push(htmlHighlightDeco.range(doc.line(i).from));
        }
        return Decoration.set(ranges);
      }
    }
    return decos.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

interface HtmlSourceEditorProps {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}

const themeCompartment = new Compartment();
const wrapCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function findSourceSelectionFromCaret(
  text: string,
  pos: number,
): { sourceLine: number; tag: string | null } | null {
  const clamped = Math.max(0, Math.min(pos, text.length));
  const tagRe = /<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
  const stack: Array<{ tag: string; sourceLine: number | null }> = [];
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(text)) !== null) {
    if (m.index > clamped) break;
    const full = m[0];
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? '';
    const isClosing = full.startsWith('</');
    const isSelfClosing = /\/\s*>$/.test(full) || VOID_TAGS.has(tag);

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i];
        stack.splice(i, 1);
        if (frame.tag === tag) break;
      }
      continue;
    }

    const lineMatch = attrs.match(/\bdata-mkly-line="(\d+)"/);
    stack.push({
      tag,
      sourceLine: lineMatch ? Number(lineMatch[1]) : null,
    });

    if (isSelfClosing) stack.pop();
  }

  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    if (frame.sourceLine !== null) {
      return { sourceLine: frame.sourceLine, tag: frame.tag };
    }
  }

  const before = text.slice(0, clamped);
  const all = before.match(/\bdata-mkly-line="(\d+)"/g);
  if (!all) return null;
  const last = all[all.length - 1];
  const lineMatch = last.match(/\bdata-mkly-line="(\d+)"/);
  if (!lineMatch) return null;
  return { sourceLine: Number(lineMatch[1]), tag: null };
}

function findHtmlRangeForSourceLine(
  text: string,
  sourceLine: number,
): { from: number; to: number } | null {
  return findHtmlPositionForBlock(sourceLine, text);
}

export function HtmlSourceEditor({ value, onChange, readOnly = false }: HtmlSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const theme = useEditorStore((s) => s.theme);
  const viewMode = useEditorStore((s) => s.viewMode);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const wordWrap = useEditorStore((s) => s.htmlWordWrap);
  const localSelectionFrameRef = useRef<number | null>(null);
  const lastLocalLineRef = useRef<number | null>(null);
  const lastFocusVersionRef = useRef(-1);
  const hasBeenVisibleRef = useRef(false);

  onChangeRef.current = onChange;

  // External sync: skips updates while user is editing, re-syncs after cooldown
  const { markUserEdit, isExternalRef, flushPending } = useExternalSync(viewRef, value);

  useEffect(() => {
    if (!containerRef.current) return;

    const commitSelectionFromView = (view: EditorView, force = false) => {
      const pos = view.state.selection.main.head;
      const text = view.state.doc.toString();
      const selection = findSourceSelectionFromCaret(text, pos);
      if (!selection) return;
      const line = selection.sourceLine;

      const store = useEditorStore.getState();
      if (!force && store.focusOrigin === 'html' && store.cursorLine === line && lastLocalLineRef.current === line) {
        return;
      }
      lastLocalLineRef.current = line;
      store.focusBlock(line, 'html');
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        drawSelection(),
        history(),
        html(),
        htmlHighlightField,
        themeCompartment.of(mklyThemeDark),
        keymap.of([
          { key: 'Mod-z', run: () => { useEditorStore.getState().undo(); return true; } },
          { key: 'Mod-Shift-z', run: () => { useEditorStore.getState().redo(); return true; } },
          { key: 'Mod-y', run: () => { useEditorStore.getState().redo(); return true; } },
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalRef.current) {
            markUserEdit();
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet && !update.docChanged && !isExternalRef.current && update.view.hasFocus) {
            update.view.dispatch({ effects: setHtmlHighlightEffect.of(null) });
            if (localSelectionFrameRef.current !== null) {
              cancelAnimationFrame(localSelectionFrameRef.current);
            }
            localSelectionFrameRef.current = requestAnimationFrame(() => {
              localSelectionFrameRef.current = null;
              const currentView = viewRef.current;
              if (!currentView || !currentView.hasFocus) return;
              commitSelectionFromView(currentView);
            });
          }
        }),
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            const store = useEditorStore.getState();
            if (!store.stylePickMode || readOnly) return false;

            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null) return false;

            const text = view.state.doc.toString();
            const selection = findSourceSelectionFromCaret(text, pos);
            if (!selection) return false;
            const sourceLine = selection.sourceLine;

            const source = store.source;
            const { blockLine, blockType } = resolveBlockLine(sourceLine, source);
            if (blockLine === null || !blockType) return false;

            store.focusBlock(sourceLine, 'html');
            const selectionId = useEditorStore.getState().selectionId ?? undefined;
            const block = parseCursorBlock(source, sourceLine);
            const coords = view.coordsAtPos(pos);
            if (!coords) return false;

            const tag = selection.tag;
            const target = tag && !['div', 'section', 'article', 'main'].includes(tag)
              ? `>${tag}`
              : 'self';

            store.openStylePopup({
              blockType,
              target,
              targetTag: target.startsWith('>') ? (tag ?? undefined) : undefined,
              label: block?.label,
              sourceLine: blockLine,
              targetLine: target.startsWith('>') ? sourceLine : undefined,
              selectionId,
              anchorRect: {
                x: coords.left,
                y: coords.top,
                width: Math.max(1, coords.right - coords.left),
                height: Math.max(1, coords.bottom - coords.top),
              },
            });

            return false;
          },
          blur: () => {
            if (localSelectionFrameRef.current !== null) {
              cancelAnimationFrame(localSelectionFrameRef.current);
              localSelectionFrameRef.current = null;
            }
            const currentView = viewRef.current;
            if (currentView) {
              commitSelectionFromView(currentView, true);
            }
            flushPending();
            return false;
          },
        }),
        wrapCompartment.of(EditorView.lineWrapping),
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
        EditorState.tabSize.of(2),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      if (localSelectionFrameRef.current !== null) {
        cancelAnimationFrame(localSelectionFrameRef.current);
      }
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? mklyThemeDark : mklyThemeLight,
      ),
    });
  }, [theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartment.reconfigure(
        wordWrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [wordWrap]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // When the HTML tab becomes visible, force CM6 to remeasure (it was hidden)
  // and scroll to top on first display
  useEffect(() => {
    const view = viewRef.current;
    if (!view || viewMode !== 'html') return;
    view.requestMeasure();
    if (!hasBeenVisibleRef.current) {
      hasBeenVisibleRef.current = true;
      requestAnimationFrame(() => {
        viewRef.current?.dispatch({
          effects: EditorView.scrollIntoView(0, { y: 'start' }),
        });
      });
    }
  }, [viewMode]);

  // React to external selection: highlight exact selected source line when possible,
  // otherwise fall back to the containing block line.
  // Skip when hidden — dispatching scrollIntoView to a hidden CM6 instance
  // creates a pendingScrollTarget that crashes on the next document change.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (viewMode !== 'html') return;
    if (focusOrigin === 'html') return;
    if (focusVersion === lastFocusVersionRef.current) return;
    lastFocusVersionRef.current = focusVersion;
    if (view.hasFocus) return;

    requestAnimationFrame(() => {
      const v = viewRef.current;
      if (!v) return;
      if (v.hasFocus) return;

      const text = v.state.doc.toString();
      let range = findHtmlRangeForSourceLine(text, cursorLine);
      if (!range && activeBlockLine !== null && activeBlockLine !== cursorLine) {
        range = findHtmlRangeForSourceLine(text, activeBlockLine);
      }
      if (!range) return;

      isExternalRef.current = true;
      clearPendingScroll(v);

      v.dispatch({
        effects: setHtmlHighlightEffect.of({ from: range.from, to: range.to }),
      });

      if (shouldScrollToBlock(focusOrigin, 'html', focusIntent, scrollLock)) {
        const lineStart = v.state.doc.lineAt(range.from).from;
        v.dispatch({
          effects: EditorView.scrollIntoView(lineStart, { y: 'center' }),
        });
      }

      isExternalRef.current = false;
    });
  }, [cursorLine, activeBlockLine, focusOrigin, focusVersion, focusIntent, scrollLock, viewMode]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'auto' }}
      className="mkly-editor"
    />
  );
}
