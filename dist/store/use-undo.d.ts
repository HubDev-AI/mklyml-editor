export interface UndoInitOptions {
    persistHistory?: boolean;
}
export declare function useUndoInit(documentId: string, options?: UndoInitOptions): void;
