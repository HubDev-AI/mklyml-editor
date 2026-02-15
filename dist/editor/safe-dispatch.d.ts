import { TransactionSpec } from '@codemirror/state';
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
declare function clearPendingScroll(view: EditorView): void;
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
export declare function safeDispatch(view: EditorView, ...specs: TransactionSpec[]): void;
export { clearPendingScroll };
