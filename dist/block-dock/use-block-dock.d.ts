import { CompletionData, BlockDocs } from '../../../mkly/src/index.ts';
export interface BlockDockEntry {
    name: string;
    description: string;
    kit?: string;
    docs?: BlockDocs;
}
export declare function useBlockDock(completionData: CompletionData): {
    query: string;
    setQuery: (q: string) => void;
    filtered: BlockDockEntry[];
    selectedIndex: number;
    setSelectedIndex: import('react').Dispatch<import('react').SetStateAction<number>>;
    moveSelection: (direction: "up" | "down") => void;
    resetSearch: () => void;
    selectedBlock: BlockDockEntry;
};
