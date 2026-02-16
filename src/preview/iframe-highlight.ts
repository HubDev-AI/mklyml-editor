import { findBlockElement, shouldScrollToBlock } from '../store/selection-orchestrator';
import type { FocusOrigin, FocusIntent } from '../store/editor-store';
import { useEditorStore } from '../store/editor-store';

export const ACTIVE_BLOCK_CSS = '[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}';

/**
 * Highlight the active block in an iframe and optionally scroll to it.
 * Shared between Edit and Preview panes.
 */
export function syncActiveBlock(
  doc: Document,
  activeBlockLine: number | null,
  focusOrigin: FocusOrigin,
  selfOrigin: FocusOrigin,
  focusIntent: FocusIntent,
  scrollLock: boolean,
) {
  doc.querySelectorAll('[data-mkly-active]').forEach((el) => el.removeAttribute('data-mkly-active'));
  if (activeBlockLine !== null) {
    const el = findBlockElement(activeBlockLine, doc);
    if (el) {
      el.setAttribute('data-mkly-active', '');
      if (shouldScrollToBlock(focusOrigin, selfOrigin, focusIntent, scrollLock)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}

/**
 * Bind mousedown on [data-mkly-line] elements to focus the block in the editor.
 * Returns a cleanup function.
 */
export function bindBlockClicks(doc: Document, origin: FocusOrigin): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    let el = target.closest<HTMLElement>('[data-mkly-line]');
    if (!el) {
      const blocks = doc.querySelectorAll<HTMLElement>('[data-mkly-line]');
      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom &&
            e.clientX >= rect.left && e.clientX <= rect.right) {
          el = block;
          break;
        }
      }
    }
    if (el) {
      const line = Number(el.dataset.mklyLine);
      useEditorStore.getState().focusBlock(line, origin);
    }
  };
  doc.body.addEventListener('mousedown', handler);
  return () => doc.body.removeEventListener('mousedown', handler);
}
