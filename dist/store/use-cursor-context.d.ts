export interface CursorBlock {
    type: string;
    startLine: number;
    endLine: number;
    properties: Record<string, string>;
    isSpecial?: boolean;
    label?: string;
}
export declare function parseCursorBlock(source: string, cursorLine: number): CursorBlock | null;
export declare function useCursorContext(): CursorBlock | null;
