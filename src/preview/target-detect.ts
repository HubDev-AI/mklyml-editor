/**
 * Detect the BEM target name from a clicked element within a block.
 * Walks up from the clicked element to the block root looking for `__target` classes.
 */
export function detectTarget(clickedEl: Element, blockRootEl: Element): string {
  const baseClass = [...blockRootEl.classList].find(c =>
    c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'),
  );
  if (!baseClass) return 'self';

  let el: Element | null = clickedEl;
  while (el && el !== blockRootEl) {
    const targetClass = [...el.classList].find(c =>
      c.startsWith(baseClass + '__'),
    );
    if (targetClass) {
      return targetClass.slice(baseClass.length + 2); // after "__"
    }
    el = el.parentElement;
  }
  return 'self';
}

/**
 * Extract block type from a block element's `data-mkly-id` attribute.
 * Format: "core/card:5" → "core/card"
 */
export function extractBlockType(blockEl: Element): string | null {
  const id = blockEl.getAttribute('data-mkly-id');
  if (!id) return null;
  return id.split(':')[0];
}
