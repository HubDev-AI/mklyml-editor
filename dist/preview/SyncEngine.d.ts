export interface SyncResult {
    source?: string;
    error?: string;
}
export interface ReverseOptions {
    preservePreambleFrom?: string;
}
export declare class SyncEngine {
    private reverseTimer;
    reverseConvert(html: string, opts?: ReverseOptions): SyncResult;
    debouncedReverse(html: string, callback: (result: SyncResult) => void, debounceMs?: number, opts?: ReverseOptions): void;
    destroy(): void;
}
