/**
 * Queries computed CSS styles for a block element identified by data-mkly-line
 * in a preview iframe document. Returns a map of property names to computed values.
 */

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

export function queryComputedStyles(doc: Document, line: number): Record<string, string> {
  const el = doc.querySelector(`[data-mkly-line="${line}"]`);
  if (!el || !(el instanceof HTMLElement)) return {};

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
