import { htmlToMkly, CORE_KIT } from '@milkly/mkly';
import { NEWSLETTER_KIT } from '@mkly-kits/newsletter';

export const MKLY_KITS = { core: CORE_KIT, newsletter: NEWSLETTER_KIT };

const SKIP_BLOCK_TYPES = new Set(['use', 'meta', 'theme', 'style']);

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
 * Find the line index of the first content block (non-meta/use/theme/style)
 * in the source. Returns source.length if no content block found.
 */
function firstContentBlockLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^---\s+([\w/]+)/);
    if (match && !trimmed.startsWith('--- /') && !SKIP_BLOCK_TYPES.has(match[1])) {
      return i;
    }
  }
  return lines.length;
}

/**
 * Replace whatever preamble the reverse conversion auto-generated with
 * the authoritative preamble from the current source. The Edit pane only
 * edits block content — meta/use/theme/style directives must be preserved.
 */
export function ensurePreamble(newSource: string, currentSource: string): string {
  const currentLines = currentSource.split('\n');
  const currentFirstBlock = firstContentBlockLine(currentLines);
  if (currentFirstBlock === 0) return newSource;

  // Trim trailing blank lines from preamble
  let preambleEnd = currentFirstBlock;
  while (preambleEnd > 0 && currentLines[preambleEnd - 1].trim() === '') preambleEnd--;
  const preamble = currentLines.slice(0, preambleEnd).join('\n');
  if (!preamble) return newSource;

  // Strip auto-generated preamble from new source
  const newLines = newSource.split('\n');
  const newFirstBlock = firstContentBlockLine(newLines);
  const body = newLines.slice(newFirstBlock).join('\n');

  return preamble + '\n\n' + body;
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
