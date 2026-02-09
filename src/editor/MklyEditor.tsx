import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState, Compartment, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import { mklyLanguage } from '../mkly-lang';
import { mklyCompletionSource } from '../mkly-completions';
import { mklyThemeDark } from './mkly-theme-dark';
import { mklyThemeLight } from './mkly-theme-light';
import { wrapBold, wrapItalic, wrapCode, insertLink } from '../format-bar/format-commands';
import { FormatBar } from '../format-bar/FormatBar';
import { useEditorStore } from '../store/editor-store';
import { blockColorPlugin } from './block-color-plugin';
import { applyExternalUpdate } from './diff-update';
import { shouldScrollToBlock } from '../store/selection-orchestrator';
import type { CompletionData } from '@milkly/mkly';

interface MklyEditorProps {
  completionData: CompletionData;
}

const themeCompartment = new Compartment();
const wrapCompartment = new Compartment();

const setHighlightEffect = StateEffect.define<number | null>();
const setDropLineEffect = StateEffect.define<number | null>();

const highlightLineDeco = Decoration.line({ class: 'mkly-highlight-line' });
const dropLineDeco = Decoration.line({ class: 'mkly-drop-line' });

const highlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightEffect)) {
        if (e.value === null) return Decoration.none;
        const lineNum = Math.min(e.value, tr.state.doc.lines);
        if (lineNum < 1) return Decoration.none;
        const line = tr.state.doc.line(lineNum);
        return Decoration.set([highlightLineDeco.range(line.from)]);
      }
    }
    return decos.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const dropLineField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setDropLineEffect)) {
        if (e.value === null) return Decoration.none;
        const lineNum = Math.min(e.value, tr.state.doc.lines);
        if (lineNum < 1) return Decoration.none;
        const line = tr.state.doc.line(lineNum);
        return Decoration.set([dropLineDeco.range(line.from)]);
      }
    }
    return decos.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function MklyEditor({ completionData }: MklyEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  const source = useEditorStore((s) => s.source);
  const errors = useEditorStore((s) => s.errors);
  const theme = useEditorStore((s) => s.theme);
  const setSource = useEditorStore((s) => s.setSource);
  const setCursorLine = useEditorStore((s) => s.setCursorLine);
  const setBlockDockOpen = useEditorStore((s) => s.setBlockDockOpen);
  const activeBlockLine = useEditorStore((s) => s.activeBlockLine);
  const focusOrigin = useEditorStore((s) => s.focusOrigin);
  const focusVersion = useEditorStore((s) => s.focusVersion);
  const focusIntent = useEditorStore((s) => s.focusIntent);
  const scrollLock = useEditorStore((s) => s.scrollLock);
  const wordWrap = useEditorStore((s) => s.mklyWordWrap);

  const sourceRef = useRef(source);
  const errorsRef = useRef(errors);
  const setSourceRef = useRef(setSource);
  const isExternalRef = useRef(false);
  const lastFocusVersionRef = useRef(focusVersion);

  sourceRef.current = source;
  errorsRef.current = errors;
  setSourceRef.current = setSource;

  const mklyLinter = useCallback(() => {
    return linter((view) => {
      const currentErrors = errorsRef.current;
      const diagnostics: Diagnostic[] = [];

      for (const err of currentErrors) {
        const lineNum = Math.min(err.line, view.state.doc.lines);
        if (lineNum < 1) continue;
        const line = view.state.doc.line(lineNum);

        diagnostics.push({
          from: line.from,
          to: line.to,
          severity: err.severity === 'warning' ? 'warning' : 'error',
          message: err.message,
        });
      }

      return diagnostics;
    }, { delay: 300 });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: sourceRef.current,
      extensions: [
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        history(),
        mklyLanguage,
        themeCompartment.of(mklyThemeDark),
        autocompletion({
          override: [mklyCompletionSource(completionData)],
          activateOnTyping: true,
        }),
        highlightField,
        dropLineField,
        blockColorPlugin(completionData),
        mklyLinter(),
        keymap.of([
          { key: 'Mod-b', run: wrapBold },
          { key: 'Mod-i', run: wrapItalic },
          { key: 'Mod-k', run: insertLink },
          { key: 'Mod-e', run: wrapCode },
          { key: 'Mod-Shift-p', run: () => { setBlockDockOpen(true); return true; } },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (isExternalRef.current) return;
          if (update.docChanged) {
            setSourceRef.current(update.state.doc.toString());
          }
          // Only fire focusBlock when user actively moves cursor (not on doc changes or external updates)
          if (update.selectionSet && !update.docChanged && update.view.hasFocus) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            useEditorStore.getState().focusBlock(line.number, 'mkly');
          }
        }),
        wrapCompartment.of(EditorView.lineWrapping),
        EditorState.tabSize.of(2),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setEditorView(view);

    return () => {
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap theme via Compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(
        theme === 'dark' ? mklyThemeDark : mklyThemeLight,
      ),
    });
  }, [theme]);

  // Toggle word wrap via Compartment
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartment.reconfigure(
        wordWrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [wordWrap]);

  // Sync external source changes (from inspector, visual edit, block insertion, etc.)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    isExternalRef.current = true;
    applyExternalUpdate(view, source);
    isExternalRef.current = false;
  }, [source]);

  // React to activeBlockLine changes from OTHER tabs:
  // ALWAYS highlight, CONDITIONAL scroll (skip for own focus, edit-property, scrollLock)
  useEffect(() => {
    const view = viewRef.current;
    if (!view || activeBlockLine === null) return;
    // Skip if this is our own focus event
    if (focusOrigin === 'mkly') return;
    // Skip if we've already reacted to this focus version
    if (focusVersion === lastFocusVersionRef.current) return;
    lastFocusVersionRef.current = focusVersion;

    const lineNum = Math.min(activeBlockLine, view.state.doc.lines);
    if (lineNum < 1) return;

    // ALWAYS highlight
    view.dispatch({
      effects: setHighlightEffect.of(activeBlockLine),
    });

    // CONDITIONAL scroll via orchestrator
    if (shouldScrollToBlock(focusOrigin, 'mkly', focusIntent, scrollLock)) {
      const line = view.state.doc.line(lineNum);
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      });
    }

    const timer = setTimeout(() => {
      view.dispatch({ effects: setHighlightEffect.of(null) });
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeBlockLine, focusOrigin, focusVersion, focusIntent, scrollLock]);

  const dropLineRef = useRef<number | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-mkly-block')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const view = viewRef.current;
    if (!view) return;

    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return;
    const line = view.state.doc.lineAt(pos);

    if (dropLineRef.current !== line.number) {
      dropLineRef.current = line.number;
      view.dispatch({
        effects: setDropLineEffect.of(line.number),
      });
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    dropLineRef.current = null;
    viewRef.current?.dispatch({
      effects: setDropLineEffect.of(null),
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dropLineRef.current = null;
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({ effects: setDropLineEffect.of(null) });

    const blockName = e.dataTransfer.getData('application/x-mkly-block');
    if (!blockName) return;

    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return;

    const line = view.state.doc.lineAt(pos);
    const insertText = `\n--- ${blockName}\n`;
    view.dispatch({
      changes: { from: line.to, insert: insertText },
    });

    // After inserting "\n--- blockName\n" at line.to, the --- line is line.number + 1
    requestAnimationFrame(() => {
      const newView = viewRef.current;
      if (!newView) return;
      // Recalculate: find the inserted --- line
      const newLineNum = Math.min(line.number + 1, newView.state.doc.lines);
      useEditorStore.getState().focusBlock(newLineNum, 'block-dock');
    });
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="mkly-editor"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
      <FormatBar editorView={editorView} />
    </>
  );
}
