import { findBlockElement, shouldScrollToBlock } from '../store/selection-orchestrator';
import type { FocusOrigin, FocusIntent } from '../store/editor-store';
import { useEditorStore } from '../store/editor-store';
import { detectTarget, extractBlockType, findSourceLine, resolveInlineElement } from './target-detect';

export const ACTIVE_BLOCK_CSS = '[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}';
export const STYLE_SELECTED_ATTR = 'data-mkly-style-selected';

export const STYLE_PICK_CSS = [
  '[data-mkly-style-hover]{outline:2px dashed rgba(226,114,91,0.7)!important;outline-offset:2px;cursor:pointer!important}',
  `[${STYLE_SELECTED_ATTR}]{outline:2px solid rgba(226,114,91,0.95)!important;outline-offset:2px}`,
  'body.mkly-style-pick *{cursor:crosshair!important}',
  'body.mkly-style-pick [contenteditable="false"]{opacity:1!important}',
].join('\n');

function eventTargetToElement(target: EventTarget | null): Element | null {
  if (!target || typeof target !== 'object') return null;
  const candidate = target as { nodeType?: number; parentElement?: Element | null };
  if (candidate.nodeType === 1) return target as unknown as Element;
  return candidate.parentElement ?? null;
}

export function clearStylePickSelection(doc: Document): void {
  doc.querySelectorAll(`[${STYLE_SELECTED_ATTR}]`).forEach((el) =>
    el.removeAttribute(STYLE_SELECTED_ATTR));
}

function findStyleSelectionElement(doc: Document, selectionId: string): Element | null {
  const candidates = doc.querySelectorAll(`[${STYLE_SELECTED_ATTR}]`);
  for (const el of candidates) {
    if (el.getAttribute(STYLE_SELECTED_ATTR) === selectionId) return el;
  }
  return null;
}

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
    return null;
  }

  // BEM sub-element: link, img, body, etc.
  const sub = target.includes(':') ? target.split(':')[0] : target;
  const baseClass = `mkly-${blockType.replace('/', '-')}`;
  return blockEl.querySelector(`.${baseClass}__${sub}`);
}

function resolveStyleSelectionElement(
  clicked: Element,
  blockEl: HTMLElement,
  blockType: string,
  target: string,
  targetIndex?: number,
): Element | null {
  if (target === 'self' || target.startsWith('self:')) return blockEl;

  if (target.startsWith('>.')) {
    const className = target.slice(2);
    let el: Element | null = clicked;
    while (el && el !== blockEl) {
      if (el.classList.contains(className)) return el;
      el = el.parentElement;
    }
    return blockEl.classList.contains(className) ? blockEl : null;
  }

  if (target.startsWith('>')) {
    const tag = target.slice(1).toLowerCase();
    const resolved = resolveInlineElement(clicked, blockEl);
    if (resolved !== blockEl && resolved.tagName.toLowerCase() === tag) {
      return resolved;
    }
    if (targetIndex === undefined) return null;
    const all = blockEl.querySelectorAll(tag);
    return all[targetIndex] ?? null;
  }

  const baseClass = `mkly-${blockType.replace('/', '-')}`;
  const sub = target.includes(':') ? target.split(':')[0] : target;
  const targetClass = `${baseClass}__${sub}`;
  let el: Element | null = clicked;
  while (el && el !== blockEl) {
    if ([...el.classList].some((cls) => cls === targetClass || cls.startsWith(targetClass + '--'))) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function resolveActiveBlockElement(
  doc: Document,
  activeBlockLine: number,
  selectedLine?: number | null,
): HTMLElement | null {
  const direct = findBlockElement(activeBlockLine, doc);
  if (direct?.hasAttribute('data-mkly-id')) return direct;

  if (selectedLine !== undefined && selectedLine !== null) {
    const selected = doc.querySelector<HTMLElement>(`[data-mkly-line="${selectedLine}"]`);
    const selectedBlock = selected?.closest<HTMLElement>('[data-mkly-id][data-mkly-line]');
    if (selectedBlock) return selectedBlock;
  }

  const blockRoots = Array.from(doc.querySelectorAll<HTMLElement>('[data-mkly-id][data-mkly-line]'));
  if (blockRoots.length === 0) return null;

  let best: HTMLElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const root of blockRoots) {
    const line = Number(root.dataset.mklyLine);
    if (!Number.isFinite(line)) continue;
    const distance = Math.abs(line - activeBlockLine);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = root;
    }
  }
  return best;
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
  styleTarget?: { blockType: string; target: string; targetIndex?: number; selectionId?: string } | null,
  selectedLine?: number | null,
  activeSelectionId?: string | null,
) {
  doc.querySelectorAll('[data-mkly-active]').forEach((el) => el.removeAttribute('data-mkly-active'));
  const styleSelectionId = styleTarget?.selectionId ?? null;
  const markerSelectionId = styleSelectionId ?? activeSelectionId ?? null;
  if (activeBlockLine !== null) {
    const el = resolveActiveBlockElement(doc, activeBlockLine, selectedLine);
    if (el) {
      let highlightEl: Element = el;
      if (styleTarget) {
        const marked = styleTarget.selectionId
          ? findStyleSelectionElement(doc, styleTarget.selectionId)
          : null;
        const markedInBlock = marked && (marked === el || el.contains(marked)) ? marked : null;
        const sub = markedInBlock
          ?? findStyleTargetElement(el, styleTarget.blockType, styleTarget.target, styleTarget.targetIndex);
        if (sub && (sub === el || el.contains(sub))) highlightEl = sub;
      }
      if (highlightEl === el && selectedLine !== undefined && selectedLine !== null) {
        const lineEl = doc.querySelector(`[data-mkly-line="${selectedLine}"]`);
        if (lineEl && (lineEl === el || el.contains(lineEl))) {
          highlightEl = lineEl;
        }
      }
      highlightEl.setAttribute('data-mkly-active', '');
      if (markerSelectionId) {
        clearStylePickSelection(doc);
        highlightEl.setAttribute(STYLE_SELECTED_ATTR, markerSelectionId);
      } else {
        clearStylePickSelection(doc);
      }
      if (shouldScrollToBlock(focusOrigin, selfOrigin, focusIntent, scrollLock)) {
        highlightEl.scrollIntoView({ block: 'center' });
      }
    }
  } else {
    clearStylePickSelection(doc);
  }
}

/**
 * Bind mousedown on [data-mkly-line] elements to focus the block in the editor.
 * Returns a cleanup function.
 */
export function bindBlockClicks(doc: Document, origin: FocusOrigin): () => void {
  const handler = (e: MouseEvent) => {
    const target = eventTargetToElement(e.target);
    if (!target) return;

    const el = target.closest<HTMLElement>('[data-mkly-line]');
    if (el?.dataset.mklyLine) {
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
    const clicked = eventTargetToElement(e.target);
    if (!clicked) return;

    const block = clicked.closest<HTMLElement>('[data-mkly-id]');
    if (!block) return;
    const blockType = extractBlockType(block);
    if (!blockType) return;

    const target = detectTarget(clicked, block);
    let targetIndex: number | undefined;
    if (/^>[a-z]/.test(target)) {
      const tag = target.slice(1);
      const all = block.querySelectorAll(tag);
      for (let i = 0; i < all.length; i++) {
        if (all[i] === clicked || all[i].contains(clicked)) {
          targetIndex = i;
          break;
        }
      }
    }
    const hoverEl = resolveStyleSelectionElement(clicked, block, blockType, target, targetIndex) ?? block;

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
export function bindStylePickClick(
  doc: Document,
  iframeEl: HTMLIFrameElement,
  origin: FocusOrigin,
): () => void {
  const handler = (e: MouseEvent) => {
    const clicked = eventTargetToElement(e.target);
    if (!clicked) return;

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

    // Resolve the exact source line for the selected element. This must be
    // kept for both tag targets (">p") and class targets (">.s1") so style
    // edits never fall back to block-level when marker lookup races.
    let targetLine: number | undefined;
    let targetIndex: number | undefined;
    const selectedLine = findSourceLine(clicked, block);
    if (selectedLine) targetLine = selectedLine.lineNum;

    // For plain tag targets (">li", ">p"), also keep sibling index to
    // disambiguate repeated tags inside the same block.
    if (/^>[a-z]/.test(target)) {
      const tag = target.slice(1);
      const all = block.querySelectorAll(tag);
      for (let i = 0; i < all.length; i++) {
        if (all[i] === clicked || all[i].contains(clicked)) {
          targetIndex = i;
          break;
        }
      }
    }

    const selectedEl = resolveStyleSelectionElement(clicked, block, blockType, target, targetIndex);
    if (!selectedEl) return;

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
    const selectedLineAttr = selectedEl.getAttribute('data-mkly-line');
    const selectedLineValue = selectedLineAttr ? Number(selectedLineAttr) : Number.NaN;
    const selectedLineNumber = Number.isFinite(selectedLineValue) ? selectedLineValue : undefined;
    const focusLine = targetLine ?? selectedLineNumber ?? line;
    const store = useEditorStore.getState();
    store.focusBlock(focusLine, origin);
    const selectionId = useEditorStore.getState().selectionId;
    const targetTag = target.startsWith('>')
      ? selectedEl.tagName.toLowerCase()
      : undefined;
    store.openStylePopup({
      blockType,
      target,
      targetTag,
      label,
      sourceLine: line,
      targetLine,
      targetIndex,
      selectionId: selectionId ?? undefined,
      anchorRect,
    });
  };

  doc.addEventListener('mousedown', handler, true);
  return () => doc.removeEventListener('mousedown', handler, true);
}
