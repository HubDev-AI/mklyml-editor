import { StyleGraph } from '../../../mkly/src/index.ts';
/**
 * Property regex: matches mkly property lines like `key: value`.
 */
export declare const PROPERTY_RE: RegExp;
export declare const PROPERTY_KEY_RE: RegExp;
export interface PropertyChangeResult {
    newSource: string;
}
/**
 * Apply a non-style property change to a block in the source.
 * Handles block properties like title, url, level, etc.
 */
export declare function applyPropertyChange(source: string, blockStartLine: number, blockEndLine: number, key: string, value: string): PropertyChangeResult;
/**
 * Apply a style change via the StyleGraph.
 * Mutates the StyleGraph, serializes it, and patches the --- style block in the source.
 * Auto-inserts a --- style block if none exists.
 */
export declare function applyStyleChange(source: string, styleGraph: StyleGraph | null, blockType: string, target: string, prop: string, value: string, label?: string): PropertyChangeResult & {
    newGraph: StyleGraph;
    lineDelta: number;
};
/**
 * Parse just the user-layer StyleGraph from the source text.
 * Useful for reading current style state without a full compile.
 */
export declare function parseSourceStyleGraph(source: string): StyleGraph;
