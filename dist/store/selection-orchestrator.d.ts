import { SourceMapEntry } from '../../../mkly/src/index.ts';
import { FocusOrigin, FocusIntent } from './editor-store';
/**
 * Find the sourceMap entry whose sourceLine range contains the given blockLine.
 */
export declare function getBlockEntry(blockLine: number, sourceMap: SourceMapEntry[] | null): SourceMapEntry | null;
/**
 * Resolve the correct activeBlockLine from a cursor position.
 * Walks backward through source lines to find the containing block delimiter.
 * Returns null for special pseudo-blocks (use, meta, theme, style).
 */
export declare function resolveBlockLine(cursorLine: number, source: string): {
    blockLine: number | null;
    blockType: string | null;
};
/**
 * Find the character range in prettified HTML for a given block line.
 * Locates the opening tag with `data-mkly-line="N"` and walks forward
 * to the matching closing tag so the entire element is highlighted.
 */
export declare function findHtmlPositionForBlock(blockLine: number, htmlText: string): {
    from: number;
    to: number;
} | null;
/**
 * Find the DOM element for a given block line in an iframe document.
 */
export declare function findBlockElement(blockLine: number, doc: Document): HTMLElement | null;
/**
 * Centralized scroll decision: should a pane scroll to the focused block?
 */
export declare function shouldScrollToBlock(focusOrigin: FocusOrigin, selfOrigin: FocusOrigin, focusIntent: FocusIntent, scrollLock: boolean): boolean;
