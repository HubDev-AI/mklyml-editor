import type { SourceMapEntry } from '@mklyml/core';
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
 * Find the character range in prettified HTML for a given block line.
 * Locates the opening tag with `data-mkly-line="N"` and walks forward
 * to the matching closing tag so the entire element is highlighted.
 */
export function findHtmlPositionForBlock(
  blockLine: number,
  htmlText: string,
): { from: number; to: number } | null {
  const searchStr = `data-mkly-line="${blockLine}"`;
  const attrIdx = htmlText.indexOf(searchStr);
  if (attrIdx === -1) return null;

  // Walk back to find the `<` that opens this tag
  let from = attrIdx;
  while (from > 0 && htmlText[from] !== '<') from--;

  // Extract the tag name from the opening tag
  const tagMatch = htmlText.slice(from).match(/^<(\w+)/);
  if (!tagMatch) return { from, to: htmlText.length };

  const tagName = tagMatch[1];
  const closeTag = `</${tagName}>`;

  // Walk forward from after the opening tag, tracking depth to find the matching close
  let depth = 1;
  let pos = htmlText.indexOf('>', from) + 1;
  if (pos === 0) return { from, to: htmlText.length };

  // Check for self-closing tag
  if (htmlText[pos - 2] === '/') return { from, to: pos };

  const openPattern = new RegExp(`<${tagName}[\\s>]`, 'g');

  while (pos < htmlText.length && depth > 0) {
    const nextClose = htmlText.indexOf(closeTag, pos);
    if (nextClose === -1) break;

    // Count any same-tag opens between pos and nextClose
    openPattern.lastIndex = pos;
    let m: RegExpExecArray | null;
    while ((m = openPattern.exec(htmlText)) !== null && m.index < nextClose) {
      // Skip self-closing
      const endOfTag = htmlText.indexOf('>', m.index);
      if (endOfTag !== -1 && htmlText[endOfTag - 1] === '/') continue;
      depth++;
    }

    depth--;
    if (depth === 0) {
      return { from, to: nextClose + closeTag.length };
    }
    pos = nextClose + closeTag.length;
  }

  // Fallback: couldn't find matching close, extend to next block or end
  const nextIdx = htmlText.indexOf('data-mkly-line="', attrIdx + searchStr.length);
  const to = nextIdx !== -1 ? nextIdx : htmlText.length;
  return { from, to };
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
