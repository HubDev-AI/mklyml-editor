import type { SourceMapEntry } from '@milkly/mkly';
import type { FocusOrigin, FocusIntent } from './editor-store';

const SPECIAL_TYPES = new Set(['use', 'meta', 'theme', 'style']);

/**
 * Find the sourceMap entry whose sourceLine range contains the given blockLine.
 */
export function getBlockEntry(
  blockLine: number,
  sourceMap: SourceMapEntry[] | null,
): SourceMapEntry | null {
  if (!sourceMap) return null;
  for (const entry of sourceMap) {
    if (entry.sourceLine === blockLine) return entry;
  }
  // Fallback: find entry whose range contains blockLine
  for (const entry of sourceMap) {
    if (blockLine >= entry.sourceLine && blockLine <= entry.sourceEndLine) {
      return entry;
    }
  }
  return null;
}

/**
 * Resolve the correct activeBlockLine from a cursor position.
 * Walks backward through source lines to find the containing block delimiter.
 * Returns null for special pseudo-blocks (use, meta, theme, style).
 */
export function resolveBlockLine(
  cursorLine: number,
  source: string,
): { blockLine: number | null; blockType: string | null } {
  const lines = source.split('\n');
  for (let i = Math.min(cursorLine - 1, lines.length - 1); i >= 0; i--) {
    const trimmed = lines[i].trim();
    // Skip closing tags
    if (trimmed.startsWith('--- /')) continue;
    const match = trimmed.match(/^---\s+([\w]+(?:\/[\w]+)?)/);
    if (match) {
      const type = match[1];
      if (SPECIAL_TYPES.has(type)) {
        return { blockLine: null, blockType: null };
      }
      return { blockLine: i + 1, blockType: type };
    }
  }
  return { blockLine: null, blockType: null };
}

/**
 * Find the character offset in prettified HTML for a given block line.
 * Uses the `data-mkly-line="N"` attribute embedded in compiled HTML.
 */
export function findHtmlPositionForBlock(
  blockLine: number,
  htmlText: string,
): { from: number; to: number } | null {
  const searchStr = `data-mkly-line="${blockLine}"`;
  const idx = htmlText.indexOf(searchStr);
  if (idx === -1) return null;

  // Find the end of this block's HTML (next data-mkly-line or end of text)
  const nextIdx = htmlText.indexOf('data-mkly-line="', idx + searchStr.length);
  const to = nextIdx !== -1 ? nextIdx : htmlText.length;
  return { from: idx, to };
}

/**
 * Find the DOM element for a given block line in an iframe document.
 */
export function findBlockElement(
  blockLine: number,
  doc: Document,
): HTMLElement | null {
  return doc.querySelector(`[data-mkly-line="${blockLine}"]`);
}

/**
 * Centralized scroll decision: should a pane scroll to the focused block?
 */
export function shouldScrollToBlock(
  focusOrigin: FocusOrigin,
  selfOrigin: FocusOrigin,
  focusIntent: FocusIntent,
  scrollLock: boolean,
): boolean {
  // Never scroll for own focus events
  if (focusOrigin === selfOrigin) return false;
  // Only scroll on explicit navigation
  if (focusIntent !== 'navigate') return false;
  // Respect scroll lock
  if (scrollLock) return false;
  return true;
}
