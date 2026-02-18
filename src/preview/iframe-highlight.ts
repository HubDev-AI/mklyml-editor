import { findBlockElement, shouldScrollToBlock } from '../store/selection-orchestrator';
import type { FocusOrigin, FocusIntent } from '../store/editor-store';
import { useEditorStore } from '../store/editor-store';
import { detectTarget, extractBlockType, findSourceLine, resolveInlineElement } from './target-detect';

export const ACTIVE_BLOCK_CSS = '[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}';

export const STYLE_PICK_CSS = [
  '[data-mkly-style-hover]{outline:2px dashed rgba(226,114,91,0.7)!important;outline-offset:2px;cursor:pointer!important}',
  'body.mkly-style-pick *{cursor:crosshair!important}',
].join('\n');

/**
 * Find a specific sub-element within a block for style pick highlighting.
 * `targetIndex` selects the Nth matching element for tag targets (e.g., 2nd <li>).
 */
function findStyleTargetElement(blockEl: Element, blockType: string, target: string, targetIndex?: number): Element | null {
  if (target === 'self' || target.startsWith('self:')) return blockEl;

  // Class target: >.s1
  if (target.startsWith('>.')) {
    return blockEl.querySelector(`.${target.slice(2)}`);
  }

  // Tag target: >li, >p — use targetIndex to find the exact element clicked
  if (target.startsWith('>')) {
    const tag = target.slice(1);
    if (targetIndex !== undefined) {
      const all = blockEl.querySelectorAll(tag);
      return all[targetIndex] ?? null;
    }
    return blockEl.querySelector(tag);
  }

  // BEM sub-element: link, img, body, etc.
  const sub = target.includes(':') ? target.split(':')[0] : target;
  const baseClass = `mkly-${blockType.replace('/', '-')}`;
  return blockEl.querySelector(`.${baseClass}__${sub}`);
}

/**
 * Highlight the active block in an iframe and optionally scroll to it.
 * When a style popup is open, highlights the specific sub-element instead of the block root.
 * Shared between Edit and Preview panes.
 */
export function syncActiveBlock(
  doc: Document,
  activeBlockLine: number | null,
  focusOrigin: FocusOrigin,
  selfOrigin: FocusOrigin,
  focusIntent: FocusIntent,
  scrollLock: boolean,
  styleTarget?: { blockType: string; target: string; targetIndex?: number } | null,
) {
  doc.querySelectorAll('[data-mkly-active]').forEach((el) => el.removeAttribute('data-mkly-active'));
  if (activeBlockLine !== null) {
    const el = findBlockElement(activeBlockLine, doc);
    if (el) {
      let highlightEl: Element = el;
      if (styleTarget) {
        const sub = findStyleTargetElement(el, styleTarget.blockType, styleTarget.target, styleTarget.targetIndex);
        if (sub) {
          highlightEl = sub;
        } else if (styleTarget.target !== 'self' && !styleTarget.target.startsWith('self:')) {
          return;
        }
      }
      highlightEl.setAttribute('data-mkly-active', '');
      if (shouldScrollToBlock(focusOrigin, selfOrigin, focusIntent, scrollLock)) {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const block = target.closest('[data-mkly-id]');
    if (!block) return;

    // Determine what to highlight — mirrors detectTarget() logic:
    // 1. BEM sub-element (walk up from target to block looking for __class)
    // 2. The target element itself if it's a meaningful tag (not div/section/etc.)
    // 3. The block root otherwise
    const baseClass = [...block.classList].find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'));
    let hoverEl: Element = block;
    let foundBEM = false;
    if (baseClass) {
      let el: Element | null = target;
      while (el && el !== block) {
        if ([...el.classList].some(c => c.startsWith(baseClass + '__'))) {
          hoverEl = el;
          foundBEM = true;
          break;
        }
        el = el.parentElement;
      }
    }
    // For non-BEM elements, resolve inline tags to block-level parent and highlight
    if (!foundBEM && target !== block) {
      const resolved = resolveInlineElement(target, block);
      if (resolved !== block) {
        const tag = resolved.tagName.toLowerCase();
        if (tag !== 'div' && tag !== 'section' && tag !== 'article' && tag !== 'main') {
          hoverEl = resolved;
        }
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
    const clicked = e.target as Element;

    // Find block root via data-mkly-id (only block roots have this attribute).
    // Sub-elements may have data-mkly-line but not data-mkly-id.
    const block = clicked.closest<HTMLElement>('[data-mkly-id]');
    if (!block) return;

    const blockType = extractBlockType(block);
    if (!blockType) return;

    e.preventDefault();
    e.stopPropagation();

    // Clear any hover outline before opening the popup
    doc.querySelectorAll('[data-mkly-style-hover]').forEach(el =>
      el.removeAttribute('data-mkly-style-hover'));

    // Detect which sub-element target was clicked (BEM __target class).
    // For elements without BEM classes (e.g. <p> inside core/html),
    // detectTarget returns the tag name as a fallback.
    const target = detectTarget(clicked, block);

    // For plain tag targets (">li", ">p"), find the source line so we can
    // inject a class annotation later (deferred to first style change).
    // Also compute targetIndex — which Nth sibling of that tag was clicked.
    let targetLine: number | undefined;
    let targetIndex: number | undefined;
    if (/^>[a-z]/.test(target)) {
      const sl = findSourceLine(clicked, block);
      if (sl) targetLine = sl.lineNum;
      const tag = target.slice(1);
      const all = block.querySelectorAll(tag);
      for (let i = 0; i < all.length; i++) {
        if (all[i] === clicked || all[i].contains(clicked)) {
          targetIndex = i;
          break;
        }
      }
    }

    // Label from BEM modifier class (e.g., mkly-core-card--hero → "hero")
    const baseClass = [...block.classList].find(c => c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'));
    let label: string | undefined;
    if (baseClass) {
      const modClass = [...block.classList].find(c => c.startsWith(baseClass + '--'));
      if (modClass) label = modClass.slice(baseClass.length + 2);
    }

    // Always position popup at the actual clicked element, not the block root.
    // This gives the user clear visual association with what they clicked.
    const elRect = clicked.getBoundingClientRect();
    const iframeRect = iframeEl.getBoundingClientRect();
    const anchorRect = {
      x: elRect.x + iframeRect.x,
      y: elRect.y + iframeRect.y,
      width: elRect.width,
      height: elRect.height,
    };

    const line = Number(block.dataset.mklyLine);
    const store = useEditorStore.getState();
    store.focusBlock(line, 'preview');
    store.openStylePopup({ blockType, target, label, sourceLine: line, targetLine, targetIndex, anchorRect });
  };

  doc.addEventListener('mousedown', handler, true);
  return () => doc.removeEventListener('mousedown', handler, true);
}
