import { EditorView } from '@codemirror/view';
/**
 * Syncs an external value into a CodeMirror EditorView without
 * disturbing the user's cursor or scroll when they're actively editing.
 *
 * - Tracks "user is editing" via markUserEdit() calls
 * - Skips external updates while user is editing (prevents jumps/cursor loss)
 * - Re-syncs after editing settles (debounced cooldown)
 *
 * Returns:
 * - markUserEdit: call this from the CM updateListener on user-initiated docChanged
 * - isExternalRef: use to guard onChange from firing during external updates
 */
export declare function useExternalSync(viewRef: React.RefObject<EditorView | null>, value: string, cooldownMs?: number): {
    markUserEdit: () => void;
    isExternalRef: import('react').MutableRefObject<boolean>;
};
