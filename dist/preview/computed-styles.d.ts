/**
 * Queries computed CSS styles for a block element identified by data-mkly-line
 * in a preview iframe document. Returns a map of property names to computed values.
 */
export declare function queryComputedStyles(doc: Document, line: number): Record<string, string>;
