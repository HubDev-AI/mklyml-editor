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
 * If the target line is blank, scans backward to find the nearest content line.
 * Returns the modified source, or null if no suitable line was found.
 */
export function injectClassAnnotation(source: string, lineNum: number, className: string): string | null {
  const lines = source.split('\n');
  // lineNum is 1-based (from data-mkly-line), convert to 0-based array index
  const startIdx = lineNum - 1;
  if (startIdx < 0 || startIdx >= lines.length) return null;

  // Find the actual content line — scan backward if target is blank or a block header.
  let targetIdx = startIdx;
  while (targetIdx >= 0) {
    const line = lines[targetIdx].trim();
    // Skip blank lines and block headers (--- blockType)
    if (line === '' || line.startsWith('---')) {
      targetIdx--;
      continue;
    }
    // Skip property lines (key: value inside block header)
    if (/^\w[\w-]*:\s/.test(line) && targetIdx > 0 && lines[targetIdx - 1].trim().startsWith('---')) {
      targetIdx--;
      continue;
    }
    break;
  }
  if (targetIdx < 0) return null;

  const line = lines[targetIdx];
  // Don't inject if line already has a class annotation
  if (/\{\.\w[\w-]*\}\s*$/.test(line)) return null;

  lines[targetIdx] = line.trimEnd() + ` {.${className}}`;
  return lines.join('\n');
}

/**
 * Generate a unique block label (s1, s2, ...) that doesn't exist as a label in the source.
 */
export function generateBlockLabel(source: string): string {
  const existing = [...source.matchAll(/^---\s+[\w/]+:\s*s(\d+)/gm)];
  const maxNum = existing.length > 0
    ? Math.max(...existing.map(m => parseInt(m[1])))
    : 0;
  return `s${maxNum + 1}`;
}

/**
 * Inject a label onto a block header line.
 * Transforms "--- blockType" into "--- blockType: label".
 * Returns the modified source, or null if the line already has a label or is invalid.
 */
export function injectBlockLabel(source: string, blockLine: number, label: string): string | null {
  const lines = source.split('\n');
  // blockLine is 1-based (from data-mkly-line), convert to 0-based array index
  const idx = blockLine - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const line = lines[idx];
  // Match "--- blockType" without existing label
  const match = line.match(/^(---\s+[\w/]+)\s*$/);
  if (!match) return null; // already has a label or invalid format
  lines[idx] = `${match[1]}: ${label}`;
  return lines.join('\n');
}

/**
 * Find the nearest element with data-mkly-line, walking up from the clicked element.
 * Returns the line number and the element, or null if not found.
 */
export function findSourceLine(el: Element, stopAt: Element): { lineNum: number; el: Element } | null {
  let current: Element | null = el;
  while (current && current !== stopAt) {
    const attr = current.getAttribute('data-mkly-line');
    if (attr !== null) {
      return { lineNum: parseInt(attr, 10), el: current };
    }
    current = current.parentElement;
  }
  // Check the stop element itself
  const attr = stopAt.getAttribute('data-mkly-line');
  if (attr !== null) {
    return { lineNum: parseInt(attr, 10), el: stopAt };
  }
  return null;
}
