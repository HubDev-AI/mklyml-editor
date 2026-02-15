export interface ScrollAnchor {
    line: number;
    offset: number;
    elementIndex: number;
    viewportRatio: number;
}
export declare function captureScrollAnchor(doc: Document): ScrollAnchor | null;
export declare function restoreScrollAnchor(doc: Document, anchor: ScrollAnchor): void;
