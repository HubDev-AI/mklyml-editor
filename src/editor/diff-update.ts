import type { ChangeSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { clearPendingScroll } from './safe-dispatch';

/**
 * Compute minimal ChangeSpec between two strings by finding the common
 * prefix and suffix. Returns null if strings are identical.
 */
export function computeMinimalChanges(
  oldStr: string,
  newStr: string,
): ChangeSpec | null {
  if (oldStr === newStr) return null;

  const minLen = Math.min(oldStr.length, newStr.length);
  let prefixLen = 0;
  while (prefixLen < minLen && oldStr[prefixLen] === newStr[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return {
    from: prefixLen,
    to: oldStr.length - suffixLen,
    insert: newStr.slice(prefixLen, newStr.length - suffixLen),
  };
}

/**
 * Apply an external value update to a CodeMirror EditorView using minimal
 * diff changes. Preserves scroll position when the editor is visible.
 *
 * Returns true if changes were applied, false if doc was already up to date.
 */
export function applyExternalUpdate(
  view: EditorView,
  newValue: string,
): boolean {
  const currentDoc = view.state.doc.toString();
  const change = computeMinimalChanges(currentDoc, newValue);
  if (!change) return false;

  clearPendingScroll(view);
  const isVisible = view.dom.offsetParent !== null;

  try {
    if (isVisible) {
      const scrollEffect = view.scrollSnapshot();
      view.dispatch({ changes: change, effects: scrollEffect });
    } else {
      view.dispatch({ changes: change });
    }
  } catch {
    clearPendingScroll(view);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newValue },
    });
  }

  return true;
}
