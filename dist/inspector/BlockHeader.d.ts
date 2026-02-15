import { CompletionData } from '../../../mkly/src/index.ts';
interface BlockHeaderProps {
    type: string;
    startLine: number;
    endLine: number;
    kitName?: string;
    completionData?: CompletionData;
}
export declare function BlockHeader({ type, startLine, endLine, kitName, completionData }: BlockHeaderProps): import("react/jsx-runtime").JSX.Element;
export {};
