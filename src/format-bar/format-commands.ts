import type { EditorView } from '@codemirror/view';

type WrapFn = (view: EditorView) => boolean;

function wrapSelection(view: EditorView, prefix: string, suffix: string): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;

  const selected = view.state.sliceDoc(from, to);

  // If already wrapped, unwrap
  const before = view.state.sliceDoc(Math.max(0, from - prefix.length), from);
  const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + suffix.length));

  if (before === prefix && after === suffix) {
    view.dispatch({
      changes: [
        { from: from - prefix.length, to: from, insert: '' },
        { from: to, to: to + suffix.length, insert: '' },
      ],
      selection: { anchor: from - prefix.length, head: to - prefix.length },
    });
    return true;
  }

  // Wrap
  view.dispatch({
    changes: { from, to, insert: `${prefix}${selected}${suffix}` },
    selection: { anchor: from + prefix.length, head: to + prefix.length },
  });
  return true;
}

export const wrapBold: WrapFn = (view) => wrapSelection(view, '**', '**');
export const wrapItalic: WrapFn = (view) => wrapSelection(view, '*', '*');
export const wrapCode: WrapFn = (view) => wrapSelection(view, '`', '`');

export function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;

  const selected = view.state.sliceDoc(from, to);
  const replacement = `[${selected}](url)`;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
  });
  return true;
}

export function wrapInlineStyle(view: EditorView, styles: Record<string, string>): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;

  const selected = view.state.sliceDoc(from, to);
  const styleStr = Object.entries(styles)
    .map(([k, v]) => `@${k}:${v}`)
    .join(' ');

  const prefix = `{${styleStr}}`;
  const wrapped = `${prefix}${selected}{/}`;
  view.dispatch({
    changes: { from, to, insert: wrapped },
    selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length },
  });
  return true;
}

export function setTextColor(view: EditorView, color: string): boolean {
  return wrapInlineStyle(view, { color });
}

export function setFontSize(view: EditorView, size: string): boolean {
  return wrapInlineStyle(view, { fontSize: size });
}

export function setHighlightColor(view: EditorView, color: string): boolean {
  return wrapInlineStyle(view, { bgColor: color });
}
