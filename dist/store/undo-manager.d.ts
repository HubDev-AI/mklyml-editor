interface UndoManagerConfig {
    documentId: string;
    maxEntries: number;
    debounceMs: number;
    maxStorageBytes: number;
    persistHistory: boolean;
}
export interface UndoInfo {
    position: number;
    total: number;
    storageBytes: number;
}
export declare class UndoManager {
    private state;
    private config;
    private pending;
    private timer;
    private lastSource;
    onCheckpoint: (() => void) | null;
    constructor(documentId: string, initialSource: string, config?: Partial<Omit<UndoManagerConfig, 'documentId'>>);
    private load;
    private save;
    private trimHalf;
    private reconstructAt;
    private currentSource;
    private applyPatch;
    private createCheckpoint;
    recordChange(source: string): void;
    private commitPending;
    flush(): void;
    undo(): string | null;
    redo(): string | null;
    get canUndo(): boolean;
    get canRedo(): boolean;
    getInfo(): UndoInfo;
    clear(): void;
    destroy(): void;
    /** Sync lastSource when external code sets the source (undo/redo apply) */
    syncLastSource(source: string): void;
}
/** Static utilities for external access (e.g., parent app) */
export declare function clearDocumentHistory(documentId: string): void;
export declare function getDocumentHistoryInfo(documentId: string): UndoInfo | null;
export {};
