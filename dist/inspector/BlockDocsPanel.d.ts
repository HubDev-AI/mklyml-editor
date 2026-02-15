import { BlockDocs } from '../../../mkly/src/index.ts';
interface BlockDocsPanelProps {
    blockType: string;
    docs: BlockDocs;
    kitName?: string;
}
export declare function BlockDocsPanel({ blockType, docs, kitName }: BlockDocsPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
