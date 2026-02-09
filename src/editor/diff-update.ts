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
 * Apply an external value update to a CodeMirror EditorView using minimal
 * diff changes + scrollSnapshot for zero-jump updates.
 *
 * - Minimal diff: only the changed region is replaced, so CM6 naturally
 *   preserves cursor position and scroll for unchanged lines.
 * - scrollSnapshot: CM6's built-in scroll anchor, mapped through changes.
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

  // Capture scroll snapshot — CM6 maps it through the changes automatically
  const scrollEffect = view.scrollSnapshot();

  // Let CM6 map cursor through the change naturally (no forced selection).
  // The cursor stays in place if outside the changed region, or gets pushed
  // forward/backward if inside it — exactly what we want.
  view.dispatch({
    changes: change,
    effects: scrollEffect,
  });

  return true;
}
