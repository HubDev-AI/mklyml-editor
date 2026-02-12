import { useEffect, useRef } from 'react';
import { EditorState, Compartment, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { mklyThemeDark } from '../editor/mkly-theme-dark';
import { mklyThemeLight } from '../editor/mkly-theme-light';
import { useEditorStore } from '../store/editor-store';
import { useExternalSync } from '../hooks/use-external-sync';
import { clearPendingScroll } from '../editor/safe-dispatch';
import { findHtmlPositionForBlock, shouldScrollToBlock } from '../store/selection-orchestrator';

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
}

const themeCompartment = new Compartment();
const wrapCompartment = new Compartment();

function findNearestMklyLine(text: string, pos: number): number | null {
  const before = text.slice(0, pos);
  const match = before.match(/data-mkly-line="(\d+)"/g);
  if (!match) return null;
  const last = match[match.length - 1];
  const numMatch = last.match(/data-mkly-line="(\d+)"/);
  return numMatch ? Number(numMatch[1]) : null;
}

export function HtmlSourceEditor({ value, onChange }: HtmlSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const theme = useEditorStore((s) => s.theme);
  const viewMode = useEditorStore((s) => s.viewMode);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const wordWrap = useEditorStore((s) => s.htmlWordWrap);
  const cursorDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastFocusVersionRef = useRef(-1);
  const hasBeenVisibleRef = useRef(false);

  onChangeRef.current = onChange;

  // External sync: skips updates while user is editing, re-syncs after cooldown
  const { markUserEdit, isExternalRef } = useExternalSync(viewRef, value);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        drawSelection(),
        history(),
        html(),
        htmlHighlightField,
        themeCompartment.of(mklyThemeDark),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalRef.current) {
            markUserEdit();
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet && !update.docChanged && !isExternalRef.current && update.view.hasFocus) {
            clearTimeout(cursorDebounceRef.current);
            cursorDebounceRef.current = setTimeout(() => {
              const pos = update.state.selection.main.head;
              const text = update.state.doc.toString();
              const line = findNearestMklyLine(text, pos);
              if (line !== null) {
                useEditorStore.getState().focusBlock(line, 'html');
              }
            }, 500);
          }
        }),
        wrapCompartment.of(EditorView.lineWrapping),
        EditorState.tabSize.of(2),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      clearTimeout(cursorDebounceRef.current);
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

  // React to activeBlockLine: ALWAYS highlight, CONDITIONAL scroll
  // Skip when hidden — dispatching scrollIntoView to a hidden CM6 instance
  // creates a pendingScrollTarget that crashes on the next document change.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || activeBlockLine === null) return;
    if (viewMode !== 'html') return;
    if (focusOrigin === 'html') return;
    if (focusVersion === lastFocusVersionRef.current) return;
    lastFocusVersionRef.current = focusVersion;

    requestAnimationFrame(() => {
      const v = viewRef.current;
      if (!v) return;

      const text = v.state.doc.toString();
      const pos = findHtmlPositionForBlock(activeBlockLine, text);
      if (!pos) return;

      isExternalRef.current = true;
      clearPendingScroll(v);

      v.dispatch({
        effects: setHtmlHighlightEffect.of({ from: pos.from, to: pos.to }),
      });

      if (shouldScrollToBlock(focusOrigin, 'html', focusIntent, scrollLock)) {
        v.dispatch({
          effects: EditorView.scrollIntoView(pos.from, { y: 'center' }),
        });
      }

      isExternalRef.current = false;
    });
    const timer = setTimeout(() => {
      clearPendingScroll(view);
      view.dispatch({ effects: setHtmlHighlightEffect.of(null) });
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeBlockLine, focusOrigin, focusVersion, focusIntent, scrollLock, viewMode]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'auto' }}
      className="mkly-editor"
    />
  );
}
