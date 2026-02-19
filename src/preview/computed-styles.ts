/**
 * Queries computed CSS styles for a block element identified by data-mkly-line
 * in a preview iframe document. Returns a map of property names to computed values.
 *
 * When `styleTarget` is provided, queries the specific sub-element within the block
 * (e.g., the link, image, or Nth list item) instead of the block root.
 */
import { STYLE_SELECTED_ATTR } from './iframe-highlight';

const QUERIED_PROPS = [
  'color', 'backgroundColor',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textAlign',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'opacity', 'display',
] as const;

interface StyleTarget {
  blockType: string;
  target: string;
  targetIndex?: number;
  selectionId?: string;
}

export function queryComputedStyles(
  doc: Document,
  line: number,
  styleTarget?: StyleTarget | null,
  selectedLine?: number | null,
): Record<string, string> {
  const blockEl = doc.querySelector(`[data-mkly-line="${line}"]`);
  if (!blockEl || blockEl.nodeType !== 1) return {};

  let el: Element = blockEl;

  // If a style target is specified, find the sub-element to query
  if (styleTarget && styleTarget.target !== 'self' && !styleTarget.target.startsWith('self:')) {
    const sub = findSubElement(blockEl, styleTarget);
    if (!sub) return {};
    el = sub;
  } else if (selectedLine !== undefined && selectedLine !== null && selectedLine !== line) {
    const selectedEl = doc.querySelector(`[data-mkly-line="${selectedLine}"]`);
    if (selectedEl && (selectedEl === blockEl || blockEl.contains(selectedEl))) {
      el = selectedEl;
    }
  }

  const cs = doc.defaultView?.getComputedStyle(el);
  if (!cs) return {};

  const result: Record<string, string> = {};
  for (const prop of QUERIED_PROPS) {
    const val = cs.getPropertyValue(camelToKebab(prop));
    if (val) result[prop] = val;
  }

  // Collapse padding/margin/border into shorthand for display
  result['padding'] = collapseBox(result, 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft');
  result['margin'] = collapseBox(result, 'marginTop', 'marginRight', 'marginBottom', 'marginLeft');
  result['borderWidth'] = collapseBox(result, 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth');
  result['borderColor'] = result['borderTopColor'] ?? '';
  result['borderStyle'] = result['borderTopStyle'] ?? '';
  result['borderRadius'] = collapseBox(result, 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius');

  return result;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function collapseBox(r: Record<string, string>, top: string, right: string, bottom: string, left: string): string {
  const t = r[top] ?? '0px';
  const ri = r[right] ?? '0px';
  const b = r[bottom] ?? '0px';
  const l = r[left] ?? '0px';
  if (t === ri && ri === b && b === l) return t;
  if (t === b && ri === l) return `${t} ${ri}`;
  return `${t} ${ri} ${b} ${l}`;
}

function findSubElement(blockEl: Element, styleTarget: StyleTarget): Element | null {
  const { blockType, target, targetIndex, selectionId } = styleTarget;

  if (selectionId) {
    const selected = blockEl.ownerDocument.querySelectorAll(`[${STYLE_SELECTED_ATTR}]`);
    for (const el of selected) {
      if (el.getAttribute(STYLE_SELECTED_ATTR) === selectionId) return el;
    }
  }

  // Class target: >.s1
  if (target.startsWith('>.')) {
    return blockEl.querySelector(`.${target.slice(2)}`);
  }

  // Tag target: >li, >p — use targetIndex to find the exact one
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
