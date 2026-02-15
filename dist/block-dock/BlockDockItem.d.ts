import { BlockDockEntry } from './use-block-dock';
import { CompletionData } from '../../../mkly/src/index.ts';
interface BlockDockItemProps {
    block: BlockDockEntry;
    selected: boolean;
    helpOpen: boolean;
    completionData: CompletionData;
    onToggleHelp: () => void;
    onCloseHelp: () => void;
    onClick: () => void;
    onMouseEnter: () => void;
}
export declare function BlockDockItem({ block, selected, helpOpen, completionData, onToggleHelp, onCloseHelp, onClick, onMouseEnter }: BlockDockItemProps): import("react/jsx-runtime").JSX.Element;
export {};
