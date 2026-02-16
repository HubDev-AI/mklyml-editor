import { htmlToMkly, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';

export const MKLY_KITS = { core: CORE_KIT, newsletter: NEWSLETTER_KIT };

const SKIP_BLOCK_TYPES = new Set(['use', 'meta', 'theme', 'preset', 'style']);

/**
 * Strip attributes injected by browser extensions (Grammarly, LanguageTool, etc.)
 * and editor-specific attributes before reverse-converting HTML to mkly.
 */
export function cleanHtmlForReverse(html: string): string {
  return html
    .replace(/\s+contenteditable="(true|false)"/g, '')
    .replace(/\s+data-mkly-(?!styles)[\w-]+(?:="[^"]*")?/g, '')
    .replace(/\s+data-gramm(?:_\w+)?(?:="[^"]*")?/g, '')
    .replace(/\s+data-lt-[\w-]+(?:="[^"]*")?/g, '')
    .replace(/\s+data-qb-[\w-]+(?:="[^"]*")?/g, '')
    .replace(/\s+data-lpop-[\w-]+(?:="[^"]*")?/g, '')
    .replace(/\s+spellcheck="false"/g, '');
}

/**
 * Reverse-convert HTML to mkly source using the standard kit config.
 */
export function reverseToMkly(html: string): string {
  return htmlToMkly(cleanHtmlForReverse(html), { kits: MKLY_KITS });
}

/**
 * Find the source line number of the Nth content block.
 */
export function findLineForBlockIndex(
  source: string,
  blockIndex: number,
  blockClass?: string | null,
): number | null {
  const lines = source.split('\n');
  let blockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^---\s+([\w/]+)/);
    if (match && !trimmed.startsWith('--- /') && !SKIP_BLOCK_TYPES.has(match[1])) {
      if (blockCount === blockIndex) {
        return i + 1;
      }
      blockCount++;
    }
  }

  // Fallback: match by block type from CSS class
  if (blockClass) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const match = trimmed.match(/^---\s+([\w/]+)/);
      if (match && !trimmed.startsWith('--- /') && !SKIP_BLOCK_TYPES.has(match[1])) {
        const expectedClass = `mkly-${match[1].replace('/', '-')}`;
        if (expectedClass === blockClass) {
          return i + 1;
        }
      }
    }
  }

  return null;
}

/**
 * Convert a CSS block class like "mkly-newsletter-intro" to a block type
 * like "newsletter/intro". Returns null if the class doesn't match.
 */
export function blockClassToType(blockClass: string): string | null {
  if (!blockClass.startsWith('mkly-')) return null;
  const stripped = blockClass.slice(5); // remove "mkly-"
  // The class uses dashes: "core-header" → "core/header", "newsletter-intro" → "newsletter/intro"
  // But single-segment types like "core-text" → "core/text"
  // Kit names: core, newsletter — the first segment before the first dash is the kit
  const dashIdx = stripped.indexOf('-');
  if (dashIdx === -1) return stripped;
  return stripped.slice(0, dashIdx) + '/' + stripped.slice(dashIdx + 1);
}

/**
 * Find the block in new source that corresponds to a block at `originalLine`
 * with the given CSS class in the original source.
 *
 * Uses block type + proximity matching instead of fragile index counting.
 * This is more robust when the reverse compiler restructures the source
 * (e.g., losing wrapper blocks, reordering, or adding extra blocks).
 */
export function findBlockByOriginalLine(
  source: string,
  originalLine: number,
  blockClass: string | null,
): number | null {
  if (originalLine < 1) return null;
  const lines = source.split('\n');
  const targetType = blockClass ? blockClassToType(blockClass) : null;

  // Collect all content block positions + types
  const blocks: Array<{ line: number; type: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^---\s+([\w/]+)/);
    if (match && !trimmed.startsWith('--- /') && !SKIP_BLOCK_TYPES.has(match[1])) {
      blocks.push({ line: i + 1, type: match[1] });
    }
  }

  if (blocks.length === 0) return null;

  // Strategy 1: Find same block type closest to original line
  if (targetType) {
    let bestLine: number | null = null;
    let bestDistance = Infinity;
    for (const b of blocks) {
      if (b.type === targetType) {
        const distance = Math.abs(b.line - originalLine);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestLine = b.line;
        }
      }
    }
    if (bestLine !== null) return bestLine;
  }

  // Strategy 2: Fall back to closest content block by line proximity
  let bestLine: number | null = null;
  let bestDistance = Infinity;
  for (const b of blocks) {
    const distance = Math.abs(b.line - originalLine);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLine = b.line;
    }
  }
  return bestLine;
}
