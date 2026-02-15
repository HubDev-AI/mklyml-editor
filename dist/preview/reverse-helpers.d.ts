export declare const MKLY_KITS: {
    core: import('../../../mkly/src/index.ts').MklyKit;
    newsletter: import('../../../mkly/src/index.ts').MklyKit;
};
/**
 * Strip attributes injected by browser extensions (Grammarly, LanguageTool, etc.)
 * and editor-specific attributes before reverse-converting HTML to mkly.
 */
export declare function cleanHtmlForReverse(html: string): string;
/**
 * Reverse-convert HTML to mkly source using the standard kit config.
 */
export declare function reverseToMkly(html: string): string;
/**
 * Replace whatever preamble the reverse conversion auto-generated with
 * the authoritative preamble from the current source. The Edit pane only
 * edits block content — meta/use/theme/style directives must be preserved.
 */
export declare function ensurePreamble(newSource: string, currentSource: string): string;
/**
 * Find the source line number of the Nth content block.
 */
export declare function findLineForBlockIndex(source: string, blockIndex: number, blockClass?: string | null): number | null;
/**
 * Convert a CSS block class like "mkly-newsletter-intro" to a block type
 * like "newsletter/intro". Returns null if the class doesn't match.
 */
export declare function blockClassToType(blockClass: string): string | null;
/**
 * Find the block in new source that corresponds to a block at `originalLine`
 * with the given CSS class in the original source.
 *
 * Uses block type + proximity matching instead of fragile index counting.
 * This is more robust when the reverse compiler restructures the source
 * (e.g., losing wrapper blocks, reordering, or adding extra blocks).
 */
export declare function findBlockByOriginalLine(source: string, originalLine: number, blockClass: string | null): number | null;
