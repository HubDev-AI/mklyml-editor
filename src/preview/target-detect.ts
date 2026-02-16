/**
 * Detect the target name from a clicked element within a block.
 *
 * Priority:
 * 1. Style class annotation (e.g., class="s1" → ">.s1")
 * 2. BEM `__target` class (e.g., mkly-core-card__img → "img")
 * 3. If clicked element IS the block root → "self"
 * 4. Tag-name fallback → ">p", ">h2", etc.
 */
export function detectTarget(clickedEl: Element, blockRootEl: Element): string {
  if (clickedEl === blockRootEl) return 'self';

  // Check for style class annotation (injected by class-injection system)
  const styleClass = [...clickedEl.classList].find(c => /^s\d+$/.test(c));
  if (styleClass) return `>.${styleClass}`;

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
  // or ">tag" for specific elements (class will be injected on first style change).
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

/**
 * Generate a unique style class name (s1, s2, ...) that doesn't exist in the source.
 */
export function generateStyleClass(source: string): string {
  const existing = [...source.matchAll(/\{\.s(\d+)\}/g)];
  const maxNum = existing.length > 0
    ? Math.max(...existing.map(m => parseInt(m[1])))
    : 0;
  return `s${maxNum + 1}`;
}

/**
 * Inject a {.className} annotation onto a specific source line.
 * Returns the modified source, or null if the line couldn't be found.
 */
export function injectClassAnnotation(source: string, lineNum: number, className: string): string | null {
  const lines = source.split('\n');
  if (lineNum < 0 || lineNum >= lines.length) return null;

  const line = lines[lineNum];
  // Don't inject if line already has a class annotation
  if (/\{\.\w[\w-]*\}\s*$/.test(line)) return null;

  lines[lineNum] = line.trimEnd() + ` {.${className}}`;
  return lines.join('\n');
}
