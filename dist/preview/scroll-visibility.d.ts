import { EditorView } from '@codemirror/view';
/**
 * Check if a CodeMirror line is currently visible in the scroll viewport.
 */
export declare function isCmLineVisible(view: EditorView, lineFrom: number): boolean;
/**
 * Scroll a CodeMirror editor to a line only if it's not currently visible.
 * Uses 'nearest' to minimize displacement.
 */
export declare function scrollCmIfNeeded(view: EditorView, lineFrom: number): void;
/**
 * Check if a DOM element is visible within its scroll container.
 */
export declare function isDomElementVisible(el: Element, container: Element): boolean;
/**
 * Scroll a DOM element into view within its container only if not visible.
 * Uses 'nearest' to minimize displacement.
 */
export declare function scrollDomIfNeeded(el: Element, container: Element): void;
