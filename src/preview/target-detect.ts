/**
 * Detect the target name from a clicked element within a block.
 *
 * Priority:
 * 1. BEM `__target` class (e.g., mkly-core-card__img → "img")
 * 2. If clicked element IS the block root → "self"
 * 3. Tag-name fallback for elements without BEM classes (e.g., <p> → "p")
 *    This covers arbitrary content inside core/html and similar blocks.
 */
export function detectTarget(clickedEl: Element, blockRootEl: Element): string {
  if (clickedEl === blockRootEl) return 'self';

  const baseClass = [...blockRootEl.classList].find(c =>
    c.startsWith('mkly-') && !c.includes('__') && !c.includes('--'),
  );

  // Walk from clicked element up to block root, looking for BEM __target
  if (baseClass) {
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
  }

  // No BEM class found — return "self" for generic wrapper elements,
  // or ">tag" for specific elements (descendant tag selector).
  // The ">" prefix tells the style graph to emit a descendant CSS selector
  // (e.g. ".mkly-block p") instead of a BEM selector (".mkly-block__p").
  const tag = clickedEl.tagName.toLowerCase();
  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
    return 'self';
  }
  return `>${tag}`;
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
