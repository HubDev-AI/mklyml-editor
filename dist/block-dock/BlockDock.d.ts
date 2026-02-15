import { CompletionData } from '../../../mkly/src/index.ts';
interface BlockDockProps {
    completionData: CompletionData;
    onInsert: (blockName: string) => void;
}
export declare function BlockDock({ completionData, onInsert }: BlockDockProps): import('react').ReactPortal | null;
export {};
