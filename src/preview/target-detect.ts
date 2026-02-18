/** HTML tags considered inline — clicking these resolves to their block-level parent. */
export const INLINE_TAGS = new Set([
  'strong', 'em', 'a', 'span', 'code', 'sub', 'sup',
  'mark', 'small', 'b', 'i', 'u', 'abbr', 'del', 'ins', 'br',
]);

/**
 * Walk up from an inline element to the nearest block-level ancestor
 * within the given root. Returns the element unchanged if it's not inline.
 */
export function resolveInlineElement(el: Element, root: Element): Element {
  let current = el;
  while (current !== root && INLINE_TAGS.has(current.tagName.toLowerCase())) {
    if (current.parentElement) current = current.parentElement;
    else break;
  }
  return current;
}

/**
 * Detect the target name from a clicked element within a block.
 *
 * Priority:
 * 1. Style class annotation on clicked element (e.g., class="s1" → ">.s1")
 * 2. BEM `__target` class (e.g., mkly-core-card__img → "img") — walks up from clicked
 * 3. Resolve inline elements (strong, em, a, span, etc.) to block-level parent
 * 4. Style class annotation on resolved parent (e.g., <em> inside <li class="s1">)
 * 5. Tag-name fallback → ">p", ">h2", etc.
 */
export function detectTarget(clickedEl: Element, blockRootEl: Element): string {
  if (clickedEl === blockRootEl) return 'self';

  // Check for style class annotation on the clicked element itself
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

  // No BEM/class found — resolve inline elements to block-level parent
  const resolved = resolveInlineElement(clickedEl, blockRootEl);
  if (resolved === blockRootEl) return 'self';

  // Check for style class on the resolved parent (e.g., <em> inside <li class="s1">)
  const resolvedStyleClass = [...resolved.classList].find(c => /^s\d+$/.test(c));
  if (resolvedStyleClass) return `>.${resolvedStyleClass}`;

  // Tag-name fallback — "self" for generic wrappers, ">tag" for content elements
  const tag = resolved.tagName.toLowerCase();
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
  const classNums = [...source.matchAll(/\{\.s(\d+)\}/g)].map(m => parseInt(m[1], 10));
  const labelNums = [...source.matchAll(/^---\s+(?!\/)[^\s:"]+:\s*s(\d+)/gm)].map(m => parseInt(m[1], 10));
  const nums = [...classNums, ...labelNums];
  const maxNum = nums.length > 0
    ? Math.max(...nums)
    : 0;
  return `s${maxNum + 1}`;
}

/**
 * Inject a {.className} annotation onto a specific source line.
 * Resolves the nearest content line within the selected block only.
 * Returns the modified source, or null if no suitable line was found.
 */
interface BlockRange {
  start: number; // inclusive, 0-based
  end: number; // exclusive, 0-based
}

const PROPERTY_LINE_RE = /^[\w./:+-]+:\s/;
const OPEN_BLOCK_RE = /^---\s+(?!\/)/;

function resolveBlockRange(lines: string[], lineIdx: number, blockLine?: number): BlockRange | null {
  let start = -1;
  const explicit = blockLine !== undefined ? blockLine - 1 : -1;
  if (explicit >= 0 && explicit < lines.length && OPEN_BLOCK_RE.test(lines[explicit].trim())) {
    start = explicit;
  } else {
    for (let i = Math.min(lineIdx, lines.length - 1); i >= 0; i--) {
      if (OPEN_BLOCK_RE.test(lines[i].trim())) {
        start = i;
        break;
      }
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('---')) {
      end = i;
      break;
    }
  }

  return { start, end };
}

function firstContentLine(lines: string[], range: BlockRange): number {
  let i = range.start + 1;
  // Skip header properties (immediately after block header).
  while (i < range.end) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('---')) break;
    if (PROPERTY_LINE_RE.test(trimmed)) {
      i++;
      continue;
    }
    break;
  }
  // Skip blank spacer lines before actual content.
  while (i < range.end && lines[i].trim() === '') i++;
  return i;
}

function findNearestLine(
  lines: string[],
  range: BlockRange,
  preferredIdx: number,
  isCandidate: (line: string) => boolean,
): number | null {
  const min = firstContentLine(lines, range);
  const max = range.end - 1;
  if (min > max) return null;

  const ref = Math.min(Math.max(preferredIdx, min), max);
  if (isCandidate(lines[ref])) return ref;

  for (let dist = 1; ref - dist >= min || ref + dist <= max; dist++) {
    const up = ref - dist;
    if (up >= min && isCandidate(lines[up])) return up;
    const down = ref + dist;
    if (down <= max && isCandidate(lines[down])) return down;
  }
  return null;
}

export function injectClassAnnotation(source: string, lineNum: number, className: string, blockLine?: number): string | null {
  const lines = source.split('\n');
  // lineNum is 1-based (from data-mkly-line), convert to 0-based array index
  const startIdx = lineNum - 1;
  if (startIdx < 0 || startIdx >= lines.length) return null;

  const range = resolveBlockRange(lines, startIdx, blockLine);
  if (!range) return null;

  const targetIdx = findNearestLine(
    lines,
    range,
    startIdx,
    (line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('---');
    },
  );
  if (targetIdx === null) return null;

  const line = lines[targetIdx];
  // Don't inject if line already has a class annotation
  if (/\{\.\w[\w-]*\}\s*$/.test(line)) return null;

  lines[targetIdx] = line.trimEnd() + ` {.${className}}`;
  return lines.join('\n');
}

/**
 * Inject a class="className" directly into an HTML tag on a specific source line.
 * Used for verbatim blocks (core/html) where {.sN} annotations are literal text.
 * Returns the modified source, or null if already present or no tag found.
 */
export function injectHtmlClassAttribute(source: string, lineNum: number, className: string, blockLine?: number): string | null {
  const lines = source.split('\n');
  const startIdx = lineNum - 1;
  if (startIdx < 0 || startIdx >= lines.length) return null;

  const range = resolveBlockRange(lines, startIdx, blockLine);
  if (!range) return null;
  const targetIdx = findNearestLine(
    lines,
    range,
    startIdx,
    (line) => /^\s*<(?!\/)\w+/.test(line),
  );
  if (targetIdx === null) return null;

  const line = lines[targetIdx];

  // Already has this class?
  if (new RegExp(`class="[^"]*\\b${className}\\b`).test(line)) return null;

  // Has existing class attribute — append
  if (/class="[^"]*"/.test(line)) {
    lines[targetIdx] = line.replace(/class="([^"]*)"/, `class="$1 ${className}"`);
    return lines.join('\n');
  }

  // No class attr — add after tag name
  const tagMatch = line.match(/^(\s*<\w+)/);
  if (!tagMatch) return null;
  lines[targetIdx] = line.replace(/^(\s*<\w+)/, `$1 class="${className}"`);
  return lines.join('\n');
}

/**
 * Generate a unique block label (s1, s2, ...) that doesn't exist as a label in the source.
 */
export function generateBlockLabel(source: string): string {
  const labelNums = [...source.matchAll(/^---\s+(?!\/)[^\s:"]+:\s*s(\d+)/gm)].map(m => parseInt(m[1], 10));
  const classNums = [...source.matchAll(/\{\.s(\d+)\}/g)].map(m => parseInt(m[1], 10));
  const nums = [...labelNums, ...classNums];
  const maxNum = nums.length > 0
    ? Math.max(...nums)
    : 0;
  return `s${maxNum + 1}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find a block header line by block type + label in source.
 * Returns 1-based line number, or null if not found.
 */
export function findBlockLineByTypeAndLabel(source: string, blockType: string, label: string): number | null {
  const lines = source.split('\n');
  const typeRe = escapeRegex(blockType);
  const labelRe = escapeRegex(label);
  const re = new RegExp(`^---\\s+${typeRe}:\\s*${labelRe}(?:\\s+"[^"]*")?\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i].trim())) return i + 1;
  }
  return null;
}

interface BlockHeaderInfo {
  line: number; // 1-based
  type: string;
  label?: string;
}

const BLOCK_HEADER_RE = /^---\s+((?!\/)[^\s:"]+)(?::\s*([^"]+?))?(?:\s+"[^"]*")?\s*$/;

function parseBlockHeaders(source: string): BlockHeaderInfo[] {
  const lines = source.split('\n');
  const headers: BlockHeaderInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(BLOCK_HEADER_RE);
    if (!m) continue;
    headers.push({
      line: i + 1,
      type: m[1],
      label: m[2]?.trim() || undefined,
    });
  }
  return headers;
}

/**
 * Get the 0-based occurrence index of a block (same type + same label state)
 * at a given header line.
 */
export function findBlockOccurrenceAtLine(
  source: string,
  blockType: string,
  line: number,
  label?: string,
): number | null {
  const headers = parseBlockHeaders(source).filter(h =>
    h.type === blockType && (h.label ?? undefined) === (label ?? undefined),
  );
  const idx = headers.findIndex(h => h.line === line);
  return idx === -1 ? null : idx;
}

/**
 * Resolve block header line by block type + occurrence index (+ label state).
 */
export function findBlockLineByTypeAndOccurrence(
  source: string,
  blockType: string,
  occurrence: number,
  label?: string,
): number | null {
  if (occurrence < 0) return null;
  const headers = parseBlockHeaders(source).filter(h =>
    h.type === blockType && (h.label ?? undefined) === (label ?? undefined),
  );
  return headers[occurrence]?.line ?? null;
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
  // Match "--- blockType" without existing label, optionally preserving quoted block name
  const match = line.match(/^(---\s+(?!\/)[^\s:"]+)(\s+"[^"]*")?\s*$/);
  if (!match) return null; // already has a label or invalid format
  lines[idx] = `${match[1]}: ${label}${match[2] ?? ''}`;
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
