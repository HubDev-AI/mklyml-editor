import { BlockDocs } from '../../../mkly/src/index.ts';
interface BlockHelpPopoverProps {
    docs: BlockDocs;
    blockName: string;
    kitName?: string;
    anchorEl: HTMLElement;
    onClose: () => void;
}
export declare function BlockHelpPopover({ docs, blockName, kitName, anchorEl, onClose }: BlockHelpPopoverProps): import('react').ReactPortal;
export {};
