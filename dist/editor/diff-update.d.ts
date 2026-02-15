import { ChangeSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
/**
 * Compute minimal ChangeSpec between two strings by finding the common
 * prefix and suffix. Returns null if strings are identical.
 */
export declare function computeMinimalChanges(oldStr: string, newStr: string): ChangeSpec | null;
/**
 * Apply an external value update to a CodeMirror EditorView using minimal
 * diff changes. Preserves scroll position when the editor is visible.
 *
 * Returns true if changes were applied, false if doc was already up to date.
 */
export declare function applyExternalUpdate(view: EditorView, newValue: string): boolean;
