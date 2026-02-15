import { FocusOrigin, FocusIntent } from '../store/editor-store';
export declare const ACTIVE_BLOCK_CSS = "[data-mkly-active]{outline:2px solid rgba(59,130,246,0.5);outline-offset:2px;transition:outline 0.15s}";
/**
 * Highlight the active block in an iframe and optionally scroll to it.
 * Shared between Edit and Preview panes.
 */
export declare function syncActiveBlock(doc: Document, activeBlockLine: number | null, focusOrigin: FocusOrigin, selfOrigin: FocusOrigin, focusIntent: FocusIntent, scrollLock: boolean): void;
/**
 * Bind mousedown on [data-mkly-line] elements to focus the block in the editor.
 * Returns a cleanup function.
 */
export declare function bindBlockClicks(doc: Document, origin: FocusOrigin): () => void;
