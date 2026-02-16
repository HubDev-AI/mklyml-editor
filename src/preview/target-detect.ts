/**
 * Detect the target name from a clicked element within a block.
 *
 * Priority:
 * 1. BEM `__target` class (e.g., mkly-core-card__img → "img")
 * 2. If clicked element IS the block root → "self"
 * 3. Tag-name fallback with nth-of-type for unique targeting.
 *    If there are multiple <p> elements, returns ">p:nth-of-type(N)"
 *    so the style applies only to the specific element clicked.
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
  // or ">tag" / ">tag:nth-of-type(N)" for specific elements.
  const tag = clickedEl.tagName.toLowerCase();
  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
    return 'self';
  }

  // Count siblings of the same tag type within the same parent.
  // If multiple exist, use :nth-of-type(N) for unique targeting.
  const parent = clickedEl.parentElement;
  if (parent) {
    let sameTagCount = 0;
    let position = 0;
    for (const child of parent.children) {
      if (child.tagName === clickedEl.tagName) {
        sameTagCount++;
        if (child === clickedEl) position = sameTagCount;
      }
    }
    if (sameTagCount > 1 && position > 0) {
      return `>${tag}:nth-of-type(${position})`;
    }
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
