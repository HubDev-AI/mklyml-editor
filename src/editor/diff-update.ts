import type { ChangeSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * Compute minimal ChangeSpec between two strings by finding the common
 * prefix and suffix. Returns null if strings are identical.
 *
 * This avoids replacing the entire document when only a small portion changed,
 * which preserves CodeMirror's scroll position and word-wrap layout for
 * unchanged regions.
 */
export function computeMinimalChanges(
  oldStr: string,
  newStr: string,
): ChangeSpec | null {
  if (oldStr === newStr) return null;

  // Find common prefix length
  const minLen = Math.min(oldStr.length, newStr.length);
  let prefixLen = 0;
  while (prefixLen < minLen && oldStr[prefixLen] === newStr[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix length (don't overlap with prefix)
  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const from = prefixLen;
  const to = oldStr.length - suffixLen;
  const insert = newStr.slice(prefixLen, newStr.length - suffixLen);

  return { from, to, insert };
}

/**
 * Clear any stale pendingScrollTarget on a CodeMirror EditorView.
 *
 * CM6 stores a pendingScrollTarget when scrollIntoView or scrollSnapshot
 * is dispatched to a hidden editor. On the next dispatch(), CM6 tries to
 * map that target through the changeset. If the document shrank, the old
 * position is out of range and throws an unrecoverable RangeError — which
 * also leaves pendingScrollTarget intact, crashing ALL future dispatches.
 *
 * This is the only way to recover: clear the private property directly.
 */
function clearPendingScroll(view: EditorView): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (view as any).pendingScrollTarget = null;
}

/**
 * Apply an external value update to a CodeMirror EditorView using minimal
 * diff changes + scrollSnapshot for zero-jump updates.
 *
 * - Minimal diff: only the changed region is replaced, so CM6 naturally
 *   preserves cursor position and scroll for unchanged lines.
 * - scrollSnapshot: CM6's built-in scroll anchor, mapped through changes.
 *   Only used when the editor is visible (hidden editors can't scroll).
 * - No forced cursor move: CM6 maps the cursor through changes automatically.
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

  // Clear any stale scroll target from prior dispatches to a hidden editor
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
    // Full replacement fallback
    clearPendingScroll(view);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newValue },
    });
  }

  return true;
}
