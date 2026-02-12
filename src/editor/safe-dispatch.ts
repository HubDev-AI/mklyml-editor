import type { TransactionSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * Clear CodeMirror's internal pendingScrollTarget.
 *
 * CM6 stores a pendingScrollTarget when scrollIntoView or scrollSnapshot
 * is dispatched to a hidden/unmeasurable editor. On the next dispatch(),
 * update() tries to map that target through the changeset — if the doc
 * shrank, the old position is out of range and throws RangeError.
 * Worse: the throw leaves pendingScrollTarget intact, crashing ALL future
 * dispatches permanently.
 */
function clearPendingScroll(view: EditorView): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (view as any).pendingScrollTarget = null;
}

/**
 * Safe wrapper around view.dispatch() that:
 * 1. Clears any stale pendingScrollTarget before dispatching
 * 2. Catches RangeError from position mapping and retries without effects
 * 3. Falls back to full doc replacement as last resort
 *
 * Use for any dispatch that changes the document or applies scroll effects.
 * Pure UI effects (theme reconfigure, highlight decorations) are generally
 * safe to dispatch directly since they don't involve position mapping.
 */
export function safeDispatch(view: EditorView, ...specs: TransactionSpec[]): void {
  clearPendingScroll(view);
  try {
    view.dispatch(...specs);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    // Strip scroll effects and retry with just the changes
    clearPendingScroll(view);
    const changesOnly = specs
      .filter((s) => s.changes != null)
      .map((s) => ({ changes: s.changes }));
    if (changesOnly.length > 0) {
      try {
        view.dispatch(...changesOnly);
      } catch {
        // Last resort: full doc replacement
        clearPendingScroll(view);
        const newContent = changesOnly
          .map((s) => {
            const c = s.changes;
            if (typeof c === 'object' && c !== null && 'insert' in c && typeof c.insert === 'string') {
              return c.insert;
            }
            return null;
          })
          .filter(Boolean)
          .join('');
        if (newContent) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: newContent },
          });
        }
      }
    }
  }
}

export { clearPendingScroll };
