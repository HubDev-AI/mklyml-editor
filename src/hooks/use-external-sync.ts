import { useEffect, useRef, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { applyExternalUpdate } from '../editor/diff-update';

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
export function useExternalSync(
  viewRef: React.RefObject<EditorView | null>,
  value: string,
  cooldownMs = 800,
) {
  const isExternalRef = useRef(false);
  const userEditingRef = useRef(false);
  const editTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingValueRef = useRef<string | null>(null);

  const applyPending = useCallback(() => {
    const view = viewRef.current;
    if (!view || pendingValueRef.current === null) return;
    if (view.hasFocus) return;
    isExternalRef.current = true;
    applyExternalUpdate(view, pendingValueRef.current);
    isExternalRef.current = false;
    pendingValueRef.current = null;
  }, [viewRef]);

  const markUserEdit = useCallback(() => {
    userEditingRef.current = true;
    clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => {
      userEditingRef.current = false;
      applyPending();
    }, cooldownMs);
  }, [cooldownMs, applyPending]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (userEditingRef.current || view.hasFocus) {
      // User is editing or currently focused in this editor —
      // stash external changes and apply after focus leaves.
      pendingValueRef.current = value;
      return;
    }

    isExternalRef.current = true;
    applyExternalUpdate(view, value);
    isExternalRef.current = false;
  }, [value, viewRef]);

  // Cleanup
  useEffect(() => {
    return () => clearTimeout(editTimerRef.current);
  }, []);

  const flushPending = useCallback(() => {
    userEditingRef.current = false;
    applyPending();
  }, [applyPending]);

  return { markUserEdit, isExternalRef, flushPending };
}
