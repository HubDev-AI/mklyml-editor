import { CompletionData } from '../../../mkly/src/index.ts';
interface MetaInspectorProps {
    properties: Record<string, string>;
    startLine: number;
    endLine: number;
    completionData: CompletionData;
}
export declare function MetaInspector({ properties, startLine, endLine, completionData }: MetaInspectorProps): import("react/jsx-runtime").JSX.Element;
export {};
