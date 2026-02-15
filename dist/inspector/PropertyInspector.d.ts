import { CursorBlock } from '../store/use-cursor-context';
import { CompletionData } from '../../../mkly/src/index.ts';
interface PropertyInspectorProps {
    cursorBlock: CursorBlock | null;
    completionData: CompletionData;
}
export declare function PropertyInspector({ cursorBlock, completionData }: PropertyInspectorProps): import("react/jsx-runtime").JSX.Element;
export {};
