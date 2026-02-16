import { findBlockElement, shouldScrollToBlock } from '../store/selection-orchestrator';
import type { FocusOrigin, FocusIntent } from '../store/editor-store';
import { useEditorStore } from '../store/editor-store';
import { detectTarget, extractBlockType } from './target-detect';

export const ACTIVE_BLOCK_CSS = '[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}';

export const STYLE_PICK_CSS = [
  '[data-mkly-style-hover]{outline:2px dashed rgba(226,114,91,0.7)!important;outline-offset:2px;cursor:pointer!important}',
  'body.mkly-style-pick *{cursor:crosshair!important}',
].join('\n');

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

/**
 * Toggle the `mkly-style-pick` class on the iframe body.
 */
export function setStylePickClass(doc: Document, active: boolean): void {
  doc.body.classList.toggle('mkly-style-pick', active);
}

/**
 * Bind hover handlers for style pick mode — shows dashed outline on hovered elements.
 * Returns a cleanup function.
 */
export function bindStylePickHover(doc: Document): () => void {
  let lastHovered: Element | null = null;

  const over = (e: MouseEvent) => {
    const target = e.target as Element;
    const block = target.closest('[data-mkly-line]');
    if (!block) return;

    // Determine the closest meaningful sub-element or the block itself
    const baseClass = [...block.classList].find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'));
    let hoverEl: Element = block;
    if (baseClass) {
      let el: Element | null = target;
      while (el && el !== block) {
        if ([...el.classList].some(c => c.startsWith(baseClass + '__'))) {
          hoverEl = el;
          break;
        }
        el = el.parentElement;
      }
    }

    if (lastHovered && lastHovered !== hoverEl) {
      lastHovered.removeAttribute('data-mkly-style-hover');
    }
    hoverEl.setAttribute('data-mkly-style-hover', '');
    lastHovered = hoverEl;
  };

  const out = (e: MouseEvent) => {
    const related = e.relatedTarget as Element | null;
    if (lastHovered && (!related || !lastHovered.contains(related))) {
      lastHovered.removeAttribute('data-mkly-style-hover');
      lastHovered = null;
    }
  };

  doc.addEventListener('mouseover', over);
  doc.addEventListener('mouseout', out);
  return () => {
    doc.removeEventListener('mouseover', over);
    doc.removeEventListener('mouseout', out);
    if (lastHovered) lastHovered.removeAttribute('data-mkly-style-hover');
  };
}

/**
 * Bind click handler for style pick mode — identifies block + target and opens popup.
 * `iframeEl` is the iframe DOM element (for coordinate conversion).
 * Returns a cleanup function.
 */
export function bindStylePickClick(doc: Document, iframeEl: HTMLIFrameElement): () => void {
  const handler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as Element;
    const block = target.closest<HTMLElement>('[data-mkly-line]');
    if (!block) return;

    const blockType = extractBlockType(block);
    if (!blockType) return;

    const detectedTarget = detectTarget(target, block);

    // Get the label from the block's BEM modifier class (e.g., mkly-core-card--hero)
    const baseClass = [...block.classList].find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'));
    let label: string | undefined;
    if (baseClass) {
      const modClass = [...block.classList].find(c => c.startsWith(baseClass + '--'));
      if (modClass) {
        label = modClass.slice(baseClass.length + 2);
      }
    }

    // Convert iframe-relative coords to viewport coords
    const clickedEl = detectedTarget === 'self' ? block : (
      (() => {
        let el: Element | null = target;
        while (el && el !== block) {
          if (baseClass && [...el.classList].some(c => c.startsWith(baseClass + '__'))) return el;
          el = el.parentElement;
        }
        return block;
      })()
    );

    const elRect = clickedEl.getBoundingClientRect();
    const iframeRect = iframeEl.getBoundingClientRect();
    const anchorRect = {
      x: elRect.x + iframeRect.x,
      y: elRect.y + iframeRect.y,
      width: elRect.width,
      height: elRect.height,
    };

    // Also focus the block in the editor
    const line = Number(block.dataset.mklyLine);
    const store = useEditorStore.getState();
    store.focusBlock(line, 'preview');
    store.openStylePopup({ blockType, target: detectedTarget, label, anchorRect });
  };

  doc.addEventListener('mousedown', handler, true);
  return () => doc.removeEventListener('mousedown', handler, true);
}
